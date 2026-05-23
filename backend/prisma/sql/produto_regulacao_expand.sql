-- Expand-contract: regulacao + eventos (sem classificacaoAnarme — usa tipoDispensacao).

CREATE TABLE IF NOT EXISTS `produto_regulacao` (
    `produtoId` BIGINT UNSIGNED NOT NULL,
    `antimicrobiano` BOOLEAN NOT NULL DEFAULT false,
    `tipoDispensacao` ENUM('VENDA_LIVRE', 'RECEITA_SIMPLES', 'RECEITA_CONTROLADA', 'RECEITA_OBRIGATORIA', 'RECEITA_RETIDA', 'PSICOTROPICO', 'NARCOTICO') NOT NULL DEFAULT 'VENDA_LIVRE',
    `requiresPrescription` BOOLEAN NOT NULL DEFAULT false,
    `requiresDoubleCheck` BOOLEAN NOT NULL DEFAULT false,
    `requiresPsychotropicBook` BOOLEAN NOT NULL DEFAULT false,
    `requiresManualReview` BOOLEAN NOT NULL DEFAULT false,
    `riskLevel` ENUM('LOW', 'MEDIUM', 'HIGH', 'CRITICAL') NOT NULL DEFAULT 'LOW',
    `policyVersion` INTEGER NOT NULL DEFAULT 2,
    `classificadoEm` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `classificadoPor` VARCHAR(100) NULL,
    `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    PRIMARY KEY (`produtoId`),
    INDEX `produto_regulacao_tipoDispensacao_idx`(`tipoDispensacao`),
    INDEX `produto_regulacao_requiresManualReview_idx`(`requiresManualReview`),
    CONSTRAINT `produto_regulacao_produtoId_fkey` FOREIGN KEY (`produtoId`) REFERENCES `produtos`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `produto_classificacao_eventos` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `produtoId` BIGINT UNSIGNED NOT NULL,
    `rule` VARCHAR(100) NOT NULL,
    `reason` TEXT NULL,
    `matchedTerm` VARCHAR(191) NULL,
    `source` VARCHAR(100) NOT NULL,
    `policySnapshot` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    PRIMARY KEY (`id`),
    INDEX `produto_classificacao_eventos_produtoId_createdAt_idx`(`produtoId`, `createdAt`),
    CONSTRAINT `produto_classificacao_eventos_produtoId_fkey` FOREIGN KEY (`produtoId`) REFERENCES `produtos`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Remover coluna obsoleta se existir (bases já migradas com expand anterior)
SET @db := DATABASE();
SET @drop_produto := (
  SELECT IF(
    COUNT(*) > 0,
    'ALTER TABLE `produtos` DROP COLUMN `classificacaoAnarme`',
    'SELECT 1'
  )
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'produtos' AND COLUMN_NAME = 'classificacaoAnarme'
);
PREPARE stmt FROM @drop_produto;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @drop_disp := (
  SELECT IF(
    COUNT(*) > 0,
    'ALTER TABLE `dispensacoes` DROP COLUMN `classificacaoAnarme`',
    'SELECT 1'
  )
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'dispensacoes' AND COLUMN_NAME = 'classificacaoAnarme'
);
PREPARE stmt2 FROM @drop_disp;
EXECUTE stmt2;
DEALLOCATE PREPARE stmt2;

SET @drop_reg := (
  SELECT IF(
    COUNT(*) > 0,
    'ALTER TABLE `produto_regulacao` DROP COLUMN `classificacaoAnarme`',
    'SELECT 1'
  )
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'produto_regulacao' AND COLUMN_NAME = 'classificacaoAnarme'
);
PREPARE stmt3 FROM @drop_reg;
EXECUTE stmt3;
DEALLOCATE PREPARE stmt3;
