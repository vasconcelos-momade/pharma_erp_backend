#!/usr/bin/env bash
# Teste E2E: tenant + trial + email + fim de trial + invoice (+ opcional: branch, suspensão, mensal).
# Uso (raiz do repo): bash scripts/test-billing-lifecycle.sh
#
# Variáveis:
#   SKIP_TENANT_CREATE=1     — reutilizar TENANT_ID existente
#   TENANT_ID=               — obrigatório se SKIP_TENANT_CREATE=1
#   SKIP_BRANCH=1            — não criar filial extra
#   SKIP_SUSPENSION=1        — não simular fatura vencida / suspensão
#   SKIP_MONTHLY=1           — não correr billing mensal
#   DRY_RUN_MONTHLY=1        — mensal em --dry-run

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck source=lib/docker.sh
source "${SCRIPT_DIR}/lib/docker.sh"

ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
cd "$ROOT"

BASE_URL="${BASE_URL:-http://localhost:3300/api/v1}"
MYSQL_CONTAINER="${MYSQL_CONTAINER:-skalway_pharm_mysql}"
BACKEND_CONTAINER="${BACKEND_CONTAINER:-skalway_pharm_backend}"
MYSQL_ROOT_PASSWORD="${MYSQL_ROOT_PASSWORD:-root_password}"

SKIP_TENANT_CREATE="${SKIP_TENANT_CREATE:-0}"
SKIP_BRANCH="${SKIP_BRANCH:-0}"
SKIP_SUSPENSION="${SKIP_SUSPENSION:-0}"
SKIP_MONTHLY="${SKIP_MONTHLY:-0}"
DRY_RUN_MONTHLY="${DRY_RUN_MONTHLY:-0}"

mysql_query() {
  docker exec "$MYSQL_CONTAINER" mysql -uroot -p"$MYSQL_ROOT_PASSWORD" -N -e "$1" 2>/dev/null
}

billing_exec() {
  docker exec "$BACKEND_CONTAINER" bun "$@"
}

echo "==> 0. Pré-requisitos"
curl -sf "${BASE_URL}/health" | grep -q '"status":"ok"' || {
  echo "    API em ${BASE_URL} indisponível. Suba o stack: docker compose -f docker-compose.dev.yml up -d"
  exit 1
}
echo "    API OK"

SMTP_CHECK=$(docker exec "$BACKEND_CONTAINER" printenv SMTP_HOST 2>/dev/null || true)
FROM_CHECK=$(docker exec "$BACKEND_CONTAINER" sh -c 'printenv MAIL_FROM || printenv SMTP_FROM' 2>/dev/null || true)
if [[ -z "$SMTP_CHECK" || -z "$FROM_CHECK" ]]; then
  echo "    AVISO: SMTP incompleto — emails só nos logs ([email] SMTP nao configurado)"
else
  echo "    SMTP configurado (${SMTP_CHECK})"
fi

TS=$(date +%s)
TENANT_SLUG="billing_${TS}"
OWNER_EMAIL="billing.${TS}@demo.com"
OWNER_PASSWORD="123456"

if [[ "$SKIP_TENANT_CREATE" == "1" ]]; then
  [[ -n "${TENANT_ID:-}" ]] || { echo "    TENANT_ID obrigatório com SKIP_TENANT_CREATE=1"; exit 1; }
  echo "==> 1. Tenant existente: ${TENANT_ID}"
else
  echo "==> 1. Criar tenant (POST /central/tenants)"
  BODY=$(curl -s -X POST "${BASE_URL}/central/tenants" \
    -H "Content-Type: application/json" \
    -d "{
      \"nomeEmpresa\": \"Billing Demo ${TS}\",
      \"nomeTenant\": \"${TENANT_SLUG}\",
      \"adminName\": \"Admin\",
      \"adminEmail\": \"admin.${TS}@demo.com\",
      \"adminPassword\": \"${OWNER_PASSWORD}\",
      \"ownerUser\": {
        \"name\": \"Dono\",
        \"email\": \"${OWNER_EMAIL}\",
        \"password\": \"${OWNER_PASSWORD}\",
        \"role\": \"admin\"
      }
    }")

  if command -v jq >/dev/null 2>&1; then
    TENANT_ID=$(echo "$BODY" | jq -r '.data.id // .id')
    BRANCH_ID=$(echo "$BODY" | jq -r '.data.branch.id // .branch.id')
  else
    TENANT_ID=$(echo "$BODY" | sed -n 's/.*"id":"\?\([^",}]*\)".*/\1/p' | head -1)
    BRANCH_ID=$(echo "$BODY" | sed -n 's/.*"branch":{[^}]*"id":"\?\([^",}]*\)".*/\1/p' | head -1)
  fi

  [[ -n "$TENANT_ID" && "$TENANT_ID" != "null" ]] || { echo "    Falha ao criar tenant: $BODY"; exit 1; }
  echo "    tenantId=${TENANT_ID} branchHQ=${BRANCH_ID}"
  echo "    Verifique email de trial em: ${OWNER_EMAIL}"
fi

echo "==> 2. Subscrição em trial (MySQL)"
SUB_ROW=$(mysql_query "
  SELECT s.id, s.status, DATE_FORMAT(s.trialEndsAt, '%Y-%m-%d %H:%i:%s'),
         p.slug, t.status
  FROM skalway_central.subscriptions s
  JOIN skalway_central.plans p ON p.id = s.planId
  JOIN skalway_central.tenants t ON t.id = s.tenantId
  WHERE s.tenantId = ${TENANT_ID} AND s.deletedAt IS NULL
  ORDER BY s.createdAt DESC LIMIT 1;
")
[[ -n "$SUB_ROW" ]] || { echo "    Subscrição não encontrada"; exit 1; }

SUBSCRIPTION_ID=$(echo "$SUB_ROW" | awk '{print $1}')
SUB_STATUS=$(echo "$SUB_ROW" | awk '{print $2}')
TRIAL_ENDS=$(echo "$SUB_ROW" | awk '{print $3}')
PLAN_SLUG=$(echo "$SUB_ROW" | awk '{print $4}')
TENANT_STATUS=$(echo "$SUB_ROW" | awk '{print $5}')

echo "    subscription=${SUBSCRIPTION_ID} status=${SUB_STATUS} trialEndsAt=${TRIAL_ENDS} plan=${PLAN_SLUG} tenant=${TENANT_STATUS}"
[[ "$SUB_STATUS" == "trial" ]] || echo "    AVISO: esperado status trial, obteve ${SUB_STATUS}"

if [[ "$SKIP_BRANCH" != "1" && "$SKIP_TENANT_CREATE" != "1" ]]; then
  echo "==> 3. Criar filial extra (CreateBranchUseCase)"
  BRANCH_JSON=$(billing_exec scripts/test-create-branch.ts \
    --tenant-id="${TENANT_ID}" \
    --code="L2" \
    --name="Filial 2 Demo")
  echo "    ${BRANCH_JSON}"
  BRANCHES=$(mysql_query "SELECT COUNT(*) FROM skalway_central.branches WHERE tenantId=${TENANT_ID} AND active=1 AND deletedAt IS NULL;")
  echo "    branches activas: ${BRANCHES}"
else
  echo "==> 3. Filial extra omitida"
fi

echo "==> 4. Simular fim de trial (billing:process:lifecycle)"
# Dia seguinte ao trialEndsAt (UTC) em ISO date
REF_TRIAL=$(mysql_query "
  SELECT DATE_FORMAT(DATE_ADD(s.trialEndsAt, INTERVAL 1 DAY), '%Y-%m-%d')
  FROM skalway_central.subscriptions s
  WHERE s.id = ${SUBSCRIPTION_ID};
")
LIFECYCLE_TRIAL=$(billing_exec run billing:process:lifecycle -- --reference-date="${REF_TRIAL}")
echo "$LIFECYCLE_TRIAL" | head -20

INV_ROW=$(mysql_query "
  SELECT i.number, i.status, i.amount, DATE_FORMAT(i.dueDate, '%Y-%m-%d')
  FROM skalway_central.invoices i
  WHERE i.subscriptionId = ${SUBSCRIPTION_ID}
  ORDER BY i.createdAt DESC LIMIT 1;
")
[[ -n "$INV_ROW" ]] || { echo "    FALHA: nenhuma invoice após fim de trial"; exit 1; }
echo "    Invoice: ${INV_ROW}"

AFTER=$(mysql_query "
  SELECT s.status, t.status
  FROM skalway_central.subscriptions s
  JOIN skalway_central.tenants t ON t.id = s.tenantId
  WHERE s.id = ${SUBSCRIPTION_ID};
")
echo "    Pós-trial: subscription/tenant = ${AFTER}"
echo "    Verifique email de factura emitida em: ${OWNER_EMAIL:-inbox do owner}"

if [[ "$SKIP_SUSPENSION" != "1" ]]; then
  echo "==> 5. Simular fatura vencida e suspensão"
  REF_OVERDUE=$(mysql_query "
    SELECT DATE_FORMAT(DATE_ADD(i.dueDate, INTERVAL 2 DAY), '%Y-%m-%d')
    FROM skalway_central.invoices i
    WHERE i.subscriptionId = ${SUBSCRIPTION_ID}
    ORDER BY i.createdAt DESC LIMIT 1;
  ")
  LIFECYCLE_OVER=$(billing_exec run billing:process:lifecycle -- --reference-date="${REF_OVERDUE}")
  echo "$LIFECYCLE_OVER" | head -15

  SUSP=$(mysql_query "
    SELECT s.status, t.status, i.status
    FROM skalway_central.subscriptions s
    JOIN skalway_central.tenants t ON t.id = s.tenantId
    JOIN skalway_central.invoices i ON i.subscriptionId = s.id
    WHERE s.id = ${SUBSCRIPTION_ID}
    ORDER BY i.createdAt DESC LIMIT 1;
  ")
  echo "    Pós-vencimento: sub/tenant/invoice = ${SUSP}"
  echo "    Verifique email de suspensão"
else
  echo "==> 5. Suspensão omitida (SKIP_SUSPENSION=1)"
fi

if [[ "$SKIP_MONTHLY" != "1" ]]; then
  echo "==> 6. Faturação mensal (billing:generate:monthly)"
  MONTHLY_ARGS=(run billing:generate:monthly -- --tenant-id="${TENANT_ID}")
  [[ "$DRY_RUN_MONTHLY" == "1" ]] && MONTHLY_ARGS+=(--dry-run)
  billing_exec "${MONTHLY_ARGS[@]}" | head -25
else
  echo "==> 6. Mensal omitida"
fi

echo ""
echo "==> Sucesso — resumo"
echo "    TENANT_ID=${TENANT_ID}"
echo "    SUBSCRIPTION_ID=${SUBSCRIPTION_ID}"
echo "    OWNER_EMAIL=${OWNER_EMAIL:-n/a}"
echo ""
echo "Consultas úteis:"
echo "  docker logs ${BACKEND_CONTAINER} 2>&1 | grep '\\[email\\]'"
echo "  docker exec -it ${MYSQL_CONTAINER} mysql -uroot -p${MYSQL_ROOT_PASSWORD} skalway_central"
