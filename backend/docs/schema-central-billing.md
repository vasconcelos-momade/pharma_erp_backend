# Schema Central — Billing, Pagamentos e SaaS

Documentação das decisões do schema `central/schema.prisma` para faturação multi-tenant.

**API REST implementada:** [api-central-billing.md](./api-central-billing.md)

## O que está sólido

| Área | Decisão |
|------|---------|
| **BillingSnapshot** | Histórico imutável por período; suporta mudança de preços e auditoria. |
| **Invoice ≠ Payment** | Uma fatura pode ter vários pagamentos; pagamentos parciais são suportados. |
| **WalletTransaction** | Ledger de saldo (crédito, débito, reconciliação). |
| **Subscription + Plan** | Modelo SaaS por branches com planos `base` / `enterprise`. |

## Campos adicionados (pré-produção)

### Subscription

- `trialEndsAt` — fim do período experimental.
- `lastBillingAt` / `nextBillingAt` — controlo de cobrança recorrente.
- `branchesUsed` — **cache**; fonte de verdade: `COUNT(branches WHERE active=true)` em `GenerateMonthlyBillingService` e `CreateBranchUseCase`.

### Invoice

- `paidAmount` — total já liquidado (default `0`).
- `status` — inclui `parcial` para pagamentos incompletos.
- `remainingAmount` — coluna **GENERATED** no MySQL (`amount - paidAmount`); a API calcula o valor nas respostas HTTP para evitar leituras desactualizadas via Prisma.
- Índice `@@index([subscriptionId, dueDate])`.

### Payment

- `status` default `pendente` (confirmação manual ou webhook).
- `proofUrl` — comprovativo (transferência, recibo M-Pesa/e-Mola).
- `coversFrom` / `coversTo` — período coberto pelo pagamento.
- `confirmedAt` / `confirmedBy` — aprovação por utilizador central.
- `reference` — referência da transacção (M-Pesa/e-Mola/transferência).
- `webhookEventId` — idempotência por evento de gateway.
- `deletedAt` — soft delete.

### PaymentWebhook

Fila de eventos de gateways (`MPESA`, `EMOLA`, etc.) para processamento idempotente. Consumida por `ReceivePaymentWebhookUseCase` e `ProcessPaymentWebhookUseCase`.

### Branch

- `dbSslEnabled` — ligação TLS à base tenant em produção.

### TenantStatus

- Valor `trial` alinhado com `SubscriptionStatus.trial`.

### PaymentMethod

- `EMOLA` adicionado ao lado de `MPESA`.

## Regras de negócio (implementadas)

### Pagamento parcial

```text
paidAmount += payment.amount (quando status → confirmado)
if paidAmount >= invoice.amount → invoice.status = pago
else if paidAmount > 0           → invoice.status = parcial
```

Fatura `vencido` passa a `pago` quando totalmente liquidada. `cancelado` não é alterado.

### branchesUsed

Não confiar apenas no campo cacheado. Sempre recalcular em:

- geração mensal de faturação;
- criação de branch;
- relatórios de billing.

O campo na `Subscription` é actualizado após essas operações para leitura rápida.

### Código de aplicação

| Use case / serviço | Ficheiro |
|--------------------|----------|
| Confirmar pagamento (manual) | `billing/application/use-cases/confirm-payment.use-case.ts` |
| Submeter pagamento | `billing/application/use-cases/submit-payment.use-case.ts` |
| Receber webhook | `billing/application/use-cases/receive-payment-webhook.use-case.ts` |
| Processar webhook | `billing/application/use-cases/process-payment-webhook.use-case.ts` |
| Integridade fatura | `billing/application/services/invoice-financial-integrity.service.ts` |
| Aplicar pagamento à fatura | `billing/application/services/apply-payment-to-invoice.service.ts` |
| Resposta HTTP (`remainingAmount`) | `billing/application/services/invoice-response.mapper.ts` |

## Próximos passos (opcional)

1. Upload de `proofUrl` (S3/local) no endpoint de submissão de pagamento.
2. Validação de assinatura específica por operador M-Pesa/e-Mola (formato oficial do gateway).
3. UI Flutter para faturas e pagamentos no `pharma_erp`.

## Aplicar alterações na base

```bash
docker compose -f docker-compose.dev.yml run --rm --no-deps backend \
  bunx prisma db push \
    --schema=src/infrastructure/prisma/central/schema.prisma \
    --accept-data-loss \
    --skip-generate

docker compose -f docker-compose.dev.yml restart backend backend_worker
```
