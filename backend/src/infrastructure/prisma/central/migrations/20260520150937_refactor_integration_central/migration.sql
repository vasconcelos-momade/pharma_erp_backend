-- CreateTable
CREATE TABLE `users` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `uuid` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `password` VARCHAR(191) NOT NULL,
    `role` ENUM('superadmin', 'admin', 'usuario') NOT NULL DEFAULT 'usuario',
    `active` BOOLEAN NOT NULL DEFAULT true,
    `lastLoginAt` DATETIME(0) NULL,
    `failedLoginCount` INTEGER NOT NULL DEFAULT 0,
    `lockedUntil` DATETIME(0) NULL,
    `version` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updatedAt` DATETIME(0) NOT NULL,
    `deletedAt` DATETIME(0) NULL,

    UNIQUE INDEX `users_uuid_key`(`uuid`),
    UNIQUE INDEX `users_email_key`(`email`),
    INDEX `users_role_idx`(`role`),
    INDEX `users_lockedUntil_idx`(`lockedUntil`),
    INDEX `users_active_idx`(`active`),
    INDEX `users_deletedAt_idx`(`deletedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `user_tenants` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `userId` BIGINT UNSIGNED NOT NULL,
    `tenantId` BIGINT UNSIGNED NOT NULL,
    `role` ENUM('ADMIN', 'GERENTE', 'CAIXA', 'FARMACEUTICO', 'DIRETOR_TECNICO') NOT NULL,
    `active` BOOLEAN NOT NULL DEFAULT true,
    `version` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,

    INDEX `user_tenants_deletedAt_idx`(`deletedAt`),
    UNIQUE INDEX `user_tenants_userId_tenantId_key`(`userId`, `tenantId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `tenants` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `uuid` VARCHAR(191) NOT NULL,
    `userId` BIGINT UNSIGNED NOT NULL,
    `nomeTenant` VARCHAR(191) NOT NULL,
    `nomeEmpresa` VARCHAR(191) NOT NULL,
    `nuit` VARCHAR(191) NULL,
    `status` ENUM('trial', 'ativo', 'pendente', 'grace', 'suspenso') NOT NULL DEFAULT 'ativo',
    `country` VARCHAR(2) NOT NULL DEFAULT 'MZ',
    `version` INTEGER NOT NULL DEFAULT 0,
    `createdBy` BIGINT UNSIGNED NULL,
    `updatedBy` BIGINT UNSIGNED NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,

    UNIQUE INDEX `tenants_uuid_key`(`uuid`),
    UNIQUE INDEX `tenants_nomeTenant_key`(`nomeTenant`),
    INDEX `tenants_status_idx`(`status`),
    INDEX `tenants_country_idx`(`country`),
    INDEX `tenants_userId_idx`(`userId`),
    INDEX `tenants_deletedAt_idx`(`deletedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `tenant_settings` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `tenantId` BIGINT UNSIGNED NOT NULL,
    `chave` VARCHAR(191) NOT NULL,
    `valor` JSON NOT NULL,
    `schemaVersion` INTEGER NOT NULL DEFAULT 1,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,

    INDEX `tenant_settings_deletedAt_idx`(`deletedAt`),
    UNIQUE INDEX `tenant_settings_tenantId_chave_key`(`tenantId`, `chave`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `branches` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `uuid` VARCHAR(191) NOT NULL,
    `tenantId` BIGINT UNSIGNED NOT NULL,
    `codigo` VARCHAR(191) NOT NULL,
    `nome` VARCHAR(191) NOT NULL,
    `isHeadOffice` BOOLEAN NOT NULL DEFAULT false,
    `ativo` BOOLEAN NOT NULL DEFAULT true,
    `syncEnabled` BOOLEAN NOT NULL DEFAULT true,
    `offlineEnabled` BOOLEAN NOT NULL DEFAULT true,
    `connectionStatus` ENUM('ONLINE', 'OFFLINE', 'DEGRADED') NOT NULL DEFAULT 'ONLINE',
    `lastSyncAt` DATETIME(3) NULL,
    `lastVersionSync` INTEGER NULL,
    `dbHost` VARCHAR(191) NOT NULL,
    `dbPort` INTEGER NOT NULL DEFAULT 3306,
    `dbName` VARCHAR(191) NOT NULL,
    `dbUsername` VARCHAR(191) NOT NULL,
    `dbPasswordCipherText` VARCHAR(191) NOT NULL,
    `dbPasswordIv` VARCHAR(191) NOT NULL,
    `dbPasswordTag` VARCHAR(191) NULL,
    `dbSslEnabled` BOOLEAN NOT NULL DEFAULT false,
    `version` INTEGER NOT NULL DEFAULT 0,
    `createdBy` BIGINT UNSIGNED NULL,
    `updatedBy` BIGINT UNSIGNED NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,

    UNIQUE INDEX `branches_uuid_key`(`uuid`),
    INDEX `branches_tenantId_idx`(`tenantId`),
    INDEX `branches_ativo_idx`(`ativo`),
    INDEX `branches_deletedAt_idx`(`deletedAt`),
    UNIQUE INDEX `branches_tenantId_codigo_key`(`tenantId`, `codigo`),
    UNIQUE INDEX `branches_tenantId_nome_key`(`tenantId`, `nome`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `devices` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `uuid` VARCHAR(191) NOT NULL,
    `tenantId` BIGINT UNSIGNED NOT NULL,
    `branchId` BIGINT UNSIGNED NOT NULL,
    `nome` VARCHAR(191) NOT NULL,
    `codigo` VARCHAR(191) NOT NULL,
    `lastHeartbeatAt` DATETIME(3) NULL,
    `apiKeyHash` VARCHAR(255) NULL,
    `ativo` BOOLEAN NOT NULL DEFAULT true,
    `version` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,

    UNIQUE INDEX `devices_uuid_key`(`uuid`),
    INDEX `devices_tenantId_branchId_idx`(`tenantId`, `branchId`),
    INDEX `devices_apiKeyHash_idx`(`apiKeyHash`),
    INDEX `devices_deletedAt_idx`(`deletedAt`),
    UNIQUE INDEX `devices_tenantId_branchId_codigo_key`(`tenantId`, `branchId`, `codigo`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `sync_logs` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `tenantId` BIGINT UNSIGNED NOT NULL,
    `branchId` BIGINT UNSIGNED NOT NULL,
    `deviceId` BIGINT UNSIGNED NULL,
    `entityName` VARCHAR(191) NOT NULL,
    `entityId` VARCHAR(191) NOT NULL,
    `operation` ENUM('CREATE', 'UPDATE', 'DELETE') NOT NULL,
    `payload` JSON NULL,
    `payloadHash` VARCHAR(64) NULL,
    `schemaVersion` INTEGER NOT NULL DEFAULT 1,
    `status` ENUM('PENDING', 'PROCESSING', 'SYNCED', 'FAILED') NOT NULL DEFAULT 'PENDING',
    `retries` INTEGER NOT NULL DEFAULT 0,
    `nextRetryAt` DATETIME(3) NULL,
    `errorMessage` TEXT NULL,
    `checksum` VARCHAR(64) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `syncedAt` DATETIME(3) NULL,
    `deletedAt` DATETIME(3) NULL,

    INDEX `sync_logs_status_idx`(`status`),
    INDEX `sync_logs_tenantId_branchId_idx`(`tenantId`, `branchId`),
    INDEX `sync_logs_tenantId_status_createdAt_idx`(`tenantId`, `status`, `createdAt`),
    INDEX `sync_logs_tenantId_entityName_entityId_idx`(`tenantId`, `entityName`, `entityId`),
    INDEX `sync_logs_tenantId_payloadHash_idx`(`tenantId`, `payloadHash`),
    INDEX `sync_logs_branchId_status_createdAt_idx`(`branchId`, `status`, `createdAt`),
    INDEX `sync_logs_deviceId_status_idx`(`deviceId`, `status`),
    INDEX `sync_logs_createdAt_idx`(`createdAt`),
    INDEX `sync_logs_deletedAt_idx`(`deletedAt`),
    UNIQUE INDEX `sync_logs_tenantId_branchId_entityName_entityId_operation_sc_key`(`tenantId`, `branchId`, `entityName`, `entityId`, `operation`, `schemaVersion`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `sync_sessions` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `tenantId` BIGINT UNSIGNED NOT NULL,
    `branchId` BIGINT UNSIGNED NOT NULL,
    `deviceId` BIGINT UNSIGNED NULL,
    `status` ENUM('RUNNING', 'SUCCESS', 'FAILED', 'PARTIAL') NOT NULL DEFAULT 'RUNNING',
    `startedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `endedAt` DATETIME(3) NULL,
    `bytesSent` BIGINT UNSIGNED NOT NULL DEFAULT 0,
    `bytesReceived` BIGINT UNSIGNED NOT NULL DEFAULT 0,
    `recordsPushed` INTEGER NOT NULL DEFAULT 0,
    `recordsPulled` INTEGER NOT NULL DEFAULT 0,
    `conflictsCount` INTEGER NOT NULL DEFAULT 0,
    `errorMessage` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,

    INDEX `sync_sessions_tenantId_branchId_startedAt_idx`(`tenantId`, `branchId`, `startedAt`),
    INDEX `sync_sessions_deviceId_startedAt_idx`(`deviceId`, `startedAt`),
    INDEX `sync_sessions_status_startedAt_idx`(`status`, `startedAt`),
    INDEX `sync_sessions_deletedAt_idx`(`deletedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `plans` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(191) NOT NULL,
    `slug` VARCHAR(191) NOT NULL,
    `monthlyPrice` DECIMAL(10, 2) NOT NULL,
    `includedBranches` INTEGER NOT NULL DEFAULT 1,
    `extraBranchPrice` DECIMAL(10, 2) NOT NULL,
    `isEnterprise` BOOLEAN NOT NULL DEFAULT false,
    `active` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,

    UNIQUE INDEX `plans_slug_key`(`slug`),
    INDEX `plans_deletedAt_idx`(`deletedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `subscriptions` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `tenantId` BIGINT UNSIGNED NOT NULL,
    `planId` INTEGER NOT NULL,
    `branchesUsed` INTEGER NOT NULL DEFAULT 1,
    `status` ENUM('trial', 'ativo', 'cancelado', 'expirado') NOT NULL DEFAULT 'trial',
    `startDate` DATETIME(3) NOT NULL,
    `endDate` DATETIME(3) NULL,
    `trialEndsAt` DATETIME(3) NULL,
    `lastBillingAt` DATETIME(3) NULL,
    `nextBillingAt` DATETIME(3) NULL,
    `version` INTEGER NOT NULL DEFAULT 0,
    `createdBy` BIGINT UNSIGNED NULL,
    `updatedBy` BIGINT UNSIGNED NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,

    INDEX `subscriptions_tenantId_status_idx`(`tenantId`, `status`),
    INDEX `subscriptions_deletedAt_idx`(`deletedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `invoice_fiscal_counters` (
    `tenantId` BIGINT UNSIGNED NOT NULL,
    `fiscalYear` INTEGER NOT NULL,
    `lastSequence` INTEGER NOT NULL DEFAULT 0,
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`tenantId`, `fiscalYear`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `invoices` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `uuid` VARCHAR(191) NOT NULL,
    `number` VARCHAR(32) NOT NULL,
    `tenantId` BIGINT UNSIGNED NOT NULL,
    `fiscalYear` INTEGER NOT NULL,
    `sequence` INTEGER NOT NULL,
    `subscriptionId` BIGINT UNSIGNED NOT NULL,
    `billingSnapshotId` BIGINT UNSIGNED NULL,
    `amount` DECIMAL(10, 2) NOT NULL,
    `paidAmount` DECIMAL(10, 2) NOT NULL DEFAULT 0,
    `remainingAmount` DECIMAL(10, 2) NOT NULL,
    `status` ENUM('pendente', 'parcial', 'pago', 'vencido', 'cancelado') NOT NULL DEFAULT 'pendente',
    `dueDate` DATETIME(3) NOT NULL,
    `paidAt` DATETIME(3) NULL,
    `periodStart` DATETIME(3) NULL,
    `periodEnd` DATETIME(3) NULL,
    `branchesUsed` INTEGER NULL,
    `extraBranches` INTEGER NULL,
    `description` TEXT NULL,
    `version` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,

    UNIQUE INDEX `invoices_uuid_key`(`uuid`),
    UNIQUE INDEX `invoices_billingSnapshotId_key`(`billingSnapshotId`),
    INDEX `invoices_status_dueDate_idx`(`status`, `dueDate`),
    INDEX `invoices_tenantId_status_dueDate_idx`(`tenantId`, `status`, `dueDate`),
    INDEX `invoices_tenantId_dueDate_status_idx`(`tenantId`, `dueDate`, `status`),
    INDEX `invoices_tenantId_createdAt_idx`(`tenantId`, `createdAt`),
    INDEX `invoices_tenantId_fiscalYear_sequence_idx`(`tenantId`, `fiscalYear`, `sequence`),
    INDEX `invoices_subscriptionId_dueDate_idx`(`subscriptionId`, `dueDate`),
    INDEX `invoices_deletedAt_idx`(`deletedAt`),
    UNIQUE INDEX `invoices_tenantId_number_key`(`tenantId`, `number`),
    UNIQUE INDEX `invoices_tenantId_fiscalYear_sequence_key`(`tenantId`, `fiscalYear`, `sequence`),
    UNIQUE INDEX `invoices_tenantId_billingSnapshotId_key`(`tenantId`, `billingSnapshotId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `billing_snapshots` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `tenantId` BIGINT UNSIGNED NOT NULL,
    `subscriptionId` BIGINT UNSIGNED NOT NULL,
    `periodStart` DATETIME(3) NOT NULL,
    `periodEnd` DATETIME(3) NOT NULL,
    `planMonthlyPrice` DECIMAL(10, 2) NOT NULL,
    `includedBranches` INTEGER NOT NULL,
    `extraBranchesUsed` INTEGER NOT NULL,
    `extraBranchPrice` DECIMAL(10, 2) NOT NULL,
    `totalBranchesUsed` INTEGER NOT NULL,
    `subtotal` DECIMAL(10, 2) NOT NULL,
    `total` DECIMAL(10, 2) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `billing_snapshots_tenantId_createdAt_idx`(`tenantId`, `createdAt`),
    INDEX `billing_snapshots_subscriptionId_createdAt_idx`(`subscriptionId`, `createdAt`),
    UNIQUE INDEX `billing_snapshots_subscriptionId_periodStart_periodEnd_key`(`subscriptionId`, `periodStart`, `periodEnd`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `tenant_wallets` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `tenantId` BIGINT UNSIGNED NOT NULL,
    `balance` DECIMAL(10, 2) NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,

    UNIQUE INDEX `tenant_wallets_tenantId_key`(`tenantId`),
    INDEX `tenant_wallets_deletedAt_idx`(`deletedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `payments` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `tenantId` BIGINT UNSIGNED NOT NULL,
    `invoiceId` BIGINT UNSIGNED NULL,
    `amount` DECIMAL(10, 2) NOT NULL,
    `method` ENUM('CASH', 'BANK_TRANSFER', 'MPESA', 'EMOLA', 'CARD', 'OTHER') NOT NULL,
    `status` ENUM('pendente', 'confirmado', 'falhado', 'cancelado') NOT NULL DEFAULT 'pendente',
    `reference` VARCHAR(191) NOT NULL,
    `proofUrl` TEXT NULL,
    `coversFrom` DATETIME(3) NULL,
    `coversTo` DATETIME(3) NULL,
    `confirmedAt` DATETIME(3) NULL,
    `confirmedBy` BIGINT UNSIGNED NULL,
    `createdBy` BIGINT UNSIGNED NULL,
    `updatedBy` BIGINT UNSIGNED NULL,
    `notes` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,

    INDEX `payments_tenantId_createdAt_idx`(`tenantId`, `createdAt`),
    INDEX `payments_tenantId_status_createdAt_idx`(`tenantId`, `status`, `createdAt`),
    INDEX `payments_tenantId_confirmedAt_idx`(`tenantId`, `confirmedAt`),
    INDEX `payments_tenantId_invoiceId_status_idx`(`tenantId`, `invoiceId`, `status`),
    INDEX `payments_invoiceId_idx`(`invoiceId`),
    INDEX `payments_status_idx`(`status`),
    INDEX `payments_deletedAt_idx`(`deletedAt`),
    UNIQUE INDEX `payments_tenantId_reference_key`(`tenantId`, `reference`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `payment_webhooks` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `provider` VARCHAR(191) NOT NULL,
    `eventType` VARCHAR(191) NOT NULL,
    `providerEventId` VARCHAR(191) NULL,
    `reference` VARCHAR(191) NULL,
    `payload` JSON NOT NULL,
    `processed` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `deletedAt` DATETIME(3) NULL,

    UNIQUE INDEX `payment_webhooks_providerEventId_key`(`providerEventId`),
    INDEX `payment_webhooks_provider_processed_idx`(`provider`, `processed`),
    INDEX `payment_webhooks_reference_idx`(`reference`),
    INDEX `payment_webhooks_deletedAt_idx`(`deletedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `job_queue` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `tenantId` BIGINT UNSIGNED NULL,
    `type` VARCHAR(128) NOT NULL,
    `payload` JSON NOT NULL,
    `idempotencyKey` VARCHAR(128) NULL,
    `status` ENUM('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'CANCELLED') NOT NULL DEFAULT 'PENDING',
    `priority` INTEGER NOT NULL DEFAULT 0,
    `retries` INTEGER NOT NULL DEFAULT 0,
    `maxRetries` INTEGER NOT NULL DEFAULT 5,
    `runAt` DATETIME(3) NULL,
    `processedAt` DATETIME(3) NULL,
    `lockedAt` DATETIME(3) NULL,
    `lockedBy` VARCHAR(64) NULL,
    `lastError` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,

    INDEX `job_queue_status_runAt_idx`(`status`, `runAt`),
    INDEX `job_queue_status_priority_runAt_idx`(`status`, `priority`, `runAt`),
    INDEX `job_queue_tenantId_status_idx`(`tenantId`, `status`),
    INDEX `job_queue_tenantId_status_runAt_idx`(`tenantId`, `status`, `runAt`),
    INDEX `job_queue_type_status_idx`(`type`, `status`),
    INDEX `job_queue_lockedAt_idx`(`lockedAt`),
    INDEX `job_queue_deletedAt_idx`(`deletedAt`),
    UNIQUE INDEX `job_queue_tenantId_idempotencyKey_key`(`tenantId`, `idempotencyKey`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `wallet_transactions` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `tenantId` BIGINT UNSIGNED NOT NULL,
    `invoiceId` BIGINT UNSIGNED NULL,
    `paymentId` BIGINT UNSIGNED NULL,
    `type` ENUM('CREDIT', 'DEBIT') NOT NULL,
    `amount` DECIMAL(10, 2) NOT NULL,
    `balanceAfter` DECIMAL(10, 2) NOT NULL,
    `description` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `deletedAt` DATETIME(3) NULL,

    INDEX `wallet_transactions_tenantId_createdAt_idx`(`tenantId`, `createdAt`),
    INDEX `wallet_transactions_invoiceId_idx`(`invoiceId`),
    INDEX `wallet_transactions_paymentId_idx`(`paymentId`),
    INDEX `wallet_transactions_deletedAt_idx`(`deletedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `audit_logs` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `tenantId` BIGINT UNSIGNED NULL,
    `userId` BIGINT UNSIGNED NULL,
    `branchId` BIGINT UNSIGNED NULL,
    `action` VARCHAR(191) NOT NULL,
    `entity` VARCHAR(191) NOT NULL,
    `entityId` VARCHAR(191) NULL,
    `data` JSON NULL,
    `oldData` JSON NULL,
    `newData` JSON NULL,
    `requestId` VARCHAR(64) NULL,
    `userAgent` TEXT NULL,
    `method` VARCHAR(16) NULL,
    `path` VARCHAR(255) NULL,
    `ip` VARCHAR(45) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `audit_logs_tenantId_createdAt_idx`(`tenantId`, `createdAt`),
    INDEX `audit_logs_userId_createdAt_idx`(`userId`, `createdAt`),
    INDEX `audit_logs_requestId_idx`(`requestId`),
    INDEX `audit_logs_entity_entityId_idx`(`entity`, `entityId`),
    INDEX `audit_logs_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `user_sessions` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `userId` BIGINT UNSIGNED NOT NULL,
    `deviceId` BIGINT UNSIGNED NULL,
    `tokenHash` VARCHAR(255) NOT NULL,
    `refreshTokenHash` VARCHAR(255) NULL,
    `expiresAt` DATETIME(3) NOT NULL,
    `revokedAt` DATETIME(3) NULL,
    `revokedReason` VARCHAR(255) NULL,
    `lastActivityAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `ip` VARCHAR(45) NULL,
    `userAgent` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `deletedAt` DATETIME(3) NULL,

    INDEX `user_sessions_userId_expiresAt_idx`(`userId`, `expiresAt`),
    INDEX `user_sessions_deviceId_idx`(`deviceId`),
    INDEX `user_sessions_tokenHash_idx`(`tokenHash`),
    INDEX `user_sessions_expiresAt_idx`(`expiresAt`),
    INDEX `user_sessions_lastActivityAt_idx`(`lastActivityAt`),
    INDEX `user_sessions_deletedAt_idx`(`deletedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `login_attempts` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `email` VARCHAR(191) NOT NULL,
    `ip` VARCHAR(45) NULL,
    `userAgent` TEXT NULL,
    `success` BOOLEAN NOT NULL DEFAULT false,
    `userId` BIGINT UNSIGNED NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `login_attempts_email_createdAt_idx`(`email`, `createdAt`),
    INDEX `login_attempts_ip_createdAt_idx`(`ip`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `permissions` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `code` VARCHAR(128) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `deletedAt` DATETIME(3) NULL,

    UNIQUE INDEX `permissions_code_key`(`code`),
    INDEX `permissions_deletedAt_idx`(`deletedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `role_permissions` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `permissionId` INTEGER NOT NULL,
    `role` ENUM('superadmin', 'admin', 'usuario') NOT NULL,

    UNIQUE INDEX `role_permissions_permissionId_role_key`(`permissionId`, `role`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `user_permissions` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `userId` BIGINT UNSIGNED NOT NULL,
    `permissionId` INTEGER NOT NULL,
    `tenantId` BIGINT UNSIGNED NULL,
    `allowed` BOOLEAN NOT NULL DEFAULT true,
    `deletedAt` DATETIME(3) NULL,

    INDEX `user_permissions_deletedAt_idx`(`deletedAt`),
    UNIQUE INDEX `user_permissions_userId_permissionId_tenantId_key`(`userId`, `permissionId`, `tenantId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `user_tenants` ADD CONSTRAINT `user_tenants_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `user_tenants` ADD CONSTRAINT `user_tenants_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tenants` ADD CONSTRAINT `tenants_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tenants` ADD CONSTRAINT `tenants_createdBy_fkey` FOREIGN KEY (`createdBy`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tenants` ADD CONSTRAINT `tenants_updatedBy_fkey` FOREIGN KEY (`updatedBy`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tenant_settings` ADD CONSTRAINT `tenant_settings_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `branches` ADD CONSTRAINT `branches_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `branches` ADD CONSTRAINT `branches_createdBy_fkey` FOREIGN KEY (`createdBy`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `branches` ADD CONSTRAINT `branches_updatedBy_fkey` FOREIGN KEY (`updatedBy`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `devices` ADD CONSTRAINT `devices_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `devices` ADD CONSTRAINT `devices_branchId_fkey` FOREIGN KEY (`branchId`) REFERENCES `branches`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sync_logs` ADD CONSTRAINT `sync_logs_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sync_logs` ADD CONSTRAINT `sync_logs_branchId_fkey` FOREIGN KEY (`branchId`) REFERENCES `branches`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sync_logs` ADD CONSTRAINT `sync_logs_deviceId_fkey` FOREIGN KEY (`deviceId`) REFERENCES `devices`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sync_sessions` ADD CONSTRAINT `sync_sessions_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sync_sessions` ADD CONSTRAINT `sync_sessions_branchId_fkey` FOREIGN KEY (`branchId`) REFERENCES `branches`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sync_sessions` ADD CONSTRAINT `sync_sessions_deviceId_fkey` FOREIGN KEY (`deviceId`) REFERENCES `devices`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `subscriptions` ADD CONSTRAINT `subscriptions_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `subscriptions` ADD CONSTRAINT `subscriptions_planId_fkey` FOREIGN KEY (`planId`) REFERENCES `plans`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `subscriptions` ADD CONSTRAINT `subscriptions_createdBy_fkey` FOREIGN KEY (`createdBy`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `subscriptions` ADD CONSTRAINT `subscriptions_updatedBy_fkey` FOREIGN KEY (`updatedBy`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `invoice_fiscal_counters` ADD CONSTRAINT `invoice_fiscal_counters_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `invoices` ADD CONSTRAINT `invoices_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `invoices` ADD CONSTRAINT `invoices_subscriptionId_fkey` FOREIGN KEY (`subscriptionId`) REFERENCES `subscriptions`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `invoices` ADD CONSTRAINT `invoices_billingSnapshotId_fkey` FOREIGN KEY (`billingSnapshotId`) REFERENCES `billing_snapshots`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `billing_snapshots` ADD CONSTRAINT `billing_snapshots_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `billing_snapshots` ADD CONSTRAINT `billing_snapshots_subscriptionId_fkey` FOREIGN KEY (`subscriptionId`) REFERENCES `subscriptions`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tenant_wallets` ADD CONSTRAINT `tenant_wallets_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payments` ADD CONSTRAINT `payments_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payments` ADD CONSTRAINT `payments_invoiceId_fkey` FOREIGN KEY (`invoiceId`) REFERENCES `invoices`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payments` ADD CONSTRAINT `payments_confirmedBy_fkey` FOREIGN KEY (`confirmedBy`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payments` ADD CONSTRAINT `payments_createdBy_fkey` FOREIGN KEY (`createdBy`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payments` ADD CONSTRAINT `payments_updatedBy_fkey` FOREIGN KEY (`updatedBy`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `job_queue` ADD CONSTRAINT `job_queue_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `wallet_transactions` ADD CONSTRAINT `wallet_transactions_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `wallet_transactions` ADD CONSTRAINT `wallet_transactions_invoiceId_fkey` FOREIGN KEY (`invoiceId`) REFERENCES `invoices`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `wallet_transactions` ADD CONSTRAINT `wallet_transactions_paymentId_fkey` FOREIGN KEY (`paymentId`) REFERENCES `payments`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `audit_logs` ADD CONSTRAINT `audit_logs_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `audit_logs` ADD CONSTRAINT `audit_logs_branchId_fkey` FOREIGN KEY (`branchId`) REFERENCES `branches`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `audit_logs` ADD CONSTRAINT `audit_logs_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `user_sessions` ADD CONSTRAINT `user_sessions_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `user_sessions` ADD CONSTRAINT `user_sessions_deviceId_fkey` FOREIGN KEY (`deviceId`) REFERENCES `devices`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `login_attempts` ADD CONSTRAINT `login_attempts_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `role_permissions` ADD CONSTRAINT `role_permissions_permissionId_fkey` FOREIGN KEY (`permissionId`) REFERENCES `permissions`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `user_permissions` ADD CONSTRAINT `user_permissions_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `user_permissions` ADD CONSTRAINT `user_permissions_permissionId_fkey` FOREIGN KEY (`permissionId`) REFERENCES `permissions`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
