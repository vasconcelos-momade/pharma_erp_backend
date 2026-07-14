-- Expand: quantidade -> quantidadeSugerida + quantidadeAprovada
ALTER TABLE `compras_itens`
  ADD COLUMN `quantidadeSugerida` DECIMAL(10, 2) NOT NULL DEFAULT 0 AFTER `produtoId`,
  ADD COLUMN `quantidadeAprovada` DECIMAL(10, 2) NOT NULL DEFAULT 0 AFTER `quantidadeSugerida`;

UPDATE `compras_itens`
SET
  `quantidadeSugerida` = `quantidade`,
  `quantidadeAprovada` = `quantidade`
WHERE `quantidade` IS NOT NULL;

ALTER TABLE `compras_itens` DROP COLUMN `quantidade`;
