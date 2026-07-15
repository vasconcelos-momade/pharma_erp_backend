-- Fornecedor principal persistido na sugestão (agrupamento PDF / listagem).
ALTER TABLE `purchase_suggestions`
  ADD COLUMN `supplierId` BIGINT UNSIGNED NULL AFTER `produtoId`,
  ADD INDEX `purchase_suggestions_supplierId_idx` (`supplierId`),
  ADD CONSTRAINT `purchase_suggestions_supplierId_fkey`
    FOREIGN KEY (`supplierId`) REFERENCES `fornecedores`(`id`)
    ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill a partir do fornecedor principal do produto.
UPDATE `purchase_suggestions` ps
INNER JOIN (
  SELECT pf.produtoId,
         COALESCE(
           MAX(CASE WHEN pf.fornecedorPrincipal = 1 THEN pf.fornecedorId END),
           MIN(pf.fornecedorId)
         ) AS supplierId
  FROM `produtos_fornecedores` pf
  GROUP BY pf.produtoId
) src ON src.produtoId = ps.produtoId
SET ps.supplierId = src.supplierId;
