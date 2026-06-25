#!/usr/bin/env bash
# Aplica migrations Prisma em todas as bases tenant_* (preserva dados).
# Uso: bash scripts/migrate-all-tenants.sh [--baseline-all]
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
BASELINE_FLAG="${1:-}"

MYSQL_CONTAINER="${MYSQL_CONTAINER:-skalway_pharm_mysql}"
MYSQL_ROOT_PASSWORD="${MYSQL_ROOT_PASSWORD:-root_password}"

dbs="$(
  docker exec "$MYSQL_CONTAINER" mysql -uroot -p"$MYSQL_ROOT_PASSWORD" --batch --skip-column-names \
    -e "SELECT SCHEMA_NAME FROM information_schema.SCHEMATA WHERE SCHEMA_NAME LIKE 'tenant_%' ORDER BY 1;" \
    2>/dev/null
)"

if [[ -z "${dbs// }" ]]; then
  echo "Nenhuma base tenant_* encontrada."
  exit 1
fi

failed=0
while IFS= read -r db; do
  [[ -z "${db:-}" ]] && continue
  echo ""
  echo "=============================="
  echo "Migrando: $db"
  echo "=============================="
  if ! bash "$SCRIPT_DIR/migrate-tenant-deploy.sh" "$db" $BASELINE_FLAG; then
    failed=$((failed + 1))
  fi
done <<< "$dbs"

echo ""
echo "==> Validar tabelas requisicoes..."
while IFS= read -r db; do
  [[ -z "${db:-}" ]] && continue
  count="$(
    docker exec "$MYSQL_CONTAINER" mysql -uroot -p"$MYSQL_ROOT_PASSWORD" --batch --skip-column-names \
      -e "SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA='${db}' AND TABLE_NAME IN ('requisicoes','requisicao_itens');" \
      2>/dev/null
  )"
  if [[ "${count:-0}" == "2" ]]; then
    echo "  ✓ ${db}: requisicoes + requisicao_itens OK"
  else
    echo "  ✗ ${db}: tabelas de transferência em falta (${count}/2)"
    failed=$((failed + 1))
  fi
done <<< "$dbs"

if [[ "$failed" -gt 0 ]]; then
  echo ""
  echo "❌ ${failed} tenant(s) com falha."
  exit 1
fi

echo ""
echo "✅ Todas as bases tenant_* migradas e validadas."
