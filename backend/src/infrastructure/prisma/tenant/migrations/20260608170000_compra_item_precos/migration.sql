-- Rename preco -> precoCompra
ALTER TABLE `compras_itens` CHANGE COLUMN `preco` `precoCompra` DECIMAL(10, 2) NOT NULL;

-- Add precoVenda (optional)
ALTER TABLE `compras_itens` ADD COLUMN `precoVenda` DECIMAL(10, 2) NULL AFTER `precoCompra`;

-- Backfill precoVenda from produto catalog
UPDATE `compras_itens` ci
INNER JOIN `produtos` p ON p.id = ci.produtoId
SET ci.precoVenda = p.precoVenda
WHERE ci.precoVenda IS NULL;
