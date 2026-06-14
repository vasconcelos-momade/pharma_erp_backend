-- Unificar COMPRA no modelo de requisicoes (transferencias)
ALTER TABLE `transferencias`
  ADD COLUMN `fornecedorId` BIGINT UNSIGNED NULL AFTER `observacao`,
  ADD COLUMN `total` DECIMAL(14, 2) NULL AFTER `fornecedorId`;

ALTER TABLE `transferencias`
  ADD INDEX `transferencias_fornecedorId_idx` (`fornecedorId`),
  ADD INDEX `transferencias_tipo_idx` (`tipo`);

ALTER TABLE `transferencias`
  ADD CONSTRAINT `transferencias_fornecedorId_fkey`
    FOREIGN KEY (`fornecedorId`) REFERENCES `fornecedores`(`id`)
    ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `transferencia_itens`
  CHANGE COLUMN `quantidade` `quantidadeSolicitada` DECIMAL(14, 2) NOT NULL;

ALTER TABLE `transferencia_itens`
  ADD COLUMN `numeroLote` VARCHAR(100) NULL AFTER `quantidadeSolicitada`,
  ADD COLUMN `dataValidade` DATETIME(3) NULL AFTER `numeroLote`,
  ADD COLUMN `precoCompra` DECIMAL(10, 2) NULL AFTER `dataValidade`,
  ADD COLUMN `precoVenda` DECIMAL(10, 2) NULL AFTER `precoCompra`,
  ADD COLUMN `subtotal` DECIMAL(14, 2) NULL AFTER `precoVenda`;

ALTER TABLE `transferencias`
  MODIFY COLUMN `tipo` ENUM('COMPRA', 'ENTRADA', 'SAIDA') NOT NULL DEFAULT 'SAIDA';
