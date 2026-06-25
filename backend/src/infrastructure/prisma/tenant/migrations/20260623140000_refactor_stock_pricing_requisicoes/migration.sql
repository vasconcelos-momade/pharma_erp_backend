-- Produto = catálogo (sem preço nem stock persistido)
-- Requisicoes: nomenclatura única (idempotente para bases db push ou legadas)

DROP PROCEDURE IF EXISTS migrate_refactor_stock_pricing_requisicoes;

DELIMITER //
CREATE PROCEDURE migrate_refactor_stock_pricing_requisicoes()
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'produtos'
      AND COLUMN_NAME = 'precoVenda'
  ) THEN
    ALTER TABLE `produtos` DROP COLUMN `precoVenda`;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.TABLES
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'transferencias'
  ) THEN
    RENAME TABLE `transferencias` TO `requisicoes`;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.TABLES
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'transferencia_itens'
  ) THEN
    RENAME TABLE `transferencia_itens` TO `requisicao_itens`;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'requisicao_itens'
      AND COLUMN_NAME = 'transferenciaId'
  ) THEN
    ALTER TABLE `requisicao_itens`
      CHANGE COLUMN `transferenciaId` `requisicaoId` BIGINT UNSIGNED NOT NULL;
  END IF;
END //
DELIMITER ;

CALL migrate_refactor_stock_pricing_requisicoes();
DROP PROCEDURE migrate_refactor_stock_pricing_requisicoes;
