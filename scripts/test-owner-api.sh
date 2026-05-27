#!/usr/bin/env bash
# Teste E2E leve com dono de tenant (credenciais em backend/docs/teste-runtime-api-v1.md).
# Uso: bash scripts/test-owner-api.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck source=lib/docker.sh
source "${SCRIPT_DIR}/lib/docker.sh"

ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
cd "$ROOT"

BASE_URL="${BASE_URL:-http://localhost:3300/api/v1}"
LOGIN_EMAIL="${LOGIN_EMAIL:-dono.1779294744@teste.com}"
LOGIN_PASSWORD="${LOGIN_PASSWORD:-123456}"

fail() { echo "    FALHA: $*"; exit 1; }

echo "==> Login (${LOGIN_EMAIL})"
LOGIN=$(curl -sf -X POST "${BASE_URL}/central/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"${LOGIN_EMAIL}\",\"password\":\"${LOGIN_PASSWORD}\"}") || fail "login indisponível — stack a correr?"

TOKEN=$(echo "$LOGIN" | jq -r '.data.token // empty')
TENANT_ID=$(echo "$LOGIN" | jq -r '.data.tenants[0].id // empty')
BRANCH_ID=$(echo "$LOGIN" | jq -r '.data.tenants[0].branches[0].id // empty')
[[ -n "$TOKEN" && -n "$TENANT_ID" && -n "$BRANCH_ID" ]] || fail "token/tenant/branch em falta"

echo "    tenant=${TENANT_ID} branch=${BRANCH_ID}"

AUTH=(-H "Authorization: Bearer ${TOKEN}")
TENANT_HDR=(-H "x-tenant-id: ${TENANT_ID}" -H "x-branch-id: ${BRANCH_ID}")

check() {
  local name="$1"
  local url="$2"
  shift 2
  local http
  http=$(curl -s -o /tmp/test-owner-body.json -w "%{http_code}" "$url" "${AUTH[@]}" "$@")
  [[ "$http" == "200" ]] || { echo "    $name HTTP $http"; cat /tmp/test-owner-body.json | head -c 300; fail "$name"; }
  echo "    OK $name"
}

echo "==> Central"
check "tenants list" "${BASE_URL}/central/tenants"
check "tenant detail" "${BASE_URL}/central/tenants/${TENANT_ID}"
check "subscription" "${BASE_URL}/central/tenants/${TENANT_ID}/subscription"
check "invoices" "${BASE_URL}/central/tenants/${TENANT_ID}/invoices?limit=5"
check "payments" "${BASE_URL}/central/tenants/${TENANT_ID}/payments?limit=5"
check "branches" "${BASE_URL}/central/tenants/${TENANT_ID}/branches"

echo "==> Tenant ERP"
check "produtos" "${BASE_URL}/tenant/produtos" "${TENANT_HDR[@]}"
PROD_COUNT=$(jq '.data | length' /tmp/test-owner-body.json 2>/dev/null || echo 0)
echo "    total produtos: ${PROD_COUNT}"
check "pos search" "${BASE_URL}/tenant/pos/produtos/search?q=CLAV" "${TENANT_HDR[@]}"
POS_ITEMS=$(jq '.data.items | length' /tmp/test-owner-body.json 2>/dev/null || echo 0)
echo "    pos search (CLAV): ${POS_ITEMS} itens na página"
check "pos caixas" "${BASE_URL}/tenant/pos/caixas/available" "${TENANT_HDR[@]}"
check "pos sessao" "${BASE_URL}/tenant/pos/sessions/current" "${TENANT_HDR[@]}"

echo ""
echo "==> Teste dono concluído."
