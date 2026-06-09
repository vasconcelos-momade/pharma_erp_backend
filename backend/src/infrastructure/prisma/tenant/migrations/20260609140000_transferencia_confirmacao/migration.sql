-- AlterTable
ALTER TABLE `transferencias`
  ADD COLUMN `confirmedAt` DATETIME(3) NULL,
  ADD COLUMN `confirmedById` BIGINT UNSIGNED NULL;

-- AddForeignKey
ALTER TABLE `transferencias`
  ADD CONSTRAINT `transferencias_confirmedById_fkey`
  FOREIGN KEY (`confirmedById`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
