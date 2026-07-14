-- Campos de pagamento em dinheiro na fatura (PDV)
ALTER TABLE `faturas`
  ADD COLUMN `valorRecebido` DECIMAL(14, 2) NULL AFTER `total`,
  ADD COLUMN `troco` DECIMAL(14, 2) NOT NULL DEFAULT 0 AFTER `valorRecebido`;
