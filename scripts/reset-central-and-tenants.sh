#!/usr/bin/env bash
# Recria a base central (migrations), apaga bases tenant_* e reinicia backend/worker.
# Uso: a partir da raiz do repo: bash scripts/reset-central-and-tenants.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck source=lib/docker.sh
source "${SCRIPT_DIR}/lib/docker.sh"
# shellcheck source=lib/mysql-tenants.sh
source "${SCRIPT_DIR}/lib/mysql-tenants.sh"

ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
cd "$ROOT"

COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.dev.yml}"
MYSQL_CONTAINER="${MYSQL_CONTAINER:-skalway_pharm_mysql}"
MYSQL_ROOT_PASSWORD="${MYSQL_ROOT_PASSWORD:-root_password}"
CENTRAL_DB="${MYSQL_DATABASE:-skalway_central}"
MYSQL_APP_USER="${MYSQL_USER:-admin}"

echo "==> Apagando bases tenant_* ..."
drop_all_tenant_databases

echo "==> Recriando base central: $CENTRAL_DB ..."
docker exec "$MYSQL_CONTAINER" mysql -uroot -p"$MYSQL_ROOT_PASSWORD" -e "
  DROP DATABASE IF EXISTS \`${CENTRAL_DB}\`;
  CREATE DATABASE \`${CENTRAL_DB}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
  GRANT ALL PRIVILEGES ON \`${CENTRAL_DB}\`.* TO '${MYSQL_APP_USER}'@'%';
  FLUSH PRIVILEGES;
"

echo "==> Sincronizando base central com Prisma (db push, sem generate) ..."
docker compose -f "$COMPOSE_FILE" run --rm --no-deps backend \
  bunx prisma db push \
    --schema=src/infrastructure/prisma/central/schema.prisma \
    --accept-data-loss \
    --skip-generate

echo "==> Reiniciando backend e worker (generate no entrypoint / volumes Docker) ..."
docker compose -f "$COMPOSE_FILE" up -d --build --force-recreate backend backend_worker

echo "==> Aguardando backend ..."
sleep 8

echo "==> Seed central (planos + superadmin) ..."
docker exec skalway_pharm_backend bun prisma/seed.ts

echo ""
echo "==> Pronto. Teste criação de tenant:"
echo "    bash scripts/test-tenant-creation.sh SKIP_SEEDS=1"
echo ""
echo "    ou manualmente (TS=\$(date +%s)):"
echo "TS=\$(date +%s)"
echo "curl -s -i -X POST \"http://localhost:3300/api/v1/central/tenants\" \\"
echo "  -H \"Content-Type: application/json\" \\"
echo "  -d \"{\\\"nomeEmpresa\\\":\\\"Farmacia \\\$TS\\\",\\\"nomeTenant\\\":\\\"farmacia_\\\$TS\\\",\\\"adminName\\\":\\\"Admin\\\",\\\"adminEmail\\\":\\\"admin.\\\$TS@demo.com\\\",\\\"adminPassword\\\":\\\"123456\\\",\\\"ownerUser\\\":{\\\"name\\\":\\\"Dono\\\",\\\"email\\\":\\\"dono.\\\$TS@demo.com\\\",\\\"password\\\":\\\"123456\\\",\\\"role\\\":\\\"admin\\\"}}\""
