-- AlterTable
ALTER TABLE `role_permissions` MODIFY `module` ENUM('REQUISICOES', 'COMPRAS', 'PRODUTOS', 'LOTES', 'INVENTARIO', 'FORNECEDORES', 'CLIENTES', 'POS', 'RELATORIOS', 'UTILIZADORES', 'CONFIGURACOES', 'COTACOES', 'FATURAS', 'CAIXA', 'ESTOQUE', 'PSICOTROPICOS', 'AUDITORIA') NOT NULL;

-- AlterTable
ALTER TABLE `user_permissions` MODIFY `module` ENUM('REQUISICOES', 'COMPRAS', 'PRODUTOS', 'LOTES', 'INVENTARIO', 'FORNECEDORES', 'CLIENTES', 'POS', 'RELATORIOS', 'UTILIZADORES', 'CONFIGURACOES', 'COTACOES', 'FATURAS', 'CAIXA', 'ESTOQUE', 'PSICOTROPICOS', 'AUDITORIA') NOT NULL;

-- CreateTable
CREATE TABLE `cotacoes` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `numero` VARCHAR(191) NOT NULL,
    `clienteId` BIGINT UNSIGNED NOT NULL,
    `userId` BIGINT UNSIGNED NOT NULL,
    `subtotal` DECIMAL(14, 2) NOT NULL,
    `desconto` DECIMAL(14, 2) NOT NULL DEFAULT 0,
    `ivaTotal` DECIMAL(14, 2) NOT NULL,
    `total` DECIMAL(14, 2) NOT NULL,
    `moeda` VARCHAR(191) NOT NULL DEFAULT 'MZN',
    `estado` ENUM('PENDENTE', 'APROVADA', 'REJEITADA', 'EXPIRADA') NOT NULL DEFAULT 'PENDENTE',
    `validade` DATETIME(3) NOT NULL,
    `observacoes` TEXT NULL,
    `deletedAt` DATETIME(3) NULL,
    `version` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `cotacoes_numero_key`(`numero`),
    INDEX `cotacoes_clienteId_estado_idx`(`clienteId`, `estado`),
    INDEX `cotacoes_createdAt_idx`(`createdAt`),
    INDEX `cotacoes_estado_idx`(`estado`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `cotacao_itens` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `cotacaoId` BIGINT UNSIGNED NOT NULL,
    `produtoId` BIGINT UNSIGNED NULL,
    `servicoId` BIGINT UNSIGNED NULL,
    `descricao` VARCHAR(191) NOT NULL,
    `quantidade` DECIMAL(14, 2) NOT NULL,
    `precoUnit` DECIMAL(14, 2) NOT NULL,
    `baseCalculo` DECIMAL(14, 2) NOT NULL DEFAULT 0,
    `iva` DECIMAL(5, 2) NOT NULL,
    `valorIva` DECIMAL(14, 2) NOT NULL DEFAULT 0,
    `taxaAplicada` DECIMAL(5, 2) NOT NULL DEFAULT 0,
    `tipoRegraFiscalSnapshot` ENUM('IVA_NORMAL', 'IVA_REDUZIDO', 'IVA_ISENTO', 'NAO_TRIBUTAVEL') NULL,
    `codigoRegraFiscal` VARCHAR(50) NULL,
    `motivoIsencao` TEXT NULL,
    `total` DECIMAL(14, 2) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `cotacoes` ADD CONSTRAINT `cotacoes_clienteId_fkey` FOREIGN KEY (`clienteId`) REFERENCES `clientes`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `cotacoes` ADD CONSTRAINT `cotacoes_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `cotacao_itens` ADD CONSTRAINT `cotacao_itens_cotacaoId_fkey` FOREIGN KEY (`cotacaoId`) REFERENCES `cotacoes`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `cotacao_itens` ADD CONSTRAINT `cotacao_itens_produtoId_fkey` FOREIGN KEY (`produtoId`) REFERENCES `produtos`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `cotacao_itens` ADD CONSTRAINT `cotacao_itens_servicoId_fkey` FOREIGN KEY (`servicoId`) REFERENCES `servicos`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
