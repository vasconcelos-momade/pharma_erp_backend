-- Migrar movimentos legados de compra para o novo tipo COMPRA
UPDATE `estoque_movimentos`
SET `tipo` = 'COMPRA', `origem` = 'COMPRA'
WHERE `tipo` = 'ENTRADA' AND `origem` = 'COMPRA_FORNECEDOR';

-- Remover referência de contas a pagar às compras
ALTER TABLE `contas_pagar` DROP FOREIGN KEY `contas_pagar_compraId_fkey`;
ALTER TABLE `contas_pagar` DROP COLUMN `compraId`;

-- Remover modelo tradicional de compra
DROP TABLE IF EXISTS `compras_itens`;
DROP TABLE IF EXISTS `compras`;

-- Adicionar tipo COMPRA ao enum de movimentação
ALTER TABLE `estoque_movimentos`
  MODIFY `tipo` ENUM('ENTRADA', 'COMPRA', 'SAIDA', 'AJUSTE', 'DEVOLUCAO', 'QUARENTENA', 'INCINERACAO') NOT NULL;
