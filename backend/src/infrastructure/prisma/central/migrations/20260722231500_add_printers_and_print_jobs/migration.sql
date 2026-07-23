-- CreateEnum
-- PrinterType / PrinterConnection / PrintStatus (inline in CREATE TABLE for MySQL)

-- CreateTable
CREATE TABLE `printers` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `uuid` VARCHAR(191) NOT NULL,
    `tenantId` BIGINT UNSIGNED NOT NULL,
    `branchId` BIGINT UNSIGNED NOT NULL,
    `deviceId` BIGINT UNSIGNED NULL,
    `nome` VARCHAR(191) NOT NULL,
    `tipo` ENUM('ESC_POS', 'A4', 'LABEL') NOT NULL,
    `conexao` ENUM('NETWORK', 'USB', 'BLUETOOTH', 'PDF') NOT NULL,
    `ip` VARCHAR(45) NULL,
    `porta` INTEGER NULL DEFAULT 9100,
    `modelo` VARCHAR(128) NULL,
    `fabricante` VARCHAR(128) NULL,
    `ativo` BOOLEAN NOT NULL DEFAULT true,
    `version` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,

    UNIQUE INDEX `printers_uuid_key`(`uuid`),
    INDEX `printers_tenantId_branchId_idx`(`tenantId`, `branchId`),
    INDEX `printers_tenantId_branchId_ativo_idx`(`tenantId`, `branchId`, `ativo`),
    INDEX `printers_deviceId_idx`(`deviceId`),
    INDEX `printers_tipo_conexao_idx`(`tipo`, `conexao`),
    INDEX `printers_deletedAt_idx`(`deletedAt`),
    UNIQUE INDEX `printers_tenantId_branchId_nome_key`(`tenantId`, `branchId`, `nome`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `print_jobs` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `tenantId` BIGINT UNSIGNED NOT NULL,
    `branchId` BIGINT UNSIGNED NOT NULL,
    `printerId` BIGINT UNSIGNED NOT NULL,
    `documento` VARCHAR(128) NOT NULL,
    `payload` JSON NOT NULL,
    `status` ENUM('PENDING', 'PROCESSING', 'PRINTED', 'FAILED', 'CANCELLED') NOT NULL DEFAULT 'PENDING',
    `tentativas` INTEGER NOT NULL DEFAULT 0,
    `maxAttempts` INTEGER NOT NULL DEFAULT 3,
    `erro` TEXT NULL,
    `printedAt` DATETIME(3) NULL,
    `lockedAt` DATETIME(3) NULL,
    `lockedBy` VARCHAR(64) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,

    INDEX `print_jobs_tenantId_branchId_status_idx`(`tenantId`, `branchId`, `status`),
    INDEX `print_jobs_printerId_status_idx`(`printerId`, `status`),
    INDEX `print_jobs_status_createdAt_idx`(`status`, `createdAt`),
    INDEX `print_jobs_status_lockedAt_idx`(`status`, `lockedAt`),
    INDEX `print_jobs_deletedAt_idx`(`deletedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `printers` ADD CONSTRAINT `printers_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `printers` ADD CONSTRAINT `printers_branchId_fkey` FOREIGN KEY (`branchId`) REFERENCES `branches`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `printers` ADD CONSTRAINT `printers_deviceId_fkey` FOREIGN KEY (`deviceId`) REFERENCES `devices`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `print_jobs` ADD CONSTRAINT `print_jobs_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `print_jobs` ADD CONSTRAINT `print_jobs_branchId_fkey` FOREIGN KEY (`branchId`) REFERENCES `branches`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `print_jobs` ADD CONSTRAINT `print_jobs_printerId_fkey` FOREIGN KEY (`printerId`) REFERENCES `printers`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
