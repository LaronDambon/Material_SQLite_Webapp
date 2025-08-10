// static/script.js
document.addEventListener('DOMContentLoaded', () => {
    const tablesNav = document.getElementById('tables-nav');
    const viewsNav = document.getElementById('views-nav');
    const dataTable = document.getElementById('data-table');
    const dataTableBody = dataTable.getElementsByTagName('tbody')[0];
    const dataTableHead = document.getElementById('data-table').getElementsByTagName('thead')[0];
    const dataTitle = document.getElementById('data-title');
    const tableControls = document.querySelector('.table-controls');

    const sqlFormContainer = document.getElementById('sql-form-container');
    const sqlForm = document.getElementById('sql-form');
    const showSqlFormBtn = document.getElementById('show-sql-form-btn');
    const sqlCommandText = document.getElementById('sql-command-text');
    const sqlFeedback = document.getElementById('sql-feedback');
    const sqlResultsContainer = document.getElementById('sql-result-container');
    
    const importModalOverlay = document.getElementById('import-modal-overlay');
    const importForm = document.getElementById('excel-import-form');
    const importModalCloseBtn = document.getElementById('import-modal-close-btn');
    const importFormFeedback = document.getElementById('import-form-feedback');

    const aiFormContainer = document.getElementById('ai-form-container');
    const showAiFormBtn = document = document.getElementById('show-ai-form-btn');
    const aiControlsManual = document.getElementById('ai-controls-manual');
    const generatePromptBtn = document.getElementById('generate-prompt-btn');
    const promptOutput = document.getElementById('prompt-output');
    const jsonInput = document.getElementById('json-input');
    const processJsonBtn = document.getElementById('process-json-btn');
    const aiFeedback = document.getElementById('ai-feedback');
    const uniqueNamesContainer = document.getElementById('unique-names-container');
    const aiContentContainer = document.getElementById('ai-content-container');

    const insertModalOverlay = document.getElementById('insert-modal-overlay');
    const modalForm = document.getElementById('quick-insert-form');
    const modalFormTitle = document.getElementById('modal-form-title');
    const modalFeedback = document.getElementById('form-feedback');
    const modalCloseBtn = document.querySelector('.modal-content .close-btn');

    const sidebar = document.querySelector('.sidebar');
    const sidebarToggleBtn = document.getElementById('sidebar-toggle-btn');
    const sidebarOverlay = document.getElementById('sidebar-overlay');
    
    let uniqueNamesToProcess = [];
    let currentTableName = null;
    let currentTableType = null;
    let currentColumnsInfo = [];
    let currentVisibleColumns = [];
    
    let resizing = false;
    let currentResizer = null;
    let startX = 0;
    let startWidth = 0;

    loadSchema();
    addEventListeners();

    function addEventListeners() {
        showSqlFormBtn.addEventListener('click', () => {
            const isHidden = sqlFormContainer.classList.contains('hidden');
            hideAllForms();
            if (isHidden) {
                sqlFormContainer.classList.remove('hidden');
            }
        });
        showAiFormBtn.addEventListener('click', () => {
            const isHidden = aiFormContainer.classList.contains('hidden');
            hideAllForms();
            if (isHidden) {
                aiFormContainer.classList.remove('hidden');
            }
        });
        sqlForm.addEventListener('submit', handleSqlCommand);
        modalCloseBtn.addEventListener('click', () => {
            insertModalOverlay.classList.add('hidden');
        });
        insertModalOverlay.addEventListener('click', (e) => {
            if (e.target === insertModalOverlay) {
                insertModalOverlay.classList.add('hidden');
            }
        });
        modalForm.addEventListener('submit', handleInsertForm);
        sidebarToggleBtn.addEventListener('click', toggleSidebar);
        sidebarOverlay.addEventListener('click', toggleSidebar);
        generatePromptBtn.addEventListener('click', generatePrompt);
        processJsonBtn.addEventListener('click', processJson);
        importModalCloseBtn.addEventListener('click', () => {
            importModalOverlay.classList.add('hidden');
        });
        importForm.addEventListener('submit', handleImportForm);
        
        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
    }
    
    function toggleSidebar() {
        sidebar.classList.toggle('open');
        sidebarOverlay.classList.toggle('open');
    }

    async function loadSchema() {
        try {
            const response = await fetch('/api/schema');
            const schema = await response.json();
            populateNav(tablesNav, schema.tables, 'table');
            populateNav(viewsNav, schema.views, 'view');
            if (schema.tables.length > 0) {
                loadData(schema.tables[0], 'table');
            }
        } catch (error) {
            console.error('Ошибка при загрузке схемы:', error);
            dataTitle.textContent = 'Ошибка загрузки схемы БД';
        }
    }

    function populateNav(container, items, type) {
        container.innerHTML = '';
        items.forEach(item => {
            const link = document.createElement('a');
            link.href = '#';
            link.textContent = item;
            link.addEventListener('click', (e) => {
                e.preventDefault();
                document.querySelectorAll('.sidebar nav a').forEach(el => el.classList.remove('active'));
                link.classList.add('active');
                loadData(item, type);
                hideAllForms();
            });
            container.appendChild(link);
        });
    }

    function hideAllForms() {
        sqlFormContainer.classList.add('hidden');
        aiFormContainer.classList.add('hidden');
    }

    async function loadData(name, type) {
        try {
            currentTableName = name;
            currentTableType = type;

            const response = await fetch(`/api/data/${name}`);
            const data = await response.json();
            
            dataTitle.textContent = `Содержимое: ${name}`;
            dataTableHead.innerHTML = '';
            dataTableBody.innerHTML = '';
            tableControls.innerHTML = '';

            let columnsToDisplay;
            
            if (type === 'table') {
                const infoResponse = await fetch(`/api/table_info/${name}`);
                currentColumnsInfo = await infoResponse.json();
                columnsToDisplay = currentColumnsInfo.map(col => col.name);
                currentVisibleColumns = columnsToDisplay;
                buildTableControls(name);
            } else if (type === 'view') {
                columnsToDisplay = data.length > 0 ? Object.keys(data[0]) : [];
                currentVisibleColumns = columnsToDisplay;
                tableControls.classList.remove('hidden');
                buildViewControls();
            }
            
            if (data.length === 0) {
                dataTableBody.innerHTML = '<tr><td colspan="100%">Нет данных для отображения.</td></tr>';
                if (name === 'Уникальные_не_внесенные_имена') {
                    uniqueNamesToProcess = [];
                    renderUniqueNamesList();
                }
                return;
            }
            
            renderTable(columnsToDisplay, data, type);
            
            if (name === 'Уникальные_не_внесенные_имена') {
                uniqueNamesToProcess = data.map(item => item.Наименование);
                renderUniqueNamesList();
                generatePromptBtn.disabled = uniqueNamesToProcess.length === 0;
                processJsonBtn.disabled = uniqueNamesToProcess.length === 0;
                aiFeedback.textContent = uniqueNamesToProcess.length === 0 ? 'Нет новых наименований для анализа.' : '';
            }
        } catch (error) {
            console.error(`Ошибка при загрузке данных для ${name}:`, error);
            dataTitle.textContent = `Ошибка загрузки данных`;
            dataTableBody.innerHTML = `<tr><td colspan="100%">Не удалось загрузить данные.</td></tr>`;
        }
    }
    
    function renderTable(headers, data, type) {
        dataTableHead.innerHTML = '';
        dataTableBody.innerHTML = '';
     
        const headerRow = document.createElement('tr');
        headers.forEach(headerText => {
            const th = document.createElement('th');
            th.textContent = headerText;
            th.dataset.columnName = headerText;
        
            const resizer = document.createElement('div');
            resizer.className = 'resizer';
            resizer.addEventListener('mousedown', handleMouseDown);
            th.appendChild(resizer);
        
            headerRow.appendChild(th);
        });
    
        // Отображаем столбец "Действия" только для таблиц
        if (type === 'table') {
            const actionsTh = document.createElement('th');
            actionsTh.textContent = 'Действия';
            actionsTh.dataset.columnName = 'Действия';
            headerRow.appendChild(actionsTh);
        }
    
        dataTableHead.appendChild(headerRow);

        data.forEach(rowData => {
            const row = document.createElement('tr');
            headers.forEach(header => {
                const cell = document.createElement('td');
                cell.textContent = rowData[header];
                cell.dataset.columnName = header;
                row.appendChild(cell);
            });
        
            // Отображаем кнопку "Удалить" только для таблиц
            if (type === 'table') {
                const actionsCell = document.createElement('td');
                actionsCell.innerHTML = `<button class="btn-delete" data-id="${rowData.id}">Удалить</button>`;
                actionsCell.dataset.columnName = 'Действия'; // Вот где задается имя колонки
                actionsCell.querySelector('.btn-delete').addEventListener('click', () => handleDeleteRow(rowData.id));
                row.appendChild(actionsCell);
            }
        
            dataTableBody.appendChild(row);
        });
    
        updateVisibleColumns();
        loadColumnWidths(currentTableName);
    }
    
    function handleMouseDown(e) {
        currentResizer = e.target;
        resizing = true;
        startX = e.pageX;
        startWidth = currentResizer.parentNode.offsetWidth;
        dataTable.classList.add('resizing');
    }
    
    function handleMouseMove(e) {
        if (!resizing) return;
        
        const newWidth = startWidth + (e.pageX - startX);
        const columnHeader = currentResizer.parentNode;
        
        columnHeader.style.width = newWidth + 'px';
        const columnIndex = Array.from(columnHeader.parentNode.children).indexOf(columnHeader);
        
        const tableRows = dataTableBody.querySelectorAll('tr');
        tableRows.forEach(row => {
            if (row.children[columnIndex]) {
                row.children[columnIndex].style.width = newWidth + 'px';
            }
        });
    }
    
    function handleMouseUp() {
        if (resizing) {
            resizing = false;
            dataTable.classList.remove('resizing');
            saveColumnWidths(currentTableName); // Вызываем функцию сохранения ширины
            currentResizer = null;
        }
    }

    // Изменение 3: Добавляем функции для сохранения и загрузки ширины столбцов
    function saveColumnWidths(tableName) {
        const widths = {};
        const headers = Array.from(dataTableHead.querySelectorAll('th'));
        headers.forEach(header => {
            const colName = header.dataset.columnName;
            const width = header.offsetWidth;
            widths[colName] = width;
        });
        localStorage.setItem(`columnWidths_${tableName}`, JSON.stringify(widths));
    }
    
    function loadColumnWidths(tableName) {
        const savedWidths = localStorage.getItem(`columnWidths_${tableName}`);
        if (savedWidths) {
            const widths = JSON.parse(savedWidths);
            const headers = Array.from(dataTableHead.querySelectorAll('th'));
            headers.forEach(header => {
                const colName = header.dataset.columnName;
                if (widths[colName]) {
                    header.style.width = `${widths[colName]}px`;
                }
            });
            const rows = Array.from(dataTableBody.querySelectorAll('tr'));
            rows.forEach(row => {
                const cells = Array.from(row.querySelectorAll('td'));
                cells.forEach(cell => {
                    const colName = cell.dataset.columnName;
                    if (widths[colName]) {
                        cell.style.width = `${widths[colName]}px`;
                    }
                });
            });
        }
    }
    
    async function setAutoColumnWidth() {
        const headers = Array.from(dataTableHead.querySelectorAll('th'));
        const dataRows = Array.from(dataTableBody.querySelectorAll('tr'));
        
        if (headers.length === 0 || dataRows.length === 0) return;

        const maxContentWidths = new Map();
        
        headers.forEach(header => {
            const headerText = header.textContent;
            let maxWidth = headerText.length * 10;
            
            maxContentWidths.set(headerText, maxWidth);
        });
        
        dataRows.forEach(row => {
            const cells = Array.from(row.querySelectorAll('td'));
            
            cells.forEach((cell, index) => {
                const headerText = headers[index].textContent;
                const currentWidth = maxContentWidths.get(headerText);
                const contentWidth = cell.textContent.length * 10;
                
                if (contentWidth > currentWidth) {
                    maxContentWidths.set(headerText, contentWidth);
                }
            });
        });
        
        headers.forEach(header => {
            const headerText = header.textContent;
            const newWidth = maxContentWidths.get(headerText) + 30;
            header.style.width = `${newWidth}px`;
        });
        saveColumnWidths(currentTableName); // Сохраняем автоматическую ширину
    }
    
    function buildTableControls(tableName) {
        tableControls.innerHTML = '';
        
        const insertBtn = document.createElement('button');
        insertBtn.className = 'btn-insert';
        insertBtn.textContent = 'Добавить запись';
        insertBtn.addEventListener('click', () => showInsertModal(tableName));
        tableControls.appendChild(insertBtn);

        const exportBtn = document.createElement('a');
        exportBtn.className = 'btn-export';
        exportBtn.textContent = 'Экспорт в Excel';
        exportBtn.href = `/api/export_to_excel/${tableName}`;
        tableControls.appendChild(exportBtn);

        const importBtn = document.createElement('button');
        importBtn.className = 'btn-import';
        importBtn.textContent = 'Импорт из Excel';
        importBtn.addEventListener('click', () => showImportModal(tableName));
        tableControls.appendChild(importBtn);

        const autoWidthBtn = document.createElement('button');
        autoWidthBtn.className = 'btn-auto-width';
        autoWidthBtn.textContent = 'Авто-ширина столбцов';
        autoWidthBtn.addEventListener('click', setAutoColumnWidth);
        tableControls.appendChild(autoWidthBtn);

        const toggleColumnsBtn = document.createElement('div');
        toggleColumnsBtn.className = 'dropdown';
        toggleColumnsBtn.innerHTML = `
            <button class="btn-toggle-columns">Видимость столбцов</button>
            <div class="dropdown-content" id="columns-dropdown"></div>
        `;
        tableControls.appendChild(toggleColumnsBtn);
        
        setupColumnToggle(currentColumnsInfo.map(col => col.name));

        tableControls.classList.remove('hidden');
    }
    
    function buildViewControls() {
        tableControls.innerHTML = '';
        
        const exportBtn = document.createElement('a');
        exportBtn.className = 'btn-export';
        exportBtn.textContent = 'Экспорт в Excel';
        exportBtn.href = `/api/export_to_excel/${currentTableName}`;
        tableControls.appendChild(exportBtn);
        
        const autoWidthBtn = document.createElement('button');
        autoWidthBtn.className = 'btn-auto-width';
        autoWidthBtn.textContent = 'Авто-ширина столбцов';
        autoWidthBtn.addEventListener('click', setAutoColumnWidth);
        tableControls.appendChild(autoWidthBtn);

        const toggleColumnsBtn = document.createElement('div');
        toggleColumnsBtn.className = 'dropdown';
        toggleColumnsBtn.innerHTML = `
            <button class="btn-toggle-columns">Видимость столбцов</button>
            <div class="dropdown-content" id="columns-dropdown"></div>
        `;
        tableControls.appendChild(toggleColumnsBtn);
        
        setupColumnToggle(currentVisibleColumns);
    }
    
    function setupColumnToggle(allColumns) {
        const dropdown = document.getElementById('columns-dropdown');
        dropdown.innerHTML = '';
        
        allColumns.forEach(colName => {
            const label = document.createElement('label');
            label.className = 'dropdown-item';
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.checked = true;
            checkbox.value = colName;
            
            label.appendChild(checkbox);
            label.appendChild(document.createTextNode(colName));
            dropdown.appendChild(label);
            
            checkbox.addEventListener('change', () => {
                const checkedColumns = Array.from(dropdown.querySelectorAll('input[type="checkbox"]:checked'))
                                             .map(cb => cb.value);
                currentVisibleColumns = checkedColumns;
                updateVisibleColumns();
            });
        });
        
        document.querySelector('.btn-toggle-columns').addEventListener('click', (e) => {
            e.stopPropagation();
            dropdown.classList.toggle('show');
        });
        
        window.addEventListener('click', (e) => {
            if (!e.target.closest('.dropdown')) {
                dropdown.classList.remove('show');
            }
        });
    }

    function updateVisibleColumns() {
        const headers = Array.from(dataTableHead.querySelectorAll('th'));
        const rows = Array.from(dataTableBody.querySelectorAll('tr'));
    
        headers.forEach(header => {
            const colName = header.dataset.columnName;
            // Столбец "Действия" всегда видим, остальные — в зависимости от настроек
            const isVisible = currentVisibleColumns.includes(colName) || (colName === 'Действия') || (colName === 'btn-delete');
            header.style.display = isVisible ? '' : 'none';
        });

        rows.forEach(row => {
            const cells = Array.from(row.querySelectorAll('td'));
            cells.forEach(cell => {
                 const colName = cell.dataset.columnName;
                 // Столбец "Действия" всегда видим, остальные — в зависимости от настроек
                 const isVisible = currentVisibleColumns.includes(colName) || (colName === 'Действия') || (colName === 'btn-delete');
                 cell.style.display = isVisible ? '' : 'none';
            });
        });
    }
    

    async function showInsertModal(tableName) {
        modalFormTitle.textContent = `Добавить запись в таблицу '${tableName}'`;
        modalForm.innerHTML = '';
        modalFeedback.textContent = '';
        
        currentColumnsInfo.forEach(col => {
            if (col.name !== 'id') {
                const formGroup = document.createElement('div');
                formGroup.className = 'form-group';
                
                const label = document.createElement('label');
                label.htmlFor = `input-${col.name}`;
                label.textContent = col.name;
                
                const input = document.createElement('input');
                input.type = 'text';
                input.id = `input-${col.name}`;
                input.name = col.name;
                input.required = col.notnull === 1;
                
                formGroup.appendChild(label);
                formGroup.appendChild(input);
                modalForm.appendChild(formGroup);
            }
        });
        
        const submitBtn = document.createElement('button');
        submitBtn.type = 'submit';
        submitBtn.className = 'btn-submit';
        submitBtn.textContent = 'Сохранить';
        modalForm.appendChild(submitBtn);

        insertModalOverlay.classList.remove('hidden');
    }
    
    async function showImportModal(tableName) {
        document.getElementById('import-form-title').textContent = `Импорт в таблицу '${tableName}'`;
        importFormFeedback.textContent = '';
        document.getElementById('import-file-input').value = null;
        importModalOverlay.classList.remove('hidden');
    }

    async function handleInsertForm(e) {
        e.preventDefault();
        
        const formData = new FormData(modalForm);
        const data = {};
        formData.forEach((value, key) => {
            data[key] = value;
        });

        modalFeedback.textContent = 'Сохранение...';
        modalFeedback.className = 'feedback';
        
        try {
            const response = await fetch(`/api/insert/${currentTableName}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(data)
            });
            const result = await response.json();
            
            if (result.status === 'success') {
                modalFeedback.textContent = result.message;
                modalFeedback.className = 'feedback success';
                modalForm.reset();
                loadData(currentTableName, currentTableType);
                setTimeout(() => insertModalOverlay.classList.add('hidden'), 2000);
            } else {
                modalFeedback.textContent = result.message;
                modalFeedback.className = 'feedback error';
            }
        } catch (error) {
            console.error('Ошибка при добавлении записи:', error);
            modalFeedback.textContent = 'Ошибка сети или сервера.';
            modalFeedback.className = 'feedback error';
        }
    }
    
    async function handleDeleteRow(rowId) {
        if (!confirm('Вы уверены, что хотите удалить эту запись?')) {
            return;
        }

        try {
            const response = await fetch(`/api/delete/${currentTableName}/${rowId}`, {
                method: 'DELETE'
            });
            const result = await response.json();
            
            if (result.status === 'success') {
                alert(result.message);
                loadData(currentTableName, currentTableType);
            } else {
                alert(result.message);
            }
        } catch (error) {
            console.error('Ошибка при удалении записи:', error);
            alert('Ошибка сети или сервера при удалении.');
        }
    }
    
    async function handleImportForm(e) {
        e.preventDefault();
        
        const fileInput = document.getElementById('import-file-input');
        const file = fileInput.files[0];
        
        if (!file) {
            importFormFeedback.textContent = 'Выберите файл.';
            importFormFeedback.className = 'feedback error';
            return;
        }

        const formData = new FormData();
        formData.append('file', file);

        importFormFeedback.textContent = 'Импорт данных...';
        importFormFeedback.className = 'feedback';
        
        try {
            const response = await fetch(`/api/import_from_excel/${currentTableName}`, {
                method: 'POST',
                body: formData
            });
            const result = await response.json();
            
            if (result.status === 'success') {
                importFormFeedback.textContent = result.message;
                importFormFeedback.className = 'feedback success';
                loadData(currentTableName, currentTableType);
                setTimeout(() => importModalOverlay.classList.add('hidden'), 2000);
            } else {
                importFormFeedback.textContent = result.message;
                importFormFeedback.className = 'feedback error';
            }
        } catch (error) {
            console.error('Ошибка при импорте:', error);
            importFormFeedback.textContent = 'Ошибка сети или сервера.';
            importFormFeedback.className = 'feedback error';
        }
    }

    async function handleSqlCommand(e) {
        e.preventDefault();
        const sqlCommand = sqlCommandText.value;
        sqlFeedback.textContent = 'Выполнение...';
        sqlFeedback.className = 'feedback';
        sqlResultsContainer.classList.add('hidden');
        
        try {
            const response = await fetch('/api/sql_command', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ sql: sqlCommand })
            });
            const result = await response.json();
            
            if (result.status === 'success') {
                sqlFeedback.textContent = result.message || 'Команда успешно выполнена.';
                sqlFeedback.className = 'feedback success';
                
                if (result.results && result.results.length > 0) {
                    displaySqlResults(result.results, result.columns);
                } else if (result.results && result.results.length === 0 && result.columns) {
                    displaySqlResults([], result.columns);
                } else {
                     document.querySelector('#sql-result-table thead').innerHTML = '';
                     document.querySelector('#sql-result-table tbody').innerHTML = '';
                }
            } else {
                sqlFeedback.textContent = result.message;
                sqlFeedback.className = 'feedback error';
            }
        } catch (error) {
            console.error('Ошибка при выполнении SQL:', error);
            sqlFeedback.textContent = 'Ошибка сети или сервера.';
            sqlFeedback.className = 'feedback error';
        }
    }
    
    function displaySqlResults(data, columns) {
        const tableHead = document.querySelector('#sql-result-table thead');
        const tableBody = document.querySelector('#sql-result-table tbody');
        tableHead.innerHTML = '';
        tableBody.innerHTML = '';
        
        if (columns && columns.length > 0) {
            const headerRow = document.createElement('tr');
            columns.forEach(col => {
                const th = document.createElement('th');
                th.textContent = col;
                headerRow.appendChild(th);
            });
            tableHead.appendChild(headerRow);
        }
        
        if (data && data.length > 0) {
            data.forEach(rowData => {
                const row = document.createElement('tr');
                columns.forEach(col => {
                    const cell = document.createElement('td');
                    cell.textContent = rowData[col];
                    row.appendChild(cell);
                });
                tableBody.appendChild(row);
            });
        } else {
            tableBody.innerHTML = '<tr><td colspan="100%">Нет данных для отображения.</td></tr>';
        }
        
        sqlResultsContainer.classList.remove('hidden');
    }
    
    async function generatePrompt() {
        const altnamesResponse = await fetch('/api/data/altnames');
        const existingNames = await altnamesResponse.json();

        const promptText = `
Я передаю тебе список новых наименований и список уже существующих наименований с их ID. Твоя задача — сопоставить каждое новое наименование с наиболее подходящими существующими ID. Если для нового наименования нет подходящих групп, предложи создать новую группу (присвоив ему ID: -1).
Учитывай небольшие различия, такие как опечатки, латинские или кириллические буквы, разная маркировка (например, 'x' и 'х').

Существующие наименования (используй их для сопоставления):
${JSON.stringify(existingNames, null, 2)}

Новые наименования для анализа:
${JSON.stringify(uniqueNamesToProcess, null, 2)}

Выдай ответ исключительно в формате JSON, без каких-либо дополнительных объяснений. Ответ должен быть массивом объектов. Каждый объект должен содержать:
1. "new_name": Исходное новое наименование.
2. "alternatives": Массив, содержащий до 3 наиболее подходящих предложений для этого наименования. Если совпадений нет, предложи создать новую группу, присвоив ей ID: -1.
   Каждый объект в "alternatives" должен содержать:
   а. "suggested_id": ID наиболее подходящего существующего наименования. Если совпадений нет, используй -1.
   б. "confidence": Краткое обоснование выбора. Например, "совпадение", "похожее наименование", "опечатка", "новое наименование".

Пример ожидаемого формата ответа:
[
  {
    "new_name": "Пример_наименования_1",
    "alternatives": [
      {
        "suggested_id": 123,
        "confidence": "высокая схожесть"
      },
      {
        "suggested_id": 456,
        "confidence": "возможная опечатка"
      }
    ]
  },
  {
    "new_name": "Пример_наименования_2",
    "alternatives": [
      {
        "suggested_id": -1,
        "confidence": "новое наименование"
      }
    ]
  }
]
`;
        promptOutput.value = promptText;
        promptOutput.classList.remove('hidden');
    }

    function renderUniqueNamesList() {
        uniqueNamesContainer.innerHTML = '';
        if (uniqueNamesToProcess.length === 0) {
            uniqueNamesContainer.innerHTML = '<p>Нет новых наименований для анализа.</p>';
            return;
        }

        uniqueNamesToProcess.forEach(name => {
            const suggestionBlock = document.createElement('div');
            suggestionBlock.className = 'suggestion-block';
            suggestionBlock.dataset.newName = name;
            suggestionBlock.innerHTML = `
                <h4>${name}</h4>
                <div class="alternatives-container">
                    <p>Ожидается JSON-ответ...</p>
                </div>
            `;
            uniqueNamesContainer.appendChild(suggestionBlock);
        });
    }

    async function processJson() {
        processJsonBtn.textContent = 'Обработка...';
        processJsonBtn.disabled = true;
        aiFeedback.textContent = 'Обработка JSON...';
        
        try {
            const jsonText = jsonInput.value;
            const suggestions = JSON.parse(jsonText);
            
            if (!Array.isArray(suggestions) || !suggestions.every(item => item.new_name && (item.alternatives || item.alternaatives))) {
                 throw new Error("Некорректный формат JSON. Ожидается массив объектов с ключами 'new_name' и 'alternatives'.");
            }
            
            aiFeedback.textContent = 'JSON успешно обработан!';
            aiContentContainer.classList.remove('hidden');
            renderSuggestions(suggestions);
            
        } catch (error) {
            console.error('Ошибка при обработке JSON:', error);
            aiFeedback.textContent = `Ошибка: ${error.message}`;
        } finally {
            processJsonBtn.textContent = 'Обработать JSON';
            processJsonBtn.disabled = false;
        }
    }

    async function renderSuggestions(suggestions) {
        const currentAltnameIdsResponse = await fetch('/api/data/altnames');
        const currentAltnameData = await currentAltnameIdsResponse.json();
        const altnameIdToNameMap = new Map();
        currentAltnameData.forEach(item => {
            if (!altnameIdToNameMap.has(item.id)) {
                 altnameIdToNameMap.set(item.id, item.altname);
            }
        });

        uniqueNamesContainer.removeEventListener('click', handleAiAction);
        uniqueNamesContainer.addEventListener('click', handleAiAction);
        
        const allBlocks = document.querySelectorAll('.suggestion-block');

        suggestions.forEach(suggestion => {
            let block = Array.from(allBlocks).find(b => b.dataset.newName === suggestion.new_name);

            if (block) {
                const alternativesContainer = block.querySelector('.alternatives-container');
                alternativesContainer.innerHTML = '';
                const alternatives = suggestion.alternatives || suggestion.alternaatives;
                if (alternatives && alternatives.length > 0 && alternatives[0].suggested_id !== -1) {
                    const ul = document.createElement('ul');
                    ul.className = 'alternatives-list';
                    alternatives.forEach(alt => {
                        const suggestedAltName = altnameIdToNameMap.get(alt.suggested_id) || `ID: ${alt.suggested_id}`;
                        const li = document.createElement('li');
                        li.innerHTML = `
                            <span> ID <strong>${alt.suggested_id}</strong> (${suggestedAltName})<br> <small>${alt.confidence}</small> </span>
                            <button class="btn-ai-action btn-confirm-id" data-new-name="${suggestion.new_name}" data-id="${alt.suggested_id}">Подтвердить</button>
                        `;
                        ul.appendChild(li);
                    });
                    alternativesContainer.appendChild(ul);
                } else {
                    const noMatchP = document.createElement('p');
                    noMatchP.textContent = 'Похожих наименований не найдено.';
                    alternativesContainer.appendChild(noMatchP);
                }
                const createNewBtn = document.createElement('button');
                createNewBtn.className = 'btn-ai-action create-new';
                createNewBtn.textContent = 'Создать новую группу';
                createNewBtn.dataset.newName = suggestion.new_name;
                createNewBtn.dataset.id = '-1';
                alternativesContainer.appendChild(createNewBtn);
            }
        });
    }

    async function handleAiAction(e) {
        const btn = e.target.closest('.btn-ai-action');
        if (btn && !btn.disabled) {
            const block = btn.closest('.suggestion-block');
            const newName = btn.dataset.newName;
            const suggestedId = btn.dataset.id;
            const actionId = suggestedId === '-1' ? null : parseInt(suggestedId);
            executeAiAction(newName, actionId, block);
        }
    }

    async function executeAiAction(new_name, suggested_id, block) {
        let sqlCommand;
        const feedbackElement = document.createElement('p');
        feedbackElement.textContent = 'Выполняется SQL команда...';
        const alternativesContainer = block.querySelector('.alternatives-container');
        alternativesContainer.prepend(feedbackElement);
        try {
            if (suggested_id === null) {
                const maxIdResponse = await fetch('/api/sql_command', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ sql: `SELECT MAX(id) AS max_id FROM altnames` })
                });
                const maxIdResult = await maxIdResponse.json();
                
                const maxId = (maxIdResult.results && maxIdResult.results.length > 0 && maxIdResult.results[0].max_id !== null) ? maxIdResult.results[0].max_id : 0;
                const newId = maxId + 1;
                
                sqlCommand = `INSERT INTO altnames (id, altname) VALUES (${newId}, '${new_name.replace(/'/g, "''")}')`;
            } else {
                sqlCommand = `INSERT INTO altnames (id, altname) VALUES (${suggested_id}, '${new_name.replace(/'/g, "''")}')`;
            }
            
            const response = await fetch('/api/sql_command', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sql: sqlCommand })
            });

            const result = await response.json();
            
            if (result.status === 'success') {
                feedbackElement.textContent = `Успешно: ${result.message}`;
                feedbackElement.className = 'feedback success';
                block.querySelectorAll('.btn-ai-action').forEach(btn => btn.disabled = true);
            } else {
                feedbackElement.textContent = `Ошибка: ${result.message}`;
                feedbackElement.className = 'feedback error';
            }
        } catch (error) {
            feedbackElement.textContent = `Ошибка: ${error.message}`;
            feedbackElement.className = 'feedback error';
        }
    }
});
