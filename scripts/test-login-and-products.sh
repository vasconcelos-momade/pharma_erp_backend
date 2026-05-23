#!/usr/bin/env bash
# Login central + listagem de produtos no tenant (com branch explícita).
# Uso: bash scripts/test-login-and-products.sh
# Credenciais: LOGIN_EMAIL e LOGIN_PASSWORD
# Exemplo validado: LOGIN_EMAIL=dono.1779294744@teste.com LOGIN_PASSWORD=123456
# Ver backend/docs/teste-runtime-api-v1.md

set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:3300/api/v1}"
LOGIN_EMAIL="${LOGIN_EMAIL:-admin@skalway.com}"
LOGIN_PASSWORD="${LOGIN_PASSWORD:-admin123}"

echo "🔐 Login: ${LOGIN_EMAIL}"

LOGIN_RESPONSE=$(curl -s -X POST "${BASE_URL}/central/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\": \"${LOGIN_EMAIL}\", \"password\": \"${LOGIN_PASSWORD}\"}")

if command -v jq >/dev/null 2>&1; then
  TOKEN=$(echo "$LOGIN_RESPONSE" | jq -r '.data.token // .token // empty')
  TENANT_ID=$(echo "$LOGIN_RESPONSE" | jq -r '.data.tenants[0].id // .tenants[0].id // empty')
  BRANCH_ID=$(echo "$LOGIN_RESPONSE" | jq -r '.data.tenants[0].branches[0].id // .tenants[0].branches[0].id // empty')
else
  TOKEN=$(echo "$LOGIN_RESPONSE" | sed -n 's/.*"token":"\([^"]*\)".*/\1/p')
  TENANT_ID=$(echo "$LOGIN_RESPONSE" | sed -n 's/.*"tenants":\[{"id":"\([^"]*\)".*/\1/p')
  BRANCH_ID=$(echo "$LOGIN_RESPONSE" | sed -n 's/.*"branches":\[{"id":"\([^"]*\)".*/\1/p')
fi

if [[ -z "$TOKEN" ]]; then
  echo "❌ Erro ao obter token. Resposta: $LOGIN_RESPONSE"
  echo "   Dica: crie um tenant com bash scripts/test-tenant-creation.sh SKIP_SEEDS=1"
  echo "   e use LOGIN_EMAIL/LOGIN_PASSWORD impressos no final."
  exit 1
fi

if [[ -z "$TENANT_ID" || -z "$BRANCH_ID" ]]; then
  echo "❌ Utilizador sem tenant/branch. Resposta: $LOGIN_RESPONSE"
  exit 1
fi

echo "✅ Login OK — tenant=${TENANT_ID} branch=${BRANCH_ID}"
echo "📦 GET /tenant/produtos ..."

curl -s "${BASE_URL}/tenant/produtos" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "x-tenant-id: ${TENANT_ID}" \
  -H "x-branch-id: ${BRANCH_ID}" \
  | head -c 1200

echo ""
echo "✅ Concluído"
