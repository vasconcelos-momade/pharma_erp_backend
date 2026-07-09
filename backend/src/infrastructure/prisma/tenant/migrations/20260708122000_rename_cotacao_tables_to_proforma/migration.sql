-- Migracao fisica de tabelas comerciais:
-- cotacoes -> proforma_invoices
-- cotacao_itens -> proforma_invoice_items
-- Mantemos os modelos Prisma atuais (Cotacao/CotacaoItem) para compatibilidade
-- com o codigo da aplicacao enquanto a renomeacao semantica acontece por etapas.

RENAME TABLE `cotacao_itens` TO `proforma_invoice_items`;
RENAME TABLE `cotacoes` TO `proforma_invoices`;
