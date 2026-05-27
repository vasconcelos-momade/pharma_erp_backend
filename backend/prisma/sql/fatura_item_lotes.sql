-- Fase FEFO: rastreabilidade multi-lote por linha de fatura (expand).
-- Aplicar em cada base tenant_* após db push ou manualmente se a tabela ainda não existir.

CREATE TABLE IF NOT EXISTS `fatura_item_lotes` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `faturaItemId` BIGINT UNSIGNED NOT NULL,
  `loteId` BIGINT UNSIGNED NOT NULL,
  `quantidade` DECIMAL(14, 2) NOT NULL,
  `custoUnitario` DECIMAL(10, 2) NOT NULL,
  `ordemFefo` INT NOT NULL DEFAULT 0,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE INDEX `fatura_item_lotes_faturaItemId_loteId_key` (`faturaItemId`, `loteId`),
  INDEX `fatura_item_lotes_faturaItemId_idx` (`faturaItemId`),
  INDEX `fatura_item_lotes_loteId_idx` (`loteId`),
  CONSTRAINT `fatura_item_lotes_faturaItemId_fkey`
    FOREIGN KEY (`faturaItemId`) REFERENCES `fatura_itens`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fatura_item_lotes_loteId_fkey`
    FOREIGN KEY (`loteId`) REFERENCES `lotes`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
