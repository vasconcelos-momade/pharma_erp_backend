ALTER TABLE `cotacoes`
  ADD COLUMN `nuit` VARCHAR(50) NULL AFTER `clienteId`,
  ADD COLUMN `contacto` VARCHAR(50) NULL AFTER `nuit`;
