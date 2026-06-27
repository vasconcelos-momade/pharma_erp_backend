-- Produto = catálogo (sem preço nem stock persistido)
-- Requisicoes: nomenclatura única (bases novas via migrate deploy)

ALTER TABLE `produtos` DROP COLUMN `precoVenda`;

RENAME TABLE `transferencias` TO `requisicoes`;

RENAME TABLE `transferencia_itens` TO `requisicao_itens`;

ALTER TABLE `requisicao_itens`
  CHANGE COLUMN `transferenciaId` `requisicaoId` BIGINT UNSIGNED NOT NULL;
