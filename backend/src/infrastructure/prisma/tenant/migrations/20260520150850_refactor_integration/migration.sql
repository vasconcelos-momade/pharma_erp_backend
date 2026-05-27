-- CreateTable
CREATE TABLE `users` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NULL,
    `role` ENUM('ADMIN', 'GERENTE', 'CAIXA', 'FARMACEUTICO', 'DIRETOR_TECNICO') NOT NULL DEFAULT 'GERENTE',
    `active` BOOLEAN NOT NULL DEFAULT true,
    `centralUserId` BIGINT UNSIGNED NULL,
    `version` INTEGER NOT NULL DEFAULT 0,
    `deletedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `users_email_key`(`email`),
    INDEX `users_centralUserId_idx`(`centralUserId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `terminais` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `codigo` VARCHAR(191) NOT NULL,
    `nome` VARCHAR(191) NOT NULL,
    `localizacao` VARCHAR(191) NULL,
    `ativo` BOOLEAN NOT NULL DEFAULT true,
    `deletedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `terminais_codigo_key`(`codigo`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `caixas` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `terminalId` BIGINT UNSIGNED NOT NULL,
    `saldoAtual` DECIMAL(10, 2) NOT NULL DEFAULT 0,
    `version` INTEGER NOT NULL DEFAULT 0,
    `deletedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `caixas_terminalId_key`(`terminalId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `caixa_movimentos` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `caixaId` BIGINT UNSIGNED NOT NULL,
    `userId` BIGINT UNSIGNED NOT NULL,
    `faturaId` BIGINT UNSIGNED NULL,
    `tipo` ENUM('ENTRADA', 'SAIDA', 'SUPRIMENTO', 'SANGRIA', 'ESTORNO') NOT NULL,
    `origem` ENUM('PEDIDO', 'COMPRA', 'AJUSTE', 'PAGAMENTO', 'SANGRIA', 'REFORCO', 'OUTRO') NULL,
    `categoria` ENUM('ENERGIA', 'AGUA', 'INTERNET', 'SALARIO', 'TRANSPORTE', 'MANUTENCAO', 'LIMPEZA', 'IMPOSTO', 'RENDA', 'COMPRA_STOCK', 'OUTRO') NULL,
    `valor` DECIMAL(10, 2) NOT NULL,
    `saldoAnterior` DECIMAL(10, 2) NOT NULL,
    `saldoFinal` DECIMAL(10, 2) NOT NULL,
    `idempotencyKey` VARCHAR(191) NULL,
    `descricao` TEXT NULL,
    `deletedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `caixa_movimentos_idempotencyKey_key`(`idempotencyKey`),
    INDEX `caixa_movimentos_caixaId_createdAt_idx`(`caixaId`, `createdAt`),
    INDEX `caixa_movimentos_tipo_createdAt_idx`(`tipo`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `clientes` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `nome` VARCHAR(191) NOT NULL,
    `telefone` VARCHAR(191) NULL,
    `email` VARCHAR(191) NULL,
    `tipo` ENUM('PACIENTE', 'EMPRESA', 'CONVENIO') NOT NULL,
    `documento` VARCHAR(191) NULL,
    `dataNascimento` DATETIME(3) NULL,
    `sexo` VARCHAR(191) NULL,
    `nuit` VARCHAR(191) NULL,
    `empresaId` BIGINT UNSIGNED NULL,
    `limiteCredito` DECIMAL(14, 2) NULL,
    `saldoAtual` DECIMAL(14, 2) NOT NULL DEFAULT 0,
    `temPrescricao` BOOLEAN NOT NULL DEFAULT false,
    `version` INTEGER NOT NULL DEFAULT 0,
    `deletedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `clientes_empresaId_idx`(`empresaId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `empresas` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `nome` VARCHAR(191) NOT NULL,
    `nuit` VARCHAR(50) NULL,
    `limiteCredito` DECIMAL(10, 2) NULL,
    `saldoUsado` DECIMAL(10, 2) NOT NULL DEFAULT 0,
    `ativo` BOOLEAN NOT NULL DEFAULT true,
    `statusContrato` ENUM('ATIVO', 'SUSPENSO', 'CANCELADO', 'AGUARDANDO_RENOVACAO') NOT NULL DEFAULT 'ATIVO',
    `deletedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `empresas_nome_key`(`nome`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `convenio_contratos` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `empresaId` BIGINT UNSIGNED NOT NULL,
    `limite` DECIMAL(10, 2) NULL,
    `desconto` DECIMAL(5, 2) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `produtos` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `nome` VARCHAR(191) NOT NULL,
    `substanciaActiva` TEXT NULL,
    `dosagem` TEXT NULL,
    `forma` TEXT NULL,
    `apresentacao` TEXT NULL,
    `ativo` BOOLEAN NOT NULL DEFAULT true,
    `barcode` VARCHAR(100) NULL,
    `classificacaoAnarme` ENUM('NORMAL', 'NARCOTICO', 'PSICOTROPICO_LIII', 'PSICOTROPICO_LIV', 'CONTROLADO_ESPECIAL') NOT NULL DEFAULT 'NORMAL',
    `tipoDispensacao` ENUM('VENDA_LIVRE', 'RECEITA_SIMPLES', 'RECEITA_CONTROLADA', 'RECEITA_OBRIGATORIA', 'RECEITA_RETIDA', 'PSICOTROPICO', 'NARCOTICO') NOT NULL DEFAULT 'VENDA_LIVRE',
    `requiresPrescription` BOOLEAN NOT NULL DEFAULT false,
    `requiresDoubleCheck` BOOLEAN NOT NULL DEFAULT false,
    `requiresPsychotropicBook` BOOLEAN NOT NULL DEFAULT false,
    `precoVenda` DECIMAL(14, 2) NOT NULL,
    `estoqueAtual` DECIMAL(14, 2) NOT NULL DEFAULT 0,
    `estoqueMinimo` DECIMAL(14, 2) NOT NULL DEFAULT 0,
    `taxRuleId` BIGINT UNSIGNED NULL,
    `version` INTEGER NOT NULL DEFAULT 0,
    `deletedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `produtos_barcode_key`(`barcode`),
    INDEX `produtos_ativo_idx`(`ativo`),
    INDEX `produtos_taxRuleId_idx`(`taxRuleId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `servicos` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `nome` VARCHAR(255) NOT NULL,
    `tipoServicoClinico` ENUM('PESO', 'PRESSAO_ARTERIAL', 'TEMPERATURA', 'GLICEMIA', 'CONSULTA', 'INJECAO', 'CURATIVO', 'OUTRO') NOT NULL,
    `preco` DECIMAL(14, 2) NOT NULL,
    `ativo` BOOLEAN NOT NULL DEFAULT true,
    `taxRuleId` BIGINT UNSIGNED NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `servicos_nome_key`(`nome`),
    INDEX `servicos_ativo_idx`(`ativo`),
    INDEX `servicos_taxRuleId_idx`(`taxRuleId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `fornecedores` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `nome` VARCHAR(255) NOT NULL,
    `tipo` ENUM('DISTRIBUIDOR', 'IMPORTADOR', 'FABRICANTE', 'GROSSISTA', 'LOCAL') NULL,
    `nuit` VARCHAR(50) NULL,
    `email` VARCHAR(255) NULL,
    `telefone` VARCHAR(50) NULL,
    `telefoneAlt` VARCHAR(50) NULL,
    `endereco` TEXT NULL,
    `cidade` VARCHAR(100) NULL,
    `provincia` VARCHAR(100) NULL,
    `pais` VARCHAR(100) NULL DEFAULT 'Mocambique',
    `contatoNome` VARCHAR(255) NULL,
    `observacoes` TEXT NULL,
    `ativo` BOOLEAN NOT NULL DEFAULT true,
    `deletedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `fornecedores_nome_key`(`nome`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `produtos_fornecedores` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `produtoId` BIGINT UNSIGNED NOT NULL,
    `fornecedorId` BIGINT UNSIGNED NOT NULL,
    `precoCompra` DECIMAL(10, 2) NOT NULL,
    `fornecedorPrincipal` BOOLEAN NOT NULL DEFAULT false,
    `prazoEntregaDias` INTEGER NULL,
    `codigoFornecedor` VARCHAR(191) NULL,

    UNIQUE INDEX `produtos_fornecedores_produtoId_fornecedorId_key`(`produtoId`, `fornecedorId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `compras` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `fornecedorId` BIGINT UNSIGNED NOT NULL,
    `data` DATETIME(3) NOT NULL,
    `total` DECIMAL(14, 2) NOT NULL,
    `status` ENUM('PENDENTE', 'RECEBIDA', 'CANCELADA') NOT NULL,
    `version` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `compras_fornecedorId_idx`(`fornecedorId`),
    INDEX `compras_status_idx`(`status`),
    INDEX `compras_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `compras_itens` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `compraId` BIGINT UNSIGNED NOT NULL,
    `produtoId` BIGINT UNSIGNED NOT NULL,
    `quantidade` DECIMAL(10, 2) NOT NULL,
    `preco` DECIMAL(10, 2) NOT NULL,
    `total` DECIMAL(10, 2) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `lotes` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `produtoId` BIGINT UNSIGNED NOT NULL,
    `fornecedorId` BIGINT UNSIGNED NULL,
    `numeroLote` VARCHAR(100) NOT NULL,
    `dataValidade` DATETIME(3) NOT NULL,
    `dataFabricacao` DATETIME(3) NULL,
    `quantidadeInicial` DECIMAL(10, 2) NOT NULL,
    `quantidadeAtual` DECIMAL(10, 2) NOT NULL,
    `quantidadeQuarentena` DECIMAL(10, 2) NOT NULL DEFAULT 0,
    `quantidadeIncinerada` DECIMAL(10, 2) NOT NULL DEFAULT 0,
    `precoCompra` DECIMAL(10, 2) NOT NULL,
    `precoVenda` DECIMAL(10, 2) NULL,
    `ativo` BOOLEAN NOT NULL DEFAULT true,
    `estadoSanitario` ENUM('VALIDO', 'EXPIRADO', 'RECALL') NOT NULL DEFAULT 'VALIDO',
    `disponibilidade` ENUM('DISPONIVEL', 'BLOQUEADO', 'INDISPONIVEL') NOT NULL DEFAULT 'DISPONIVEL',
    `version` INTEGER NOT NULL DEFAULT 0,
    `deletedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `lotes_produtoId_idx`(`produtoId`),
    INDEX `lotes_numeroLote_idx`(`numeroLote`),
    INDEX `lotes_produtoId_ativo_estadoSanitario_disponibilidade_dataVa_idx`(`produtoId`, `ativo`, `estadoSanitario`, `disponibilidade`, `dataValidade`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `lote_movimentos_sanitarios` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `loteId` BIGINT UNSIGNED NOT NULL,
    `tipo` ENUM('QUARENTENA', 'LIBERACAO', 'INCINERACAO', 'RECALL', 'DEVOLUCAO_FORNECEDOR') NOT NULL,
    `quantidade` DECIMAL(10, 2) NOT NULL,
    `motivo` TEXT NOT NULL,
    `responsavelId` BIGINT UNSIGNED NOT NULL,
    `documentoReferencia` VARCHAR(100) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `incineracoes` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `numeroAuto` VARCHAR(100) NOT NULL,
    `dataIncineracao` DATETIME(3) NOT NULL,
    `responsavelId` BIGINT UNSIGNED NOT NULL,
    `aprovadoPorId` BIGINT UNSIGNED NULL,
    `entidadeDestino` VARCHAR(255) NULL,
    `observacoes` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `incineracoes_numeroAuto_key`(`numeroAuto`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `incineracao_itens` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `incineracaoId` BIGINT UNSIGNED NOT NULL,
    `loteId` BIGINT UNSIGNED NOT NULL,
    `quantidade` DECIMAL(10, 2) NOT NULL,
    `motivo` TEXT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `estoque_movimentos` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `produtoId` BIGINT UNSIGNED NOT NULL,
    `loteId` BIGINT UNSIGNED NULL,
    `userId` BIGINT UNSIGNED NOT NULL,
    `tipo` ENUM('ENTRADA', 'SAIDA', 'AJUSTE', 'DEVOLUCAO', 'QUARENTENA', 'INCINERACAO') NOT NULL,
    `quantidade` DECIMAL(14, 2) NOT NULL,
    `estoqueAnterior` DECIMAL(14, 2) NOT NULL,
    `estoqueFinal` DECIMAL(14, 2) NOT NULL,
    `origem` VARCHAR(191) NULL,
    `idempotencyKey` VARCHAR(191) NULL,
    `observacoes` TEXT NULL,
    `deletedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `estoque_movimentos_idempotencyKey_key`(`idempotencyKey`),
    INDEX `estoque_movimentos_produtoId_createdAt_idx`(`produtoId`, `createdAt`),
    INDEX `estoque_movimentos_loteId_createdAt_idx`(`loteId`, `createdAt`),
    INDEX `estoque_movimentos_tipo_idx`(`tipo`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `historico_precos` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `produtoId` BIGINT UNSIGNED NOT NULL,
    `fornecedorId` BIGINT UNSIGNED NULL,
    `precoAnterior` DECIMAL(10, 2) NOT NULL,
    `precoNovo` DECIMAL(10, 2) NOT NULL,
    `variacao` DECIMAL(10, 2) NULL,
    `data` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `historico_precos_produtoId_idx`(`produtoId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `alertas_estoque` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `produtoId` BIGINT UNSIGNED NOT NULL,
    `tipo` ENUM('ESTOQUE_BAIXO', 'PRODUTO_ESGOTADO', 'LOTE_EXPIRADO', 'LOTE_A_EXPIRAR', 'PRECO_SUBIU', 'SEM_FORNECEDOR') NOT NULL,
    `mensagem` VARCHAR(191) NOT NULL,
    `resolvido` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `faturas` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `numero` VARCHAR(191) NOT NULL,
    `serie` VARCHAR(191) NOT NULL,
    `tipo` ENUM('FT', 'FR', 'NC', 'ND') NOT NULL DEFAULT 'FT',
    `clienteId` BIGINT UNSIGNED NOT NULL,
    `terminalId` BIGINT UNSIGNED NULL,
    `userId` BIGINT UNSIGNED NOT NULL,
    `idempotencyKey` VARCHAR(191) NULL,
    `subtotal` DECIMAL(14, 2) NOT NULL,
    `desconto` DECIMAL(14, 2) NOT NULL DEFAULT 0,
    `ivaTotal` DECIMAL(14, 2) NOT NULL,
    `total` DECIMAL(14, 2) NOT NULL,
    `tipoOperacao` ENUM('TRIBUTADA', 'ISENTA', 'NAO_SUJEITA') NOT NULL DEFAULT 'TRIBUTADA',
    `tipoPagamento` ENUM('DINHEIRO', 'CARTAO', 'CREDITO_CONVENIO', 'FIADO', 'EMOLA', 'MPESA') NOT NULL DEFAULT 'DINHEIRO',
    `moeda` VARCHAR(191) NOT NULL DEFAULT 'MZN',
    `estado` ENUM('RASCUNHO', 'EMITIDA', 'PAGA', 'PARCIAL', 'ANULADA') NOT NULL DEFAULT 'EMITIDA',
    `qrCode` VARCHAR(191) NULL,
    `deletedAt` DATETIME(3) NULL,
    `version` INTEGER NOT NULL DEFAULT 0,
    `authorizedById` BIGINT UNSIGNED NULL,
    `cancelledAt` DATETIME(3) NULL,
    `cancelledById` BIGINT UNSIGNED NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `faturas_numero_key`(`numero`),
    UNIQUE INDEX `faturas_idempotencyKey_key`(`idempotencyKey`),
    INDEX `faturas_clienteId_estado_idx`(`clienteId`, `estado`),
    INDEX `faturas_tipoPagamento_idx`(`tipoPagamento`),
    INDEX `faturas_createdAt_idx`(`createdAt`),
    INDEX `faturas_estado_idx`(`estado`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `fatura_itens` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `faturaId` BIGINT UNSIGNED NOT NULL,
    `produtoId` BIGINT UNSIGNED NULL,
    `servicoId` BIGINT UNSIGNED NULL,
    `loteId` BIGINT UNSIGNED NULL,
    `descricao` VARCHAR(191) NOT NULL,
    `quantidade` DECIMAL(14, 2) NOT NULL,
    `precoUnit` DECIMAL(14, 2) NOT NULL,
    `custoUnitario` DECIMAL(14, 2) NOT NULL DEFAULT 0,
    `lucroUnitario` DECIMAL(14, 2) NULL,
    `baseCalculo` DECIMAL(14, 2) NOT NULL DEFAULT 0,
    `iva` DECIMAL(5, 2) NOT NULL,
    `valorIva` DECIMAL(14, 2) NOT NULL DEFAULT 0,
    `taxaAplicada` DECIMAL(5, 2) NOT NULL DEFAULT 0,
    `tipoRegraFiscalSnapshot` ENUM('IVA_NORMAL', 'IVA_REDUZIDO', 'IVA_ISENTO', 'NAO_TRIBUTAVEL') NULL,
    `codigoRegraFiscal` VARCHAR(50) NULL,
    `moedaTaxa` VARCHAR(10) NOT NULL DEFAULT 'MZN',
    `motivoIsencao` TEXT NULL,
    `total` DECIMAL(14, 2) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `contas_receber` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `clienteId` BIGINT UNSIGNED NOT NULL,
    `faturaId` BIGINT UNSIGNED NULL,
    `userId` BIGINT UNSIGNED NOT NULL,
    `authorizedById` BIGINT UNSIGNED NULL,
    `valor` DECIMAL(14, 2) NOT NULL,
    `saldo` DECIMAL(14, 2) NOT NULL,
    `status` ENUM('ABERTA', 'PAGA', 'PARCIAL', 'CANCELADA') NOT NULL DEFAULT 'ABERTA',
    `vencimento` DATETIME(3) NULL,
    `version` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `contas_receber_clienteId_idx`(`clienteId`),
    INDEX `contas_receber_status_idx`(`status`),
    INDEX `contas_receber_vencimento_idx`(`vencimento`),
    INDEX `contas_receber_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `conta_receber_pagamentos` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `contaReceberId` BIGINT UNSIGNED NOT NULL,
    `userId` BIGINT UNSIGNED NOT NULL,
    `caixaId` BIGINT UNSIGNED NULL,
    `valor` DECIMAL(10, 2) NOT NULL,
    `metodo` ENUM('DINHEIRO', 'CARTAO', 'TRANSFERENCIA', 'CARTEIRA_MOVEL', 'EMOLA', 'MPESA') NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `contas_pagar` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `fornecedorId` BIGINT UNSIGNED NOT NULL,
    `compraId` BIGINT UNSIGNED NULL,
    `userId` BIGINT UNSIGNED NOT NULL,
    `valor` DECIMAL(14, 2) NOT NULL,
    `saldo` DECIMAL(14, 2) NOT NULL,
    `status` ENUM('ABERTA', 'PAGA', 'PARCIAL', 'CANCELADA') NOT NULL DEFAULT 'ABERTA',
    `vencimento` DATETIME(3) NULL,
    `version` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `contas_pagar_fornecedorId_idx`(`fornecedorId`),
    INDEX `contas_pagar_status_idx`(`status`),
    INDEX `contas_pagar_vencimento_idx`(`vencimento`),
    INDEX `contas_pagar_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `estoque_reservas` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `produtoId` BIGINT UNSIGNED NOT NULL,
    `loteId` BIGINT UNSIGNED NULL,
    `faturaId` BIGINT UNSIGNED NULL,
    `quantidade` DECIMAL(10, 2) NOT NULL,
    `expiresAt` DATETIME(3) NOT NULL,
    `idempotencyKey` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `estoque_reservas_idempotencyKey_key`(`idempotencyKey`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `financial_movements` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `userId` BIGINT UNSIGNED NOT NULL,
    `caixaId` BIGINT UNSIGNED NULL,
    `faturaId` BIGINT UNSIGNED NULL,
    `contaReceberId` BIGINT UNSIGNED NULL,
    `contaPagarId` BIGINT UNSIGNED NULL,
    `type` ENUM('SALE', 'REFUND', 'EXPENSE', 'PURCHASE', 'ADJUSTMENT', 'DEBT_PAYMENT') NOT NULL,
    `amount` DECIMAL(14, 2) NOT NULL,
    `reference` TEXT NULL,
    `idempotencyKey` VARCHAR(191) NULL,
    `deletedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `financial_movements_idempotencyKey_key`(`idempotencyKey`),
    INDEX `financial_movements_caixaId_createdAt_idx`(`caixaId`, `createdAt`),
    INDEX `financial_movements_type_createdAt_idx`(`type`, `createdAt`),
    INDEX `financial_movements_faturaId_idx`(`faturaId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `pagamentos` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `faturaId` BIGINT UNSIGNED NOT NULL,
    `caixaId` BIGINT UNSIGNED NULL,
    `metodo` ENUM('DINHEIRO', 'CARTAO', 'TRANSFERENCIA', 'CARTEIRA_MOVEL', 'EMOLA', 'MPESA') NOT NULL,
    `valor` DECIMAL(14, 2) NOT NULL,
    `status` ENUM('PENDENTE', 'CONFIRMADO', 'ESTORNADO') NOT NULL DEFAULT 'CONFIRMADO',
    `referencia` VARCHAR(191) NULL,
    `deletedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `version` INTEGER NOT NULL DEFAULT 0,

    INDEX `pagamentos_faturaId_idx`(`faturaId`),
    INDEX `pagamentos_caixaId_idx`(`caixaId`),
    INDEX `pagamentos_status_idx`(`status`),
    INDEX `pagamentos_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `livro_psicotropicos` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `produtoId` BIGINT UNSIGNED NOT NULL,
    `loteId` BIGINT UNSIGNED NULL,
    `dispensacaoId` BIGINT UNSIGNED NULL,
    `tipoMovimento` ENUM('ENTRADA', 'SAIDA', 'IMPORTACAO') NOT NULL,
    `quantidade` DECIMAL(10, 2) NOT NULL,
    `saldoAnterior` DECIMAL(10, 2) NOT NULL,
    `saldoAtual` DECIMAL(10, 2) NOT NULL,
    `numeroDocumento` VARCHAR(191) NULL,
    `idempotencyKey` VARCHAR(191) NULL,
    `observacoes` VARCHAR(191) NULL,
    `responsavelId` BIGINT UNSIGNED NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `livro_psicotropicos_dispensacaoId_key`(`dispensacaoId`),
    UNIQUE INDEX `livro_psicotropicos_idempotencyKey_key`(`idempotencyKey`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `role_permissions` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `role` ENUM('ADMIN', 'GERENTE', 'CAIXA', 'FARMACEUTICO', 'DIRETOR_TECNICO') NOT NULL,
    `module` ENUM('PRODUTOS', 'FATURAS', 'CAIXA', 'ESTOQUE', 'PSICOTROPICOS', 'FORNECEDORES', 'COMPRAS', 'CLIENTES', 'CONFIGURACOES', 'AUDITORIA') NOT NULL,
    `action` ENUM('VIEW', 'CREATE', 'EDIT', 'DELETE', 'APPROVE') NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `role_permissions_role_module_action_key`(`role`, `module`, `action`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `stock_balances` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `produtoId` BIGINT UNSIGNED NOT NULL,
    `quantidadeTotal` DECIMAL(10, 2) NOT NULL DEFAULT 0,
    `quantidadeReservada` DECIMAL(10, 2) NOT NULL DEFAULT 0,
    `quantidadeDisponivel` DECIMAL(10, 2) NOT NULL DEFAULT 0,
    `version` INTEGER NOT NULL DEFAULT 0,
    `lastUpdated` DATETIME(3) NOT NULL,

    UNIQUE INDEX `stock_balances_produtoId_key`(`produtoId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `cash_balances` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `caixaId` BIGINT UNSIGNED NOT NULL,
    `saldoDinheiro` DECIMAL(10, 2) NOT NULL DEFAULT 0,
    `saldoDigital` DECIMAL(10, 2) NOT NULL DEFAULT 0,
    `saldoTotal` DECIMAL(10, 2) NOT NULL DEFAULT 0,
    `lastUpdated` DATETIME(3) NOT NULL,

    UNIQUE INDEX `cash_balances_caixaId_key`(`caixaId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `audit_logs` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `userId` BIGINT UNSIGNED NOT NULL,
    `action` VARCHAR(191) NOT NULL,
    `entity` VARCHAR(191) NOT NULL,
    `entityId` BIGINT UNSIGNED NULL,
    `before` JSON NULL,
    `after` JSON NULL,
    `ip` VARCHAR(45) NULL,
    `userAgent` TEXT NULL,
    `hashAnterior` VARCHAR(64) NULL,
    `hashAtual` VARCHAR(64) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `audit_logs_entity_entityId_idx`(`entity`, `entityId`),
    INDEX `audit_logs_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `sanitario_reports` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `tipo` ENUM('MAPA_MENSAL_PSICOTROPICOS', 'MAPA_MENSAL_NARCOTICOS', 'RELATORIO_EXPIRADOS', 'RELATORIO_QUARENTENA', 'RELATORIO_INCINERACAO', 'BALANCO_ESTOQUE_ANUAL') NOT NULL,
    `periodo` VARCHAR(50) NOT NULL,
    `arquivoUrl` TEXT NULL,
    `payload` JSON NULL,
    `geradoPorId` BIGINT UNSIGNED NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `digital_signatures` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `userId` BIGINT UNSIGNED NOT NULL,
    `entity` VARCHAR(100) NOT NULL,
    `entityId` BIGINT UNSIGNED NOT NULL,
    `assinaturaHash` VARCHAR(255) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `report_snapshots` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `tipo` VARCHAR(100) NOT NULL,
    `referencia` VARCHAR(100) NOT NULL,
    `payload` JSON NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `user_permissions` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `userId` BIGINT UNSIGNED NOT NULL,
    `module` ENUM('PRODUTOS', 'FATURAS', 'CAIXA', 'ESTOQUE', 'PSICOTROPICOS', 'FORNECEDORES', 'COMPRAS', 'CLIENTES', 'CONFIGURACOES', 'AUDITORIA') NOT NULL,
    `action` ENUM('VIEW', 'CREATE', 'EDIT', 'DELETE', 'APPROVE') NOT NULL,
    `allowed` BOOLEAN NOT NULL DEFAULT true,

    UNIQUE INDEX `user_permissions_userId_module_action_key`(`userId`, `module`, `action`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `config` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `key` VARCHAR(191) NOT NULL,
    `value` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `updatedAt` DATETIME(3) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `config_key_key`(`key`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `stock_valuation` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `produtoId` BIGINT UNSIGNED NOT NULL,
    `custoMedio` DECIMAL(10, 2) NOT NULL,
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `stock_valuation_produtoId_key`(`produtoId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `dispensacoes` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `produtoId` BIGINT UNSIGNED NOT NULL,
    `loteId` BIGINT UNSIGNED NOT NULL,
    `userId` BIGINT UNSIGNED NOT NULL,
    `validadoPorId` BIGINT UNSIGNED NULL,
    `faturaItemId` BIGINT UNSIGNED NULL,
    `faturaId` BIGINT UNSIGNED NULL,
    `receitaId` BIGINT UNSIGNED NULL,
    `quantidade` DECIMAL(14, 2) NOT NULL,
    `tipoDispensacao` ENUM('VENDA_LIVRE', 'RECEITA_SIMPLES', 'RECEITA_CONTROLADA', 'RECEITA_OBRIGATORIA', 'RECEITA_RETIDA', 'PSICOTROPICO', 'NARCOTICO') NOT NULL,
    `classificacaoAnarme` ENUM('NORMAL', 'NARCOTICO', 'PSICOTROPICO_LIII', 'PSICOTROPICO_LIV', 'CONTROLADO_ESPECIAL') NOT NULL DEFAULT 'NORMAL',
    `isControlado` BOOLEAN NOT NULL DEFAULT false,
    `isPsicotropico` BOOLEAN NOT NULL DEFAULT false,
    `necessitaReceita` BOOLEAN NOT NULL,
    `receitaVerificada` BOOLEAN NOT NULL DEFAULT false,
    `receitaFisicaPresente` BOOLEAN NOT NULL DEFAULT false,
    `receitaValida` BOOLEAN NOT NULL DEFAULT false,
    `validacaoDupla` BOOLEAN NOT NULL DEFAULT false,
    `motivoSaida` VARCHAR(191) NULL,
    `numeroDocumento` VARCHAR(191) NULL,
    `idempotencyKey` VARCHAR(191) NULL,
    `deletedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `version` INTEGER NOT NULL DEFAULT 0,

    UNIQUE INDEX `dispensacoes_faturaItemId_key`(`faturaItemId`),
    UNIQUE INDEX `dispensacoes_idempotencyKey_key`(`idempotencyKey`),
    INDEX `dispensacoes_produtoId_createdAt_idx`(`produtoId`, `createdAt`),
    INDEX `dispensacoes_loteId_idx`(`loteId`),
    INDEX `dispensacoes_faturaId_idx`(`faturaId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `fatura_anulacoes` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `faturaId` BIGINT UNSIGNED NOT NULL,
    `userId` BIGINT UNSIGNED NOT NULL,
    `motivo` TEXT NOT NULL,
    `observacoes` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `fatura_anulacoes_faturaId_key`(`faturaId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `fatura_item_cancelamentos` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `faturaItemId` BIGINT UNSIGNED NOT NULL,
    `userId` BIGINT UNSIGNED NOT NULL,
    `quantidade` DECIMAL(10, 2) NOT NULL,
    `motivo` TEXT NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `payment_refunds` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `paymentId` BIGINT UNSIGNED NOT NULL,
    `userId` BIGINT UNSIGNED NOT NULL,
    `valor` DECIMAL(10, 2) NOT NULL,
    `metodo` ENUM('DINHEIRO', 'CARTAO', 'TRANSFERENCIA', 'CARTEIRA_MOVEL', 'EMOLA', 'MPESA') NOT NULL,
    `motivo` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `business_events` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `userId` BIGINT UNSIGNED NOT NULL,
    `type` VARCHAR(191) NOT NULL,
    `entity` VARCHAR(191) NOT NULL,
    `entityId` BIGINT UNSIGNED NULL,
    `payload` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `business_events_type_createdAt_idx`(`type`, `createdAt`),
    INDEX `business_events_entity_entityId_idx`(`entity`, `entityId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `caixa_sessoes` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `caixaId` BIGINT UNSIGNED NOT NULL,
    `userId` BIGINT UNSIGNED NOT NULL,
    `abertura` DECIMAL(10, 2) NOT NULL,
    `sistema` DECIMAL(10, 2) NOT NULL DEFAULT 0,
    `contado` DECIMAL(10, 2) NULL,
    `diferenca` DECIMAL(10, 2) NULL,
    `observacaoFecho` TEXT NULL,
    `fechadoPorId` BIGINT UNSIGNED NULL,
    `status` ENUM('ABERTA', 'FECHADA') NOT NULL DEFAULT 'ABERTA',
    `openedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `closedAt` DATETIME(3) NULL,
    `deletedAt` DATETIME(3) NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `stock_reversals` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `faturaId` BIGINT UNSIGNED NOT NULL,
    `faturaItemId` BIGINT UNSIGNED NULL,
    `produtoId` BIGINT UNSIGNED NOT NULL,
    `loteId` BIGINT UNSIGNED NULL,
    `userId` BIGINT UNSIGNED NOT NULL,
    `quantidade` DECIMAL(10, 2) NOT NULL,
    `motivo` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `financial_summary` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `periodo` VARCHAR(191) NOT NULL,
    `ano` INTEGER NOT NULL,
    `mes` INTEGER NULL,
    `dia` INTEGER NULL,
    `totalVendas` DECIMAL(12, 2) NOT NULL,
    `totalCustos` DECIMAL(12, 2) NOT NULL,
    `totalDespesas` DECIMAL(12, 2) NOT NULL,
    `lucroBruto` DECIMAL(12, 2) NOT NULL,
    `lucroLiquido` DECIMAL(12, 2) NOT NULL,
    `margemLucro` DECIMAL(5, 2) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `financial_summary_periodo_ano_mes_dia_key`(`periodo`, `ano`, `mes`, `dia`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `receitas` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `clienteId` BIGINT UNSIGNED NOT NULL,
    `medicoNome` VARCHAR(191) NULL,
    `numeroReceita` VARCHAR(191) NULL,
    `dataReceita` DATETIME(3) NOT NULL,
    `observacoes` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `livro_receitas` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `receitaId` BIGINT UNSIGNED NOT NULL,
    `clienteId` BIGINT UNSIGNED NOT NULL,
    `faturaId` BIGINT UNSIGNED NULL,
    `faturaItemId` BIGINT UNSIGNED NULL,
    `dispensacaoId` BIGINT UNSIGNED NULL,
    `produtoId` BIGINT UNSIGNED NOT NULL,
    `loteId` BIGINT UNSIGNED NULL,
    `tipoMovimento` ENUM('ENTRADA', 'SAIDA', 'CANCELAMENTO', 'AJUSTE') NOT NULL,
    `quantidade` DECIMAL(14, 2) NOT NULL,
    `saldoAnterior` DECIMAL(14, 2) NOT NULL,
    `saldoAtual` DECIMAL(14, 2) NOT NULL,
    `medicoNome` VARCHAR(191) NULL,
    `numeroReceita` VARCHAR(191) NULL,
    `dataReceita` DATETIME(3) NOT NULL,
    `origemReceita` ENUM('FISICA', 'DIGITAL', 'SISTEMA_INTERNO') NOT NULL DEFAULT 'FISICA',
    `idempotencyKey` VARCHAR(191) NULL,
    `observacoes` VARCHAR(191) NULL,
    `responsavelId` BIGINT UNSIGNED NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `version` INTEGER NOT NULL DEFAULT 0,

    UNIQUE INDEX `livro_receitas_dispensacaoId_key`(`dispensacaoId`),
    UNIQUE INDEX `livro_receitas_idempotencyKey_key`(`idempotencyKey`),
    INDEX `livro_receitas_receitaId_idx`(`receitaId`),
    INDEX `livro_receitas_clienteId_idx`(`clienteId`),
    INDEX `livro_receitas_produtoId_idx`(`produtoId`),
    INDEX `livro_receitas_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `regras_fiscais` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `codigo` VARCHAR(50) NOT NULL,
    `nome` VARCHAR(100) NOT NULL,
    `tipo` ENUM('IVA_NORMAL', 'IVA_REDUZIDO', 'IVA_ISENTO', 'NAO_TRIBUTAVEL') NOT NULL DEFAULT 'IVA_NORMAL',
    `taxa` DECIMAL(5, 2) NOT NULL DEFAULT 0,
    `descricao` TEXT NULL,
    `ativo` BOOLEAN NOT NULL DEFAULT true,
    `versao` INTEGER NOT NULL DEFAULT 1,
    `dataInicio` DATETIME(3) NULL,
    `dataFim` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `regras_fiscais_codigo_key`(`codigo`),
    INDEX `regras_fiscais_ativo_idx`(`ativo`),
    INDEX `regras_fiscais_tipo_idx`(`tipo`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `caixas` ADD CONSTRAINT `caixas_terminalId_fkey` FOREIGN KEY (`terminalId`) REFERENCES `terminais`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `caixa_movimentos` ADD CONSTRAINT `caixa_movimentos_caixaId_fkey` FOREIGN KEY (`caixaId`) REFERENCES `caixas`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `caixa_movimentos` ADD CONSTRAINT `caixa_movimentos_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `caixa_movimentos` ADD CONSTRAINT `caixa_movimentos_faturaId_fkey` FOREIGN KEY (`faturaId`) REFERENCES `faturas`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `clientes` ADD CONSTRAINT `clientes_empresaId_fkey` FOREIGN KEY (`empresaId`) REFERENCES `empresas`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `convenio_contratos` ADD CONSTRAINT `convenio_contratos_empresaId_fkey` FOREIGN KEY (`empresaId`) REFERENCES `empresas`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `produtos` ADD CONSTRAINT `produtos_taxRuleId_fkey` FOREIGN KEY (`taxRuleId`) REFERENCES `regras_fiscais`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `servicos` ADD CONSTRAINT `servicos_taxRuleId_fkey` FOREIGN KEY (`taxRuleId`) REFERENCES `regras_fiscais`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `produtos_fornecedores` ADD CONSTRAINT `produtos_fornecedores_produtoId_fkey` FOREIGN KEY (`produtoId`) REFERENCES `produtos`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `produtos_fornecedores` ADD CONSTRAINT `produtos_fornecedores_fornecedorId_fkey` FOREIGN KEY (`fornecedorId`) REFERENCES `fornecedores`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `compras` ADD CONSTRAINT `compras_fornecedorId_fkey` FOREIGN KEY (`fornecedorId`) REFERENCES `fornecedores`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `compras_itens` ADD CONSTRAINT `compras_itens_compraId_fkey` FOREIGN KEY (`compraId`) REFERENCES `compras`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `compras_itens` ADD CONSTRAINT `compras_itens_produtoId_fkey` FOREIGN KEY (`produtoId`) REFERENCES `produtos`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `lotes` ADD CONSTRAINT `lotes_produtoId_fkey` FOREIGN KEY (`produtoId`) REFERENCES `produtos`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `lotes` ADD CONSTRAINT `lotes_fornecedorId_fkey` FOREIGN KEY (`fornecedorId`) REFERENCES `fornecedores`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `lote_movimentos_sanitarios` ADD CONSTRAINT `lote_movimentos_sanitarios_loteId_fkey` FOREIGN KEY (`loteId`) REFERENCES `lotes`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `lote_movimentos_sanitarios` ADD CONSTRAINT `lote_movimentos_sanitarios_responsavelId_fkey` FOREIGN KEY (`responsavelId`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `incineracoes` ADD CONSTRAINT `incineracoes_responsavelId_fkey` FOREIGN KEY (`responsavelId`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `incineracoes` ADD CONSTRAINT `incineracoes_aprovadoPorId_fkey` FOREIGN KEY (`aprovadoPorId`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `incineracao_itens` ADD CONSTRAINT `incineracao_itens_incineracaoId_fkey` FOREIGN KEY (`incineracaoId`) REFERENCES `incineracoes`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `incineracao_itens` ADD CONSTRAINT `incineracao_itens_loteId_fkey` FOREIGN KEY (`loteId`) REFERENCES `lotes`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `estoque_movimentos` ADD CONSTRAINT `estoque_movimentos_produtoId_fkey` FOREIGN KEY (`produtoId`) REFERENCES `produtos`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `estoque_movimentos` ADD CONSTRAINT `estoque_movimentos_loteId_fkey` FOREIGN KEY (`loteId`) REFERENCES `lotes`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `estoque_movimentos` ADD CONSTRAINT `estoque_movimentos_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `historico_precos` ADD CONSTRAINT `historico_precos_produtoId_fkey` FOREIGN KEY (`produtoId`) REFERENCES `produtos`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `historico_precos` ADD CONSTRAINT `historico_precos_fornecedorId_fkey` FOREIGN KEY (`fornecedorId`) REFERENCES `fornecedores`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `alertas_estoque` ADD CONSTRAINT `alertas_estoque_produtoId_fkey` FOREIGN KEY (`produtoId`) REFERENCES `produtos`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `faturas` ADD CONSTRAINT `faturas_clienteId_fkey` FOREIGN KEY (`clienteId`) REFERENCES `clientes`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `faturas` ADD CONSTRAINT `faturas_terminalId_fkey` FOREIGN KEY (`terminalId`) REFERENCES `terminais`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `faturas` ADD CONSTRAINT `faturas_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `faturas` ADD CONSTRAINT `faturas_authorizedById_fkey` FOREIGN KEY (`authorizedById`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `faturas` ADD CONSTRAINT `faturas_cancelledById_fkey` FOREIGN KEY (`cancelledById`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `fatura_itens` ADD CONSTRAINT `fatura_itens_faturaId_fkey` FOREIGN KEY (`faturaId`) REFERENCES `faturas`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `fatura_itens` ADD CONSTRAINT `fatura_itens_produtoId_fkey` FOREIGN KEY (`produtoId`) REFERENCES `produtos`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `fatura_itens` ADD CONSTRAINT `fatura_itens_servicoId_fkey` FOREIGN KEY (`servicoId`) REFERENCES `servicos`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `fatura_itens` ADD CONSTRAINT `fatura_itens_loteId_fkey` FOREIGN KEY (`loteId`) REFERENCES `lotes`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `contas_receber` ADD CONSTRAINT `contas_receber_clienteId_fkey` FOREIGN KEY (`clienteId`) REFERENCES `clientes`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `contas_receber` ADD CONSTRAINT `contas_receber_faturaId_fkey` FOREIGN KEY (`faturaId`) REFERENCES `faturas`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `contas_receber` ADD CONSTRAINT `contas_receber_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `contas_receber` ADD CONSTRAINT `contas_receber_authorizedById_fkey` FOREIGN KEY (`authorizedById`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `conta_receber_pagamentos` ADD CONSTRAINT `conta_receber_pagamentos_contaReceberId_fkey` FOREIGN KEY (`contaReceberId`) REFERENCES `contas_receber`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `conta_receber_pagamentos` ADD CONSTRAINT `conta_receber_pagamentos_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `conta_receber_pagamentos` ADD CONSTRAINT `conta_receber_pagamentos_caixaId_fkey` FOREIGN KEY (`caixaId`) REFERENCES `caixas`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `contas_pagar` ADD CONSTRAINT `contas_pagar_fornecedorId_fkey` FOREIGN KEY (`fornecedorId`) REFERENCES `fornecedores`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `contas_pagar` ADD CONSTRAINT `contas_pagar_compraId_fkey` FOREIGN KEY (`compraId`) REFERENCES `compras`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `contas_pagar` ADD CONSTRAINT `contas_pagar_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `estoque_reservas` ADD CONSTRAINT `estoque_reservas_produtoId_fkey` FOREIGN KEY (`produtoId`) REFERENCES `produtos`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `estoque_reservas` ADD CONSTRAINT `estoque_reservas_loteId_fkey` FOREIGN KEY (`loteId`) REFERENCES `lotes`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `estoque_reservas` ADD CONSTRAINT `estoque_reservas_faturaId_fkey` FOREIGN KEY (`faturaId`) REFERENCES `faturas`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `financial_movements` ADD CONSTRAINT `financial_movements_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `financial_movements` ADD CONSTRAINT `financial_movements_caixaId_fkey` FOREIGN KEY (`caixaId`) REFERENCES `caixas`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `financial_movements` ADD CONSTRAINT `financial_movements_faturaId_fkey` FOREIGN KEY (`faturaId`) REFERENCES `faturas`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `financial_movements` ADD CONSTRAINT `financial_movements_contaReceberId_fkey` FOREIGN KEY (`contaReceberId`) REFERENCES `contas_receber`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `financial_movements` ADD CONSTRAINT `financial_movements_contaPagarId_fkey` FOREIGN KEY (`contaPagarId`) REFERENCES `contas_pagar`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `pagamentos` ADD CONSTRAINT `pagamentos_faturaId_fkey` FOREIGN KEY (`faturaId`) REFERENCES `faturas`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `pagamentos` ADD CONSTRAINT `pagamentos_caixaId_fkey` FOREIGN KEY (`caixaId`) REFERENCES `caixas`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `livro_psicotropicos` ADD CONSTRAINT `livro_psicotropicos_responsavelId_fkey` FOREIGN KEY (`responsavelId`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `livro_psicotropicos` ADD CONSTRAINT `livro_psicotropicos_produtoId_fkey` FOREIGN KEY (`produtoId`) REFERENCES `produtos`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `livro_psicotropicos` ADD CONSTRAINT `livro_psicotropicos_loteId_fkey` FOREIGN KEY (`loteId`) REFERENCES `lotes`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `livro_psicotropicos` ADD CONSTRAINT `livro_psicotropicos_dispensacaoId_fkey` FOREIGN KEY (`dispensacaoId`) REFERENCES `dispensacoes`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `stock_balances` ADD CONSTRAINT `stock_balances_produtoId_fkey` FOREIGN KEY (`produtoId`) REFERENCES `produtos`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `cash_balances` ADD CONSTRAINT `cash_balances_caixaId_fkey` FOREIGN KEY (`caixaId`) REFERENCES `caixas`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `audit_logs` ADD CONSTRAINT `audit_logs_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `user_permissions` ADD CONSTRAINT `user_permissions_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `stock_valuation` ADD CONSTRAINT `stock_valuation_produtoId_fkey` FOREIGN KEY (`produtoId`) REFERENCES `produtos`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `dispensacoes` ADD CONSTRAINT `dispensacoes_produtoId_fkey` FOREIGN KEY (`produtoId`) REFERENCES `produtos`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `dispensacoes` ADD CONSTRAINT `dispensacoes_loteId_fkey` FOREIGN KEY (`loteId`) REFERENCES `lotes`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `dispensacoes` ADD CONSTRAINT `dispensacoes_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `dispensacoes` ADD CONSTRAINT `dispensacoes_validadoPorId_fkey` FOREIGN KEY (`validadoPorId`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `dispensacoes` ADD CONSTRAINT `dispensacoes_faturaItemId_fkey` FOREIGN KEY (`faturaItemId`) REFERENCES `fatura_itens`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `dispensacoes` ADD CONSTRAINT `dispensacoes_faturaId_fkey` FOREIGN KEY (`faturaId`) REFERENCES `faturas`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `dispensacoes` ADD CONSTRAINT `dispensacoes_receitaId_fkey` FOREIGN KEY (`receitaId`) REFERENCES `receitas`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `fatura_anulacoes` ADD CONSTRAINT `fatura_anulacoes_faturaId_fkey` FOREIGN KEY (`faturaId`) REFERENCES `faturas`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `fatura_anulacoes` ADD CONSTRAINT `fatura_anulacoes_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `fatura_item_cancelamentos` ADD CONSTRAINT `fatura_item_cancelamentos_faturaItemId_fkey` FOREIGN KEY (`faturaItemId`) REFERENCES `fatura_itens`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `fatura_item_cancelamentos` ADD CONSTRAINT `fatura_item_cancelamentos_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payment_refunds` ADD CONSTRAINT `payment_refunds_paymentId_fkey` FOREIGN KEY (`paymentId`) REFERENCES `pagamentos`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payment_refunds` ADD CONSTRAINT `payment_refunds_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `business_events` ADD CONSTRAINT `business_events_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `caixa_sessoes` ADD CONSTRAINT `caixa_sessoes_caixaId_fkey` FOREIGN KEY (`caixaId`) REFERENCES `caixas`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `caixa_sessoes` ADD CONSTRAINT `caixa_sessoes_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `caixa_sessoes` ADD CONSTRAINT `caixa_sessoes_fechadoPorId_fkey` FOREIGN KEY (`fechadoPorId`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `stock_reversals` ADD CONSTRAINT `stock_reversals_faturaId_fkey` FOREIGN KEY (`faturaId`) REFERENCES `faturas`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `stock_reversals` ADD CONSTRAINT `stock_reversals_faturaItemId_fkey` FOREIGN KEY (`faturaItemId`) REFERENCES `fatura_itens`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `stock_reversals` ADD CONSTRAINT `stock_reversals_produtoId_fkey` FOREIGN KEY (`produtoId`) REFERENCES `produtos`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `stock_reversals` ADD CONSTRAINT `stock_reversals_loteId_fkey` FOREIGN KEY (`loteId`) REFERENCES `lotes`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `stock_reversals` ADD CONSTRAINT `stock_reversals_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `receitas` ADD CONSTRAINT `receitas_clienteId_fkey` FOREIGN KEY (`clienteId`) REFERENCES `clientes`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `livro_receitas` ADD CONSTRAINT `livro_receitas_responsavelId_fkey` FOREIGN KEY (`responsavelId`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `livro_receitas` ADD CONSTRAINT `livro_receitas_receitaId_fkey` FOREIGN KEY (`receitaId`) REFERENCES `receitas`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `livro_receitas` ADD CONSTRAINT `livro_receitas_clienteId_fkey` FOREIGN KEY (`clienteId`) REFERENCES `clientes`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `livro_receitas` ADD CONSTRAINT `livro_receitas_produtoId_fkey` FOREIGN KEY (`produtoId`) REFERENCES `produtos`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `livro_receitas` ADD CONSTRAINT `livro_receitas_loteId_fkey` FOREIGN KEY (`loteId`) REFERENCES `lotes`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `livro_receitas` ADD CONSTRAINT `livro_receitas_faturaId_fkey` FOREIGN KEY (`faturaId`) REFERENCES `faturas`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `livro_receitas` ADD CONSTRAINT `livro_receitas_faturaItemId_fkey` FOREIGN KEY (`faturaItemId`) REFERENCES `fatura_itens`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `livro_receitas` ADD CONSTRAINT `livro_receitas_dispensacaoId_fkey` FOREIGN KEY (`dispensacaoId`) REFERENCES `dispensacoes`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
