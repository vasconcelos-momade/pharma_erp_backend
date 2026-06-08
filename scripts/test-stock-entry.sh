#!/bin/bash

# Configurações
BASE_URL="${BASE_URL:-http://localhost:3300/api/v1}"
ADMIN_EMAIL="dono.central.1778026024@demo.com"
ADMIN_PASSWORD="123456"

echo "🔐 Fazendo login..."
LOGIN_RESPONSE=$(curl -s -X POST "$BASE_URL/central/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\": \"$ADMIN_EMAIL\", \"password\": \"$ADMIN_PASSWORD\"}")

TOKEN=$(echo $LOGIN_RESPONSE | sed -n 's/.*"token":"\([^"]*\)".*/\1/p')

if [ -z "$TOKEN" ]; then
  echo "❌ Erro ao obter token."
  exit 1
fi
echo "✅ Login realizado!"

# 1. Listar Produtos
echo "📦 Listando produtos..."
curl -s -X GET "$BASE_URL/tenant/produtos" \
  -H "Authorization: Bearer $TOKEN" | head -c 500
echo -e "\n..."

# 2. Entrada de Stock (Receive Purchase)
echo "📥 Realizando entrada de stock..."
# Dados para o teste
PRODUTO_ID="10000"
FORNECEDOR_ID="1"
LOTE="LOTE-TESTE-$(date +%s)"
VALIDADE="2027-12-31"

DOC_NUM="FT-TESTE-$(date +%s)"
STOCK_ENTRY_DATA='{
  "fornecedorId": "'$FORNECEDOR_ID'",
  "numeroDocumento": "'$DOC_NUM'",
  "items": [
    {
      "produtoId": "'$PRODUTO_ID'",
      "numeroLote": "'$LOTE'",
      "dataValidade": "'$VALIDADE'",
      "quantidade": 50,
      "precoCompra": 100,
      "precoVenda": 150
    }
  ]
}'

STOCK_RESPONSE=$(curl -s -X POST "$BASE_URL/tenant/stock/receive" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "$STOCK_ENTRY_DATA")

echo "📄 Resposta da entrada de stock:"
echo $STOCK_RESPONSE | sed 's/,/\n/g'

# 3. Verificar se o stock aumentou
echo "🔍 Verificando stock atualizado do produto $PRODUTO_ID..."
curl -s -X GET "$BASE_URL/tenant/produtos/$PRODUTO_ID" \
  -H "Authorization: Bearer $TOKEN" | sed 's/,/\n/g'
