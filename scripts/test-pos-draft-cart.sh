#!/usr/bin/env bash
# Carrinho PDV (fatura rascunho): GET → ADD → INCREMENT → DECREMENT → DELETE.
# Uso: bash scripts/test-pos-draft-cart.sh
# Requer sessão de caixa aberta (abre automaticamente se possível).

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
cd "$ROOT"

BASE_URL="${BASE_URL:-http://localhost:3300/api/v1}"
LOGIN_EMAIL="${LOGIN_EMAIL:-dono.1779294744@teste.com}"
LOGIN_PASSWORD="${LOGIN_PASSWORD:-123456}"

fail() { echo "    FALHA: $*"; exit 1; }

echo "==> 1. Login (${LOGIN_EMAIL})"
LOGIN=$(curl -sf -X POST "${BASE_URL}/central/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"${LOGIN_EMAIL}\",\"password\":\"${LOGIN_PASSWORD}\"}") || fail "login"

TOKEN=$(echo "$LOGIN" | jq -r '.data.token')
TENANT_ID=$(echo "$LOGIN" | jq -r '.data.tenants[0].id')
BRANCH_ID=$(echo "$LOGIN" | jq -r '.data.tenants[0].branches[0].id')
USER_ID=$(echo "$LOGIN" | jq -r '.data.user.id')
HDR=(-H "Authorization: Bearer ${TOKEN}" -H "x-tenant-id: ${TENANT_ID}" -H "x-branch-id: ${BRANCH_ID}")

echo "==> 2. Abrir sessão de caixa (se necessário)"
curl -sf -X POST "${BASE_URL}/tenant/pos/sessions/open" \
  "${HDR[@]}" -H "Content-Type: application/json" \
  -d '{"caixaId":"1","valorAbertura":500}' >/dev/null 2>&1 || true

SESS=$(curl -sf "${BASE_URL}/tenant/pos/sessions/current" "${HDR[@]}")
SESSAO_ID=$(echo "$SESS" | jq -r '.data.id // .id // empty')
[[ -n "$SESSAO_ID" && "$SESSAO_ID" != "null" ]] || fail "sem sessão aberta"
KEY="pdv-${USER_ID}-${SESSAO_ID}"
echo "    sessaoId=${SESSAO_ID} idempotencyKey=${KEY}"

echo "==> 3. GET carrinho (pode ter linhas de sessões anteriores)"
curl -sf "${BASE_URL}/tenant/pos/sales/draft?idempotencyKey=${KEY}" "${HDR[@]}" \
  | jq -c '{items: (.data.items|length), subtotal: .data.subtotal, ivaTotal: .data.ivaTotal, total: .data.total}'

SERVICO_ID="${SERVICO_ID:-2}"
echo "==> 4a. POST adicionar serviço ${SERVICO_ID}"
ADD_SVC=$(curl -s -w "\n%{http_code}" -X POST "${BASE_URL}/tenant/pos/sales/draft/items" \
  "${HDR[@]}" -H "Content-Type: application/json" \
  -d "{\"idempotencyKey\":\"${KEY}-svc\",\"servicoId\":\"${SERVICO_ID}\",\"quantidade\":1}")
HTTP=$(echo "$ADD_SVC" | tail -n1)
BODY=$(echo "$ADD_SVC" | sed '$d')
[[ "$HTTP" == "200" || "$HTTP" == "201" ]] || fail "add serviço HTTP ${HTTP}: $(echo "$BODY" | head -c 400)"
echo "$BODY" | jq -c '{servico: (.data.items[]|select(.tipo=="servico")|{id, nome, total}), total: .data.total}'

echo "==> 4. POST adicionar produto 10000"
ADD=$(curl -s -w "\n%{http_code}" -X POST "${BASE_URL}/tenant/pos/sales/draft/items" \
  "${HDR[@]}" -H "Content-Type: application/json" \
  -d "{\"idempotencyKey\":\"${KEY}\",\"produtoId\":\"10000\",\"quantidade\":1}")
HTTP=$(echo "$ADD" | tail -n1)
BODY=$(echo "$ADD" | sed '$d')
[[ "$HTTP" == "200" || "$HTTP" == "201" ]] || fail "add HTTP ${HTTP}: $(echo "$BODY" | head -c 400)"
ITEM_ID=$(echo "$BODY" | jq -r '.data.items[] | select(.produtoId=="10000") | .id' | head -1)
[[ -n "$ITEM_ID" && "$ITEM_ID" != "null" ]] || fail "sem itemId"
echo "$BODY" | jq -c --arg id "$ITEM_ID" '{itemId: $id, qty: (.data.items[]|select(.id==$id)|.quantidade), ivaTotal: .data.ivaTotal, total: .data.total}'

echo "==> 5. PATCH increment"
INC=$(curl -s -w "\n%{http_code}" -X PATCH \
  "${BASE_URL}/tenant/pos/sales/draft/items/${ITEM_ID}/increment" \
  "${HDR[@]}" -H "Content-Type: application/json" \
  -d "{\"idempotencyKey\":\"${KEY}\"}")
HTTP=$(echo "$INC" | tail -n1)
BODY=$(echo "$INC" | sed '$d')
[[ "$HTTP" == "200" ]] || fail "increment HTTP ${HTTP}"
echo "$BODY" | jq -c --arg id "$ITEM_ID" '{qty: (.data.items[]|select(.id==$id)|.quantidade)}'

echo "==> 6. PATCH decrement"
DEC=$(curl -s -w "\n%{http_code}" -X PATCH \
  "${BASE_URL}/tenant/pos/sales/draft/items/${ITEM_ID}/decrement" \
  "${HDR[@]}" -H "Content-Type: application/json" \
  -d "{\"idempotencyKey\":\"${KEY}\"}")
HTTP=$(echo "$DEC" | tail -n1)
BODY=$(echo "$DEC" | sed '$d')
[[ "$HTTP" == "200" ]] || fail "decrement HTTP ${HTTP}"
echo "$BODY" | jq -c --arg id "$ITEM_ID" '{qty: (.data.items[]?|select(.id==$id)|.quantidade), items: (.data.items|length)}'

echo "==> 7. DELETE linha"
DEL=$(curl -s -w "\n%{http_code}" -X DELETE \
  "${BASE_URL}/tenant/pos/sales/draft/items/${ITEM_ID}" \
  "${HDR[@]}" -H "Content-Type: application/json" \
  -d "{\"idempotencyKey\":\"${KEY}\"}")
HTTP=$(echo "$DEL" | tail -n1)
BODY=$(echo "$DEL" | sed '$d')
[[ "$HTTP" == "200" ]] || fail "delete HTTP ${HTTP}"
echo "$BODY" | jq -c '{items: (.data.items|length), total: .data.total}'

echo ""
echo "==> Carrinho rascunho OK"
