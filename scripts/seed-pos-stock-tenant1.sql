-- Stock PDV para tenant_farmacia_1779294744 (tenant id 1)
-- Executar: docker exec -i skalway_pharm_mysql mysql -uroot -proot_password tenant_farmacia_1779294744 < scripts/seed-pos-stock-tenant1.sql

USE tenant_farmacia_1779294744;

-- Sincronizar read model de disponibilidade para produtos activos
INSERT INTO stock_balances (
  produtoId,
  quantidadeTotal,
  quantidadeReservada,
  quantidadeDisponivel,
  lastUpdated
)
SELECT
  p.id,
  50,
  0,
  50,
  NOW(3)
FROM produtos p
WHERE p.deletedAt IS NULL
  AND p.ativo = 1
ON DUPLICATE KEY UPDATE
  quantidadeTotal = CASE
    WHEN stock_balances.quantidadeTotal < 10 THEN 50
    ELSE stock_balances.quantidadeTotal
  END,
  quantidadeDisponivel = GREATEST(
    0,
    CASE
      WHEN stock_balances.quantidadeTotal < 10 THEN 50
      ELSE stock_balances.quantidadeTotal
    END - stock_balances.quantidadeReservada
  ),
  lastUpdated = NOW(3);

-- Produtos que aparecem no topo da pesquisa POS (sem stock)
INSERT INTO stock_balances (produtoId, quantidadeTotal, quantidadeReservada, quantidadeDisponivel, lastUpdated)
VALUES
  (17631, 50, 0, 50, NOW(3)),
  (13455, 50, 0, 50, NOW(3)),
  (17188, 50, 0, 50, NOW(3))
ON DUPLICATE KEY UPDATE
  quantidadeTotal = 50,
  quantidadeDisponivel = GREATEST(0, 50 - quantidadeReservada),
  lastUpdated = NOW(3);

SELECT COUNT(*) AS produtos_com_stock
FROM stock_balances sb
INNER JOIN produtos p ON p.id = sb.produtoId
WHERE p.deletedAt IS NULL
  AND p.ativo = 1
  AND sb.quantidadeDisponivel >= 10;
