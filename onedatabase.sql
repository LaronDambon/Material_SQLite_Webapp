CREATE TABLE IF NOT EXISTS operation (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,                  -- Наименование
    article TEXT,               -- Артикул производителя
    quantity REAL,              -- Количество
    unit TEXT,                  -- Единицы измерения
    date DATE,                  -- Дата операции
    note TEXT,                  -- Примечание
    document TEXT,              -- Документ согласно которому добавлен материал
    type TEXT,                   -- Тип
    CONSTRAINT chk_operation_type CHECK (type IN ('Заявка', 'Приход', 'Выдача', 'Закрыто', 'Списано'))
);

CREATE VIEW application_summary_view AS
SELECT
  requested.name,
  requested.article,
  requested.unit,
  requested.total_requested_quantity,
  COALESCE(received.total_received_quantity, 0) AS total_received_quantity,
  requested.total_requested_quantity - COALESCE(received.total_received_quantity, 0) AS remaining_quantity
FROM
  (
    SELECT
      name,
      article,
      unit,
      SUM(quantity) AS total_requested_quantity
    FROM
      operation
    WHERE
      type = 'Заявка'
    GROUP BY
      name,
      article,
      unit
  ) AS requested
LEFT JOIN
  (
    SELECT
      name,
      article,
      unit,
      SUM(quantity) AS total_received_quantity
    FROM
      operation
    WHERE
      type = 'Приход'
    GROUP BY
      name,
      article,
      unit
  ) AS received
ON
  requested.name = received.name AND requested.article = received.article;

CREATE VIEW incoming_materials_view AS
SELECT
  name,
  article,
  unit,
  SUM(quantity) AS total_received
FROM
  operation
WHERE
  type = 'Приход'
GROUP BY
  name,
  article,
  unit
ORDER BY
  name;

CREATE VIEW issued_materials_view AS -- на выдаче, и сколько осталось
SELECT
  o.name,
  o.article,
  o.unit,
  SUM(CASE WHEN o.type = 'Выдача' THEN o.quantity ELSE 0 END) AS total_disbursed,
  SUM(CASE WHEN o.type = 'Приход' THEN o.quantity ELSE 0 END) - SUM(CASE WHEN o.type = 'Выдача' THEN o.quantity ELSE 0 END) AS remaining_on_hand
FROM
  operation AS o
WHERE
  o.type IN ('Приход', 'Выдача')
GROUP BY
  o.name,
  o.article,
  o.unit
ORDER BY
  o.name;

CREATE VIEW closed_materials_view AS -- Закрытые материалы
SELECT
  name,
  article,
  unit,
  SUM(quantity) AS total_closed
FROM
  operation
WHERE
  type = 'Закрыто'
GROUP BY
  name,
  article,
  unit
ORDER BY
  name;

CREATE VIEW written_off_materials_view AS
SELECT
  name,
  article,
  unit,
  SUM(quantity) AS total_written_off
FROM
  operation
WHERE
  type = 'Списано'
GROUP BY
  name,
  article,
  unit
ORDER BY
  name;

