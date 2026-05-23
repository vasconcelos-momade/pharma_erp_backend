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

# 1. Verificar Stock Atual
echo "🔍 Verificando stock inicial do produto 10000..."
STOCK_INICIAL=$(curl -s -X GET "$BASE_URL/tenant/produtos/10000" -H "Authorization: Bearer $TOKEN" | sed -n 's/.*"estoqueAtual":"\([^"]*\)".*/\1/p')
echo "Stock Inicial: $STOCK_INICIAL"

# 2. Realizar uma Venda
echo "💰 Realizando uma venda de 5 unidades..."
VENDA_RESPONSE=$(curl -s -X POST "$BASE_URL/tenant/pos/finalizar" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "clienteId": "1",
    "terminalId": "1",
    "metodoPagamento": "DINHEIRO",
    "items": [
      {
        "tipo": "produto",
        "produtoId": "10000",
        "quantidade": 5
      }
    ]
  }')

FATURA_ID=$(echo $VENDA_RESPONSE | sed -n 's/.*"faturaId":"\([^"]*\)".*/\1/p')
echo "Venda realizada! Fatura ID: $FATURA_ID"

# 3. Verificar Stock após Venda
STOCK_APOS_VENDA=$(curl -s -X GET "$BASE_URL/tenant/produtos/10000" -H "Authorization: Bearer $TOKEN" | sed -n 's/.*"estoqueAtual":"\([^"]*\)".*/\1/p')
echo "Stock após venda: $STOCK_APOS_VENDA"

# 4. Anular a Fatura
echo "⚠️ Anulando a fatura $FATURA_ID..."
ANULACAO_RESPONSE=$(curl -s -X POST "$BASE_URL/tenant/pos/faturas/$FATURA_ID/cancel" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "motivo": "Teste de cancelamento audital",
    "observacoes": "Cancelamento realizado via script de teste"
  }')

echo "Resposta da anulação:"
echo $ANULACAO_RESPONSE | sed 's/,/\n/g'

# 5. Verificar Stock após Anulação
STOCK_FINAL=$(curl -s -X GET "$BASE_URL/tenant/produtos/10000" -H "Authorization: Bearer $TOKEN" | sed -n 's/.*"estoqueAtual":"\([^"]*\)".*/\1/p')
echo "Stock final (deve ser igual ao inicial): $STOCK_FINAL"

if [ "$STOCK_INICIAL" == "$STOCK_FINAL" ]; then
  echo "✅ SUCESSO: O estoque foi revertido corretamente!"
else
  echo "❌ ERRO: O estoque final ($STOCK_FINAL) não coincide com o inicial ($STOCK_INICIAL)."
fi
