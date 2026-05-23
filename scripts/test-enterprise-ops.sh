#!/bin/bash

# Configurações
BASE_URL="${BASE_URL:-http://localhost:3300/api/v1}"
ADMIN_EMAIL="dono.central.1778026024@demo.com"
ADMIN_PASSWORD="123456"

echo "🔐 Fazendo login..."
TOKEN=$(curl -s -X POST "$BASE_URL/central/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\": \"$ADMIN_EMAIL\", \"password\": \"$ADMIN_PASSWORD\"}" | sed -n 's/.*"token":"\([^"]*\)".*/\1/p')

if [ -z "$TOKEN" ]; then echo "❌ Erro login"; exit 1; fi

# 1. Testar Venda em Rascunho com Reserva
echo -e "\n📝 1. Criando Venda em Rascunho (Reserva de Stock)..."
# Produto 10000 (CLAVAMOX)
DRAFT_RESPONSE=$(curl -s -X POST "$BASE_URL/tenant/pos/sales/draft" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "clienteId": "2",
    "terminalId": "1",
    "items": [
      {
        "produtoId": "10000",
        "quantidade": 10
      }
    ]
  }')
echo "Draft criado: $DRAFT_RESPONSE"

# 2. Testar Liquidação de Convênio
echo -e "\n🏦 2. Liquidando Convênio (Seguradora VITAL)..."
# Empresa ID 1 (SEGURADORA VITAL) paga 3000 MZN para abater dívida do Cliente ID 2
LIQUIDATE_RESPONSE=$(curl -s -X POST "$BASE_URL/tenant/pos/convenios/liquidate" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "empresaId": "1",
    "caixaId": "1",
    "valorPagamento": 3000,
    "metodoPagamento": "TRANSFERENCIA",
    "referencia": "TRANSF-TEST-001"
  }')
echo "Liquidação concluída: $LIQUIDATE_RESPONSE"

# 3. Testar Relatório de Diferença de Caixa
echo -e "\n📊 3. Gerando Relatório de Auditoria de Caixa (Sessão 1)..."
REPORT_RESPONSE=$(curl -s -X GET "$BASE_URL/tenant/pos/sessions/report?sessaoId=1" \
  -H "Authorization: Bearer $TOKEN")
echo "Relatório de Auditoria:"
echo $REPORT_RESPONSE | sed 's/,/\n/g'

echo -e "\n✅ Testes Enterprise concluídos."
