CREATE TABLE IF NOT EXISTS operation (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    Наименование TEXT,                  -- Наименование
    Артикул TEXT,               -- Артикул производителя
    Количество REAL,              -- Количество
    Единицы_измерения TEXT,                  -- Единицы измерения
    Дата DATE,                  -- Дата операции
    Примечание TEXT,                  -- Примечание
    Документ TEXT,              -- Документ согласно которому добавлен материал
    type TEXT,                   -- type
    CONSTRAINT chk_operation_type CHECK (type IN ('Заявка', 'Приход', 'Выдача', 'Закрыто', 'Списано'))
);

CREATE VIEW Сводка_заявок AS
SELECT
  requested.Наименование,
  requested.Артикул,
  requested.Единицы_измерения,
  requested.Всего_по_заявкам,
  COALESCE(received.Количество_прибыло , 0) AS Количество_прибыло ,
  requested.Всего_по_заявкам - COALESCE(received.Количество_прибыло , 0) AS Количество_не_прибыло
FROM
  (
    SELECT
      Наименование,
      Артикул,
      Единицы_измерения,
      SUM(Количество) AS Всего_по_заявкам
    FROM
      operation
    WHERE
      type = 'Заявка'
    GROUP BY
      Наименование,
      Артикул,
      Единицы_измерения
  ) AS requested
LEFT JOIN
  (
    SELECT
      Наименование,
      Артикул,
      Единицы_измерения,
      SUM(Количество) AS Количество_прибыло 
    FROM
      operation
    WHERE
      type = 'Приход'
    GROUP BY
      Наименование,
      Артикул,
      Единицы_измерения
  ) AS received
ON
  requested.Наименование = received.Наименование AND requested.Артикул = received.Артикул;

CREATE VIEW Сводка_приходов AS
SELECT
  Наименование,
  Артикул,
  Единицы_измерения,
  SUM(Количество) AS Всего_прибыло
FROM
  operation
WHERE
  type = 'Приход'
GROUP BY
  Наименование,
  Артикул,
  Единицы_измерения
ORDER BY
  Наименование;

CREATE VIEW Сводка_выдачи AS -- на выдаче, и сколько осталось
SELECT
  o.Наименование,
  o.Артикул,
  o.Единицы_измерения,
  SUM(CASE WHEN o.type = 'Выдача' THEN o.Количество ELSE 0 END) AS Количество_выдано,
  SUM(CASE WHEN o.type = 'Приход' THEN o.Количество ELSE 0 END) - SUM(CASE WHEN o.type = 'Выдача' THEN o.Количество ELSE 0 END) AS Количество_на_складе
FROM
  operation AS o
WHERE
  o.type IN ('Приход', 'Выдача')
GROUP BY
  o.Наименование,
  o.Артикул,
  o.Единицы_измерения
ORDER BY
  o.Наименование;

CREATE VIEW Сводка_закрытий AS -- Закрытые материалы
SELECT
  Наименование,
  Артикул,
  Единицы_измерения,
  SUM(Количество) AS Всего_закрыто
FROM
  operation
WHERE
  type = 'Закрыто'
GROUP BY
  Наименование,
  Артикул,
  Единицы_измерения
ORDER BY
  Наименование;

CREATE VIEW Сводка_списаного AS
SELECT
  Наименование,
  Артикул,
  Единицы_измерения,
  SUM(Количество) AS Всего_списано
FROM
  operation
WHERE
  type = 'Списано'
GROUP BY
  Наименование,
  Артикул,
  Единицы_измерения
ORDER BY
  Наименование;

