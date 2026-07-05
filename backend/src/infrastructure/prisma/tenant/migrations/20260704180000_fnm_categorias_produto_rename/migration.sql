-- FNM: codigoFNM em categorias + rename produto.nome/substanciaActiva

ALTER TABLE `categorias`
  ADD COLUMN `codigoFNM` VARCHAR(64) NULL;

CREATE UNIQUE INDEX `categorias_codigoFNM_key` ON `categorias`(`codigoFNM`);

ALTER TABLE `produtos`
  ADD COLUMN `nomeComercial` VARCHAR(191) NULL,
  ADD COLUMN `nomeGenerico` TEXT NULL;

UPDATE `produtos`
SET
  `nomeComercial` = `nome`,
  `nomeGenerico` = `substanciaActiva`
WHERE `nomeComercial` IS NULL;

ALTER TABLE `produtos`
  MODIFY `nomeComercial` VARCHAR(191) NOT NULL;

ALTER TABLE `produtos`
  DROP COLUMN `nome`,
  DROP COLUMN `substanciaActiva`;

-- Seed categorias FNM (Nível 1)
INSERT INTO `categorias` (`nome`, `codigoFNM`, `descricao`, `ativo`, `version`, `createdAt`, `updatedAt`)
VALUES
  ('CARDIOVASCULAR', 'CARDIOVASCULAR', 'Categoria terapêutica FNM', true, 0, NOW(3), NOW(3)),
  ('DIGESTIVO', 'DIGESTIVO', 'Categoria terapêutica FNM', true, 0, NOW(3), NOW(3)),
  ('ENDOCRINOLOGIA_METABOLISMO', 'ENDOCRINOLOGIA_METABOLISMO', 'Categoria terapêutica FNM', true, 0, NOW(3), NOW(3)),
  ('GENITO_URINARIO', 'GENITO_URINARIO', 'Categoria terapêutica FNM', true, 0, NOW(3), NOW(3)),
  ('RESPIRATORIO', 'RESPIRATORIO', 'Categoria terapêutica FNM', true, 0, NOW(3), NOW(3)),
  ('SANGUE_HEMATOPOIETICO', 'SANGUE_HEMATOPOIETICO', 'Categoria terapêutica FNM', true, 0, NOW(3), NOW(3)),
  ('SISTEMA_NERVOSO_CENTRAL', 'SISTEMA_NERVOSO_CENTRAL', 'Categoria terapêutica FNM', true, 0, NOW(3), NOW(3)),
  ('ANTIMICROBIANOS', 'ANTIMICROBIANOS', 'Categoria terapêutica FNM', true, 0, NOW(3), NOW(3)),
  ('CITOSTATICOS_IMUNOSSUPRESSORES', 'CITOSTATICOS_IMUNOSSUPRESSORES', 'Categoria terapêutica FNM', true, 0, NOW(3), NOW(3)),
  ('DIURETICOS', 'DIURETICOS', 'Categoria terapêutica FNM', true, 0, NOW(3), NOW(3)),
  ('HIDROELETROLITICO_ACIDO_BASE', 'HIDROELETROLITICO_ACIDO_BASE', 'Categoria terapêutica FNM', true, 0, NOW(3), NOW(3)),
  ('NUTRICAO_VITAMINAS_MINERAIS', 'NUTRICAO_VITAMINAS_MINERAIS', 'Categoria terapêutica FNM', true, 0, NOW(3), NOW(3)),
  ('ANTI_ALERGICOS', 'ANTI_ALERGICOS', 'Categoria terapêutica FNM', true, 0, NOW(3), NOW(3)),
  ('MUSCULO_ESQUELETICO', 'MUSCULO_ESQUELETICO', 'Categoria terapêutica FNM', true, 0, NOW(3), NOW(3)),
  ('DERMATOLOGIA', 'DERMATOLOGIA', 'Categoria terapêutica FNM', true, 0, NOW(3), NOW(3)),
  ('OTORRINOLARINGOLOGIA', 'OTORRINOLARINGOLOGIA', 'Categoria terapêutica FNM', true, 0, NOW(3), NOW(3)),
  ('OFTALMOLOGIA', 'OFTALMOLOGIA', 'Categoria terapêutica FNM', true, 0, NOW(3), NOW(3)),
  ('ANESTESIA_REANIMACAO', 'ANESTESIA_REANIMACAO', 'Categoria terapêutica FNM', true, 0, NOW(3), NOW(3)),
  ('IMUNOLOGICOS', 'IMUNOLOGICOS', 'Categoria terapêutica FNM', true, 0, NOW(3), NOW(3)),
  ('ANTISSEPTICOS_DESINFETANTES', 'ANTISSEPTICOS_DESINFETANTES', 'Categoria terapêutica FNM', true, 0, NOW(3), NOW(3)),
  ('ANTIDOTOS', 'ANTIDOTOS', 'Categoria terapêutica FNM', true, 0, NOW(3), NOW(3)),
  ('DIAGNOSTICO', 'DIAGNOSTICO', 'Categoria terapêutica FNM', true, 0, NOW(3), NOW(3))
ON DUPLICATE KEY UPDATE
  `codigoFNM` = VALUES(`codigoFNM`),
  `descricao` = VALUES(`descricao`),
  `ativo` = true,
  `updatedAt` = NOW(3);

-- Tabela criada via db push em tenants existentes; em bases novas ainda não existe.
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

-- Remapear produtos: antimicrobianos → categoria FNM ANTMIICROBIANOS
UPDATE `produtos` p
INNER JOIN `produto_regulacao` pr ON pr.`produtoId` = p.`id`
INNER JOIN `categorias` fnm ON fnm.`codigoFNM` = 'ANTIMICROBIANOS'
SET p.`categoriaId` = fnm.`id`
WHERE pr.`antimicrobiano` = true;

-- Demais produtos em categorias legadas → SISTEMA_NERVOSO_CENTRAL (default FNM)
UPDATE `produtos` p
INNER JOIN `categorias` leg ON leg.`id` = p.`categoriaId` AND leg.`codigoFNM` IS NULL
INNER JOIN `categorias` fnm ON fnm.`codigoFNM` = 'SISTEMA_NERVOSO_CENTRAL'
SET p.`categoriaId` = fnm.`id`;

-- Desactivar categorias legadas (não-FNM)
UPDATE `categorias`
SET `ativo` = false, `updatedAt` = NOW(3)
WHERE `codigoFNM` IS NULL;
