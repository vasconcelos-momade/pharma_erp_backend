-- Elimina FaturaItem.loteId: rastreabilidade exclusiva via fatura_item_lotes.

-- Garantir backfill de alocações legadas antes de remover a coluna.
INSERT INTO `fatura_item_lotes` (`faturaItemId`, `loteId`, `quantidade`, `ordemFefo`, `createdAt`)
SELECT
  fi.`id`,
  fi.`loteId`,
  fi.`quantidade`,
  1,
  NOW(3)
FROM `fatura_itens` fi
WHERE fi.`loteId` IS NOT NULL
ON DUPLICATE KEY UPDATE
  `quantidade` = VALUES(`quantidade`);

ALTER TABLE `fatura_itens` DROP FOREIGN KEY `fatura_itens_loteId_fkey`;
ALTER TABLE `fatura_itens` DROP COLUMN `loteId`;
