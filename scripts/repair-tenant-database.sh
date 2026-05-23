#!/usr/bin/env bash
# Sincroniza schema tenant e recria vínculos users (centralUserId) a partir da central.
# Uso: bash scripts/repair-tenant-database.sh tenant_farmacia_1779410837

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck source=lib/docker.sh
source "${SCRIPT_DIR}/lib/docker.sh"
# shellcheck source=lib/mysql-tenants.sh
source "${SCRIPT_DIR}/lib/mysql-tenants.sh"

ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
cd "$ROOT"

DB_NAME="${1:-}"
if [[ -z "$DB_NAME" ]]; then
  echo "Uso: bash scripts/repair-tenant-database.sh <tenant_db_name>"
  echo "Exemplo: bash scripts/repair-tenant-database.sh tenant_farmacia_1779410837"
  exit 1
fi

COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.dev.yml}"
MYSQL_CONTAINER="${MYSQL_CONTAINER:-skalway_pharm_mysql}"
MYSQL_ROOT_PASSWORD="${MYSQL_ROOT_PASSWORD:-root_password}"
BACKEND_CONTAINER="${BACKEND_CONTAINER:-skalway_pharm_backend}"

if ! tenant_database_exists "$DB_NAME"; then
  echo "❌ A base '${DB_NAME}' não existe no MySQL."
  echo "   Bases tenant_* disponíveis:"
  docker exec "$MYSQL_CONTAINER" mysql -uroot -p"$MYSQL_ROOT_PASSWORD" --batch --skip-column-names \
    -e "SELECT SCHEMA_NAME FROM information_schema.SCHEMATA WHERE SCHEMA_NAME LIKE 'tenant_%' ORDER BY 1;"
  exit 1
fi

DB_URL="mysql://root:${MYSQL_ROOT_PASSWORD}@mysql_central:3306/${DB_NAME}"

echo "==> Sincronizar schema tenant em ${DB_NAME} ..."
docker exec -e DATABASE_URL_TENANT="$DB_URL" "$BACKEND_CONTAINER" \
  sh -c 'bash scripts/ensure-tenant-database-url.sh && bunx prisma db push --schema=src/infrastructure/prisma/tenant/schema.prisma --accept-data-loss --skip-generate'

echo "==> Reparar utilizadores tenant (centralUserId) ..."
docker exec -e DATABASE_URL_TENANT="$DB_URL" "$BACKEND_CONTAINER" \
  bun prisma/repair-tenant-users.ts "$DB_NAME"

echo ""
echo "✅ Reparação concluída para ${DB_NAME}."
