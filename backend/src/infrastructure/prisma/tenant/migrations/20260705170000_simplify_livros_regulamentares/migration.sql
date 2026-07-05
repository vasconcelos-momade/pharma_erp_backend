-- LivroReceita: registo regulamentar mínimo (dados via Dispensacao + Receita)
-- LivroPsicotropico: remove campos duplicados de stock/produto

DELETE FROM `livro_receitas` WHERE `dispensacaoId` IS NULL;

ALTER TABLE `receitas`
  ADD COLUMN `origemReceita` ENUM('FISICA', 'DIGITAL', 'SISTEMA_INTERNO') NOT NULL DEFAULT 'FISICA';

UPDATE `receitas` r
JOIN (
  SELECT
    `receitaId`,
    CASE
      WHEN SUM(`origemReceita` = 'DIGITAL') > 0 THEN 'DIGITAL'
      WHEN SUM(`origemReceita` = 'SISTEMA_INTERNO') > 0 THEN 'SISTEMA_INTERNO'
      ELSE 'FISICA'
    END AS `origem`
  FROM `livro_receitas`
  GROUP BY `receitaId`
) lr ON lr.`receitaId` = r.`id`
SET r.`origemReceita` = lr.`origem`;

ALTER TABLE `livro_receitas`
  DROP FOREIGN KEY `livro_receitas_clienteId_fkey`,
  DROP FOREIGN KEY `livro_receitas_produtoId_fkey`,
  DROP FOREIGN KEY `livro_receitas_loteId_fkey`,
  DROP FOREIGN KEY `livro_receitas_faturaId_fkey`,
  DROP FOREIGN KEY `livro_receitas_faturaItemId_fkey`;

ALTER TABLE `livro_receitas`
  DROP INDEX `livro_receitas_idempotencyKey_key`,
  DROP INDEX `livro_receitas_clienteId_idx`,
  DROP INDEX `livro_receitas_produtoId_idx`,
  DROP COLUMN `clienteId`,
  DROP COLUMN `faturaId`,
  DROP COLUMN `faturaItemId`,
  DROP COLUMN `produtoId`,
  DROP COLUMN `loteId`,
  DROP COLUMN `tipoMovimento`,
  DROP COLUMN `quantidade`,
  DROP COLUMN `saldoAnterior`,
  DROP COLUMN `saldoAtual`,
  DROP COLUMN `medicoNome`,
  DROP COLUMN `numeroReceita`,
  DROP COLUMN `dataReceita`,
  DROP COLUMN `origemReceita`,
  DROP COLUMN `idempotencyKey`,
  DROP COLUMN `observacoes`,
  DROP COLUMN `updatedAt`,
  DROP COLUMN `version`;

ALTER TABLE `livro_receitas`
  DROP FOREIGN KEY `livro_receitas_dispensacaoId_fkey`;

ALTER TABLE `livro_receitas`
  MODIFY `dispensacaoId` BIGINT UNSIGNED NOT NULL;

ALTER TABLE `livro_receitas`
  ADD CONSTRAINT `livro_receitas_dispensacaoId_fkey`
    FOREIGN KEY (`dispensacaoId`) REFERENCES `dispensacoes` (`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `livro_psicotropicos`
  DROP FOREIGN KEY `livro_psicotropicos_produtoId_fkey`,
  DROP FOREIGN KEY `livro_psicotropicos_loteId_fkey`;

ALTER TABLE `livro_psicotropicos`
  DROP COLUMN `produtoId`,
  DROP COLUMN `loteId`,
  DROP COLUMN `quantidade`,
  DROP COLUMN `saldoAnterior`,
  DROP COLUMN `saldoAtual`;
