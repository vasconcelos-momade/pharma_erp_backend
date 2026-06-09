-- Normaliza dataValidade para meia-noite UTC (data calendário consistente)
UPDATE `lotes`
SET `dataValidade` = TIMESTAMP(DATE(`dataValidade`))
WHERE `deletedAt` IS NULL;

-- Consolida lotes duplicados (mesmo produto, número e validade) antes do índice único
UPDATE `lotes` AS keeper
INNER JOIN (
  SELECT
    MIN(`id`) AS keeper_id,
    `produtoId`,
    `numeroLote`,
    `dataValidade`,
    SUM(`quantidadeInicial`) AS sum_inicial,
    SUM(`quantidadeAtual`) AS sum_atual
  FROM `lotes`
  WHERE `deletedAt` IS NULL
  GROUP BY `produtoId`, `numeroLote`, `dataValidade`
  HAVING COUNT(*) > 1
) AS dup
  ON keeper.`id` = dup.keeper_id
SET
  keeper.`quantidadeInicial` = dup.sum_inicial,
  keeper.`quantidadeAtual` = dup.sum_atual;

UPDATE `lotes` AS orphan
INNER JOIN (
  SELECT
    MIN(`id`) AS keeper_id,
    `produtoId`,
    `numeroLote`,
    `dataValidade`
  FROM `lotes`
  WHERE `deletedAt` IS NULL
  GROUP BY `produtoId`, `numeroLote`, `dataValidade`
  HAVING COUNT(*) > 1
) AS dup
  ON orphan.`produtoId` = dup.`produtoId`
  AND orphan.`numeroLote` = dup.`numeroLote`
  AND orphan.`dataValidade` = dup.`dataValidade`
  AND orphan.`id` <> dup.keeper_id
  AND orphan.`deletedAt` IS NULL
SET orphan.`deletedAt` = NOW();

-- CreateIndex
CREATE UNIQUE INDEX `lotes_produtoId_numeroLote_dataValidade_key` ON `lotes`(`produtoId`, `numeroLote`, `dataValidade`);
