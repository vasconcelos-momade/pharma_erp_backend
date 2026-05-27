-- Stock PDV para tenant_farmacia_1779294744 (tenant id 1)
-- Executar: docker exec -i skalway_pharm_mysql mysql -uroot -proot_password tenant_farmacia_1779294744 < scripts/seed-pos-stock-tenant1.sql

USE tenant_farmacia_1779294744;

-- Produtos activos sem stock visível no POS
UPDATE produtos
SET estoqueAtual = 50.00
WHERE deletedAt IS NULL
  AND ativo = 1
  AND estoqueAtual < 10;

-- Sincronizar read model de disponibilidade
INSERT INTO stock_balances (
  produtoId,
  quantidadeTotal,
  quantidadeReservada,
  quantidadeDisponivel,
  lastUpdated
)
SELECT
  p.id,
  p.estoqueAtual,
  0,
  p.estoqueAtual,
  NOW(3)
FROM produtos p
WHERE p.deletedAt IS NULL
  AND p.ativo = 1
ON DUPLICATE KEY UPDATE
  quantidadeTotal = VALUES(quantidadeTotal),
  quantidadeDisponivel = GREATEST(0, VALUES(quantidadeTotal) - quantidadeReservada),
  lastUpdated = NOW(3);

-- Produtos que aparecem no topo da pesquisa POS (sem stock)
UPDATE produtos SET estoqueAtual = 50.00 WHERE id IN (17631, 13455, 17188);
INSERT INTO stock_balances (produtoId, quantidadeTotal, quantidadeReservada, quantidadeDisponivel, lastUpdated)
VALUES
  (17631, 50, 0, 50, NOW(3)),
  (13455, 50, 0, 50, NOW(3)),
  (17188, 50, 0, 50, NOW(3))
ON DUPLICATE KEY UPDATE
  quantidadeTotal = 50,
  quantidadeDisponivel = GREATEST(0, 50 - quantidadeReservada),
  lastUpdated = NOW(3);

SELECT COUNT(*) AS produtos_com_stock FROM produtos WHERE deletedAt IS NULL AND ativo = 1 AND estoqueAtual >= 10;
