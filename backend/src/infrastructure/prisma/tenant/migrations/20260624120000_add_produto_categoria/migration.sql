-- Categorização simples de produtos (backward compatible: default MEDICAMENTO).
ALTER TABLE `produtos`
  ADD COLUMN `categoria` ENUM(
    'MEDICAMENTO',
    'CONSUMIVEL',
    'EQUIPAMENTO',
    'HIGIENE',
    'SUPLEMENTO',
    'OUTRO'
  ) NOT NULL DEFAULT 'MEDICAMENTO';
