// static/script.js
document.addEventListener('DOMContentLoaded', () => {
    const tablesNav = document.getElementById('tables-nav');
    const viewsNav = document.getElementById('views-nav');
    const dataTable = document.getElementById('data-table').getElementsByTagName('tbody')[0];
    const dataTableHead = document.getElementById('data-table').getElementsByTagName('thead')[0];
    const dataTitle = document.getElementById('data-title');
    const tableControls = document.querySelector('.table-controls');

    const sqlFormContainer = document.getElementById('sql-form-container');
    const sqlForm = document.getElementById('sql-form');
    const sqlFeedback = document.getElementById('sql-feedback');
    const showSqlFormBtn = document.getElementById('show-sql-form-btn');
    
    // Элементы модального окна
    const insertModalOverlay = document.getElementById('insert-modal-overlay');
    const modalForm = document.getElementById('quick-insert-form');
    const modalFormTitle = document.getElementById('modal-form-title');
    const modalFeedback = document.getElementById('form-feedback');
    const modalCloseBtn = document.querySelector('.modal-content .close-btn');

    const sidebar = document.querySelector('.sidebar');
    const burgerBtn = document.querySelector('.burger-btn');

    const columnComments = {
        name: 'Наименование',
        article: 'Артикул производителя',
        quantity: 'Количество',
        unit: 'Единицы измерения (шт, кг, м)',
        date: 'Дата операции',
        note: 'Примечание',
        document: 'Документ-основание',
        type: 'Тип операции'
    };
    
    let activeTableName = null;
    
    // --- ИНИЦИАЛИЗАЦИЯ ---

    async function loadSchema() {
        try {
            const response = await fetch('/api/schema');
            const schema = await response.json();
            populateNav(tablesNav, schema.tables, 'table');
            populateNav(viewsNav, schema.views, 'view');
        } catch (error) {
            console.error('Ошибка при загрузке схемы:', error);
            dataTitle.textContent = 'Ошибка загрузки схемы БД';
        }
    }

    // --- ОСНОВНЫЕ ФУНКЦИИ ---

    function hideAllForms() {
        sqlFormContainer.classList.add('hidden');
    }
    
    function hideModal() {
        insertModalOverlay.classList.remove('visible');
    }
    
    function showModal() {
        insertModalOverlay.classList.add('visible');
    }

    async function loadData(name, type) {
        try {
            const response = await fetch(`/api/data/${name}`);
            const data = await response.json();
            
            dataTitle.textContent = `Содержимое: ${name}`;
            dataTableHead.innerHTML = '';
            dataTable.innerHTML = '';
            tableControls.innerHTML = '';
            
            if (type === 'table') {
                await buildTableControls(name);
                tableControls.classList.remove('hidden');
            } else {
                tableControls.classList.add('hidden');
            }
            
            activeTableName = name;

            if (data.length === 0) {
                dataTable.innerHTML = '<tr><td colspan="100%">Нет данных для отображения.</td></tr>';
                return;
            }

            const headers = Object.keys(data[0]);
            const headerRow = document.createElement('tr');
            headers.forEach(headerText => {
                const th = document.createElement('th');
                th.textContent = headerText;
                headerRow.appendChild(th);
            });
            dataTableHead.appendChild(headerRow);

            data.forEach(rowData => {
                const row = document.createElement('tr');
                headers.forEach(header => {
                    const cell = document.createElement('td');
                    cell.textContent = rowData[header];
                    row.appendChild(cell);
                });
                dataTable.appendChild(row);
            });
        } catch (error) {
            console.error(`Ошибка при загрузке данных для ${name}:`, error);
            dataTitle.textContent = `Ошибка загрузки данных`;
            dataTable.innerHTML = `<tr><td colspan="100%">Не удалось загрузить данные.</td></tr>`;
        }
    }

    // --- ДИНАМИЧЕСКИЕ ФОРМЫ И УПРАВЛЕНИЕ ---

    async function buildTableControls(tableName) {
        tableControls.innerHTML = '';
        
        // Кнопка добавления
        const insertBtn = document.createElement('button');
        insertBtn.className = 'btn-form btn-insert';
        insertBtn.textContent = 'Добавить запись';
        insertBtn.addEventListener('click', async () => {
            modalFormTitle.textContent = `Добавить запись в таблицу '${tableName}'`;
            await buildInsertFormFields(tableName);
            showModal();
        });
        
        // Кнопка экспорта
        const exportBtn = document.createElement('button');
        exportBtn.className = 'btn-form btn-export';
        exportBtn.textContent = 'Экспорт в Excel';
        exportBtn.addEventListener('click', () => {
            window.location.href = `/api/export_to_excel/${tableName}`;
        });
        
        // Кнопка импорта
        const importLabel = document.createElement('label');
        importLabel.className = 'btn-form btn-import';
        importLabel.textContent = 'Импорт из Excel';
        importLabel.style.cursor = 'pointer';
        const importInput = document.createElement('input');
        importInput.type = 'file';
        importInput.style.display = 'none';
        importInput.accept = '.xlsx';
        importInput.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (!file) return;

            const formData = new FormData();
            formData.append('file', file);

            try {
                const response = await fetch(`/api/import_from_excel/${tableName}`, {
                    method: 'POST',
                    body: formData
                });
                const result = await response.json();
                alert(result.message);
                if (result.status === 'success') {
                    loadData(tableName, 'table');
                }
            } catch (error) {
                console.error('Ошибка при импорте:', error);
                alert('Ошибка сети при импорте файла.');
            }
        });
        importLabel.appendChild(importInput);

        tableControls.appendChild(insertBtn);
        tableControls.appendChild(exportBtn);
        tableControls.appendChild(importLabel);
    }

    async function buildInsertFormFields(tableName) {
        modalForm.innerHTML = ''; 
        
        const response = await fetch(`/api/table_info/${tableName}`);
        const columns = await response.json();
        
        columns.forEach(col => {
            if (col.pk) return;
            const group = document.createElement('div');
            group.className = 'form-group';

            const label = document.createElement('label');
            label.htmlFor = `insert-${col.name}`;
            label.textContent = (columnComments[col.name] || col.name) + (col.notnull === 1 ? ' *' : '');
            
            let input;
            if (col.name === 'type') {
                input = document.createElement('select');
                const types = ['Заявка', 'Приход', 'Выдача', 'Закрыто', 'Списано'];
                types.forEach(type => {
                    const option = document.createElement('option');
                    option.value = type;
                    option.textContent = type;
                    input.appendChild(option);
                });
            } else {
                input = document.createElement('input');
                input.type = getInputType(col.type);
                if (input.type === 'number') input.step = 'any';
                input.placeholder = columnComments[col.name] || '';

                if (col.name === 'date') {
                    const today = new Date().toISOString().split('T')[0];
                    input.value = today;
                }
            }

            input.id = `insert-${col.name}`;
            input.name = col.name;
            input.required = col.notnull === 1;
            
            group.appendChild(label);
            group.appendChild(input);
            modalForm.appendChild(group);
        });

        const submitButton = document.createElement('button');
        submitButton.type = 'submit';
        submitButton.textContent = `Добавить`;
        submitButton.className = 'btn-form btn-submit';
        modalForm.appendChild(submitButton);
    }
    
    // --- ОБРАБОТЧИКИ СОБЫТИЙ ---

    modalForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(modalForm);
        const data = Object.fromEntries(formData.entries());
        
        // Преобразование типов
        for (const key in data) {
            const input = document.getElementById(`insert-${key}`);
            if (input && input.type === 'number') {
                data[key] = parseFloat(data[key]);
            }
        }
        
        try {
            const response = await fetch(`/api/insert/${activeTableName}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            const result = await response.json();
            
            showFeedback(modalFeedback, result.message, result.status === 'success' ? 'feedback-success' : 'feedback-error');
            
            if (result.status === 'success') {
                modalForm.reset();
                if (activeTableName) {
                    // Перестраиваем форму для обновления даты
                    await buildInsertFormFields(activeTableName);
                    loadData(activeTableName, 'table');
                }
                setTimeout(hideModal, 2000); // Закрываем модальное окно через 2 секунды
            }
        } catch (error) {
            console.error('Ошибка при отправке формы:', error);
            showFeedback(modalFeedback, 'Ошибка сети при отправке данных.', 'feedback-error');
        }
    });

    sqlForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const sqlCommand = document.getElementById('sql-command-text').value;

        try {
            const response = await fetch('/api/sql_command', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sql: sqlCommand })
            });

            const result = await response.json();

            if (result.status === 'success') {
                if (result.results) {
                    showFeedback(sqlFeedback, `Команда SELECT успешно выполнена. Найдено ${result.results.length} записей.`, 'feedback-info');
                    renderSQLResults(result.results, result.columns);
                } else {
                    showFeedback(sqlFeedback, result.message, 'feedback-success');
                    loadSchema();
                    if (activeTableName) {
                        loadData(activeTableName, 'table');
                    }
                }
            } else {
                showFeedback(sqlFeedback, result.message, 'feedback-error');
            }
        } catch (error) {
            console.error('Ошибка при отправке SQL:', error);
            showFeedback(sqlFeedback, 'Ошибка сети при выполнении команды.', 'feedback-error');
        }
    });

    showSqlFormBtn.addEventListener('click', () => {
        if(sqlFormContainer.classList.contains('hidden')) {
            hideAllForms();
            sqlFormContainer.classList.remove('hidden');
        } else {
            sqlFormContainer.classList.add('hidden');
        }
    });
    
    burgerBtn.addEventListener('click', () => {
        sidebar.classList.toggle('hidden');
    });

    modalCloseBtn.addEventListener('click', hideModal);
    insertModalOverlay.addEventListener('click', (e) => {
        if (e.target === insertModalOverlay) {
            hideModal();
        }
    });
    
    window.addEventListener('resize', () => {
        if (window.innerWidth > 768) {
            sidebar.classList.remove('hidden');
        }
    });

    // --- ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ---

    function populateNav(navElement, items, type) {
        navElement.innerHTML = '';
        items.forEach(item => {
            const link = document.createElement('a');
            link.href = '#';
            link.textContent = item;
            link.dataset.name = item;
            link.addEventListener('click', (e) => {
                e.preventDefault();
                hideAllForms();
                document.querySelectorAll('.sidebar nav a').forEach(a => a.classList.remove('active'));
                link.classList.add('active');
                loadData(item, type);
                if (window.innerWidth <= 768) {
                    sidebar.classList.add('hidden');
                }
            });
            navElement.appendChild(link);
        });
    }

    function getInputType(sqlType) {
        if (sqlType.includes('INT')) return 'number';
        if (sqlType.includes('REAL')) return 'number';
        if (sqlType === 'DATE') return 'date';
        return 'text';
    }

    function showFeedback(element, message, className) {
        element.textContent = message;
        element.className = className;
        element.style.display = 'block';

        setTimeout(() => {
            element.style.display = 'none';
        }, 5000);
    }
    
    function renderSQLResults(results, columns) {
        dataTableHead.innerHTML = '';
        dataTable.innerHTML = '';
        tableControls.classList.add('hidden');
        dataTitle.textContent = `Результат SQL-запроса`;

        if (results.length === 0) {
            dataTable.innerHTML = '<tr><td colspan="100%">Запрос не вернул данных.</td></tr>';
            return;
        }

        const headerRow = document.createElement('tr');
        columns.forEach(headerText => {
            const th = document.createElement('th');
            th.textContent = headerText;
            headerRow.appendChild(th);
        });
        dataTableHead.appendChild(headerRow);

        results.forEach(rowData => {
            const row = document.createElement('tr');
            columns.forEach(header => {
                const cell = document.createElement('td');
                cell.textContent = rowData[header];
                row.appendChild(cell);
            });
            dataTable.appendChild(row);
        });
    }

    // --- ЗАПУСК ---
    loadSchema();
});