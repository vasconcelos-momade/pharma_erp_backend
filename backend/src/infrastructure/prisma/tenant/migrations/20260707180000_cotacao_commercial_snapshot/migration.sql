-- Snapshot comercial persistente para cotações (cliente manual, totais e itens).

-- 1. Nome comercial do cliente (snapshot)
ALTER TABLE `cotacoes`
  ADD COLUMN `cliente` VARCHAR(191) NULL AFTER `numero`;

UPDATE `cotacoes` c
INNER JOIN `clientes` cl ON cl.id = c.clienteId
SET c.cliente = cl.nome
WHERE c.cliente IS NULL OR c.cliente = '';

UPDATE `cotacoes`
SET `cliente` = CONCAT('Cliente #', `clienteId`)
WHERE `cliente` IS NULL OR `cliente` = '';

ALTER TABLE `cotacoes`
  MODIFY `cliente` VARCHAR(191) NOT NULL;

-- 2. clienteId opcional
ALTER TABLE `cotacoes` DROP FOREIGN KEY `cotacoes_clienteId_fkey`;
ALTER TABLE `cotacoes` MODIFY `clienteId` BIGINT UNSIGNED NULL;
ALTER TABLE `cotacoes`
  ADD CONSTRAINT `cotacoes_clienteId_fkey`
  FOREIGN KEY (`clienteId`) REFERENCES `clientes`(`id`)
  ON DELETE SET NULL ON UPDATE CASCADE;

-- 3. Totais persistidos + aprovação
ALTER TABLE `cotacoes`
  ADD COLUMN `subtotal` DECIMAL(14, 2) NOT NULL DEFAULT 0 AFTER `userId`,
  ADD COLUMN `ivaTotal` DECIMAL(14, 2) NOT NULL DEFAULT 0 AFTER `desconto`,
  ADD COLUMN `total` DECIMAL(14, 2) NOT NULL DEFAULT 0 AFTER `ivaTotal`,
  ADD COLUMN `aprovadoPorId` BIGINT UNSIGNED NULL AFTER `observacoes`,
  ADD COLUMN `aprovadoEm` DATETIME(3) NULL AFTER `aprovadoPorId`;

ALTER TABLE `cotacoes`
  ADD CONSTRAINT `cotacoes_aprovadoPorId_fkey`
  FOREIGN KEY (`aprovadoPorId`) REFERENCES `users`(`id`)
  ON DELETE SET NULL ON UPDATE CASCADE;

-- 4. Snapshot por item
ALTER TABLE `cotacao_itens`
  ADD COLUMN `descricao` VARCHAR(191) NULL AFTER `servicoId`,
  ADD COLUMN `desconto` DECIMAL(14, 2) NOT NULL DEFAULT 0 AFTER `precoUnit`,
  ADD COLUMN `iva` DECIMAL(5, 2) NOT NULL DEFAULT 0 AFTER `desconto`,
  ADD COLUMN `valorIva` DECIMAL(14, 2) NOT NULL DEFAULT 0 AFTER `iva`,
  ADD COLUMN `subtotal` DECIMAL(14, 2) NOT NULL DEFAULT 0 AFTER `valorIva`,
  ADD COLUMN `total` DECIMAL(14, 2) NOT NULL DEFAULT 0 AFTER `subtotal`;

UPDATE `cotacao_itens` ci
LEFT JOIN `produtos` p ON p.id = ci.produtoId
LEFT JOIN `servicos` s ON s.id = ci.servicoId
SET ci.descricao = COALESCE(p.nomeComercial, s.nome, 'Item')
WHERE ci.descricao IS NULL OR ci.descricao = '';

UPDATE `cotacao_itens`
SET
  `subtotal` = `quantidade` * `precoUnit`,
  `total` = `quantidade` * `precoUnit`
WHERE `subtotal` = 0;

ALTER TABLE `cotacao_itens`
  MODIFY `descricao` VARCHAR(191) NOT NULL;

CREATE INDEX `cotacao_itens_cotacaoId_idx` ON `cotacao_itens`(`cotacaoId`);
