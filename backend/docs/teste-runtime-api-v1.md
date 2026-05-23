# Testes runtime — API v1 (validados)

Registo de testes manuais executados com **Docker Compose dev** (`docker compose -f docker-compose.dev.yml up -d`) contra `http://localhost:3300/api/v1`.

**Data da validação:** 2026-05-21  
**Stack:** `skalway_pharm_backend`, MySQL `skalway_pharm_mysql` (porta host `3312`)

---

## Utilizador de teste (dono de tenant)

Conta criada via registo de tenant (`POST /api/v1/central/tenants`). Usar para testar rotas **tenant** (produtos, stock, POS) e rotas **central** limitadas ao tenant `1`.

| Campo | Valor |
|-------|--------|
| Email | `dono.1779294744@teste.com` |
| Password | `123456` |
| Nome | Dono Teste |
| `user.id` (central) | `2` |
| Role | `admin` |
| `tenantId` | `1` |
| Empresa | Farmacia Teste 1779294744 |
| `nomeTenant` / base MySQL | `farmacia_1779294744` → `tenant_farmacia_1779294744` |
| `branchId` | `1` |
| Branch | `HQ` — Farmacia Teste 1779294744 - Matriz |

> **Nota:** Este utilizador **não** é o superadmin do seed (`admin@skalway.com`). Para jobs de billing global ou confirmação de pagamentos, use o superadmin.

---

## Pré-requisitos

```bash
# Na raiz pharma_erp_backend/
docker compose -f docker-compose.dev.yml ps   # backend + mysql healthy
export BASE_URL="http://localhost:3300/api/v1"
```

Smoke de validação Zod (sem credenciais):

```bash
bash scripts/smoke-api-v1-validation.sh
```

---

## 1. Login central

```bash
curl -s -X POST "${BASE_URL}/central/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"dono.1779294744@teste.com","password":"123456"}' | jq .
```

**Resultado validado:** `HTTP 200`, envelope:

```json
{
  "success": true,
  "data": {
    "token": "<jwt>",
    "user": { "id": "2", "name": "Dono Teste", "email": "dono.1779294744@teste.com", "role": "admin" },
    "tenants": [
      {
        "id": "1",
        "companyName": "Farmacia Teste 1779294744",
        "name": "farmacia_1779294744",
        "branches": [{ "id": "1", "code": "HQ", "name": "Farmacia Teste 1779294744 - Matriz" }]
      }
    ]
  }
}
```

Extrair variáveis para os passos seguintes:

```bash
LOGIN_JSON=$(curl -s -X POST "${BASE_URL}/central/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"dono.1779294744@teste.com","password":"123456"}')

export TOKEN=$(echo "$LOGIN_JSON" | jq -r '.data.token')
export TENANT_ID=$(echo "$LOGIN_JSON" | jq -r '.data.tenants[0].id')
export BRANCH_ID=$(echo "$LOGIN_JSON" | jq -r '.data.tenants[0].branches[0].id')
```

---

## 2. Listar produtos (tenant)

```bash
curl -s "${BASE_URL}/tenant/produtos" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "x-tenant-id: ${TENANT_ID}" \
  -H "x-branch-id: ${BRANCH_ID}" | jq '{success, total: (.data | length), first: .data[0].nome}'
```

**Resultado validado:** `HTTP 200`, `success: true`, **8446** produtos. Exemplo do primeiro registo: `CLAVAMOX 125` (`id: 10000`, `estoqueAtual: 50`).

Alias equivalente: `GET /api/v1/tenant/products` (mesmos headers).

---

## 3. Detalhe do tenant (central)

```bash
curl -s "${BASE_URL}/central/tenants/${TENANT_ID}" \
  -H "Authorization: Bearer ${TOKEN}" | jq .
```

**Resultado validado:** `HTTP 200`, tenant com `branches` (sem expor `dbName` nem credenciais).

---

## 4. Central — tenants, subscrição, billing

```bash
curl -s "${BASE_URL}/central/tenants" -H "Authorization: Bearer ${TOKEN}" | jq '{success, total: (.data|length)}'

curl -s "${BASE_URL}/central/tenants/${TENANT_ID}/subscription" \
  -H "Authorization: Bearer ${TOKEN}" | jq '{success, status: .data.status, plan: .data.plan.name}'

curl -s "${BASE_URL}/central/tenants/${TENANT_ID}/invoices?limit=5" \
  -H "Authorization: Bearer ${TOKEN}" | jq .

curl -s "${BASE_URL}/central/tenants/${TENANT_ID}/payments?limit=5" \
  -H "Authorization: Bearer ${TOKEN}" | jq .

curl -s "${BASE_URL}/central/tenants/${TENANT_ID}/branches" \
  -H "Authorization: Bearer ${TOKEN}" | jq .
```

| Endpoint | HTTP | Notas |
|----------|------|--------|
| `GET /central/tenants` | 200 | 1 tenant para este utilizador |
| `GET /central/tenants/1` | 200 | Detalhe + `branches` |
| `GET .../subscription` | 200 | Após lifecycle: `status: ativo`, plano **Plano Base** |
| `GET .../invoices` | 200 | Após lifecycle: ex. `INV-2026-000001`, 5000 MZN, `pendente` |
| `GET .../payments` | 200 | Lista vazia `[]` (até submeter pagamento) |
| `GET .../branches` | 200 | 1 branch (HQ) |

Respostas de fatura/pagamento incluem `currency: "MZN"` na API (valor fixo; o schema central não tem coluna `currency`).

### Billing lifecycle (fim de trial)

Simular dia após `trialEndsAt` (tenant 1: trial até ~2026-05-27):

```bash
# Superadmin
STOKEN=$(curl -s -X POST "${BASE_URL}/central/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@skalway.com","password":"admin123"}' | jq -r '.data.token')

curl -s -X POST "${BASE_URL}/central/billing/process-lifecycle" \
  -H "Authorization: Bearer ${STOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"referenceDate":"2026-05-28"}' | jq .
```

**Resultado validado:** `trialInvoicesCreated: 1`, fatura `INV-2026-000001` (5000 MZN), subscrição `ativo`.

Script: `bash scripts/test-billing-tenant1.sh`

---

## 5. POS (tenant)

```bash
curl -s "${BASE_URL}/tenant/pos/produtos/search?q=CLAV" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "x-tenant-id: ${TENANT_ID}" \
  -H "x-branch-id: ${BRANCH_ID}" \
  | jq '{success, page: .data.page, items: (.data.items|length), first: .data.items[0].nome}'

curl -s "${BASE_URL}/tenant/pos/sessions/current" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "x-tenant-id: ${TENANT_ID}" \
  -H "x-branch-id: ${BRANCH_ID}" | jq .

curl -s "${BASE_URL}/tenant/pos/caixas/available" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "x-tenant-id: ${TENANT_ID}" \
  -H "x-branch-id: ${BRANCH_ID}" | jq '{success, caixas: (.data|length)}'
```

| Endpoint | HTTP | Notas |
|----------|------|--------|
| `GET .../pos/produtos/search?q=CLAV` | 200 | Paginação: `data.items` (20 por página), ex. **ACECLAV** |
| `GET .../pos/sessions/current` | 200 | `data: null` ou sessão `ABERTA` após abrir caixa |
| `GET .../pos/caixas/available` | 200 | 2 caixas (T01, T02) |

### Fluxo POS completo (sessão → venda → anulação)

Pré-requisito: cliente na base tenant (`clientes`); se vazio:

```sql
INSERT INTO clientes (nome, tipo, saldoAtual, createdAt, updatedAt)
VALUES ('Cliente Teste POS', 'PACIENTE', 0, NOW(), NOW());
```

```bash
# 1. Abrir sessão
curl -s -X POST "${BASE_URL}/tenant/pos/sessions/open" \
  "${HDR[@]}" -H "Content-Type: application/json" \
  -d '{"caixaId":"1","valorAbertura":500}' | jq .

# 2. Validar dispensação (produto 10000 — RECEITA_SIMPLES)
curl -s -X POST "${BASE_URL}/tenant/pos/validar-dispensacao" \
  "${HDR[@]}" -H "Content-Type: application/json" \
  -d '{"produtoId":"10000","quantidade":1}' | jq .

# 3. Finalizar venda (incluir receita no item produto)
curl -s -X POST "${BASE_URL}/tenant/pos/finalizar" \
  "${HDR[@]}" -H "Content-Type: application/json" \
  -d '{
    "clienteId":"1","terminalId":"1","metodoPagamento":"DINHEIRO",
    "idempotencyKey":"pos-doc-test",
    "items":[
      {"tipo":"produto","produtoId":"10000","quantidade":2,
       "receita":{"numero":"RX-1","medicoNome":"Dr Teste"}},
      {"tipo":"servico","servicoId":"7","quantidade":1}
    ]
  }' | jq .

# 4. Anular fatura (substituir :saleId)
curl -s -X POST "${BASE_URL}/tenant/pos/faturas/2/cancel" \
  "${HDR[@]}" -H "Content-Type: application/json" \
  -d '{"motivo":"Teste","observacoes":"doc"}' | jq .
```

| Passo | HTTP | Notas |
|-------|------|--------|
| Abrir sessão | 201 | `sessaoId`, `status: ABERTA` |
| Validar dispensação | 200 | `permitido: true` |
| Finalizar venda | 201 | ex. `faturaId: 2`, `total: 474.42`, stock 50→48 |
| Anular fatura | 200 | Stock reposto para **50** |

Script: `bash scripts/test-pos-owner.sh` (requer `CLIENTE_ID` na base; ver script).

### Carrinho PDV (fatura rascunho)

Requer **sessão de caixa aberta**. A chave de idempotência deve ser estável por operador e sessão (o Flutter usa `pdv-{userId}-{sessaoId}`).

| Método | Endpoint | Notas |
|--------|----------|--------|
| `GET` | `/tenant/pos/sales/draft?idempotencyKey=` | Carrinho actual (totais + `items[]` com `fatura_itens.id`) |
| `POST` | `/tenant/pos/sales/draft/items` | Body: `idempotencyKey`, `produtoId` **ou** `servicoId`, `quantidade?` — soma qty se a linha já existir |
| `PATCH` | `/tenant/pos/sales/draft/items/:itemId/increment` | Body: `{ "idempotencyKey" }` |
| `PATCH` | `/tenant/pos/sales/draft/items/:itemId/decrement` | Em qty 1 remove a linha |
| `DELETE` | `/tenant/pos/sales/draft/items/:itemId` | Body: `{ "idempotencyKey" }` |
| `POST` | `/tenant/pos/sales/draft` | Batch (vários itens de uma vez); `idempotencyKey` obrigatório |

```bash
KEY="pdv-${USER_ID}-${SESSAO_ID}"

curl -s "${BASE_URL}/tenant/pos/sales/draft?idempotencyKey=${KEY}" "${HDR[@]}" | jq .

curl -s -X POST "${BASE_URL}/tenant/pos/sales/draft/items" \
  "${HDR[@]}" -H "Content-Type: application/json" \
  -d "{\"idempotencyKey\":\"${KEY}\",\"produtoId\":\"10000\",\"quantidade\":1}" | jq .

ITEM_ID=$(curl -s "${BASE_URL}/tenant/pos/sales/draft?idempotencyKey=${KEY}" "${HDR[@]}" \
  | jq -r '.data.items[0].id')

curl -s -X PATCH "${BASE_URL}/tenant/pos/sales/draft/items/${ITEM_ID}/increment" \
  "${HDR[@]}" -H "Content-Type: application/json" \
  -d "{\"idempotencyKey\":\"${KEY}\"}" | jq .
```

IVA e totais vêm do backend (`FiscalCalculatorUtil` + regra fiscal do produto); produtos isentos → `ivaTotal: 0`.

**Regra de negócio (add):** produtos com `precoVenda <= 0` são rejeitados com HTTP **400** e mensagem clara (ex.: produto `11073` — NISTATINA). Validação apenas no backend; o Flutter mostra `error.message` da API.

Script: `bash scripts/test-pos-draft-cart.sh`

---

## 6. Validação Zod (referência)

| Caso | Endpoint | Resultado |
|------|----------|-----------|
| Health | `GET /api/v1/health` | `200`, `status: ok` |
| Body inválido | `POST .../central/auth/login` sem `password` | `400`, `error.code: VALIDATION_ERROR` |
| Route param | `GET .../central/tenants/not-a-number/invoices` + JWT | `400`, `tenantId inválido` |
| Query | `GET .../invoices?limit=0` + JWT | `400`, `limit` positivo |

Automatizado: `bash scripts/smoke-api-v1-validation.sh`

---

## Scripts automatizados

```bash
# Só login + listagem de produtos
LOGIN_EMAIL="dono.1779294744@teste.com" LOGIN_PASSWORD="123456" \
  bash scripts/test-login-and-products.sh

# Leitura central + tenant + POS
bash scripts/test-owner-api.sh

# Billing lifecycle no tenant 1 (superadmin)
bash scripts/test-billing-tenant1.sh

# POS E2E (sessão, venda, anulação)
bash scripts/test-pos-owner.sh

# Carrinho rascunho (GET/ADD/+/−/DELETE)
bash scripts/test-pos-draft-cart.sh
```

### Correções aplicadas (2026-05-21)

| Problema | Correção |
|----------|----------|
| `GET .../invoices` → 500 (`currency` no Prisma) | `DEFAULT_INVOICE_CURRENCY` na API; removido do `select` |
| `POST .../finalizar` → 400 BigInt no audit | `serializeForJson` em `ComplianceAuditService` |
| `POST .../faturas/:id/cancel` → estoque/caixa | `estoqueAtual` / `saldoAtual` (Prisma), não `snake_case` |
| `POST .../billing/process-lifecycle` → 500 | `remainingAmount` preenchido no `invoice.create` |

---

## Flutter (app)

- Base URL resolvida para `http://<host>:3300/api/v1` via `Env.apiBaseUrlLocal` / `ApiEnvelope.resolveBaseUrl`.
- Login: `POST /central/auth/login` com parsing do envelope `{ success, data: { token, user, tenants } }`.
- PDV: datasources usam `ApiEnvelope.unwrapMap` / `unwrapList` (produtos, serviços, sessão, caixas).
- Carrinho: `GET/POST/PATCH/DELETE` em `/tenant/pos/sales/draft*`; produtos e serviços em `fatura_itens`; estado e IVA só da API (`pdvCartProvider`).

Credenciais de teste na tela de login:

- `dono.1779294744@teste.com` / `123456`

---

## Superadmin (seed) — comparação

| | Dono tenant | Superadmin seed |
|---|-------------|-----------------|
| Email | `dono.1779294744@teste.com` | `admin@skalway.com` |
| Password | `123456` | `admin123` |
| `tenants[]` no login | 1 tenant com branches | `[]` (acesso global) |
| Uso típico | ERP tenant, POS, produtos | Billing global, confirmar pagamentos |

```bash
# Seed central (se ainda não correu)
docker exec skalway_pharm_backend bun prisma/seed.ts
```
