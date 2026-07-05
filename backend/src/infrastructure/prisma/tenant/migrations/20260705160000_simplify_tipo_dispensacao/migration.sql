-- Simplificar TipoDispensacao: 7 valores → 3 (VENDA_LIVRE | RECEITA_NORMAL | RECEITA_ESPECIAL)

ALTER TABLE `produto_regulacao`
  MODIFY `tipoDispensacao` ENUM(
    'VENDA_LIVRE',
    'RECEITA_SIMPLES',
    'RECEITA_CONTROLADA',
    'RECEITA_OBRIGATORIA',
    'RECEITA_RETIDA',
    'PSICOTROPICO',
    'NARCOTICO',
    'RECEITA_NORMAL',
    'RECEITA_ESPECIAL'
  ) NOT NULL DEFAULT 'VENDA_LIVRE';

ALTER TABLE `dispensacoes`
  MODIFY `tipoDispensacao` ENUM(
    'VENDA_LIVRE',
    'RECEITA_SIMPLES',
    'RECEITA_CONTROLADA',
    'RECEITA_OBRIGATORIA',
    'RECEITA_RETIDA',
    'PSICOTROPICO',
    'NARCOTICO',
    'RECEITA_NORMAL',
    'RECEITA_ESPECIAL'
  ) NOT NULL;

UPDATE `produto_regulacao`
SET `tipoDispensacao` = 'RECEITA_NORMAL'
WHERE `tipoDispensacao` IN (
  'RECEITA_SIMPLES',
  'RECEITA_CONTROLADA',
  'RECEITA_OBRIGATORIA',
  'RECEITA_RETIDA'
);

UPDATE `produto_regulacao`
SET `tipoDispensacao` = 'RECEITA_ESPECIAL'
WHERE `tipoDispensacao` IN ('PSICOTROPICO', 'NARCOTICO');

UPDATE `produto_regulacao` pr
JOIN `produtos` p ON p.id = pr.produtoId
JOIN `categorias` c ON c.id = p.categoriaId
SET pr.`tipoDispensacao` = 'RECEITA_NORMAL',
    pr.`requiresPrescription` = 1,
    pr.`policyVersion` = 3
WHERE pr.`tipoDispensacao` = 'VENDA_LIVRE'
  AND (
    c.codigoFNM LIKE '%ANTIMICROBIANO%'
    OR c.nome LIKE '%ANTIMICROBIANO%'
  );

UPDATE `produto_regulacao`
SET `requiresPrescription` = CASE
      WHEN `tipoDispensacao` = 'VENDA_LIVRE' THEN 0
      ELSE 1
    END,
    `requiresPsychotropicBook` = CASE
      WHEN `tipoDispensacao` = 'RECEITA_ESPECIAL' THEN 1
      ELSE 0
    END,
    `policyVersion` = 3;

UPDATE `dispensacoes`
SET `tipoDispensacao` = 'RECEITA_NORMAL'
WHERE `tipoDispensacao` IN (
  'RECEITA_SIMPLES',
  'RECEITA_CONTROLADA',
  'RECEITA_OBRIGATORIA',
  'RECEITA_RETIDA'
);

UPDATE `dispensacoes`
SET `tipoDispensacao` = 'RECEITA_ESPECIAL'
WHERE `tipoDispensacao` IN ('PSICOTROPICO', 'NARCOTICO');

ALTER TABLE `produto_regulacao`
  MODIFY `tipoDispensacao` ENUM('VENDA_LIVRE', 'RECEITA_NORMAL', 'RECEITA_ESPECIAL') NOT NULL DEFAULT 'VENDA_LIVRE';

ALTER TABLE `dispensacoes`
  MODIFY `tipoDispensacao` ENUM('VENDA_LIVRE', 'RECEITA_NORMAL', 'RECEITA_ESPECIAL') NOT NULL;
