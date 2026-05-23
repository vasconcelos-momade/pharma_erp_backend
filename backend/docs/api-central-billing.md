# API Central — Tenants, Branches, Billing e Webhooks

Documentação das rotas HTTP do módulo central (`backend/src/modules/central/`), incluindo autenticação, subscrições, faturação, pagamentos e integração M-Pesa / e-Mola.

**Prefixo da API:** todos os endpoints abaixo estão sob `/api/v1` (ex.: `POST /api/v1/central/auth/login`). Nos exemplos, use `BASE_URL=http://localhost:3300/api/v1` ou o host equivalente.

**Código de referência:**

| Área | Ficheiro |
|------|----------|
| Montagem v1 | `src/routes/v1/index.ts` |
| Rotas centrais | `src/routes/v1/admin.routes.ts`, `src/routes/v1/auth.routes.ts` |
| Tenants | `modules/central/presentation/controllers/central-tenant.controller.ts` |
| Branches | `modules/central/presentation/controllers/central-branch.controller.ts` |
| Billing | `modules/central/presentation/controllers/central-billing.controller.ts` |
| Webhooks | `modules/central/presentation/controllers/central-webhook.controller.ts` |
| Validação Zod | `src/shared/http/request-validation.ts` |
| Auth JWT | `src/shared/http/central-auth.ts` |
| Assinatura webhook | `src/shared/http/webhook-auth.ts` |

Documentação relacionada: [schema-central-billing.md](./schema-central-billing.md), [refatoracao-tenant-branch.md](./refatoracao-tenant-branch.md), [teste-runtime-api-v1.md](./teste-runtime-api-v1.md).

---

## Autenticação

### Login central

```http
POST /api/v1/central/auth/login
Content-Type: application/json

{
  "email": "admin@skalway.com",
  "password": "admin123"
}
```

Resposta (envelope padrão): `{ "success": true, "data": { "token", "user", "tenants": [...] } }`. Cada tenant inclui `branches[]`.

**Conta de teste (dono de tenant, validada em runtime):** `dono.1779294744@teste.com` / `123456` → `tenantId: 1`, `branchId: 1`. Ver [teste-runtime-api-v1.md](./teste-runtime-api-v1.md).

### Cabeçalhos nas rotas protegidas

```http
Authorization: Bearer <token>
```

Rotas tenant (ERP) exigem ainda:

```http
x-tenant-id: <tenantId>
x-branch-id: <branchId>
```

### Papéis (`Role`)

| Papel | Descrição |
|-------|-----------|
| `superadmin` | Acesso a todos os tenants; confirma pagamentos; jobs de billing |
| `admin` | Administrador de tenant(s) associados |
| `usuario` | Utilizador comum |

O superadmin do seed: `admin@skalway.com` / `admin123`.

### Regras de acesso

- **Superadmin** acede a qualquer `tenantId`.
- **Outros utilizadores** só acedem a tenants presentes no JWT (`tenants[]` do login).
- Rotas de webhook de gateway são **públicas** (validadas por assinatura HMAC quando configurada).

---

## Variáveis de ambiente

| Variável | Descrição |
|----------|-----------|
| `JWT_SECRET_CENTRAL` | Segredo do token central |
| `ENCRYPTION_KEY` | Cifragem das credenciais de BD por branch (64 hex) |
| `PUBLIC_TENANT_REGISTRATION` | `true` (default): `POST /central/tenants` sem JWT aceita registo com `ownerUser`. `false`: só superadmin autenticado |
| `MPESA_WEBHOOK_SECRET` | Segredo HMAC para webhooks M-Pesa |
| `EMOLA_WEBHOOK_SECRET` | Segredo HMAC para webhooks e-Mola |
| `WEBHOOK_SECRET` | Fallback se o segredo por provider não estiver definido |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM` | Notificações por email (trial, fatura, branch) |

---

## Tenants

### Listar tenants

```http
GET /central/tenants
Authorization: Bearer <token>
```

- **Superadmin:** todos os tenants.
- **Outros:** apenas tenants do utilizador.

### Obter tenant

```http
GET /central/tenants/:tenantId
Authorization: Bearer <token>
```

Resposta inclui `branches` (sem `dbName` nem credenciais).

### Registar tenant

```http
POST /central/tenants
Content-Type: application/json
```

Corpo mínimo:

```json
{
  "nomeEmpresa": "Farmacia Demo",
  "nomeTenant": "farmacia_demo",
  "adminName": "Admin",
  "adminEmail": "admin@demo.com",
  "adminPassword": "123456",
  "ownerUser": {
    "name": "Dono",
    "email": "dono@demo.com",
    "password": "123456",
    "role": "admin"
  }
}
```

| Comportamento | Detalhe |
|---------------|---------|
| Resposta síncrona | `201` + `id`, `companyName`, `branch` (HQ) |
| Assíncrono | `POST /central/tenants?async=true` → `202` + `jobId` (fila Redis) |
| Trial | Subscrição `trial` durante **7 dias**; email ao owner |
| Base MySQL | `tenant_<nomeTenant_normalizado>` |

Alternativa: enviar `userId` de utilizador central existente em vez de `ownerUser`.

---

## Branches

### Listar branches

```http
GET /central/tenants/:tenantId/branches
Authorization: Bearer <token>
```

Query: `?includeInactive=true` para incluir filiais inactivas.

### Criar branch

```http
POST /central/tenants/:tenantId/branches
Authorization: Bearer <token>
Content-Type: application/json

{
  "code": "L2",
  "name": "Filial 2"
}
```

- Valida billing activo (`assertTenantBillingActive`).
- Filial extra partilha a mesma base MySQL da matriz (HQ).
- Actualiza `subscription.branchesUsed` e envia email ao owner.

---

## Subscrição

### Consultar subscrição activa

```http
GET /central/tenants/:tenantId/subscription
Authorization: Bearer <token>
```

Resposta: `status`, `trialEndsAt`, `nextBillingAt`, `branchesUsed`, `activeBranches`, `plan` (preço, branches incluídas, etc.).

**Estados da subscrição:** `trial` | `ativo` | `cancelado` | `expirado`

**Estados do tenant:** `trial` | `ativo` | `pendente` | `grace` | `suspenso`

---

## Faturas (SaaS)

### Listar faturas

```http
GET /central/tenants/:tenantId/invoices
Authorization: Bearer <token>
```

Query: `?status=pendente&limit=50` (máx. 100).

### Detalhe da fatura

```http
GET /central/tenants/:tenantId/invoices/:invoiceId
Authorization: Bearer <token>
```

Inclui lista de `payments[]`.

### Campos financeiros

| Campo | Descrição |
|-------|-----------|
| `amount` | Valor total da fatura |
| `paidAmount` | Total já confirmado |
| `remainingAmount` | Calculado na API: `amount - paidAmount` (não depender só da coluna gerada MySQL) |
| `status` | `pendente` \| `parcial` \| `pago` \| `vencido` \| `cancelado` |

Fatura totalmente paga passa a `pago` mesmo que antes estivesse `vencido`. `cancelado` mantém-se.

---

## Pagamentos

### Listar pagamentos

```http
GET /central/tenants/:tenantId/payments
Authorization: Bearer <token>
```

Query: `?invoiceId=&status=&limit=50`.

### Submeter pagamento (comprovativo)

```http
POST /central/tenants/:tenantId/payments
Authorization: Bearer <token>
Content-Type: application/json

{
  "invoiceId": "3",
  "amount": 5000,
  "method": "BANK_TRANSFER",
  "reference": "TRF-2026-001",
  "proofUrl": "https://...",
  "notes": "Transferência bancária"
}
```

**Métodos:** `CASH`, `BANK_TRANSFER`, `MPESA`, `EMOLA`, `CARD`, `OTHER`.

Cria `Payment` com `status: pendente` até confirmação.

### Confirmar pagamento (superadmin)

```http
POST /central/tenants/:tenantId/payments/:paymentId/confirm
Authorization: Bearer <token_superadmin>
```

- Actualiza `paidAmount` e `status` da fatura.
- Se fatura ficar `pago`, tenant passa a `ativo`.

---

## Webhooks M-Pesa / e-Mola

### Receber evento

```http
POST /central/webhooks/mpesa
POST /central/webhooks/emola
Content-Type: application/json
```

Query opcional: `?tenantId=9` (se o corpo não incluir `tenantId`).

Query `?queue=true` — grava webhook sem processar imediatamente.

**Corpo exemplo:**

```json
{
  "providerEventId": "evt-unico-123",
  "reference": "MPESA-456789",
  "amount": 5000,
  "status": "success",
  "invoiceId": "3",
  "eventType": "payment.completed",
  "providerTransactionId": "tx-abc"
}
```

| Campo | Obrigatório | Notas |
|-------|-------------|-------|
| `providerEventId` | Sim | Idempotência (único global em `payment_webhooks`) |
| `reference` | Sim | Referência da transacção |
| `amount` | Sim | Valor positivo; limitado ao remanescente da fatura |
| `status` | Não | `success`, `completed`, `paid` → confirma; outros → ignora |
| `invoiceId` | Não | Se omitido, usa a fatura em aberto mais antiga |

**Fluxo:**

1. Grava `PaymentWebhook`.
2. Cria `Payment` (se necessário) e confirma via `applyPaymentToInvoice`.
3. Marca webhook como `processed`.

**Respostas de skip (sem erro):**

- `invoice_already_settled` — fatura já `pago` ou `cancelado`
- `payment_already_confirmed` — evento já processado
- `payment_not_successful` — status não indica sucesso

### Assinatura HMAC (produção)

Com `MPESA_WEBHOOK_SECRET` ou `EMOLA_WEBHOOK_SECRET` definido:

```http
x-webhook-signature: <hex HMAC-SHA256 do corpo raw>
```

Algoritmo: `HMAC-SHA256(secret, rawBody)`.

Em desenvolvimento, sem segredo configurado, a assinatura é opcional.

### Reprocessar webhook (superadmin)

```http
POST /central/webhooks/events/:webhookId/process
Authorization: Bearer <token_superadmin>
```

---

## Jobs de billing (superadmin)

### Ciclo de subscrição (trial, vencimentos, suspensão)

```http
POST /central/billing/process-lifecycle
Authorization: Bearer <token_superadmin>
Content-Type: application/json

{
  "referenceDate": "2026-05-25"
}
```

Equivalente CLI:

```bash
docker exec skalway_pharm_backend bun run billing:process:lifecycle -- --reference-date=2026-05-25
```

| Evento | Efeito |
|--------|--------|
| `trialEndsAt` ultrapassado | Cria 1.ª fatura, subscrição `ativo`, tenant `grace` |
| Fatura vencida não paga | Tenant `suspenso`, subscrição `expirado` |
| Vencida ≥ 30 dias | Subscrição `cancelado` |

### Faturação mensal

```http
POST /central/billing/generate-monthly
Authorization: Bearer <token_superadmin>
Content-Type: application/json

{
  "referenceDate": "2026-05-01",
  "tenantId": "9",
  "dueDays": 3,
  "includeTrial": false,
  "dryRun": false
}
```

Assíncrono: `POST /central/billing/generate-monthly?async=true` → fila Redis `billing.generate-monthly`.

CLI:

```bash
docker exec skalway_pharm_backend bun run billing:generate:monthly -- --tenant-id=9 --dry-run
```

---

## Fluxo de vida (resumo)

```text
POST /central/tenants
  → Tenant: trial, Subscription: trial (7d), Branch HQ
  → Email: trial iniciado

POST /central/billing/process-lifecycle  (após trialEndsAt)
  → Invoice pendente, Subscription: ativo, Tenant: grace
  → Email: fatura emitida

POST /central/tenants/:id/payments        (owner submete comprovativo)
  → Payment: pendente

POST /central/tenants/:id/payments/:id/confirm  (superadmin)
  OU POST /central/webhooks/mpesa|emola
  → Payment: confirmado, Invoice: pago/parcial, Tenant: ativo (se pago)

POST /central/billing/process-lifecycle  (após dueDate, não pago)
  → Tenant: suspenso, Subscription: expirado
```

---

## Scripts de teste

| Script | Descrição |
|--------|-----------|
| `bash scripts/test-tenant-creation.sh` | Cria tenant, valida MySQL, login, produtos |
| `bash scripts/test-billing-lifecycle.sh` | Tenant + trial + lifecycle + invoice + branch + suspensão |
| `bash scripts/smoke-api-v1-validation.sh` | Health + validação Zod (body/query/params) sem dados de negócio |
| `bash scripts/test-login-and-products.sh` | Login + `GET /tenant/produtos` (aceita `LOGIN_EMAIL` / `LOGIN_PASSWORD`) |
| `bash scripts/test-owner-api.sh` | Central + produtos + POS com dono de teste (ver [teste-runtime-api-v1.md](./teste-runtime-api-v1.md)) |
| `docker exec skalway_pharm_backend bun scripts/test-create-branch.ts --tenant-id=9 --code=L2 --name="Filial 2"` | Criar branch via CLI |

**Teste validado (2026-05-21)** — dono do tenant `farmacia_1779294744`: ver [teste-runtime-api-v1.md](./teste-runtime-api-v1.md).

| Credencial | Valor |
|------------|--------|
| Email | `dono.1779294744@teste.com` |
| Password | `123456` |
| `tenantId` / `branchId` | `1` / `1` (HQ) |
| `GET /tenant/produtos` | `200`, **8446** produtos |
| `GET .../invoices` | `200` (após lifecycle: `INV-2026-000001`, 5000 MZN) |
| `GET .../subscription` | `200` (`ativo` após lifecycle / Plano Base) |
| `POST .../billing/process-lifecycle` | superadmin, `referenceDate` pós-trial |
| POS venda + anulação | ver [teste-runtime-api-v1.md](./teste-runtime-api-v1.md) §5 |
| Scripts | `test-owner-api.sh`, `test-billing-tenant1.sh`, `test-pos-owner.sh` |

**Exemplo — login dono + billing do tenant 1:**

```bash
BASE_URL="${BASE_URL:-http://localhost:3300/api/v1}"
LOGIN_JSON=$(curl -s -X POST "${BASE_URL}/central/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"dono.1779294744@teste.com","password":"123456"}')

TOKEN=$(echo "$LOGIN_JSON" | jq -r '.data.token')
TENANT_ID=$(echo "$LOGIN_JSON" | jq -r '.data.tenants[0].id')

curl -s "${BASE_URL}/central/tenants/${TENANT_ID}/subscription" \
  -H "Authorization: Bearer $TOKEN" | jq

curl -s "${BASE_URL}/central/tenants/${TENANT_ID}/invoices?limit=5" \
  -H "Authorization: Bearer $TOKEN" | jq
```

**Exemplo — superadmin (seed) para operações globais:**

```bash
TOKEN=$(curl -s -X POST "${BASE_URL}/central/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@skalway.com","password":"admin123"}' | jq -r '.data.token')

curl -s "${BASE_URL}/central/tenants" -H "Authorization: Bearer $TOKEN" | jq
```

**Webhook de teste (sem assinatura em dev):**

```bash
curl -s -X POST "${BASE_URL:-http://localhost:3300/api/v1}/central/webhooks/mpesa?tenantId=7" \
  -H "Content-Type: application/json" \
  -d '{
    "providerEventId": "test-'$(date +%s)'",
    "reference": "MPESA-TEST",
    "amount": 5000,
    "status": "success",
    "invoiceId": "1",
    "eventType": "payment.completed"
  }' | jq
```

---

## Tabela completa de endpoints centrais

| Método | Endpoint | Auth |
|--------|----------|------|
| `GET` | `/api/v1/health` | — |
| `POST` | `/api/v1/central/auth/login` | — |
| `POST` | `/central/users` | — |
| `GET` | `/central/tenants` | JWT |
| `POST` | `/central/tenants` | Público* ou JWT |
| `GET` | `/central/tenants/:id` | JWT + tenant |
| `GET` | `/central/tenants/:id/branches` | JWT + tenant |
| `POST` | `/central/tenants/:id/branches` | JWT + tenant |
| `GET` | `/central/tenants/:id/subscription` | JWT + tenant |
| `GET` | `/central/tenants/:id/invoices` | JWT + tenant |
| `GET` | `/central/tenants/:id/invoices/:invoiceId` | JWT + tenant |
| `GET` | `/central/tenants/:id/payments` | JWT + tenant |
| `POST` | `/central/tenants/:id/payments` | JWT + tenant |
| `POST` | `/central/tenants/:id/payments/:paymentId/confirm` | JWT superadmin |
| `POST` | `/central/webhooks/mpesa` | Assinatura† |
| `POST` | `/central/webhooks/emola` | Assinatura† |
| `POST` | `/central/webhooks/events/:id/process` | JWT superadmin |
| `POST` | `/central/billing/process-lifecycle` | JWT superadmin |
| `POST` | `/central/billing/generate-monthly` | JWT superadmin |
| `POST` | `/central/sync/push` | JWT + headers tenant/branch |
| `POST` | `/central/sync/pull` | JWT + headers tenant/branch |

\* Registo público quando `PUBLIC_TENANT_REGISTRATION=true` (default).  
† Obrigatório em produção se `*_WEBHOOK_SECRET` estiver definido.

---

## Agendamento em produção

O compose **não** inclui cron. Agendar no host ou orquestrador:

| Tarefa | Sugestão | Comando |
|--------|----------|---------|
| Ciclo de subscrição | Diário | `billing:process:lifecycle` |
| Faturação mensal | 1.º dia do mês | `billing:generate:monthly` |

Ou via API com token superadmin (ver secções acima).
