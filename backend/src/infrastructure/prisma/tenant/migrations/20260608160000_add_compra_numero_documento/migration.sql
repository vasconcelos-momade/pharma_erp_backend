-- AlterTable
ALTER TABLE `compras` ADD COLUMN `numeroDocumento` VARCHAR(100) NULL AFTER `id`;

-- Backfill existing rows
UPDATE `compras` SET `numeroDocumento` = CONCAT('DOC-', `id`) WHERE `numeroDocumento` IS NULL;

-- Make column required
ALTER TABLE `compras` MODIFY COLUMN `numeroDocumento` VARCHAR(100) NOT NULL;

-- CreateIndex
CREATE INDEX `compras_numeroDocumento_idx` ON `compras`(`numeroDocumento`);
