-- Refatoração stock: FaturaItemLote (FEFO multi-lote), LoteStockBalance (cache),
-- remoção de quantidadeAtual (fonte única: estoque_movimentos).

-- 1. Cache de stock por lote
CREATE TABLE `lote_stock_balances` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `loteId` BIGINT UNSIGNED NOT NULL,
  `quantidadeTotal` DECIMAL(14, 2) NOT NULL DEFAULT 0,
  `quantidadeDisponivel` DECIMAL(14, 2) NOT NULL DEFAULT 0,
  `version` INTEGER NOT NULL DEFAULT 0,
  `lastUpdated` DATETIME(3) NOT NULL,
  UNIQUE INDEX `lote_stock_balances_loteId_key`(`loteId`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- 2. Rastreabilidade FEFO: N lotes por item de fatura
CREATE TABLE `fatura_item_lotes` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `faturaItemId` BIGINT UNSIGNED NOT NULL,
  `loteId` BIGINT UNSIGNED NOT NULL,
  `quantidade` DECIMAL(14, 2) NOT NULL,
  `ordemFefo` INTEGER NOT NULL DEFAULT 1,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE INDEX `fatura_item_lotes_faturaItemId_loteId_key`(`faturaItemId`, `loteId`),
  INDEX `fatura_item_lotes_faturaItemId_idx`(`faturaItemId`),
  INDEX `fatura_item_lotes_loteId_idx`(`loteId`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- 3. Backfill lote_stock_balances a partir de quantidadeAtual (antes de remover coluna)
INSERT INTO `lote_stock_balances` (`loteId`, `quantidadeTotal`, `quantidadeDisponivel`, `version`, `lastUpdated`)
SELECT
  l.`id`,
  GREATEST(0, COALESCE(l.`quantidadeAtual`, 0)),
  GREATEST(0, COALESCE(l.`quantidadeAtual`, 0) - COALESCE(l.`quantidadeQuarentena`, 0)),
  0,
  NOW(3)
FROM `lotes` l
WHERE l.`deletedAt` IS NULL
ON DUPLICATE KEY UPDATE
  `quantidadeTotal` = VALUES(`quantidadeTotal`),
  `quantidadeDisponivel` = VALUES(`quantidadeDisponivel`),
  `lastUpdated` = NOW(3);

-- 4. Backfill fatura_item_lotes a partir de fatura_itens.loteId legado
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

-- 5. FKs
ALTER TABLE `lote_stock_balances`
  ADD CONSTRAINT `lote_stock_balances_loteId_fkey`
  FOREIGN KEY (`loteId`) REFERENCES `lotes`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `fatura_item_lotes`
  ADD CONSTRAINT `fatura_item_lotes_faturaItemId_fkey`
  FOREIGN KEY (`faturaItemId`) REFERENCES `fatura_itens`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `fatura_item_lotes`
  ADD CONSTRAINT `fatura_item_lotes_loteId_fkey`
  FOREIGN KEY (`loteId`) REFERENCES `lotes`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- 6. Remover fonte duplicada de stock no lote
ALTER TABLE `lotes` DROP COLUMN `quantidadeAtual`;
