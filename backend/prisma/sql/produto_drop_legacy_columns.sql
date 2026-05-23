-- Contract: remove colunas regulatórias duplicadas de `produtos` (dados em produto_regulacao).

SET @db := DATABASE();

SET @sql := (
  SELECT IF(
    COUNT(*) > 0,
    'ALTER TABLE `produtos` DROP COLUMN `classificacaoRule`',
    'SELECT 1'
  )
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'produtos' AND COLUMN_NAME = 'classificacaoRule'
);
PREPARE s1 FROM @sql; EXECUTE s1; DEALLOCATE PREPARE s1;

SET @sql := (
  SELECT IF(
    COUNT(*) > 0,
    'ALTER TABLE `produtos` DROP COLUMN `classificacaoReason`',
    'SELECT 1'
  )
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'produtos' AND COLUMN_NAME = 'classificacaoReason'
);
PREPARE s2 FROM @sql; EXECUTE s2; DEALLOCATE PREPARE s2;

SET @sql := (
  SELECT IF(
    COUNT(*) > 0,
    'ALTER TABLE `produtos` DROP COLUMN `classificacaoMatchedTerm`',
    'SELECT 1'
  )
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'produtos' AND COLUMN_NAME = 'classificacaoMatchedTerm'
);
PREPARE s3 FROM @sql; EXECUTE s3; DEALLOCATE PREPARE s3;

SET @sql := (
  SELECT IF(
    COUNT(*) > 0,
    'ALTER TABLE `produtos` DROP COLUMN `antimicrobiano`',
    'SELECT 1'
  )
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'produtos' AND COLUMN_NAME = 'antimicrobiano'
);
PREPARE s4 FROM @sql; EXECUTE s4; DEALLOCATE PREPARE s4;

SET @sql := (
  SELECT IF(
    COUNT(*) > 0,
    'ALTER TABLE `produtos` DROP COLUMN `tipoDispensacao`',
    'SELECT 1'
  )
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'produtos' AND COLUMN_NAME = 'tipoDispensacao'
);
PREPARE s5 FROM @sql; EXECUTE s5; DEALLOCATE PREPARE s5;

SET @sql := (
  SELECT IF(
    COUNT(*) > 0,
    'ALTER TABLE `produtos` DROP COLUMN `requiresPrescription`',
    'SELECT 1'
  )
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'produtos' AND COLUMN_NAME = 'requiresPrescription'
);
PREPARE s6 FROM @sql; EXECUTE s6; DEALLOCATE PREPARE s6;

SET @sql := (
  SELECT IF(
    COUNT(*) > 0,
    'ALTER TABLE `produtos` DROP COLUMN `requiresDoubleCheck`',
    'SELECT 1'
  )
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'produtos' AND COLUMN_NAME = 'requiresDoubleCheck'
);
PREPARE s7 FROM @sql; EXECUTE s7; DEALLOCATE PREPARE s7;

SET @sql := (
  SELECT IF(
    COUNT(*) > 0,
    'ALTER TABLE `produtos` DROP COLUMN `requiresPsychotropicBook`',
    'SELECT 1'
  )
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'produtos' AND COLUMN_NAME = 'requiresPsychotropicBook'
);
PREPARE s8 FROM @sql; EXECUTE s8; DEALLOCATE PREPARE s8;

SET @sql := (
  SELECT IF(
    COUNT(*) > 0,
    'ALTER TABLE `produtos` DROP COLUMN `requiresManualReview`',
    'SELECT 1'
  )
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'produtos' AND COLUMN_NAME = 'requiresManualReview'
);
PREPARE s9 FROM @sql; EXECUTE s9; DEALLOCATE PREPARE s9;

SET @sql := (
  SELECT IF(
    COUNT(*) > 0,
    'ALTER TABLE `produtos` DROP COLUMN `riskLevel`',
    'SELECT 1'
  )
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'produtos' AND COLUMN_NAME = 'riskLevel'
);
PREPARE s10 FROM @sql; EXECUTE s10; DEALLOCATE PREPARE s10;
