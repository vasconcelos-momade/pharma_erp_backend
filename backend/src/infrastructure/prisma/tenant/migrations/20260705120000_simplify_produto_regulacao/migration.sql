-- Simplifica produto_regulacao (campos legais essenciais) e produto_classificacao_eventos

-- 1. Migrar rule/reason/matchedTerm/policySnapshot → snapshot
ALTER TABLE `produto_classificacao_eventos`
  ADD COLUMN `snapshot_new` JSON NULL AFTER `policySnapshot`,
  ADD COLUMN `observacao` TEXT NULL AFTER `source`;

UPDATE `produto_classificacao_eventos`
SET
  `snapshot_new` = JSON_MERGE_PATCH(
    COALESCE(`policySnapshot`, JSON_OBJECT()),
    JSON_OBJECT(
      'rule', `rule`,
      'reason', `reason`,
      'matchedTerm', `matchedTerm`
    )
  ),
  `observacao` = `reason`
WHERE `rule` IS NOT NULL OR `reason` IS NOT NULL OR `matchedTerm` IS NOT NULL;

UPDATE `produto_classificacao_eventos`
SET `snapshot_new` = `policySnapshot`
WHERE `snapshot_new` IS NULL AND `policySnapshot` IS NOT NULL;

-- 2. Converter source VARCHAR → enum ClassificacaoSource
ALTER TABLE `produto_classificacao_eventos`
  ADD COLUMN `source_new` ENUM('MANUAL', 'REGRA', 'IMPORTACAO', 'IA') NOT NULL DEFAULT 'REGRA' AFTER `produtoId`;

UPDATE `produto_classificacao_eventos`
SET `source_new` = CASE
  WHEN `source` LIKE 'seed:%' OR `source` LIKE '%import%' THEN 'IMPORTACAO'
  WHEN `source` LIKE 'api:%' THEN 'MANUAL'
  WHEN `source` LIKE '%ia%' OR `source` LIKE '%AI%' THEN 'IA'
  ELSE 'REGRA'
END;

ALTER TABLE `produto_classificacao_eventos`
  DROP COLUMN `rule`,
  DROP COLUMN `reason`,
  DROP COLUMN `matchedTerm`,
  DROP COLUMN `source`,
  DROP COLUMN `policySnapshot`;

ALTER TABLE `produto_classificacao_eventos`
  CHANGE COLUMN `source_new` `source` ENUM('MANUAL', 'REGRA', 'IMPORTACAO', 'IA') NOT NULL,
  CHANGE COLUMN `snapshot_new` `snapshot` JSON NULL;

-- 3. Remover colunas derivadas de produto_regulacao (manter flags legais)
ALTER TABLE `produto_regulacao`
  DROP INDEX `produto_regulacao_requiresManualReview_idx`,
  DROP COLUMN `antimicrobiano`,
  DROP COLUMN `requiresDoubleCheck`,
  DROP COLUMN `requiresManualReview`,
  DROP COLUMN `riskLevel`,
  DROP COLUMN `classificadoEm`,
  DROP COLUMN `classificadoPor`;
