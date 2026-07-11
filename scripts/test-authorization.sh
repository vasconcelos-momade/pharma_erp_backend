#!/usr/bin/env bash
# Testes de autorização baseados em role_permissions (não em role hardcoded).
# Uso (raiz do repo): LOGIN_EMAIL=... LOGIN_PASSWORD=... bash scripts/test-authorization.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck source=lib/docker.sh
source "${SCRIPT_DIR}/lib/docker.sh"

BASE_URL="${BASE_URL:-http://localhost:3300/api/v1}"
LOGIN_EMAIL="${LOGIN_EMAIL:-dono.1781431302@demo.com}"
LOGIN_PASSWORD="${LOGIN_PASSWORD:-123456}"

echo "==> Login central"
LOGIN=$(curl -s -X POST "${BASE_URL}/central/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\": \"${LOGIN_EMAIL}\", \"password\": \"${LOGIN_PASSWORD}\"}")

TOKEN=$(echo "$LOGIN" | jq -r '.data.token // .token // empty')
TENANT_ID=$(echo "$LOGIN" | jq -r '.data.tenants[0].id // .tenants[0].id // empty')
BRANCH_ID=$(echo "$LOGIN" | jq -r '.data.tenants[0].branches[0].id // .tenants[0].branches[0].id // empty')

[[ -n "$TOKEN" && -n "$TENANT_ID" && -n "$BRANCH_ID" ]] || {
  echo "Falha no login: $LOGIN"
  exit 1
}

auth_headers=(
  -H "Authorization: Bearer ${TOKEN}"
  -H "x-tenant-id: ${TENANT_ID}"
  -H "x-branch-id: ${BRANCH_ID}"
)

assert_status() {
  local label="$1"
  local expected="$2"
  local method="$3"
  local path="$4"
  local code

  code=$(curl -s -o /dev/null -w "%{http_code}" -X "$method" "${BASE_URL}${path}" "${auth_headers[@]}")
  if [[ "$code" == "$expected" ]]; then
    echo "    OK  ${label} -> HTTP ${code}"
  else
    echo "    FALHA ${label}: esperado ${expected}, obteve ${code}"
    exit 1
  fi
}

echo "==> Dono (ADMIN via role_permissions): endpoints permitidos"
assert_status "GET produtos" 200 GET "/tenant/produtos"
assert_status "GET compras" 200 GET "/tenant/compras"
assert_status "GET inventarios" 200 GET "/tenant/inventarios"
assert_status "GET POS faturas" 200 GET "/tenant/pos/faturas"

echo "==> CAIXA (matriz role_permissions): permitido vs negado"
MYSQL_CONTAINER="${MYSQL_CONTAINER:-skalway_pharm_mysql}"
MYSQL_ROOT_PASSWORD="${MYSQL_ROOT_PASSWORD:-root_password}"
DB_NAME="${TENANT_DB:-tenant_farmacia_1781431302}"

docker exec "$MYSQL_CONTAINER" mysql -uroot -p"$MYSQL_ROOT_PASSWORD" -e \
  "UPDATE \`${DB_NAME}\`.users SET role='CAIXA' WHERE centralUserId=2;" >/dev/null

assert_status "CAIXA GET produtos (VIEW)" 200 GET "/tenant/produtos"
assert_status "CAIXA GET compras (sem VIEW)" 403 GET "/tenant/compras"
assert_status "CAIXA DELETE produto (sem DELETE)" 403 DELETE "/tenant/produtos/1"

docker exec "$MYSQL_CONTAINER" mysql -uroot -p"$MYSQL_ROOT_PASSWORD" -e \
  "UPDATE \`${DB_NAME}\`.users SET role='ADMIN' WHERE centralUserId=2;" >/dev/null

echo "==> Sucesso — autorização baseada em matriz role_permissions validada"
