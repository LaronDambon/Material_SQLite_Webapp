# db_setup.py
import sqlite3
import os # Добавим модуль os для проверки существования файла

# Имя файла базы данных
DB_NAME = 'database.db'
# Имя SQL файла со схемой
SQL_FILE = 'database.v3.sql' 

def create_database():
    """Создает и инициализирует базу данных из SQL-файла."""
    
    # 1. Проверяем, существует ли файл со схемой
    if not os.path.exists(SQL_FILE):
        print(f"Ошибка: Файл схемы '{SQL_FILE}' не найден.")
        return

    try:
        # 2. Читаем содержимое SQL-файла в переменную
        with open(SQL_FILE, 'r', encoding='utf-8') as f:
            # encoding='utf-8' важен, т.к. в вашем SQL есть кириллица
            sql_script = f.read()

        # 3. Подключаемся к БД и выполняем скрипт
        conn = sqlite3.connect(DB_NAME)
        cursor = conn.cursor()
        cursor.executescript(sql_script) # Передаем содержимое файла
        conn.commit()
        conn.close()
        
        print(f"База данных '{DB_NAME}' успешно создана из файла '{SQL_FILE}'.")
        
    except sqlite3.Error as e:
        print(f"Ошибка при работе с SQLite: {e}")
    except Exception as e:
        print(f"Произошла ошибка при чтении файла: {e}")


if __name__ == '__main__':
    create_database()
