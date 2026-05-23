#!/usr/bin/env bash
# Fluxo POS: login dono → abrir sessão → validar dispensação → venda → (opcional) anular.
# Uso: bash scripts/test-pos-owner.sh
# Variável: SKIP_CANCEL=1 para não anular a fatura no fim.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
cd "$ROOT"

BASE_URL="${BASE_URL:-http://localhost:3300/api/v1}"
LOGIN_EMAIL="${LOGIN_EMAIL:-dono.1779294744@teste.com}"
LOGIN_PASSWORD="${LOGIN_PASSWORD:-123456}"
MYSQL_CONTAINER="${MYSQL_CONTAINER:-skalway_pharm_mysql}"
MYSQL_ROOT_PASSWORD="${MYSQL_ROOT_PASSWORD:-root_password}"
TENANT_DB="${TENANT_DB:-tenant_farmacia_1779294744}"
SKIP_CANCEL="${SKIP_CANCEL:-0}"

fail() { echo "    FALHA: $*"; exit 1; }

ensure_cliente() {
  local count
  count=$(docker exec "$MYSQL_CONTAINER" mysql -uroot -p"$MYSQL_ROOT_PASSWORD" -N -D "$TENANT_DB" -e \
    "SELECT COUNT(*) FROM clientes WHERE deletedAt IS NULL;" 2>/dev/null | tail -1)
  if [[ "${count:-0}" == "0" ]]; then
    echo "    Criando cliente de teste na base ${TENANT_DB}..."
    docker exec "$MYSQL_CONTAINER" mysql -uroot -p"$MYSQL_ROOT_PASSWORD" -D "$TENANT_DB" -e \
      "INSERT INTO clientes (nome, tipo, saldoAtual, createdAt, updatedAt) VALUES ('Cliente Teste POS', 'PACIENTE', 0, NOW(), NOW());" \
      2>/dev/null
  fi
  docker exec "$MYSQL_CONTAINER" mysql -uroot -p"$MYSQL_ROOT_PASSWORD" -N -D "$TENANT_DB" -e \
    "SELECT id FROM clientes WHERE deletedAt IS NULL ORDER BY id LIMIT 1;" 2>/dev/null | tail -1
}

echo "==> 1. Login (${LOGIN_EMAIL})"
LOGIN=$(curl -sf -X POST "${BASE_URL}/central/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"${LOGIN_EMAIL}\",\"password\":\"${LOGIN_PASSWORD}\"}") || fail "login"

TOKEN=$(echo "$LOGIN" | jq -r '.data.token')
TENANT_ID=$(echo "$LOGIN" | jq -r '.data.tenants[0].id')
BRANCH_ID=$(echo "$LOGIN" | jq -r '.data.tenants[0].branches[0].id')
USER_ID=$(echo "$LOGIN" | jq -r '.data.user.id')
[[ -n "$TOKEN" && "$TOKEN" != "null" ]] || fail "sem token"

HDR=(-H "Authorization: Bearer ${TOKEN}" -H "x-tenant-id: ${TENANT_ID}" -H "x-branch-id: ${BRANCH_ID}")

CLIENTE_ID=$(ensure_cliente)
echo "    tenant=${TENANT_ID} branch=${BRANCH_ID} user=${USER_ID} cliente=${CLIENTE_ID}"

echo "==> 2. Stock inicial produto 10000"
STOCK_INI=$(curl -sf "${BASE_URL}/tenant/produtos/10000" "${HDR[@]}" | jq -r '.data.estoqueAtual')
echo "    estoqueAtual=${STOCK_INI}"

echo "==> 3. Abrir sessão de caixa (caixaId=1)"
SESSAO=$(curl -s -w "\n%{http_code}" -X POST "${BASE_URL}/tenant/pos/sessions/open" \
  "${HDR[@]}" -H "Content-Type: application/json" \
  -d '{"caixaId":"1","valorAbertura":500}')
HTTP=$(echo "$SESSAO" | tail -n1)
BODY=$(echo "$SESSAO" | sed '$d')
SESSAO_ID=$(echo "$BODY" | jq -r '.data.sessaoId // .sessaoId // .data.id // empty')
if [[ "$HTTP" == "400" ]] && echo "$BODY" | grep -qi "sessão\|sessao\|aberta"; then
  echo "    sessão já aberta (reutilizar)"
else
  [[ "$HTTP" == "200" || "$HTTP" == "201" ]] || fail "abrir sessão HTTP ${HTTP}: $(echo "$BODY" | head -c 300)"
  echo "    sessão aberta (HTTP ${HTTP}) id=${SESSAO_ID:-ok}"
fi

echo "==> 4. Validar dispensação (produto 10000)"
curl -sf -X POST "${BASE_URL}/tenant/pos/validar-dispensacao" \
  "${HDR[@]}" -H "Content-Type: application/json" \
  -d '{"produtoId":"10000","quantidade":1}' | jq -c '{success, data: .data}' || fail "validar dispensação"

SERVICO_ID=$(docker exec "$MYSQL_CONTAINER" mysql -uroot -p"$MYSQL_ROOT_PASSWORD" -N -D "$TENANT_DB" -e \
  "SELECT id FROM servicos WHERE deletedAt IS NULL ORDER BY id LIMIT 1;" 2>/dev/null | tail -1)
echo "    servicoId=${SERVICO_ID}"

echo "==> 5. Finalizar venda"
VENDA=$(curl -s -w "\n%{http_code}" -X POST "${BASE_URL}/tenant/pos/finalizar" \
  "${HDR[@]}" -H "Content-Type: application/json" \
  -d "{
    \"clienteId\": \"${CLIENTE_ID}\",
    \"terminalId\": \"1\",
    \"metodoPagamento\": \"DINHEIRO\",
    \"idempotencyKey\": \"test-pos-$(date +%s)\",
    \"items\": [
      {
        \"tipo\": \"produto\",
        \"produtoId\": \"10000\",
        \"quantidade\": 2,
        \"receita\": { \"numero\": \"RX-TEST-001\", \"medicoNome\": \"Dr. Teste\" }
      },
      {
        \"tipo\": \"servico\",
        \"servicoId\": \"${SERVICO_ID}\",
        \"quantidade\": 1
      }
    ]
  }")
HTTP=$(echo "$VENDA" | tail -n1)
BODY=$(echo "$VENDA" | sed '$d')
[[ "$HTTP" == "200" || "$HTTP" == "201" ]] || fail "finalizar HTTP ${HTTP}: $(echo "$BODY" | head -c 500)"
FATURA_ID=$(echo "$BODY" | jq -r '.data.faturaId // .faturaId // .data.id // empty')
echo "$BODY" | jq '{success, faturaId: (.data.faturaId // .faturaId), numero: (.data.numero // .numero), total: (.data.total // .total)}'
[[ -n "$FATURA_ID" && "$FATURA_ID" != "null" ]] || fail "sem faturaId"

STOCK_POS=$(curl -sf "${BASE_URL}/tenant/produtos/10000" "${HDR[@]}" | jq -r '.data.estoqueAtual')
echo "    stock após venda: ${STOCK_POS} (era ${STOCK_INI})"

if [[ "$SKIP_CANCEL" == "1" ]]; then
  echo "==> 6. Anulação omitida (SKIP_CANCEL=1)"
  echo "    Fatura ${FATURA_ID} mantida."
  exit 0
fi

echo "==> 6. Anular fatura ${FATURA_ID}"
ANUL=$(curl -s -w "\n%{http_code}" -X POST "${BASE_URL}/tenant/pos/faturas/${FATURA_ID}/cancel" \
  "${HDR[@]}" -H "Content-Type: application/json" \
  -d '{"motivo":"Teste script POS","observacoes":"Anulação automática test-pos-owner.sh"}')
HTTP=$(echo "$ANUL" | tail -n1)
BODY=$(echo "$ANUL" | sed '$d')
[[ "$HTTP" == "200" ]] || fail "anular HTTP ${HTTP}: $(echo "$BODY" | head -c 300)"
echo "$BODY" | jq -c '{success, data: .data}'

STOCK_FIM=$(curl -sf "${BASE_URL}/tenant/produtos/10000" "${HDR[@]}" | jq -r '.data.estoqueAtual')
echo "    stock final: ${STOCK_FIM}"
if [[ "$STOCK_FIM" == "$STOCK_INI" ]]; then
  echo "    OK estoque revertido após anulação"
else
  fail "estoque final ${STOCK_FIM} != inicial ${STOCK_INI}"
fi

echo ""
echo "==> Fluxo POS concluído."
