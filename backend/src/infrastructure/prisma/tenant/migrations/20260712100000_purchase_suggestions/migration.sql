CREATE TABLE `purchase_suggestions` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `produtoId` BIGINT UNSIGNED NOT NULL,
  `quantidadeAtual` DECIMAL(14, 2) NOT NULL,
  `estoqueMinimo` DECIMAL(14, 2) NOT NULL,
  `consumoMedioDiario` DECIMAL(14, 4) NOT NULL,
  `quantidadeSugerida` DECIMAL(14, 2) NOT NULL,
  `coberturaDias` INTEGER NOT NULL DEFAULT 30,
  `origem` ENUM('AUTOMATICA', 'MANUAL') NOT NULL DEFAULT 'AUTOMATICA',
  `observacao` TEXT NULL,
  `generatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `purchase_suggestions_produtoId_key`(`produtoId`),
  INDEX `purchase_suggestions_origem_idx`(`origem`),
  CONSTRAINT `purchase_suggestions_produtoId_fkey` FOREIGN KEY (`produtoId`) REFERENCES `produtos`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
