-- Refactor Cotacao/CotacaoItem: remove persisted calculated and redundant product fields.
-- Fiscal totals and product descriptions are resolved at runtime via FK + service layer.

ALTER TABLE `cotacoes`
    DROP COLUMN `subtotal`,
    DROP COLUMN `ivaTotal`,
    DROP COLUMN `total`;

ALTER TABLE `cotacao_itens`
    DROP COLUMN `descricao`,
    DROP COLUMN `baseCalculo`,
    DROP COLUMN `iva`,
    DROP COLUMN `valorIva`,
    DROP COLUMN `taxaAplicada`,
    DROP COLUMN `tipoRegraFiscalSnapshot`,
    DROP COLUMN `codigoRegraFiscal`,
    DROP COLUMN `motivoIsencao`,
    DROP COLUMN `total`;
