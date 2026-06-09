#!/usr/bin/env bash
# Aplica migrations Prisma numa base tenant_* SEM apagar dados.
# Usa `prisma migrate deploy` (SQL incremental). Não usa `db push --accept-data-loss`.
#
# Uso:
#   bash scripts/migrate-tenant-deploy.sh tenant_farmacia_123
#   bash scripts/migrate-tenant-deploy.sh tenant_farmacia_123 --baseline-all
#
# --baseline-all  Marca todas as migrations existentes como aplicadas (só para bases
#                 que já tinham o schema sincronizado via db push e ainda não têm
#                 tabela _prisma_migrations). Depois corre migrate deploy.

set -euo pipefail

DB_NAME="${1:-}"
BASELINE_ALL="${2:-}"

if [[ -z "$DB_NAME" ]]; then
  echo "Uso: bash scripts/migrate-tenant-deploy.sh <tenant_db_name> [--baseline-all]"
  echo "Exemplo: bash scripts/migrate-tenant-deploy.sh tenant_farmacia_1780931448"
  exit 1
fi

MYSQL_ROOT_PASSWORD="${MYSQL_ROOT_PASSWORD:-root_password}"
MYSQL_CONTAINER="${MYSQL_CONTAINER:-skalway_pharm_mysql}"
BACKEND_CONTAINER="${BACKEND_CONTAINER:-skalway_pharm_backend}"
SCHEMA="src/infrastructure/prisma/tenant/schema.prisma"
MIGRATIONS_DIR="src/infrastructure/prisma/tenant/migrations"
DB_URL="mysql://root:${MYSQL_ROOT_PASSWORD}@mysql_central:3306/${DB_NAME}"

run_prisma() {
  docker exec -e DATABASE_URL_TENANT="$DB_URL" "$BACKEND_CONTAINER" \
    sh -c "bash scripts/ensure-tenant-database-url.sh && $*"
}

echo "==> Tenant: ${DB_NAME}"
echo "==> URL: mysql://root:***@mysql_central:3306/${DB_NAME}"

if ! docker exec "$MYSQL_CONTAINER" mysql -uroot -p"$MYSQL_ROOT_PASSWORD" --batch --skip-column-names \
  -e "SELECT COUNT(*) FROM information_schema.SCHEMATA WHERE SCHEMA_NAME='${DB_NAME}';" 2>/dev/null | grep -q '^1$'; then
  echo "❌ Base '${DB_NAME}' não existe."
  exit 1
fi

if [[ "$BASELINE_ALL" == "--baseline-all" ]]; then
  echo "==> Baseline: marcar migrations existentes como aplicadas (sem executar SQL)..."
  for dir in "$MIGRATIONS_DIR"/*/; do
    [[ -d "$dir" ]] || continue
    migration_name="$(basename "$dir")"
    [[ "$migration_name" == "migration_lock.toml" ]] && continue
    echo "    resolve --applied ${migration_name}"
    run_prisma "bunx prisma migrate resolve --applied ${migration_name} --schema=${SCHEMA}" || true
  done
fi

echo "==> prisma migrate deploy (incremental, preserva dados)..."
if run_prisma "bunx prisma migrate deploy --schema=${SCHEMA}"; then
  echo "==> Regenerar Prisma Client tenant..."
  docker exec "$BACKEND_CONTAINER" bun run prisma:generate:tenant
  echo ""
  echo "✅ Migrations tenant aplicadas em ${DB_NAME}."
  echo "   Reinicie o backend se estiver em execução: docker restart ${BACKEND_CONTAINER}"
else
  echo ""
  echo "⚠️  migrate deploy falhou (ex.: P3005 — base não vazia sem histórico Prisma)."
  echo "   Se a base já tinha schema via db push, execute:"
  echo "   bash scripts/migrate-tenant-deploy.sh ${DB_NAME} --baseline-all"
  echo ""
  echo "   Se faltam apenas tabelas novas (ex.: transferencias), faça baseline só das"
  echo "   migrations antigas e volte a correr sem --baseline-all:"
  echo "   docker exec -e DATABASE_URL_TENANT=\"${DB_URL}\" ${BACKEND_CONTAINER} \\"
  echo "     bunx prisma migrate resolve --applied NOME_DA_MIGRATION --schema=${SCHEMA}"
  exit 1
fi
