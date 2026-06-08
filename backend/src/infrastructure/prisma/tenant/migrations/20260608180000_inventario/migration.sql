-- CreateTable
CREATE TABLE `inventarios` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `codigo` VARCHAR(50) NOT NULL,
    `observacao` TEXT NULL,
    `status` ENUM('ABERTO', 'EM_CONTAGEM', 'RECONCILIADO', 'CANCELADO') NOT NULL DEFAULT 'ABERTO',
    `iniciadoPorId` BIGINT UNSIGNED NOT NULL,
    `reconciliadoPorId` BIGINT UNSIGNED NULL,
    `iniciadoEm` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `reconciliadoEm` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `inventarios_codigo_key`(`codigo`),
    INDEX `inventarios_status_idx`(`status`),
    INDEX `inventarios_iniciadoEm_idx`(`iniciadoEm`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `inventario_itens` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `inventarioId` BIGINT UNSIGNED NOT NULL,
    `produtoId` BIGINT UNSIGNED NOT NULL,
    `loteId` BIGINT UNSIGNED NULL,
    `estoqueSistema` DECIMAL(14, 2) NOT NULL,
    `estoqueContado` DECIMAL(14, 2) NOT NULL,
    `divergencia` DECIMAL(14, 2) NOT NULL,

    INDEX `inventario_itens_inventarioId_idx`(`inventarioId`),
    INDEX `inventario_itens_produtoId_idx`(`produtoId`),
    UNIQUE INDEX `inventario_itens_inventarioId_produtoId_loteId_key`(`inventarioId`, `produtoId`, `loteId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `inventarios` ADD CONSTRAINT `inventarios_iniciadoPorId_fkey` FOREIGN KEY (`iniciadoPorId`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `inventarios` ADD CONSTRAINT `inventarios_reconciliadoPorId_fkey` FOREIGN KEY (`reconciliadoPorId`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `inventario_itens` ADD CONSTRAINT `inventario_itens_inventarioId_fkey` FOREIGN KEY (`inventarioId`) REFERENCES `inventarios`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `inventario_itens` ADD CONSTRAINT `inventario_itens_produtoId_fkey` FOREIGN KEY (`produtoId`) REFERENCES `produtos`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `inventario_itens` ADD CONSTRAINT `inventario_itens_loteId_fkey` FOREIGN KEY (`loteId`) REFERENCES `lotes`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
