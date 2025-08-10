# app.py
import sqlite3
from flask import Flask, render_template, jsonify, request, g, send_file
import pandas as pd
import io
import requests
import json
import re
from werkzeug.utils import secure_filename

app = Flask(__name__)
DATABASE = 'database.db'
ALLOWED_EXTENSIONS = {'xlsx', 'xls'}

OLLAMA_SERVER_URL = 'http://127.0.0.1:11434'
OLLAMA_MODEL_NAME = 'gemma3n:e2b'

def get_db():
    """Открывает новое соединение с БД для каждого запроса, если его еще нет."""
    db = getattr(g, '_database', None)
    if db is None:
        db = g._database = sqlite3.connect(DATABASE)
        db.row_factory = sqlite3.Row
    return db

@app.teardown_appcontext
def close_connection(exception):
    """Закрывает соединение с БД в конце запроса."""
    db = getattr(g, '_database', None)
    if db is not None:
        db.close()

# --- ОСНОВНОЙ МАРШРУТ ДЛЯ ОТОБРАЖЕНИЯ СТРАНИЦЫ ---
@app.route('/')
def index():
    """Рендерит основной HTML-шаблон."""
    return render_template('index.html')

# --- API ЭНДПОИНТЫ (для взаимодействия с фронтендом) ---

@app.route('/api/schema')
def get_schema():
    """Возвращает структуру БД: список таблиц и представлений."""
    db = get_db()
    cursor = db.cursor()
    
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")
    tables = [row['name'] for row in cursor.fetchall()]
    
    cursor.execute("SELECT name FROM sqlite_master WHERE type='view'")
    views = [row['name'] for row in cursor.fetchall()]
    
    return jsonify({'tables': tables, 'views': views})

@app.route('/api/data/<name>')
def get_data(name):
    """Возвращает все данные из указанной таблицы или представления."""
    db = get_db()
    cursor = db.cursor()
    
    cursor.execute("SELECT name FROM sqlite_master WHERE (type='table' OR type='view') AND name=?", (name,))
    if cursor.fetchone() is None:
        return jsonify({"error": "Table or view not found"}), 404

    query = f"SELECT * FROM {name}"
    cursor.execute(query)
    data = [dict(row) for row in cursor.fetchall()]
    return jsonify(data)

@app.route('/api/table_info/<table_name>')
def get_table_info(table_name):
    """
    Возвращает информацию о столбцах таблицы и их "обязательности" (NOT NULL).
    """
    db = get_db()
    cursor = db.cursor()

    cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name=?", (table_name,))
    if cursor.fetchone() is None:
        return jsonify({"error": "Table not found"}), 404
    
    cursor.execute(f"PRAGMA table_info({table_name})")
    columns = [dict(row) for row in cursor.fetchall()]
    return jsonify(columns)

@app.route('/api/insert/<table_name>', methods=['POST'])
def add_row(table_name):
    """Добавляет новую запись в указанную таблицу."""
    try:
        data = request.get_json()
        db = get_db()
        cursor = db.cursor()

        cursor.execute(f"PRAGMA table_info({table_name})")
        columns_info = {row['name']: row for row in cursor.fetchall()}
        
        insertable_columns = [col for col in columns_info if not columns_info[col]['pk']]
        
        for col_name in insertable_columns:
            col_info = columns_info[col_name]
            if col_info['notnull'] == 1 and not data.get(col_name):
                return jsonify({'status': 'error', 'message': f"Поле '{col_name}' является обязательным"}), 400

        values = []
        for col_name in insertable_columns:
            value = data.get(col_name)
            if value == '':
                value = None
            values.append(value)

        columns_str = ', '.join(insertable_columns)
        placeholders = ', '.join(['?' for _ in insertable_columns])
        
        query = f"INSERT INTO {table_name} ({columns_str}) VALUES ({placeholders})"
        
        cursor.execute(query, tuple(values))
        db.commit()
        
        return jsonify({'status': 'success', 'message': 'Запись успешно добавлена!'})

    except sqlite3.Error as e:
        return jsonify({'status': 'error', 'message': f'Ошибка базы данных: {e}'}), 500
    except Exception as e:
        return jsonify({'status': 'error', 'message': f'Внутренняя ошибка сервера: {e}'}), 500

@app.route('/api/update/<table_name>/<row_id>', methods=['PUT'])
def update_row(table_name, row_id):
    """Обновляет существующую запись в указанной таблице по ID."""
    try:
        data = request.get_json()
        db = get_db()
        cursor = db.cursor()

        cursor.execute(f"PRAGMA table_info({table_name})")
        columns_info = {row['name']: row for row in cursor.fetchall()}
        updateable_columns = [col for col in columns_info if not columns_info[col]['pk']]
        
        set_clause = []
        values = []
        
        for col_name in updateable_columns:
            if col_name in data:
                set_clause.append(f"{col_name} = ?")
                values.append(data.get(col_name))
        
        if not set_clause:
            return jsonify({'status': 'error', 'message': 'Нет данных для обновления'}), 400
        
        values.append(row_id)
        query = f"UPDATE {table_name} SET {', '.join(set_clause)} WHERE id = ?"
        
        cursor.execute(query, tuple(values))
        db.commit()
        
        if cursor.rowcount == 0:
            return jsonify({'status': 'error', 'message': 'Запись не найдена'}), 404
            
        return jsonify({'status': 'success', 'message': 'Запись успешно обновлена!'})
    except sqlite3.Error as e:
        return jsonify({'status': 'error', 'message': f'Ошибка базы данных: {e}'}), 500
    except Exception as e:
        return jsonify({'status': 'error', 'message': f'Внутренняя ошибка сервера: {e}'}), 500

@app.route('/api/delete/<table_name>/<row_id>', methods=['DELETE'])
def delete_row(table_name, row_id):
    """Удаляет запись из указанной таблицы по ID."""
    try:
        db = get_db()
        cursor = db.cursor()
        query = f"DELETE FROM {table_name} WHERE id = ?"
        cursor.execute(query, (row_id,))
        db.commit()
        if cursor.rowcount == 0:
            return jsonify({'status': 'error', 'message': 'Запись не найдена'}), 404
        return jsonify({'status': 'success', 'message': 'Запись успешно удалена!'})
    except sqlite3.Error as e:
        return jsonify({'status': 'error', 'message': f'Ошибка базы данных: {e}'}), 500
    except Exception as e:
        return jsonify({'status': 'error', 'message': f'Внутренняя ошибка сервера: {e}'}), 500

@app.route('/api/sql_command', methods=['POST'])
def execute_sql_command():
    """Выполняет произвольную SQL-команду и возвращает результат."""
    try:
        data = request.get_json()
        sql_command = data.get('sql', '').strip()

        if not sql_command:
            return jsonify({'status': 'error', 'message': 'Пустая SQL команда.'}), 400

        db = get_db()
        cursor = db.cursor()
        
        if sql_command.upper().startswith(('DROP', 'DELETE')) and 'WHERE' not in sql_command.upper():
            return jsonify({'status': 'error', 'message': 'Опасные команды "DROP" и "DELETE" без "WHERE" запрещены.'}), 403

        cursor.execute(sql_command)
        db.commit()

        if sql_command.upper().startswith('SELECT'):
            columns = [col[0] for col in cursor.description]
            results = [dict(row) for row in cursor.fetchall()]
            return jsonify({'status': 'success', 'results': results, 'columns': columns})
        else:
            return jsonify({'status': 'success', 'message': f"Команда успешно выполнена. Изменено строк: {cursor.rowcount}"})

    except sqlite3.Error as e:
        return jsonify({'status': 'error', 'message': f'Ошибка выполнения SQL: {e}'}), 500
    except Exception as e:
        return jsonify({'status': 'error', 'message': f'Внутренняя ошибка сервера: {e}'}), 500

@app.route('/api/link_altname', methods=['POST'])
def link_altname():
    """ Связывает новое наименование с существующей группой altnames. """
    try:
        data = request.get_json()
        new_name = data.get('new_name')
        group_id = data.get('id')
        if not new_name:
            return jsonify({'status': 'error', 'message': 'Недостаточно данных.'}), 400
        db = get_db()
        cursor = db.cursor()
        if group_id is None:
            # Создаем новую группу (запись в altnames)
            cursor.execute("INSERT INTO altnames (altname) VALUES (?)", (new_name,))
            db.commit()
            return jsonify({'status': 'success', 'message': f"Создана новая группа для наименования '{new_name}'."})
        else:
            # Связываем с существующей группой
            cursor.execute("INSERT INTO altnames (id, altname) VALUES (?, ?)", (group_id, new_name))
            db.commit()
            return jsonify({'status': 'success', 'message': f"Наименование '{new_name}' успешно связано с группой ID {group_id}."})
    except sqlite3.Error as e:
        return jsonify({'status': 'error', 'message': f'Ошибка базы данных: {e}'}), 500
    except Exception as e:
        return jsonify({'status': 'error', 'message': f'Внутренняя ошибка сервера: {e}'}), 500

@app.route('/api/export_to_excel/<table_name>')
def export_to_excel(table_name):
    """
    Экспортирует данные из таблицы/представления в Excel-файл и отправляет его пользователю для загрузки.
    """
    try:
        db = get_db()
        df = pd.read_sql_query(f"SELECT * FROM {table_name}", db)
        
        if df.empty:
            return jsonify({'status': 'error', 'message': 'Нет данных для экспорта'}), 404
            
        output = io.BytesIO()
        with pd.ExcelWriter(output, engine='xlsxwriter') as writer:
            df.to_excel(writer, index=False, sheet_name=table_name)
        
        output.seek(0)
        
        return send_file(
            output,
            mimetype='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            as_attachment=True,
            download_name=f'{table_name}.xlsx'
        )

    except Exception as e:
        return jsonify({'status': 'error', 'message': f'Ошибка экспорта: {e}'}), 500

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

@app.route('/api/import_from_excel/<table_name>', methods=['POST'])
def import_from_excel(table_name):
    """
    Импортирует данные из Excel-файла в указанную таблицу.
    """
    try:
        if 'file' not in request.files:
            return jsonify({'status': 'error', 'message': 'Нет файла для импорта'}), 400
        
        file = request.files['file']
        
        if file.filename == '':
            return jsonify({'status': 'error', 'message': 'Файл не выбран'}), 400

        if file and allowed_file(file.filename):
            df = pd.read_excel(file)
            
            if df.empty:
                return jsonify({'status': 'error', 'message': 'Файл пуст или имеет некорректный формат'}), 400
            
            db = get_db()
            cursor = db.cursor()
            
            cursor.execute(f"PRAGMA table_info({table_name})")
            db_columns = [row['name'] for row in cursor.fetchall()]
            
            if not all(col in db_columns for col in df.columns):
                return jsonify({'status': 'error', 'message': 'Несоответствие столбцов. Убедитесь, что заголовки в файле совпадают с заголовками в таблице.'}), 400

            for index, row in df.iterrows():
                columns = ', '.join(row.index)
                placeholders = ', '.join(['?'] * len(row.values))
                query = f"INSERT INTO {table_name} ({columns}) VALUES ({placeholders})"
                cursor.execute(query, tuple(row.values))
            
            db.commit()
            return jsonify({'status': 'success', 'message': f'Успешно импортировано {len(df)} записей.'})
        
        else:
            return jsonify({'status': 'error', 'message': 'Недопустимый тип файла. Поддерживаются .xlsx, .xls'}), 400

    except Exception as e:
        return jsonify({'status': 'error', 'message': f'Ошибка импорта: {e}'}), 500
        
if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)
    