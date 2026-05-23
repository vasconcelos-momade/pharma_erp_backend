#!/usr/bin/env sh
set -eu

url="${DATABASE_URL:-}"
if [ -z "$url" ]; then
  echo "❌ DATABASE_URL não está definido."
  exit 1
fi

db_name="$(printf '%s' "$url" | sed -n 's|.*/\([^/?]*\).*|\1|p')"
expected="${MYSQL_DATABASE:-skalway_central}"

if [ -z "$db_name" ]; then
  echo "❌ Não foi possível extrair o nome da base de DATABASE_URL."
  exit 1
fi

case "$db_name" in
  tenant_*)
    echo "❌ DATABASE_URL aponta para a base tenant '${db_name}'."
    echo "   O comando 'prisma:deploy:central' só pode correr em '${expected}'."
    echo "   Corrija .env (DATABASE_URL) antes de reiniciar o backend."
    exit 1
    ;;
esac

if [ "$db_name" != "$expected" ]; then
  echo "⚠️  DATABASE_URL usa '${db_name}' (esperado: '${expected}')."
  echo "   Continuando porque não é uma base tenant_*."
fi
