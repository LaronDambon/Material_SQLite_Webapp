import sqlite3
from flask import Flask, render_template, jsonify, request, g, send_file
import pandas as pd

app = Flask(__name__)
DATABASE = 'database.db'

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
        
        # Фильтруем столбцы, чтобы исключить ID, который часто является автоинкрементным
        insertable_columns = [col for col in columns_info if not columns_info[col]['pk']]
        
        # Проверяем обязательные поля (NOT NULL)
        for col_name in insertable_columns:
            col_info = columns_info[col_name]
            if col_info['notnull'] == 1 and not data.get(col_name):
                return jsonify({'status': 'error', 'message': f"Поле '{col_name}' является обязательным"}), 400

        # Собираем данные для вставки, преобразуя пустые строки в None
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

@app.route('/api/export_to_excel/<table_name>')
def export_to_excel(table_name):
    """Экспортирует данные из таблицы/представления в Excel-файл."""
    db = get_db()
    try:
        df = pd.read_sql_query(f"SELECT * FROM {table_name}", db)
        file_path = f"{table_name}_export.xlsx"
        df.to_excel(file_path, index=False)
        return send_file(file_path, as_attachment=True)
    except Exception as e:
        return jsonify({'status': 'error', 'message': f"Ошибка при экспорте: {e}"}), 500
    finally:
        db.close()

@app.route('/api/import_from_excel/<table_name>', methods=['POST'])
def import_from_excel(table_name):
    """Импортирует данные из Excel-файла в указанную таблицу."""
    if 'file' not in request.files:
        return jsonify({'status': 'error', 'message': 'Файл не найден'}), 400
    
    file = request.files['file']
    if file.filename == '':
        return jsonify({'status': 'error', 'message': 'Файл не выбран'}), 400
    
    if file:
        try:
            df = pd.read_excel(file, engine='openpyxl')
            db = get_db()
            df.to_sql(table_name, db, if_exists='append', index=False)
            db.commit()
            return jsonify({'status': 'success', 'message': f'Успешно импортировано {len(df)} записей!'})
        except Exception as e:
            return jsonify({'status': 'error', 'message': f"Ошибка при импорте: {e}"}), 500
    
    return jsonify({'status': 'error', 'message': 'Неизвестная ошибка'}), 500


if __name__ == '__main__':
    app.run(debug=False, host='0.0.0.0', port=5000)