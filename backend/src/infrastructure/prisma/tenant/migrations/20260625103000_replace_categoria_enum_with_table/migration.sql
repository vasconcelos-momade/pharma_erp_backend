CREATE TABLE `categorias` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `nome` VARCHAR(191) NOT NULL,
  `descricao` TEXT NULL,
  `ativo` BOOLEAN NOT NULL DEFAULT true,
  `version` INTEGER NOT NULL DEFAULT 0,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `deletedAt` DATETIME(3) NULL,
  UNIQUE INDEX `categorias_nome_key`(`nome`),
  INDEX `categorias_ativo_idx`(`ativo`),
  INDEX `categorias_deletedAt_idx`(`deletedAt`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

INSERT INTO `categorias` (`nome`, `descricao`, `ativo`, `version`, `createdAt`, `updatedAt`)
SELECT 'Medicamentos', 'Migrado automaticamente do enum CategoriaProduto.MEDICAMENTO', true, 0, NOW(3), NOW(3)
WHERE NOT EXISTS (SELECT 1 FROM `categorias` WHERE `nome` = 'Medicamentos');

INSERT INTO `categorias` (`nome`, `descricao`, `ativo`, `version`, `createdAt`, `updatedAt`)
SELECT 'Consumíveis', 'Migrado automaticamente do enum CategoriaProduto.CONSUMIVEL', true, 0, NOW(3), NOW(3)
WHERE NOT EXISTS (SELECT 1 FROM `categorias` WHERE `nome` = 'Consumíveis');

INSERT INTO `categorias` (`nome`, `descricao`, `ativo`, `version`, `createdAt`, `updatedAt`)
SELECT 'Equipamentos', 'Migrado automaticamente do enum CategoriaProduto.EQUIPAMENTO', true, 0, NOW(3), NOW(3)
WHERE NOT EXISTS (SELECT 1 FROM `categorias` WHERE `nome` = 'Equipamentos');

INSERT INTO `categorias` (`nome`, `descricao`, `ativo`, `version`, `createdAt`, `updatedAt`)
SELECT 'Higiene', 'Migrado automaticamente do enum CategoriaProduto.HIGIENE', true, 0, NOW(3), NOW(3)
WHERE NOT EXISTS (SELECT 1 FROM `categorias` WHERE `nome` = 'Higiene');

INSERT INTO `categorias` (`nome`, `descricao`, `ativo`, `version`, `createdAt`, `updatedAt`)
SELECT 'Suplementos', 'Migrado automaticamente do enum CategoriaProduto.SUPLEMENTO', true, 0, NOW(3), NOW(3)
WHERE NOT EXISTS (SELECT 1 FROM `categorias` WHERE `nome` = 'Suplementos');

INSERT INTO `categorias` (`nome`, `descricao`, `ativo`, `version`, `createdAt`, `updatedAt`)
SELECT 'Outros', 'Migrado automaticamente do enum CategoriaProduto.OUTRO', true, 0, NOW(3), NOW(3)
WHERE NOT EXISTS (SELECT 1 FROM `categorias` WHERE `nome` = 'Outros');

ALTER TABLE `produtos`
  ADD COLUMN `categoriaId` BIGINT UNSIGNED NULL;

UPDATE `produtos` p
JOIN `categorias` c
  ON c.`nome` = CASE p.`categoria`
    WHEN 'MEDICAMENTO' THEN 'Medicamentos'
    WHEN 'CONSUMIVEL' THEN 'Consumíveis'
    WHEN 'EQUIPAMENTO' THEN 'Equipamentos'
    WHEN 'HIGIENE' THEN 'Higiene'
    WHEN 'SUPLEMENTO' THEN 'Suplementos'
    ELSE 'Outros'
  END
SET p.`categoriaId` = c.`id`
WHERE p.`categoriaId` IS NULL;

ALTER TABLE `produtos`
  MODIFY `categoriaId` BIGINT UNSIGNED NOT NULL;

ALTER TABLE `produtos`
  DROP INDEX `produtos_categoria_idx`,
  ADD INDEX `produtos_categoriaId_idx`(`categoriaId`);

ALTER TABLE `produtos`
  ADD CONSTRAINT `produtos_categoriaId_fkey`
    FOREIGN KEY (`categoriaId`) REFERENCES `categorias`(`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `produtos`
  DROP COLUMN `categoria`;
