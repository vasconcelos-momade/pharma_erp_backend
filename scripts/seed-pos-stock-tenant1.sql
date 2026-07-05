-- Stock PDV: sincroniza projeções stock_balances + lote_stock_balances.
-- Uso: docker exec -i skalway_pharm_mysql mysql -uroot -proot_password tenant_farmacia_1783200600 < scripts/seed-pos-stock-tenant1.sql
-- Altere o nome da base no comando acima conforme o tenant.

USE tenant_farmacia_1783200600;

-- Sincronizar read model de disponibilidade para produtos activos (mínimo 50 un.)
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

-- Projeção por lote a partir de EstoqueMovimento (fonte de verdade)
INSERT INTO lote_stock_balances (
  loteId,
  quantidadeTotal,
  quantidadeDisponivel,
  lastUpdated
)
SELECT
  l.id,
  GREATEST(0, COALESCE(tot.total_qty, 0)),
  GREATEST(0, COALESCE(tot.total_qty, 0) - COALESCE(l.quantidadeQuarentena, 0)),
  NOW(3)
FROM lotes l
LEFT JOIN (
  SELECT
    em.loteId,
    SUM(
      CASE em.tipo
        WHEN 'ENTRADA' THEN em.quantidade
        WHEN 'DEVOLUCAO' THEN em.quantidade
        WHEN 'SAIDA' THEN -em.quantidade
        WHEN 'INCINERACAO' THEN -em.quantidade
        WHEN 'QUARENTENA' THEN -em.quantidade
        WHEN 'AJUSTE' THEN em.estoqueFinal - em.estoqueAnterior
        ELSE 0
      END
    ) AS total_qty
  FROM estoque_movimentos em
  WHERE em.deletedAt IS NULL
    AND em.loteId IS NOT NULL
  GROUP BY em.loteId
) tot ON tot.loteId = l.id
WHERE l.deletedAt IS NULL
ON DUPLICATE KEY UPDATE
  quantidadeTotal = VALUES(quantidadeTotal),
  quantidadeDisponivel = VALUES(quantidadeDisponivel),
  lastUpdated = NOW(3);

SELECT COUNT(*) AS produtos_com_stock
FROM stock_balances sb
INNER JOIN produtos p ON p.id = sb.produtoId
WHERE p.deletedAt IS NULL
  AND p.ativo = 1
  AND sb.quantidadeDisponivel >= 10;

SELECT COUNT(*) AS lotes_com_stock
FROM lote_stock_balances lb
INNER JOIN lotes l ON l.id = lb.loteId
WHERE l.deletedAt IS NULL
  AND l.ativo = 1
  AND l.dataValidade >= CURDATE()
  AND lb.quantidadeDisponivel > 0;
