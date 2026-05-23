#!/usr/bin/env bash
# Billing lifecycle no tenant 1 (farmacia_1779294744) — requer superadmin.
# Uso: bash scripts/test-billing-tenant1.sh

set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:3300/api/v1}"
TENANT_ID="${TENANT_ID:-1}"
REF_DATE="${REF_DATE:-2026-05-28}"

echo "==> Login superadmin"
STOKEN=$(curl -sf -X POST "${BASE_URL}/central/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@skalway.com","password":"admin123"}' | jq -r '.data.token')
[[ -n "$STOKEN" ]] || { echo "Falha login superadmin"; exit 1; }

echo "==> POST /central/billing/process-lifecycle (ref=${REF_DATE})"
curl -sf -X POST "${BASE_URL}/central/billing/process-lifecycle" \
  -H "Authorization: Bearer ${STOKEN}" \
  -H "Content-Type: application/json" \
  -d "{\"referenceDate\":\"${REF_DATE}\"}" | jq .

echo "==> Faturas do tenant ${TENANT_ID} (login dono)"
DONO=$(curl -sf -X POST "${BASE_URL}/central/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"dono.1779294744@teste.com","password":"123456"}' | jq -r '.data.token')

curl -sf "${BASE_URL}/central/tenants/${TENANT_ID}/invoices?limit=5" \
  -H "Authorization: Bearer ${DONO}" | jq '{success, invoices: [.data[]? | {number, amount, status, remainingAmount}]}'

curl -sf "${BASE_URL}/central/tenants/${TENANT_ID}/subscription" \
  -H "Authorization: Bearer ${DONO}" | jq '{success, status: .data.status, plan: .data.plan.name}'

echo "==> Concluído."
