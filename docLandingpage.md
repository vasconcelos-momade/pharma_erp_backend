# 🚀 Guia de Conteúdo para Landing Page — SkalWay Pharm

Este documento reúne os principais diferenciais técnicos e de negócio do **SkalWay Pharm** para servir de base na criação da Landing Page oficial.

## 💡 Proposta de Valor
Uma plataforma SaaS multi-tenant robusta, desenhada especificamente para o mercado farmacêutico moçambicano, garantindo compliance total com as normas da **ANARME IP** e eficiência operacional máxima.

---

## 🛠 Diferenciais Técnicos (O "Core" do Sistema)

### 1. Transacionalidade Atómica 🔐
*   **O que é:** Todas as operações críticas (Vendas, Dispensação, Compras) utilizam `$transaction`.
*   **Benefício para o Cliente:** "Erro Zero" na base de dados. Se uma venda falha por qualquer motivo, o estoque não é baixado indevidamente. Integridade total entre o financeiro e o inventário.

### 2. Inteligência FEFO (First Expire, First Out) ⏳
*   **O que é:** O sistema prioriza automaticamente a saída dos produtos com a data de validade mais próxima.
*   **Benefício para o Cliente:** Redução drástica de perdas por produtos expirados. O sistema faz a gestão inteligente dos lotes sem que o operador precise de se preocupar.

### 3. Isolamento Total de Tenant (Multi-SaaS) 🏢
*   **O que é:** Cada farmácia possui o seu próprio contexto e banco de dados isolado.
*   **Benefício para o Cliente:** Segurança máxima dos dados. As informações de estoque, vendas e pacientes de uma farmácia nunca se misturam com as de outra, garantindo privacidade e performance.

---

## 💊 Funcionalidades de Compliance ANARME

### ✅ Validação Automática de Receitas
*   Bloqueio nativo de **Narcóticos** e **Psicotrópicos** sem a devida documentação.
*   Suporte a **Dupla Validação**: Exigência de aprovação pelo Diretor Técnico para medicamentos de controle rigoroso.

### ✅ Livro de Psicotrópicos Automatizado
*   Geração automática do mapa mensal para a ANARME.
*   Rastreabilidade total: quem dispensou, quem validou e qual foi o documento de origem.

### ✅ Livro de Receitas Digital (Auditoria Farmacêutica)
*   **O que é:** Registo oficial de todas as receitas atendidas, com rastreio clínico completo.
*   **Benefício:** Auditoria total de receitas médicas (quem prescreveu, quem validou e quem dispensou), garantindo segurança jurídica e clínica para a farmácia.
*   **Rastreabilidade:** Ligação direta entre a Receita, a Dispensação e a Fatura de venda.

### ✅ Compliance ANARME & Ledger Imutável
*   **Ledger Criptográfico:** Todos os logs de auditoria técnica e farmacêutica são encadeados criptograficamente (Blockchain-like), impossibilitando a alteração de histórico.
*   **Motor de Compliance:** Validação automática de regras sanitárias (ex: obrigatoriedade de receita para controlados, dupla validação para Psicotrópicos LIII).
*   **Gestão de Quarentena e Incineração:** Fluxo completo para medicamentos expirados ou em recall, com geração automática de Autos de Destruição oficiais.
*   **Relatórios Automáticos:** Geração de mapas mensais de psicotrópicos e narcóticos prontos para submissão à ANARME.

### ✅ Catálogo Oficial Integrado
*   Base de dados com mais de **8.000 medicamentos** pré-carregados conforme o formulário nacional.
*   Classificação automática por tipo de dispensa (Venda Livre, Receita Simples, Controlada).

---

## 🏥 Módulo de Atendimento Clínico (Triagem)
Não somos apenas um PDV. O SkalWay Pharm permite registar atos clínicos:
*   Medição de Pressão Arterial, Glicemia, Peso e Temperatura.
*   Consultas Farmacêuticas e Curativos.
*   Histórico clínico do paciente integrado à conta corrente.

---

## 📊 Gestão de Inventário e Fornecedores
*   **Gestão de Lotes:** Controle individual por lote e fabricante.
*   **Importadores:** Vínculo direto com as principais empresas distribuidoras de Moçambique.
*   **Preços Dinâmicos:** Histórico de variação de preços para análise de margem de lucro.

---

## 📊 Módulo Financeiro & Lucro Real
O sistema agora conta com uma arquitetura de **Consolidação por Fecho de Caixa**, garantindo que a farmácia tenha uma visão clara da sua rentabilidade.

### 🧮 Fórmulas de Cálculo Implementadas
*   **Receita Bruta:** Soma de todas as faturas pagas/emitidas no período.
*   **CMV (Custo de Mercadoria Vendida):** Calculado no momento exato da venda, multiplicando a quantidade vendida pelo custo unitário do lote específico utilizado (FEFO).
*   **Lucro Bruto:** Receita Bruta - CMV.
*   **Despesas Operacionais:** Consolidação de todas as Sangrias de Caixa (categorizadas como Energia, Água, Salários, etc.) e movimentos financeiros de saída (EXPENSE / PURCHASE).
*   **Lucro Líquido:** Lucro Bruto - Despesas Operacionais.
*   **Margem Líquida:** Percentual do lucro real em relação à receita total.

### 🔄 Fluxo de Consolidação Automática
1.  **POS:** Grava o custo histórico em cada item da fatura.
2.  **Caixa:** Permite registar saídas categorizadas.
3.  **Fecho de Sessão:** Ao fechar o caixa, o sistema dispara automaticamente o `ConsolidarFinanceiroUseCase`, que atualiza a tabela `FinancialSummary` para gerar dashboards instantâneos.

---

## 🚀 Notas de Infraestrutura
*   **Resolução de Travamento Prisma (Docker):** Nota técnica sobre como injetar o binário da engine (`query-engine-debian-openssl-3.0.x`) manualmente em `backend/src/infrastructure/prisma/tenant/generated/tenant/` caso existam problemas de rede ou SSL durante o `prisma generate`.

---

## 🚀 Call to Action (Sugestões)
*   "Leve a sua farmácia para o próximo nível de compliance."
*   "Gestão inteligente de estoque com padrão internacional."
*   "Experimente a tranquilidade de estar 100% alinhado com a ANARME."

---
**SkalWay Pharm** — *Tecnologia que cuida da sua farmácia, para você cuidar da saúde.*
