CREATE TABLE operation (
    id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
    Наименование TEXT NOT NULL,           -- Наименование
    Артикул TEXT,                         -- Артикул производителя
    Количество REAL,                      -- Количество
    Единицы_измерения TEXT,               -- Единицы измерения
    Дата DATE,                            -- Дата операции сегодня
    Примечание TEXT,                      -- Примечание
    Документ TEXT,                        -- Документ согласно которому добавлен материал если его нет оставить пустым
    type TEXT NOT NULL,
    Обоснование TEXT,
    Номер_по_смете TEXT,
    Участок TEXT,
    CONSTRAINT chk_operation_type CHECK (type IN ('Заявка', 'Приход', 'Выдача', 'Закрыто', 'Списано','Смета'))
);
CREATE TABLE altnames (
  id INTEGER NOT NULL,
  altname TEXT NOT NULL,
  FOREIGN KEY (altname) REFERENCES operation(Наименование)
);
CREATE VIEW Уникальные_не_внесенные_имена AS
SELECT DISTINCT
    T1.Наименование
    FROM operation AS T1
LEFT JOIN
    altnames AS T2 ON T1.Наименование = T2.altname
WHERE
    T2.altname IS NULL
ORDER BY
    T1.Наименование;

CREATE TABLE altn_altn_coff (
    altn_id_main INTEGER NOT NULL,
    altn_id_second INTEGER NOT NULL,
    coefficient REAL NOT NULL,
    FOREIGN KEY (altn_id_main) REFERENCES altnames(id),
    FOREIGN KEY (altn_id_second) REFERENCES altnames(id)
);
CREATE VIEW Сводка_заявок_с_альт_именами AS
SELECT
    T1.id,
    MIN(T2.Наименование) AS Наименование,
    MIN(T2.Артикул) AS Артикул,
    MIN(T2.Единицы_измерения) AS Единицы_измерения,
    COALESCE(T1.Всего_по_заявкам, 0) AS Всего_по_заявкам,
    COALESCE(T1.Количество_прибыло, 0) AS Количество_прибыло,
    COALESCE(T1.Всего_по_заявкам, 0) - COALESCE(T1.Количество_прибыло, 0) AS Количество_не_прибыло
FROM (
    SELECT
        altnames.id,
        SUM(CASE WHEN operation.type = 'Заявка' THEN operation.Количество ELSE 0 END) AS Всего_по_заявкам,
        SUM(CASE WHEN operation.type = 'Приход' THEN operation.Количество ELSE 0 END) AS Количество_прибыло
    FROM
        operation
    JOIN
        altnames ON operation.Наименование = altnames.altname
    GROUP BY
        altnames.id
) AS T1
LEFT JOIN (
    SELECT
        altnames.id,
        operation.Наименование,
        operation.Артикул,
        operation.Единицы_измерения
    FROM
        operation
    JOIN
        altnames ON operation.Наименование = altnames.altname
    GROUP BY
        altnames.id,
        operation.Наименование,
        operation.Артикул,
        operation.Единицы_измерения
) AS T2
ON T1.id = T2.id
GROUP BY T1.id;

CREATE TABLE receipt_distribution (
    operation_id INTEGER NOT NULL,
    quantity REAL NOT NULL,
    location TEXT NOT NULL,
    FOREIGN KEY (operation_id) REFERENCES operation(id)
);
CREATE VIEW Приходы_без_распределения AS
SELECT *
FROM operation
WHERE
    type = 'Приход' AND Участок IS NULL AND id NOT IN (SELECT operation_id FROM receipt_distribution);

CREATE VIEW Сводка_остатков_по_участкам AS
WITH CombinedOperations AS (
    -- Объединяем операции 'Приход', учитывая распределение
    SELECT
        an.id AS altname_id,
        COALESCE(rd.location, op.Участок, 'Общий') AS Участок,
        op.Наименование,
        op.Единицы_измерения,
        COALESCE(rd.quantity, op.Количество) AS Количество_прихода,
        0 AS Количество_выдано
    FROM
        operation AS op
    JOIN
        altnames AS an ON op.Наименование = an.altname
    LEFT JOIN
        receipt_distribution AS rd ON op.id = rd.operation_id
    WHERE
        op.type = 'Приход'
    UNION ALL
    -- Добавляем операции 'Выдача'
    SELECT
        an.id AS altname_id,
        COALESCE(op.Участок, 'Общий') AS Участок,
        op.Наименование,
        op.Единицы_измерения,
        0 AS Количество_прихода,
        op.Количество AS Количество_выдано
    FROM
        operation AS op
    JOIN
        altnames AS an ON op.Наименование = an.altname
    WHERE
        op.type = 'Выдача'
)
SELECT
    altname_id,
    Участок,
    MIN(Наименование) AS Наименование,
    MIN(Единицы_измерения) AS Единицы_измерения,
    SUM(Количество_прихода) AS Количество_прихода,
    SUM(Количество_выдано) AS Количество_выдано,
    SUM(Количество_прихода) - SUM(Количество_выдано) AS Количество_осталось
FROM
    CombinedOperations
GROUP BY
    altname_id, Участок
ORDER BY
    Наименование;

CREATE VIEW Сводка_к_закрытию AS
WITH VydaData AS (
    SELECT
        an.id AS altname_id,
        vyda_op.Наименование,
        vyda_op.Количество,
        COALESCE(vyda_op.Участок, 'Общий') AS Участок
    FROM
        operation AS vyda_op
    JOIN
        altnames AS an ON vyda_op.Наименование = an.altname
    WHERE
        vyda_op.type = 'Выдача'
),
SmetaData AS (
    SELECT
        an_smeta.id AS altname_id,
        smeta_op.Наименование AS Наименование_по_смете,
        smeta_op.Номер_по_смете,
        smeta_op.Обоснование,
        MIN(smeta_op.Единицы_измерения) AS Единица_измерения_сметы,
        COALESCE(smeta_op.Участок, 'Общий') AS Участок
    FROM
        operation AS smeta_op
    JOIN
        altnames AS an_smeta ON smeta_op.Наименование = an_smeta.altname
    WHERE
        smeta_op.type = 'Смета'
    GROUP BY
        an_smeta.id, smeta_op.Номер_по_смете, smeta_op.Обоснование, Участок
)
-- Часть 1: Материалы, выданные для сметы
SELECT
    SmetaData.Номер_по_смете AS Позиция_по_смете,
    SmetaData.Обоснование AS Обоснование,
    MIN(SmetaData.Наименование_по_смете) AS Наименование_работ_и_затрат,
    MIN(SmetaData.Единица_измерения_сметы) AS Единица_измерения,
    VydaData.Участок AS Участок,
    SUM(VydaData.Количество) AS Количество
FROM
    VydaData
JOIN
    SmetaData ON VydaData.altname_id = SmetaData.altname_id AND VydaData.Участок = SmetaData.Участок
GROUP BY
    SmetaData.Номер_по_смете, SmetaData.Обоснование, VydaData.Участок
UNION ALL
-- Часть 2: Работы, связанные с выданными материалами по коэффициенту
SELECT
    SmetaData.Номер_по_смете AS Позиция_по_смете,
    SmetaData.Обоснование AS Обоснование,
    MIN(SmetaData.Наименование_по_смете) AS Наименование_работ_и_затрат,
    MIN(SmetaData.Единица_измерения_сметы) AS Единица_измерения,
    VydaData.Участок AS Участок,
    SUM(VydaData.Количество * aac.coefficient) AS Количество
FROM
    VydaData
JOIN
    altn_altn_coff AS aac ON VydaData.altname_id = aac.altn_id_main
JOIN
    SmetaData ON aac.altn_id_second = SmetaData.altname_id AND VydaData.Участок = SmetaData.Участок
GROUP BY
    SmetaData.Номер_по_смете, SmetaData.Обоснование, VydaData.Участок;

CREATE VIEW Сводка_заявок_с_альт_именами2 AS
SELECT
    T1.id,
    MIN(T2.Наименование) AS Наименование,
    MIN(T2.Артикул) AS Артикул,
    MIN(T2.Единицы_измерения) AS Единицы_измерения,
    COALESCE(T1.Всего_по_заявкам, 0) AS Всего_по_заявкам,
    COALESCE(T1.Всего_по_смете, 0) AS Всего_по_смете,
    COALESCE(T1.Количество_прибыло, 0) AS Количество_прибыло,
    COALESCE(T1.Всего_по_заявкам, 0) - COALESCE(T1.Количество_прибыло, 0) AS Количество_не_прибыло
FROM (
    SELECT
        altnames.id,
        SUM(CASE WHEN op.type = 'Заявка' THEN op.Количество ELSE 0 END) AS Всего_по_заявкам,
        SUM(CASE WHEN op.type = 'Смета' THEN op.Количество ELSE 0 END) AS Всего_по_смете,
        SUM(
            CASE op.type
                WHEN 'Приход' THEN
                    -- Используем COALESCE для получения количества:
                    -- если есть записи в 'receipt_distribution' для этой операции,
                    -- берем сумму оттуда; иначе берем общее количество из 'operation'.
                    COALESCE(rd.quantity, op.Количество)
                ELSE 0
            END
        ) AS Количество_прибыло
    FROM
        operation AS op
    JOIN
        altnames ON op.Наименование = altnames.altname
    LEFT JOIN
        receipt_distribution AS rd ON op.id = rd.operation_id
    GROUP BY
        altnames.id
) AS T1
LEFT JOIN (
    SELECT
        altnames.id,
        operation.Наименование,
        operation.Артикул,
        operation.Единицы_измерения
    FROM
        operation
    JOIN
        altnames ON operation.Наименование = altnames.altname
    GROUP BY
        altnames.id,
        operation.Наименование,
        operation.Артикул,
        operation.Единицы_измерения
) AS T2
ON T1.id = T2.id
GROUP BY T1.id;