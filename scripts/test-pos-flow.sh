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

# 1. Buscar Produto
echo "🔍 1. Buscando produto 'CLAVAMOX'..."
curl -s -X GET "$BASE_URL/tenant/pos/produtos/search?q=CLAVAMOX" \
  -H "Authorization: Bearer $TOKEN" | sed 's/,/\n/g'

# 2. Buscar Serviço
echo -e "\n🔍 2. Buscando serviço 'Consulta'..."
curl -s -X GET "$BASE_URL/tenant/pos/servicos/search?q=Consulta" \
  -H "Authorization: Bearer $TOKEN" | sed 's/,/\n/g'

# 3. Validar Dispensação (CLAVAMOX é RECEITA_SIMPLES)
echo -e "\n⚖️ 3. Validando dispensação do produto 10000..."
curl -s -X POST "$BASE_URL/tenant/pos/validar-dispensacao" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"produtoId": "10000", "quantidade": 1}' | sed 's/,/\n/g'

# 4. Finalizar Venda
echo -e "\n💰 4. Finalizando venda no POS..."
# Precisamos de IDs reais obtidos dos passos anteriores
CLIENTE_ID=$(curl -s -X GET "$BASE_URL/tenant/produtos" -H "Authorization: Bearer $TOKEN" | sed -n 's/.*"id":"\([^"]*\)".*/\1/p' | head -1) # Usando um ID qualquer para teste rápido
TERMINAL_ID="1"

FINALIZAR_DATA='{
  "clienteId": "1",
  "terminalId": "1",
  "metodoPagamento": "DINHEIRO",
  "items": [
    {
      "tipo": "produto",
      "produtoId": "10000",
      "quantidade": 2,
      "receita": { "numero": "RX-POS-001", "medicoNome": "Dr. Teste" }
    },
    {
      "tipo": "servico",
      "servicoId": "1",
      "quantidade": 1
    }
  ]
}'

curl -s -X POST "$BASE_URL/tenant/pos/finalizar" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "$FINALIZAR_DATA" | sed 's/,/\n/g'

echo -e "\n✅ Fluxo POS concluído."
