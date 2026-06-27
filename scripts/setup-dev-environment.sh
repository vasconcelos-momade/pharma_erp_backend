#!/usr/bin/env bash
# Sobe o stack dev, aplica migrations, cria tenant e corre todos os seeders.
# Uso (raiz do repo): bash scripts/setup-dev-environment.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck source=lib/docker.sh
source "${SCRIPT_DIR}/lib/docker.sh"
# shellcheck source=lib/mysql-tenants.sh
source "${SCRIPT_DIR}/lib/mysql-tenants.sh"

ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
cd "$ROOT"

COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.dev.yml}"
BASE_URL="${BASE_URL:-http://localhost:3300/api/v1}"
MYSQL_CONTAINER="${MYSQL_CONTAINER:-skalway_pharm_mysql}"
BACKEND_CONTAINER="${BACKEND_CONTAINER:-skalway_pharm_backend}"
MYSQL_ROOT_PASSWORD="${MYSQL_ROOT_PASSWORD:-root_password}"
MYSQL_USER="${MYSQL_USER:-admin}"
MYSQL_PASSWORD="${MYSQL_PASSWORD:-password}"

wait_for_health() {
  local attempts=0
  local max=60
  echo "==> Aguardando API (${BASE_URL}/health) ..."
  until curl -sf "${BASE_URL}/health" | grep -q '"status":"ok"'; do
    attempts=$((attempts + 1))
    if [[ "$attempts" -ge "$max" ]]; then
      echo "    Timeout à espera do backend"
      docker compose -f "$COMPOSE_FILE" logs --tail=50 backend
      exit 1
    fi
    sleep 3
  done
  echo "    API OK"
}

echo "==> 1. Subir containers (docker compose up -d --build)"
docker compose -f "$COMPOSE_FILE" up -d --build

wait_for_health

echo "==> 2. Migrations central (prisma migrate deploy)"
docker exec "$BACKEND_CONTAINER" bun run prisma:migrate:central

echo "==> 3. Seed central (planos + superadmin)"
docker exec "$BACKEND_CONTAINER" bun prisma/seed.ts

TS=$(date +%s)
TENANT_SLUG="farmacia_${TS}"
DB_NAME="tenant_${TENANT_SLUG}"
OWNER_EMAIL="dono.${TS}@demo.com"
OWNER_PASSWORD="123456"

echo "==> 4. Criar tenant (POST /central/tenants) — base: ${DB_NAME}"
RESP=$(curl -s -i -X POST "${BASE_URL}/central/tenants" \
  -H "Content-Type: application/json" \
  -d "{
    \"nomeEmpresa\": \"Farmacia Demo ${TS}\",
    \"nomeTenant\": \"${TENANT_SLUG}\",
    \"adminName\": \"Admin Tenant\",
    \"adminEmail\": \"admin.${TS}@demo.com\",
    \"adminPassword\": \"${OWNER_PASSWORD}\",
    \"ownerUser\": {
      \"name\": \"Dono Central\",
      \"email\": \"${OWNER_EMAIL}\",
      \"password\": \"${OWNER_PASSWORD}\",
      \"role\": \"admin\"
    }
  }")

HTTP_CODE=$(echo "$RESP" | head -1 | awk '{print $2}')
if [[ "$HTTP_CODE" != "201" ]]; then
  echo "    Esperado 201, obteve ${HTTP_CODE}"
  echo "$RESP"
  exit 1
fi
echo "    201 Created"

if ! tenant_database_exists "${DB_NAME}"; then
  echo "    Base ${DB_NAME} não encontrada no MySQL"
  exit 1
fi
echo "    Base ${DB_NAME} confirmada no MySQL"

echo "==> 5. Migrations tenant (baseline + deploy)"
bash backend/scripts/migrate-tenant-deploy.sh "${DB_NAME}" --baseline-all

DB_URL="mysql://${MYSQL_USER}:${MYSQL_PASSWORD}@mysql_central:3306/${DB_NAME}"

echo "==> 6. Seed completo do tenant (pode demorar 20–30 min com medicamentos ANARME)"
docker exec -e DATABASE_URL_TENANT="${DB_URL}" "$BACKEND_CONTAINER" \
  bun prisma/seed-all-tenant.ts "${DB_NAME}"

echo ""
echo "==> Ambiente pronto"
echo "    API:      http://localhost:3300/api/v1"
echo "    Tenant:   ${TENANT_SLUG}"
echo "    Email:    ${OWNER_EMAIL}"
echo "    Password: ${OWNER_PASSWORD}"
echo "    DB:       ${DB_NAME}"
echo ""
echo "    export LOGIN_EMAIL='${OWNER_EMAIL}'"
echo "    export LOGIN_PASSWORD='${OWNER_PASSWORD}'"
echo "    bash scripts/test-login-and-products.sh"
