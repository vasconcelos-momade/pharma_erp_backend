-- CreateTable
CREATE TABLE `transferencias` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `numeroDocumento` VARCHAR(100) NOT NULL,
    `origem` VARCHAR(100) NOT NULL,
    `destino` VARCHAR(100) NOT NULL,
    `tipo` ENUM('SAIDA', 'ENTRADA') NOT NULL DEFAULT 'SAIDA',
    `status` ENUM('RASCUNHO', 'CONFIRMADA', 'CANCELADA') NOT NULL DEFAULT 'RASCUNHO',
    `observacao` TEXT NULL,
    `userId` BIGINT UNSIGNED NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `transferencias_numeroDocumento_key`(`numeroDocumento`),
    INDEX `transferencias_origem_idx`(`origem`),
    INDEX `transferencias_destino_idx`(`destino`),
    INDEX `transferencias_status_idx`(`status`),
    INDEX `transferencias_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `transferencia_itens` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `transferenciaId` BIGINT UNSIGNED NOT NULL,
    `produtoId` BIGINT UNSIGNED NOT NULL,
    `loteId` BIGINT UNSIGNED NULL,
    `quantidade` DECIMAL(14, 2) NOT NULL,

    UNIQUE INDEX `transferencia_itens_transferenciaId_produtoId_loteId_key`(`transferenciaId`, `produtoId`, `loteId`),
    INDEX `transferencia_itens_transferenciaId_idx`(`transferenciaId`),
    INDEX `transferencia_itens_produtoId_idx`(`produtoId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `transferencias` ADD CONSTRAINT `transferencias_userId_fkey`
FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `transferencia_itens` ADD CONSTRAINT `transferencia_itens_transferenciaId_fkey`
FOREIGN KEY (`transferenciaId`) REFERENCES `transferencias`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `transferencia_itens` ADD CONSTRAINT `transferencia_itens_produtoId_fkey`
FOREIGN KEY (`produtoId`) REFERENCES `produtos`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `transferencia_itens` ADD CONSTRAINT `transferencia_itens_loteId_fkey`
FOREIGN KEY (`loteId`) REFERENCES `lotes`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
