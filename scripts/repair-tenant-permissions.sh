#!/usr/bin/env bash
# Restaura a matriz padrão de role_permissions num tenant (útil após edição acidental na UI).
# Uso: bash scripts/repair-tenant-permissions.sh tenant_farmacia_1782573570

set -euo pipefail

TENANT_DB="${1:-}"
if [[ -z "$TENANT_DB" ]]; then
  echo "Uso: bash scripts/repair-tenant-permissions.sh <tenant_db>"
  echo "Exemplo: bash scripts/repair-tenant-permissions.sh tenant_farmacia_1782573570"
  exit 1
fi

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MYSQL_ROOT_PASSWORD="${MYSQL_ROOT_PASSWORD:-root_password}"

echo "🔐 A restaurar permissões por perfil em ${TENANT_DB}..."
docker exec \
  -e "DATABASE_URL_TENANT=mysql://root:${MYSQL_ROOT_PASSWORD}@mysql_central:3306/${TENANT_DB}" \
  skalway_pharm_backend \
  bun prisma/seed-role-permissions.ts

echo "✅ Permissões restauradas. Peça aos utilizadores para fazer logout/login."
