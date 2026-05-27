#!/usr/bin/env bash
# Smoke: health + erros Zod (body, query, route params) na API v1.
# Uso (raiz do repo): bash scripts/smoke-api-v1-validation.sh
# Requer stack dev: docker compose -f docker-compose.dev.yml up -d

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck source=lib/docker.sh
source "${SCRIPT_DIR}/lib/docker.sh"

ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
cd "$ROOT"

BASE_URL="${BASE_URL:-http://localhost:3300/api/v1}"

fail() {
  echo "    FALHA: $*"
  exit 1
}

expect_http() {
  local label="$1"
  local expected="$2"
  local actual="$3"
  if [[ "$actual" != "$expected" ]]; then
    fail "${label}: HTTP ${actual} (esperado ${expected})"
  fi
  echo "    OK (${label} → HTTP ${actual})"
}

expect_json_field() {
  local body="$1"
  local jq_expr="$2"
  local label="$3"
  if ! echo "$body" | jq -e "$jq_expr" >/dev/null 2>&1; then
    echo "$body" | head -c 500
    fail "${label}: resposta inesperada (ver acima)"
  fi
}

echo "==> 1. Health (${BASE_URL}/health)"
HEALTH=$(curl -s -w "\n%{http_code}" "${BASE_URL}/health")
HTTP=$(echo "$HEALTH" | tail -n1)
BODY=$(echo "$HEALTH" | sed '$d')
expect_http "health" "200" "$HTTP"
echo "$BODY" | grep -q '"status":"ok"' || fail "health: corpo sem status ok"

echo "==> 2. Body inválido (login sem password)"
RESP=$(curl -s -w "\n%{http_code}" -X POST "${BASE_URL}/central/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@skalway.com"}')
HTTP=$(echo "$RESP" | tail -n1)
BODY=$(echo "$RESP" | sed '$d')
expect_http "login body" "400" "$HTTP"
expect_json_field "$BODY" '.error.code == "VALIDATION_ERROR"' "login VALIDATION_ERROR"

echo "==> 3. Body inválido (registo tenant incompleto)"
RESP=$(curl -s -w "\n%{http_code}" -X POST "${BASE_URL}/central/tenants" \
  -H "Content-Type: application/json" \
  -d '{"nomeEmpresa":"X"}')
HTTP=$(echo "$RESP" | tail -n1)
BODY=$(echo "$RESP" | sed '$d')
expect_http "register tenant body" "400" "$HTTP"
expect_json_field "$BODY" '.error.code == "VALIDATION_ERROR"' "register VALIDATION_ERROR"

echo "==> 4. Route param inválido (tenantId não numérico)"
LOGIN=$(curl -s -X POST "${BASE_URL}/central/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@skalway.com","password":"admin123"}' || true)
TOKEN=$(echo "$LOGIN" | jq -r '.data.token // .token // empty' 2>/dev/null || true)
if [[ -z "${TOKEN:-}" ]]; then
  echo "    SKIP (sem token — corra seed: docker exec skalway_pharm_backend bun prisma/seed.ts)"
else
  RESP=$(curl -s -w "\n%{http_code}" "${BASE_URL}/central/tenants/not-a-number/invoices" \
    -H "Authorization: Bearer ${TOKEN}")
  HTTP=$(echo "$RESP" | tail -n1)
  BODY=$(echo "$RESP" | sed '$d')
  expect_http "tenantId param" "400" "$HTTP"
  expect_json_field "$BODY" '.error.code == "VALIDATION_ERROR"' "tenantId VALIDATION_ERROR"
fi

echo "==> 5. Query inválida (limit=0 em faturas)"
if [[ -n "${TOKEN:-}" ]]; then
  TENANT_ID=$(echo "$LOGIN" | jq -r '.data.tenants[0].id // .tenants[0].id // "1"')
  if [[ -n "${TENANT_ID:-}" ]]; then
    RESP=$(curl -s -w "\n%{http_code}" "${BASE_URL}/central/tenants/${TENANT_ID}/invoices?limit=0" \
      -H "Authorization: Bearer ${TOKEN}")
    HTTP=$(echo "$RESP" | tail -n1)
    BODY=$(echo "$RESP" | sed '$d')
    expect_http "invoices limit query" "400" "$HTTP"
    expect_json_field "$BODY" '.error.code == "VALIDATION_ERROR"' "limit VALIDATION_ERROR"
  else
    echo "    SKIP (login sem tenants no JWT)"
  fi
else
  echo "    SKIP (sem token)"
fi

echo ""
echo "==> Smoke validação API v1 concluído."
