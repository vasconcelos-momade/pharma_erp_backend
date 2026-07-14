-- Campos em falta no schema regulatório/POS
ALTER TABLE `receitas`
  ADD COLUMN `unidadeSanitaria` VARCHAR(191) NULL AFTER `numeroReceita`;

ALTER TABLE `clientes`
  ADD COLUMN `endereco` VARCHAR(191) NULL AFTER `telefone`;

-- Índices de produto_regulacao (consultas POS/compliance)
CREATE INDEX `produto_regulacao_requiresPrescription_idx` ON `produto_regulacao`(`requiresPrescription`);
CREATE INDEX `produto_regulacao_requiresPsychotropicBook_idx` ON `produto_regulacao`(`requiresPsychotropicBook`);
