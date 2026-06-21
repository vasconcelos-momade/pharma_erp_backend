-- Backfill stock_balances a partir do cache legado antes de remover a coluna.
INSERT INTO `stock_balances` (
  `produtoId`,
  `quantidadeTotal`,
  `quantidadeReservada`,
  `quantidadeDisponivel`,
  `version`,
  `lastUpdated`
)
SELECT
  p.`id`,
  COALESCE(p.`estoqueAtual`, 0),
  0,
  COALESCE(p.`estoqueAtual`, 0),
  0,
  NOW(3)
FROM `produtos` p
WHERE p.`deletedAt` IS NULL
ON DUPLICATE KEY UPDATE
  `quantidadeTotal` = CASE
    WHEN `stock_balances`.`quantidadeTotal` = 0 THEN VALUES(`quantidadeTotal`)
    ELSE `stock_balances`.`quantidadeTotal`
  END,
  `quantidadeDisponivel` = CASE
    WHEN `stock_balances`.`quantidadeDisponivel` = 0 THEN VALUES(`quantidadeDisponivel`)
    ELSE `stock_balances`.`quantidadeDisponivel`
  END,
  `lastUpdated` = NOW(3);

ALTER TABLE `produtos` DROP COLUMN `estoqueAtual`;
