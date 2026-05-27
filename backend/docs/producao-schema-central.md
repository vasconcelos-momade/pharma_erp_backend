# Schema central — checklist pré-produção

Documento complementar a [schema-central-billing.md](./schema-central-billing.md).

## Alterações de robustez aplicadas

| Área | Decisão |
|------|---------|
| **Tenant** | `country` default `MZ` (removidos `region`, `currency`, `timezone`). |
| **Branch** | `@@unique([tenantId, name])`; credenciais AES-GCM com `dbPasswordTag`. |
| **Device** | `@@unique([branchId, code])`; `apiKeyHash` para sync autenticado. |
| **SyncLog** | Índices `(tenantId, status, createdAt)`, `(branchId, status, createdAt)`, `(deviceId, status)`. |
| **SyncSession** | Sessões de sync com métricas (bytes, conflitos, duração). |
| **Payment** | `reference` obrigatório e único; helper `buildPaymentReference()`. |
| **Invoice** | `number` legível (`INV-2026-00000042`). |
| **PaymentWebhook** | `providerEventId` único (idempotência). |
| **JobQueue** | Fila durável na central (complementa Redis). |
| **User** | `failedLoginCount`, `lockedUntil` (anti brute-force). |
| **AuditLog** | Relação com `User`. |
| **Soft delete** | `Plan`, `Permission`, `PaymentWebhook` com `deletedAt`. `BillingSnapshot` permanece append-only (sem soft delete). |

## Tenant vs Subscription (regra de runtime)

| Tenant.status | Subscription.status | Comportamento esperado |
|---------------|----------------------|-------------------------|
| `ativo` | `ativo` / `trial` | Operação normal + billing conforme plano. |
| `ativo` | `expirado` / `cancelado` | Dados preservados; **bloquear** novas branches e cobrança; avisar renovação. |
| `suspenso` / `grace` | qualquer | Bloqueio operacional conforme política comercial. |

Implementar em middleware/guard: `assertTenantBillingActive(tenantId)` antes de provisioning e APIs pagas.

## branchesUsed

Campo **cache** na `Subscription`. Fonte de verdade:

```sql
SELECT COUNT(*) FROM branches
WHERE tenantId = ? AND active = true AND deletedAt IS NULL;
```

Atualizar cache após criar/desativar branch e na faturação mensal.

## Migrations (obrigatório em produção)

**Não usar** `prisma db push` em produção.

```bash
# Desenvolvimento
docker compose -f docker-compose.dev.yml exec backend \
  bunx prisma migrate dev --schema=src/infrastructure/prisma/central/schema.prisma --name descricao

# Produção
docker compose -f docker-compose.prod.yml exec backend \
  bunx prisma migrate deploy --schema=src/infrastructure/prisma/central/schema.prisma
```

## Backups

| Alvo | Frequência sugerida |
|------|---------------------|
| Base **central** | Diário + retenção 30 dias |
| Bases **tenant_*** por branch | Diário por filial crítica; local + offsite |
| **Redis** | Snapshot se filas críticas não estiverem só em `JobQueue` |

Offline-first sem backup testado = risco de perda total.

## Riscos operacionais (pós-schema)

O schema está maduro; os maiores riscos passam a ser **backend operacional**:

1. Conflitos de sync e reconciliação (`SyncLog` + `SyncSession`).
2. Retries e idempotência (`JobQueue`, `PaymentWebhook.providerEventId`).
3. Concorrência no POS (já com locks no tenant).
4. Billing automático (`lastBillingAt` / `nextBillingAt`).
5. Confirmação de pagamentos (`Payment.status`, `Invoice.paidAmount`).
6. Observabilidade (logs, métricas por filial/device).
7. Segurança de devices (`apiKeyHash` + rotação).

## Isolamento multi-tenant (CRÍTICO) — Opção A implementada

**Não está no schema** — é enforcement em runtime (Prisma Extension):

- `infrastructure/prisma/central-tenant-scope.ts`
- `TENANT_SCOPE_STRICT=true` (default) → bloqueia `prismaCentral.*` sem `runWithCentralTenant`
- `prismaCentral` (scoped) vs `prismaCentralUnscoped` (login, registo, billing global)

```typescript
await runWithCentralTenant(tenantId, () =>
  prismaCentral.invoice.findMany({ where: { status: "pendente" } })
);
```

## Regras finais (versão produção)

| Regra | Implementação |
|-------|----------------|
| Unique por tenant | `@@unique([tenantId, reference])` Payment; `@@unique([tenantId, number])` Invoice; `@@unique([tenantId, idempotencyKey])` JobQueue |
| Índices | Payment `(tenantId, confirmedAt)`; Invoice `(tenantId, dueDate, status)`; SyncLog `(tenantId, entity, entityId)`; JobQueue `(tenantId, status, runAt)` |
| Soft delete | `deletedAt` + índice em modelos operacionais |
| Fatura | `remainingAmount`; `paidAmount <= amount` via `invoice-financial-integrity.service.ts` |
| Sync dedup | `payloadHash` + `@@index([tenantId, payloadHash])` |

## Sequência fiscal (Invoice)

- `InvoiceFiscalCounter` — `@@id([tenantId, fiscalYear])` + incremento atómico
- `Invoice.fiscalYear` + `Invoice.sequence` + `@@unique([tenantId, fiscalYear, sequence])`
- Número: `INV-2026-000123` via `allocateInvoiceFiscal()`

## Passwords, sessões e login

- Passwords: **bcrypt** no registo e compare no login (nunca plaintext).
- `UserSession` com `tokenHash` após login.
- Rate limit: `failedLoginCount` + `lockedUntil` (`LOGIN_MAX_FAILED_ATTEMPTS`, `LOGIN_LOCK_MINUTES`).

## Sync e índices

- `@@unique([tenantId, branchId, entity, entityId, operation])` em `SyncLog`
- `@@unique([tenantId, branchId, code])` em `Device`
- `Invoice.tenantId` denormalizado + `@@index([tenantId, status, dueDate])`
- `@@index([tenantId, status, createdAt])` em `Payment`

## Próximos use cases de código

- `ConfirmPaymentUseCase` + upload `proofUrl`
- `ProcessPaymentWebhookUseCase`
- `DeviceAuthMiddleware` (validar `apiKeyHash`)
- Validar `UserSession` no middleware JWT (revogação)
- Worker que consome `JobQueue`
