# PharmaERP - Sistema de Gestão Hospitalar e Farmacêutica

Este projeto é um sistema SaaS multi-tenant desenvolvido com **Bun**, **Node.js** e **Docker**, seguindo os princípios de **Clean Architecture** e **DDD**.

## 📚 Documentação Complementar

- [**Flutter na VM** (SDK, Android, pasta partilhada VirtualBox)](docs/flutter-vm-setup.md)
- [**API Central — tenants, branches, billing, pagamentos e webhooks**](backend/docs/api-central-billing.md)
- [**Testes runtime API v1**](backend/docs/teste-runtime-api-v1.md) (login dono + produtos validados em Docker)
- [Refatoração `tenant -> branch`, ajustes de Docker e validação fim-a-fim](backend/docs/refatoracao-tenant-branch.md)
- [Schema central — billing, pagamentos, webhooks e pré-produção](backend/docs/schema-central-billing.md)
- [Schema central — robustez, sync, migrations e produção](backend/docs/producao-schema-central.md)

## 🏗️ Estrutura do Projeto

O projeto é organizado em múltiplos serviços (microserviços) para garantir escalabilidade e separação de responsabilidades.

```text
.
├── backend/                # API Principal (Core SaaS & Tenant)
│   ├── src/
│   │   ├── main.ts         # Entrada HTTP (Bun.serve)
│   │   ├── routes/v1/     # Rotas activas (/api/v1/*)
│   │   ├── modules/
│   │   │   ├── central/    # Núcleo SaaS (Assinaturas, Tenants, etc.)
│   │   │   └── tenant/     # Funcionalidades da Farmácia (Estoque, Vendas, etc.)
│   │   ├── shared/         # Código compartilhado (Erros, Utils, Middlewares)
│   │   └── infrastructure/ # Implementações técnicas (Prisma, Cache, Queue)
│   └── Dockerfile.dev      # Ambiente Bun para desenvolvimento
│
├── backend-nf/             # Serviço de Notas Fiscais (NF)
│   ├── src/
│   │   └── modules/nf/     # Módulo específico de NF
│   └── Dockerfile.dev
│
├── docker/                 # Configurações de infraestrutura
│   ├── mysql/              # Scripts de inicialização do banco
│   └── nginx/              # Proxy Reverso (Roteamento de rotas)
│
├── docker-compose.yml      # Configuração completa de produção
└── docker-compose.dev.yml  # Ambiente completo de desenvolvimento
```

## 📐 Organização de um Módulo (Clean Architecture)

Cada módulo dentro de `src/modules/` segue rigorosamente esta estrutura:

- `domain/`: Entidades, interfaces de repositórios e objetos de valor (Regras de negócio puras).
- `application/`: Casos de uso (Use Cases) que orquestram a lógica da aplicação.
- `infrastructure/`: Implementações concretas (Prisma, Repositórios reais).
- `presentation/`: Controladores (Controllers).
- Rotas HTTP activas: `src/routes/v1/` (controllers + validação Zod em `shared/http/request-validation.ts`).
- `index.ts`: Ponto de entrada para exportações do módulo.

## 🔐 Autenticação e Multi-Tenancy

O sistema utiliza um fluxo de autenticação em dois níveis para garantir segurança e isolamento:

1. **Login Central**: Autentica o usuário globalmente e retorna a lista de tenants (farmácias/hospitais) aos quais ele tem acesso.
2. **Seleção de Branch**: Após o login, o cliente escolhe um `tenant` e uma `branch` reais para operar; as rotas tenant são abertas com `tenantId + branchId`.
3. **Isolamento Automático**: Utilizamos `AsyncLocalStorage` para gerenciar o contexto por branch em cada requisição. Os middlewares em `backend/src/shared/http/auth-middlewares.ts` resolvem a branch, validam a pertença ao tenant e injetam as credenciais corretas.
4. **Conexão Dinâmica**: A factory `backend/src/infrastructure/prisma/tenant-prisma.factory.ts` utiliza o `branchContext` para conectar ao banco de dados específico da branch em tempo real.
5. **Automação de Infraestrutura**: O registo de tenant cria a base MySQL `tenant_<nome_normalizado>`, cria a branch inicial `HQ` e aplica o schema tenant com Prisma (`db push`) via `backend/src/infrastructure/database/mysql-management.service.ts`.

### 🔐 Autenticação e Testes Rápidos

Para facilitar os testes das rotas protegidas do tenant, extraia do login central o `token`, o `tenantId` e o `branchId`. Detalhe dos testes validados em Docker: [backend/docs/teste-runtime-api-v1.md](backend/docs/teste-runtime-api-v1.md).

```bash
# Base da API v1 (todos os endpoints activos)
export BASE_URL="${BASE_URL:-http://localhost:3300/api/v1}"

# Opção A — Dono de tenant (testado: 8446 produtos, tenant 1 / branch HQ)
LOGIN_JSON=$(curl -s -X POST "${BASE_URL}/central/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email": "dono.1779294744@teste.com", "password": "123456"}')

# Opção B — Superadmin do seed (billing global; tenants[] vazio no JWT)
# LOGIN_JSON=$(curl -s -X POST "${BASE_URL}/central/auth/login" \
#   -H "Content-Type: application/json" \
#   -d '{"email": "admin@skalway.com", "password": "admin123"}')

# Extrair token, tenant e branch (envelope { success, data })
export TOKEN=$(echo "$LOGIN_JSON" | jq -r '.data.token // .token')
export TENANT_ID=$(echo "$LOGIN_JSON" | jq -r '.data.tenants[0].id // .tenants[0].id')
export BRANCH_ID=$(echo "$LOGIN_JSON" | jq -r '.data.tenants[0].branches[0].id // .tenants[0].branches[0].id')

# Rotas tenant
curl -s "${BASE_URL}/tenant/produtos" \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-tenant-id: $TENANT_ID" \
  -H "x-branch-id: $BRANCH_ID" | jq '{success, total: (.data | length)}'
```

**Script automatizado com o dono de teste:**

```bash
LOGIN_EMAIL="dono.1779294744@teste.com" LOGIN_PASSWORD="123456" \
  bash scripts/test-login-and-products.sh
```

### 📊 Fluxo de Venda e Compliance ANARME

O sistema implementa um rigoroso controle de dispensação de medicamentos, integrando validações automáticas baseadas nas diretrizes da ANARME (Moçambique).

#### 🧠 Regras Centrais de Negócio

1.  **Regra de Ouro do Estoque**: O `Produto.estoqueAtual` nunca deve ser alterado diretamente. Toda e qualquer alteração de estoque deve ser registada via `EstoqueMovimento`.
2.  **Transacionalidade**: Vendas, dispensações e recebimentos de compras são executados em transações atómicas para garantir que o estoque e o financeiro estejam sempre sincronizados.
3.  **FEFO (First Expire, First Out)**: O sistema prioriza automaticamente a saída de lotes com data de validade mais próxima.

#### 🔐 Regras de Dispensação
O campo `tipoDispensacao` no modelo `Produto` dita o comportamento do sistema no momento da venda:

| Tipo | Bloqueio / Requisito | Auditoria |
|------|----------------------|-----------|
| **NARCOTICO** | ❌ Bloqueio total sem Receita Especial. Exige dupla validação (Farmacêutico + Diretor Técnico). | Registo automático no Livro de Psicotrópicos. |
| **PSICOTROPICO** | ❌ Bloqueio sem Receita Controlada. | Registo automático no Livro de Psicotrópicos (LIII). |
| **RECEITA_CONTROLADA** | ❌ Exige validação de receita pelo farmacêutico. | Registo em histórico de dispensação. |
| **RECEITA_SIMPLES** | ⚠ Alerta de necessidade de receita. | Registo em histórico de dispensação. |
| **VENDA_LIVRE** | ✅ Sem restrições. | Registo normal de saída de estoque. |

#### 💊 Fluxo de Prescrição
- Uma `Prescription` (receita) criada pelo médico **não altera o estoque**.
- O estoque só é reduzido no momento da **Dispensação**, onde a receita é verificada e o movimento de saída é gerado.

#### 📦 Fluxo de Compra e Entrada
- Ao receber uma compra (`Compra`), o sistema gera automaticamente os novos `Lotes`, cria o `EstoqueMovimento` de entrada e atualiza o histórico de preços do produto.

## 🚀 Como Rodar o Projeto

### Pré-requisitos
- Docker e Docker Compose instalados.
- Utilizador no grupo `docker` (ou `sudo` para comandos Docker).
- [Bun](https://bun.sh/) instalado (opcional, para rodar comandos locais no host).

#### Permissões Docker (Linux)

Se aparecer `permission denied` em `/var/run/docker.sock`:

```bash
sudo usermod -aG docker $USER
# Terminar sessão e voltar a entrar (ou reiniciar a VM)
groups   # deve listar "docker"
```

Até renovar a sessão, pode usar `sudo docker ...`, `newgrp docker`, ou os scripts em `scripts/` (tentam `sg docker` automaticamente se necessário).

#### Pasta partilhada VirtualBox (`/media/sf_*`)

Se o projeto estiver numa pasta partilhada com o Windows/macOS, o Prisma `generate` pode falhar com `EFAULT: bad address` ao apagar ficheiros gerados. O `docker-compose.dev.yml` monta **volumes Docker** sobre `backend/.../prisma/*/generated` e o `backend/docker-entrypoint.dev.sh` gera os clients no arranque — **não é necessário** correr `prisma generate` na pasta partilhada do host.

### Ambiente de Desenvolvimento
O ambiente de desenvolvimento utiliza **Bun** com hot-reload (watch mode).

1. **Configurar Variáveis**:
   Copie o arquivo de exemplo e ajuste se necessário:
   ```bash
   cp .env.example .env
   ```
   Garanta especialmente que `ENCRYPTION_KEY` esteja definida no `.env`, porque ela é usada para cifrar as credenciais da base por branch.

2. **Subir os Containers**:
   ```bash
   docker compose -f docker-compose.dev.yml up -d --build
   ```

3. **(Opcional) Seed da base central** — planos e superadmin:
   ```bash
   docker exec skalway_pharm_backend bun prisma/seed.ts
   ```
   Credenciais do seed: `admin@skalway.com` / `admin123`.

### Serviços Disponíveis
- **API Principal**: `http://localhost:3300` (base v1: `http://localhost:3300/api/v1`, health: `/api/v1/health`)
- **NF Service**: `http://localhost:3400`
- **Nginx (Proxy)**: `http://localhost:8280` (Acesso unificado)
  - `/` -> Backend Principal
  - `/nf/` -> Backend NF
- **MySQL**: `localhost:3312`
- **Redis**: `localhost:6380`
- **phpMyAdmin**: `http://localhost:8686`

## 📜 Scripts e Comandos Essenciais

### Repositório — scripts úteis

| Script / comando | Descrição |
|------------------|-----------|
| `bash scripts/reset-central-and-tenants.sh` | **Reset total**. Apaga `tenant_*`, recria `skalway_central`, `db push`, reinicia backend/worker e corre `prisma/seed.ts`. |
| `bash scripts/test-tenant-creation.sh` | **Teste de tenant**. Cria tenant, valida MySQL, login e `GET /tenant/produtos`. Use `SKIP_SEEDS=1` para teste rápido. |
| `bash scripts/test-billing-lifecycle.sh` | **Teste billing E2E**. Tenant, trial, lifecycle, invoice, branch, pagamentos. Ver [api-central-billing.md](backend/docs/api-central-billing.md). |
| `bash scripts/test-login-and-products.sh` | **Teste de fluxo**. Login + produtos. `LOGIN_EMAIL` / `LOGIN_PASSWORD` (ex.: `dono.1779294744@teste.com` / `123456` — ver [teste-runtime-api-v1.md](backend/docs/teste-runtime-api-v1.md)). |
| `bash scripts/smoke-api-v1-validation.sh` | **Smoke validação**. Health + erros Zod em body/query/params (sem alterar dados). |
| `bash scripts/test-owner-api.sh` | **Teste dono**. Central + produtos + POS com `dono.1779294744@teste.com` (ver [teste-runtime-api-v1.md](backend/docs/teste-runtime-api-v1.md)). |
| `bash scripts/test-billing-tenant1.sh` | **Billing tenant 1**. Lifecycle pós-trial + fatura (superadmin). |
| `bash scripts/test-pos-owner.sh` | **POS E2E**. Sessão, venda, anulação com dono de teste. |
| `bash scripts/test-pos-draft-cart.sh` | **Carrinho rascunho**. GET/ADD/increment/decrement/delete com `idempotencyKey` por sessão. |
| `docker exec skalway_pharm_backend bun prisma/seed.ts` | **Seed Central**. Cria o Superadmin e os planos de assinatura na base central. |
| `docker exec skalway_pharm_backend bun prisma/seed-all-tenant.ts <nome-do-banco>` | **Seed Completo Tenant**. Executa todos os seeders em sequência para um tenant específico (regras fiscais, medicamentos, serviços, terminais, estoque). |
| `docker exec skalway_pharm_backend bun prisma/seed-medicamentos.ts` | **Seed Medicamentos**. Importa o catálogo da ANARME para o tenant. |
| `docker exec skalway_pharm_backend bun prisma/seed-servicos.ts` | **Seed Serviços**. Importa os serviços clínicos para o tenant. |
| `docker exec skalway_pharm_backend bun prisma/seed-terminais.ts` | **Seed Terminais**. Cria terminais, caixas e lote de teste para o tenant. |
| `docker exec skalway_pharm_backend bun prisma/seed-estoque.ts` | **Seed Estoque**. Adiciona estoque de teste para os primeiros 20 produtos. |
| `docker compose -f docker-compose.dev.yml restart backend backend_worker` | **Reiniciar API**. Aplica alterações em `.ts`; o entrypoint volta a correr `prisma generate` nos volumes Docker. |
| `docker compose -f docker-compose.dev.yml ps` | Estado dos containers. |
| `docker compose -f docker-compose.dev.yml logs -f backend` | Logs da API principal (`Ctrl+C` para sair). |
| `docker compose -f docker-compose.dev.yml up -d --build --force-recreate backend backend_worker` | **Rebuild** do backend e worker após alterar schemas, `package.json` ou `Dockerfile`. |
| `docker exec -i skalway_pharm_mysql mysql -uroot -proot_password tenant_NOME < scripts/seed-pos-stock-tenant1.sql` | **Stock PDV (dev)**. Exemplo em `scripts/seed-pos-stock-tenant1.sql` — ajuste o nome da base tenant. |

**Notas:**
- Scripts `scripts/*.sh` devem ser executados na **raiz do repositório**.
- Seeds e `docker exec` podem ser usados com o container `skalway_pharm_backend` a correr.
- Ficheiros do seed de medicamentos ficam em `backend/` (montado em `/usr/src/app` no Docker): `BD_Medicamentos.csv` (~8400 linhas) e `antimicrobianos.csv` (lista de substâncias). Não coloque cópias na raiz do repo — o container só vê `backend/`.
- O seed de medicamentos pode demorar **20–30 minutos** em pastas partilhadas VirtualBox.
- `bash scripts/reset-central-and-tenants.sh` apaga todas as bases `tenant_*`, recria a central e corre o seed central; use em seguida `test-tenant-creation.sh` e `seed-all-tenant.ts` para um tenant com dados.

#### Migração `Produto` → `ProdutoRegulacao` (expand → contract)

**Fonte de verdade:** `produto_regulacao` (+ auditoria em `produto_classificacao_eventos`).  
**Catálogo/preço/cache:** `produtos` (`nome`, `precoVenda`, `estoqueAtual` como cache, `taxRuleId`, …).  
**Stock operacional:** leituras via `StockBalance.quantidadeDisponivel`; `produtos.estoqueAtual` é reconciliado em vendas/devoluções/ajustes.  
**API:** resposta continua “flat” (`tipoDispensacao`, flags, …) via `flattenProdutoForApi()` a partir de `produto.regulacao`.

**Fase expand (tenant existente, antes do contract):**

```bash
docker compose -f docker-compose.dev.yml up -d --build --force-recreate backend backend_worker

# SQL opcional se ainda existir classificacaoAnarme em produtos antigos
docker exec -i skalway_pharm_mysql mysql -uroot -proot_password TENANT_DB \
  < backend/prisma/sql/produto_regulacao_expand.sql

docker exec -e DATABASE_URL_TENANT="mysql://root:root_password@mysql_central:3306/TENANT_DB" \
  skalway_pharm_backend bun prisma/backfill-produto-regulacao.ts
```

**Fase contract (após validar POS + listagens):**

```bash
# Schema: produtos sem colunas regulatórias; regulacao só em produto_regulacao
docker exec skalway_pharm_backend bunx prisma db push \
  --schema=src/infrastructure/prisma/tenant/schema.prisma --accept-data-loss

# Tenants criados antes do contract: remover colunas legadas se ainda existirem
docker exec -i skalway_pharm_mysql mysql -uroot -proot_password TENANT_DB \
  < backend/prisma/sql/produto_drop_legacy_columns.sql

docker compose -f docker-compose.dev.yml exec backend \
  bun test src/modules/tenant/products/domain/produto-dispensacao-policy.test.ts
```

Colunas removidas de `produtos`: `classificacaoRule`, `classificacaoReason`, `classificacaoMatchedTerm`, `antimicrobiano`, `tipoDispensacao`, `requires*`, `riskLevel`. Detalhes de classificação no seed ficam em `produto_classificacao_eventos` (não duplicados em `produto_regulacao`).

**Teste automatizado (recomendado):**

```bash
# Rápido (~1–2 min): cria tenant + login + produtos vazios
bash scripts/test-tenant-creation.sh SKIP_SEEDS=1

# Completo (+ seeds ANARME): omitir SKIP_SEEDS ou SKIP_SEEDS=0
bash scripts/test-tenant-creation.sh
```

### Criar tenant via `curl` (registo síncrono)

O nome da base tenant no MySQL é `tenant_<nomeTenant_normalizado>` (minúsculas, caracteres especiais viram `_`).

**Exemplo com timestamp único (evita conflitos de `nomeTenant` e email):**

```bash
TS=$(date +%s)

curl -s -i -X POST "${BASE_URL:-http://localhost:3300/api/v1}/central/tenants" \
  -H "Content-Type: application/json" \
  -d "{
    \"nomeEmpresa\": \"Farmacia Demo ${TS}\",
    \"nomeTenant\": \"farmacia_${TS}\",
    \"adminName\": \"Admin Tenant\",
    \"adminEmail\": \"admin.${TS}@demo.com\",
    \"adminPassword\": \"123456\",
    \"ownerUser\": {
      \"name\": \"Dono Central\",
      \"email\": \"dono.${TS}@demo.com\",
      \"password\": \"123456\",
      \"role\": \"admin\"
    }
  }"
```

Resposta esperada em sucesso: `201 Created` com JSON contendo `id`, `companyName`, `name` e `branch` (com `id`, `code` e `name`).

**Login após criar o tenant** (use o email do `ownerUser`, não o do admin do tenant):

```bash
curl -s -X POST "${BASE_URL:-http://localhost:3300/api/v1}/central/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\": \"dono.${TS}@demo.com\", \"password\": \"123456\"}"
```

#### 🧪 Popular dados no novo Tenant (Seed)

**Opção 1 (Recomendada) — Seed Completo:**
Após criar o tenant, use o script automatizado para executar todos os seeders em sequência:

```bash
# Substitua o nome da base pelo padrao derivado de nomeTenant:
# tenant_<nomeTenant_normalizado>
DB_NAME="tenant_farmacia_123456"

# Seed Completo (regras fiscais, medicamentos, serviços, terminais)
docker exec -e DATABASE_URL_TENANT="mysql://root:root_password@mysql_central:3306/${DB_NAME}" skalway_pharm_backend bun prisma/seed-all-tenant.ts "${DB_NAME}"
```

**Opção 2 — Seeders individuais:**
Se preferir rodar cada seeder separadamente:

```bash
# Substitua o nome da base pelo padrao derivado de nomeTenant:
# tenant_<nomeTenant_normalizado>
DB_NAME="tenant_farmacia_123456"
DB_URL="mysql://root:root_password@mysql_central:3306/${DB_NAME}"

# Seed de Regras Fiscais
docker exec -e DATABASE_URL_TENANT="${DB_URL}" skalway_pharm_backend bun prisma/seed-tax-rules.ts

# Seed de Medicamentos (Catálogo ANARME)
docker exec -e DATABASE_URL_TENANT="${DB_URL}" skalway_pharm_backend bun prisma/seed-medicamentos.ts

# Seed de Serviços Clínicos
docker exec -e DATABASE_URL_TENANT="${DB_URL}" skalway_pharm_backend bun prisma/seed-servicos.ts

# Seed de Terminais e Caixas
docker exec -e DATABASE_URL_TENANT="${DB_URL}" skalway_pharm_backend bun prisma/seed-terminais.ts

# Seed de Estoque de Teste
docker exec -e DATABASE_URL_TENANT="${DB_URL}" skalway_pharm_backend bun prisma/seed-estoque.ts
```

**Criação assíncrona (fila Redis):** acrescente `?async=true` ao URL; resposta típica `202 Accepted` com `jobId`. O worker (`skalway_pharm_backend_worker`) processa a fila — aguarde ~30–90 s e confira a base com `SHOW DATABASES LIKE 'tenant_%'`.

```bash
TS=$(date +%s)

curl -s -i -X POST "${BASE_URL:-http://localhost:3300/api/v1}/central/tenants?async=true" \
  -H "Content-Type: application/json" \
  -d "{
    \"nomeEmpresa\": \"Farmacia Async ${TS}\",
    \"nomeTenant\": \"farmacia_async_${TS}\",
    \"adminName\": \"Admin\",
    \"adminEmail\": \"admin.async.${TS}@demo.com\",
    \"adminPassword\": \"123456\",
    \"ownerUser\": {
      \"name\": \"Dono\",
      \"email\": \"dono.async.${TS}@demo.com\",
      \"password\": \"123456\",
      \"role\": \"admin\"
    }
  }"
```

### Verificar bases de dados tenant no MySQL

Com os containers a correr (MySQL exposto em `localhost:3312` conforme `.env`):

```bash
# Listar bases tenant_*
docker exec skalway_pharm_mysql mysql -uroot -proot_password -e "SHOW DATABASES LIKE 'tenant_%';"

# Tabelas de um tenant concreto (substitua o nome da base)
docker exec skalway_pharm_mysql mysql -uroot -proot_password -D tenant_farmacia_1234567890 -e "SHOW TABLES;"
```

Também pode usar o phpMyAdmin em `http://localhost:8686` (utilizador `admin` / password do `.env`); após criar tenant, o script de registo concede `GRANT` ao `admin` sobre a nova base.

**Listar tenants registados na central** (requer JWT — ver [api-central-billing.md](backend/docs/api-central-billing.md)):

```bash
BASE_URL="${BASE_URL:-http://localhost:3300/api/v1}"
TOKEN=$(curl -s -X POST "${BASE_URL}/central/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@skalway.com","password":"admin123"}' | jq -r '.data.token // .token')

curl -s "${BASE_URL}/central/tenants" \
  -H "Authorization: Bearer $TOKEN" | jq .
```

As respostas da central devolvem `branches`, mas não expõem `dbName` nem credenciais da base.

### 🌐 Endpoints da API

**Prefixo:** todas as rotas activas estão em `/api/v1`. Exemplos abaixo são relativos a esse prefixo (URL completa: `http://localhost:3300/api/v1/...`). Respostas JSON seguem o envelope `{ "success": true, "data": ... }` ou `{ "success": false, "error": { "code", "message", ... } }` — nos scripts `jq`, use `.data.token`, `.data.id`, etc.

Rotas centrais de **tenants, branches, subscrição, faturas, pagamentos e webhooks M-Pesa/e-Mola**: ver [backend/docs/api-central-billing.md](backend/docs/api-central-billing.md).

| Serviço | Método | Endpoint (sob `/api/v1`) |
|---------|--------|----------|
| Health Check | `GET` | `/health` |
| Login central | `POST` | `/central/auth/login` |
| Tenants (lista/detalhe/registo) | `GET` / `POST` | `/central/tenants`, `/central/tenants/:tenantId` |
| Branches | `GET` / `POST` | `/central/tenants/:tenantId/branches` |
| Subscrição / faturas / pagamentos | `GET` / `POST` | `/central/tenants/:tenantId/subscription`, `.../invoices`, `.../payments` |
| Webhooks | `POST` | `/central/webhooks/mpesa`, `/central/webhooks/emola` |
| Billing (admin) | `POST` | `/central/billing/process-lifecycle`, `/central/billing/generate-monthly` |
| Sync | `POST` | `/sync/push`, `/sync/pull` |
| **Produtos (Tenant)** | | |
| Listar / criar | `GET` / `POST` | `/tenant/produtos` ou `/tenant/products` |
| Item | `GET` / `PUT` / `DELETE` | `/tenant/produtos/:productId` |
| **Estoque (Tenant)** | | |
| Receber Compra (Entrada) | `POST` | `/tenant/stock/receive` |
| Ajustar Estoque (Inventário) | `POST` | `/tenant/stock/adjust` |
| **POS (Tenant)** | | |
| Pesquisa / checkout / sessões | vários | `/tenant/pos/...` (ver `routes/v1/pos.routes.ts`) |
| **Vendas (Tenant)** | | |

### 🐳 Docker (Infraestrutura)

Todos os comandos abaixo correm na **raiz do repositório** (`pharma_erp_backend/`), onde está o `docker-compose.dev.yml`.

#### Subir, parar e reiniciar

```bash
# Iniciar todo o ambiente (API + MySQL + Redis + Nginx + NF)
docker compose -f docker-compose.dev.yml up -d --build

# Subir só se os containers já existirem (sem rebuild)
docker compose -f docker-compose.dev.yml up -d

# Parar todos os serviços (mantém dados nos volumes)
docker compose -f docker-compose.dev.yml stop

# Reiniciar API principal + worker (após alterar código TypeScript no backend)
docker compose -f docker-compose.dev.yml restart backend backend_worker

# Rebuild forçado (após alterar schema Prisma, dependências ou Dockerfile)
docker compose -f docker-compose.dev.yml up -d --build --force-recreate backend backend_worker
```

#### Verificar se a API responde

```bash
# Estado dos containers
docker compose -f docker-compose.dev.yml ps

# Logs em tempo real da API (Ctrl+C para sair)
docker compose -f docker-compose.dev.yml logs -f backend

# Health / login (qualquer código HTTP ≠ 000 indica que a porta 3300 está activa)
curl -s -o /dev/null -w "HTTP %{http_code}\n" http://localhost:3300/api/v1/health
```

Base da API para o Flutter e scripts: `http://localhost:3300/api/v1`.

#### Quando usar cada comando

| Situação | Comando |
|----------|---------|
| Primeira vez ou máquina nova | `up -d --build` |
| Alterou ficheiros em `backend/src/` | `restart backend backend_worker` |
| Alterou `schema.prisma`, `package.json` ou Dockerfile | `up -d --build --force-recreate backend backend_worker` |
| API não responde / porta ocupada | `ps` + `logs -f backend` |
| Apagar **todos** os dados MySQL/Redis (cuidado) | `down -v` |

#### Outros

```bash
# Ver logs de todos os serviços
docker compose -f docker-compose.dev.yml logs -f

# Resetar volumes do banco (CUIDADO: apaga todos os dados)
docker compose -f docker-compose.dev.yml down -v
```

### 💎 Prisma (Banco de Dados)

Existem dois schemas: **central** (`skalway_central`) e **tenant** (uma base por tenant).

**Importante:** no ambiente típico com Docker, o host pode **não** ter `bun`/`bunx` disponível. Por isso, para `validate`, `generate`, `db push` e comandos Prisma afins, use **sempre o container do serviço `backend`** (imagem já com Bun e dependências). Na raiz do repositório:

```bash
# Validar schema central (executar ANTES de commit / após editar schema.prisma)
docker compose -f docker-compose.dev.yml run --rm --no-deps backend \
  bunx prisma validate --schema=src/infrastructure/prisma/central/schema.prisma

# Validar schema tenant
docker compose -f docker-compose.dev.yml run --rm --no-deps backend \
  bunx prisma validate --schema=src/infrastructure/prisma/tenant/schema.prisma
```

Alternativa com o container já a correr (shell interativo):

```bash
docker exec -it skalway_pharm_backend sh
# dentro do container, cwd = /usr/src/app
bunx prisma validate --schema=src/infrastructure/prisma/central/schema.prisma
exit
```

#### Banco central (SaaS)

No arranque em dev, o `backend`:
1. Gera clients Prisma no **entrypoint** (`docker-entrypoint.dev.sh`) para volumes Docker (evita erros em `vboxsf`).
2. Corre `prisma db push` na central com `--skip-generate` (ver `backend/package.json` → `prisma:deploy:central`).

```bash
# Sincronizar a central com o schema atual (sem generate na pasta montada)
docker compose -f docker-compose.dev.yml run --rm --no-deps backend \
  bunx prisma db push \
    --schema=src/infrastructure/prisma/central/schema.prisma \
    --accept-data-loss \
    --skip-generate

# Regerar clients após alterar schema (preferir restart do serviço)
docker compose -f docker-compose.dev.yml restart backend backend_worker

# Nova migration (dev) — requer TTY; use exec no container em dev
docker exec -it skalway_pharm_backend \
  bunx prisma migrate dev --schema=src/infrastructure/prisma/central/schema.prisma --name descricao_curta
```

Se tiver **Bun instalado no host** e estiver em `backend/`, pode usar os mesmos comandos com `bunx` localmente (equivalente ao container).

#### Schema tenant (modelo partilhado)

O ficheiro `src/infrastructure/prisma/tenant/schema.prisma` aplica-se a **cada** base `tenant_*` no registo (via `prisma db push --skip-generate` no código). Para regerar o client tenant após alterações ao schema, reinicie o backend (o entrypoint corre `generate` nos volumes `skalway_pharm_prisma_*_generated`).

Aplicar manualmente o schema a **uma** base tenant de teste (substitua `SENHA` e o nome da base; porta `3312` é a do host, dentro do Docker use `mysql_central:3306`):

```bash
docker compose -f docker-compose.dev.yml run --rm --no-deps backend \
  sh -c 'DATABASE_URL_TENANT="mysql://root:root_password@mysql_central:3306/tenant_farmacia_xxx" bunx prisma db push --skip-generate --schema=src/infrastructure/prisma/tenant/schema.prisma'
```

#### 🛠️ Comandos de Manutenção Úteis (POS & Tenant)

| Comando | Descrição |
|---------|-----------|
| `docker exec skalway_pharm_mysql mysql -uroot -proot_password -e "SHOW DATABASES LIKE 'tenant_%';"` | Listar todos os bancos de dados de tenants. |
| `docker compose -f docker-compose.dev.yml exec backend sh -c "DATABASE_URL_TENANT='mysql://root:root_password@mysql_central:3306/NOME_DO_BANCO' bunx prisma db push --schema=src/infrastructure/prisma/tenant/schema.prisma --accept-data-loss"` | Sincronizar o schema de um tenant específico (Migration manual). |
| `docker compose -f docker-compose.dev.yml exec backend bun tests/functional/sales-flow-test.ts` | Executar testes funcionais de fluxo de venda. |
| `docker compose -f docker-compose.dev.yml exec backend bun tests/stress/concurrency-test.ts` | Executar teste de estresse e concorrência no POS. |

### 💰 Billing SaaS (schema central)

O schema central inclui `BillingSnapshot`, `Invoice`, `Payment`, `WalletTransaction` e `PaymentWebhook`. Pagamentos nascem em `pendente` até confirmação manual (superadmin) ou webhook M-Pesa/e-Mola; faturas suportam estado `parcial` e `paidAmount`.

- **Schema e regras de dados:** [backend/docs/schema-central-billing.md](backend/docs/schema-central-billing.md)
- **API REST, auth, exemplos curl e scripts de teste:** [backend/docs/api-central-billing.md](backend/docs/api-central-billing.md)

### 💰 Modelo de Negócio (Franquias)

O SkalWay Pharm utiliza um modelo de licenciamento baseado em escala de infraestrutura:

| Plano | Branches | Preço |
| :--- | :--- | :--- |
| **Base** | 1 | 5.000 MZN |
| **+ Branch extra** | +1 | +2.000 MZN |
| **Enterprise** | ilimitado | sob consulta |

> **Nota**: Todas as funcionalidades do ERP estão disponíveis em todos os planos. O limite é aplicado apenas ao número de bases de dados (farmácias/branches) ativas.

**Estado Atual da Tabela `plans`:**

| ID | Nome | Slug | Preco Base | Preco Branch Extra |
| :--- | :--- | :--- | :--- | :--- |
| 1 | **Plano Base** | `base` | 5.000,00 MZN | 2.000,00 MZN |
| 2 | **Plano Base (Starter)** | `starter` | 5.000,00 MZN | 2.000,00 MZN |
| 3 | **Enterprise** | `enterprise` | 0,00 MZN | *sob consulta* |

**Acoes Realizadas:**
1. **Sementeira de Dados:** Executei o script `seed.ts` dentro do container para garantir que os valores exatos (`5.000` e `2.000`) fossem persistidos.
2. **Verificacao Direta:** Confirmei via CLI do MySQL que os registos na tabela `plans` da base `skalway_central` estao corretos.
3. **Consistencia:** O sistema agora utiliza estes valores tanto para a logica de validacao quanto para a apresentacao na API.

### 📊 Módulo Financeiro & Lucro Real

O sistema utiliza uma arquitetura de **Consolidação por Fecho de Caixa** para garantir relatórios de rentabilidade precisos.

#### 🧮 Fórmulas de Cálculo
- **Receita Bruta**: $\sum(\text{Faturas Pagas})$
- **CMV (Custo de Mercadoria Vendida)**: $\sum(\text{Quantidade Vendida} \times \text{Custo Unitário do Lote no ato da venda})$
- **Lucro Bruto**: $\text{Receita Bruta} - \text{CMV}$
- **Despesas Operacionais**: $\sum(\text{Sangrias de Caixa} + \text{Financial Movements (EXPENSE/PURCHASE)})$
- **Lucro Líquido**: $\text{Lucro Bruto} - \text{Despesas Operacionais}$
- **Margem Líquida**: $(\text{Lucro Líquido} / \text{Receita Bruta}) \times 100$

#### 🔄 Fluxo de Consolidação
1. **No POS**: Cada venda grava o `custoUnitario` histórico do lote.
2. **No Caixa**: Sangrias são categorizadas (Energia, Água, Salários, etc).
3. **No Fecho de Sessão**: O sistema dispara o `ConsolidarFinanceiroUseCase` que gera/atualiza a tabela `FinancialSummary` para o mês atual.

---

**Prisma em desenvolvimento Docker**

| Situação | Ação recomendada |
|----------|------------------|
| Alterou `schema.prisma` | `docker compose -f docker-compose.dev.yml restart backend backend_worker` |
| Erro `EFAULT` em pasta VirtualBox partilhada | Use os volumes do compose; não corra `generate` no host em `generated/` |
| Reset completo central + tenants | `bash scripts/reset-central-and-tenants.sh` |
| `generate` falha por rede ao baixar engines | Verifique rede no build; em último caso reinicie o container após `bun install` |

Os clients gerados dentro dos volumes **não** são sincronizados para a pasta partilhada do host — isso é intencional neste setup.

### 📦 Bun (Desenvolvimento Local)

Dentro da pasta `backend/` ou `backend-nf/`:

```bash
# Instalar dependências
bun install

# Iniciar em modo desenvolvimento (watch mode)
bun run dev

# Iniciar processador de filas (apenas backend)
bun run worker

# Iniciar em produção
bun run start
```

### 🌐 Nginx (Proxy Reverso)

O Nginx unifica os serviços na porta `8280`. Para recarregar configurações sem parar o container:

```bash
docker exec skalway_pharm_nginx nginx -s reload
```

## 🛠️ Tecnologias Utilizadas
- **Runtime**: Bun
- **Linguagem**: TypeScript
- **Banco de Dados**: MySQL 8.0
- **ORM**: Prisma
- **Cache/Queue**: Redis
- **Proxy**: Nginx
