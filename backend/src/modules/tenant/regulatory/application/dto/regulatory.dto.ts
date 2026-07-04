import { z } from "zod";

const sortDirSchema = z.enum(["asc", "desc"]).optional();

export const numericIdParam = (field: string) =>
  z.object({
    [field]: z.string().regex(/^\d+$/, `${field} inválido`),
  });

export const receitaIdParamSchema = numericIdParam("receitaId");
export const livroReceitaIdParamSchema = numericIdParam("entryId");
export const livroPsicotropicoIdParamSchema = numericIdParam("entryId");
export const loteIdParamSchema = numericIdParam("loteId");

export const createReceitaSchema = z.object({
  clienteId: z.string().trim().regex(/^\d+$/, "clienteId inválido"),
  medicoNome: z.string().trim().min(1).max(191).optional().nullable(),
  numeroReceita: z.string().trim().min(1).max(191).optional().nullable(),
  unidadeSanitaria: z.string().trim().min(1).max(191).optional().nullable(),
  dataReceita: z.string().trim().min(1, "dataReceita é obrigatória"),
  observacoes: z.string().trim().max(2000).optional().nullable(),
});

export const updateReceitaSchema = createReceitaSchema.partial().refine(
  (data: Record<string, unknown>) => Object.keys(data).length > 0,
  "Informe ao menos um campo para atualização",
);

export const receitasDashboardQuerySchema = z.object({
  from: z.string().optional(),
  to: z.string().optional(),
  clienteId: z.string().trim().regex(/^\d+$/, "clienteId inválido").optional(),
  search: z.string().trim().max(200).optional(),
});

export const listReceitasQuerySchema = z.object({
  search: z.string().trim().max(200).optional(),
  clienteId: z.string().trim().regex(/^\d+$/, "clienteId inválido").optional(),
  status: z.enum(["EMITIDA", "UTILIZADA", "PENDENTE", "EXPIRADA"]).optional(),
  origem: z.enum(["FISICA", "DIGITAL", "SISTEMA_INTERNO"]).optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  sortBy: z
    .enum(["dataReceita", "createdAt", "numeroReceita", "clienteNome"])
    .optional(),
  sortDir: sortDirSchema,
  page: z.coerce.number().int().positive().optional(),
  pageSize: z.coerce.number().int().positive().max(100).optional(),
});

export const listLivroReceitasQuerySchema = z.object({
  search: z.string().trim().max(200).optional(),
  clienteId: z.string().trim().regex(/^\d+$/, "clienteId inválido").optional(),
  produtoId: z.string().trim().regex(/^\d+$/, "produtoId inválido").optional(),
  responsavelId: z.string().trim().regex(/^\d+$/, "responsavelId inválido").optional(),
  origem: z.enum(["FISICA", "DIGITAL", "SISTEMA_INTERNO"]).optional(),
  tipoMovimento: z.enum(["ENTRADA", "SAIDA", "CANCELAMENTO", "AJUSTE"]).optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  sortBy: z
    .enum(["createdAt", "dataReceita", "numeroReceita", "produtoNomeComercial", "clienteNome"])
    .optional(),
  sortDir: sortDirSchema,
  page: z.coerce.number().int().positive().optional(),
  pageSize: z.coerce.number().int().positive().max(100).optional(),
});

export const listLivroPsicotropicosQuerySchema = z.object({
  search: z.string().trim().max(200).optional(),
  produtoId: z.string().trim().regex(/^\d+$/, "produtoId inválido").optional(),
  responsavelId: z.string().trim().regex(/^\d+$/, "responsavelId inválido").optional(),
  tipoMovimento: z.enum(["ENTRADA", "SAIDA", "IMPORTACAO"]).optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  sortBy: z
    .enum(["createdAt", "numeroDocumento", "produtoNomeComercial", "quantidade"])
    .optional(),
  sortDir: sortDirSchema,
  page: z.coerce.number().int().positive().optional(),
  pageSize: z.coerce.number().int().positive().max(100).optional(),
});

export const sanitarioDashboardQuerySchema = z.object({
  search: z.string().trim().max(200).optional(),
  from: z.string().optional(),
  to: z.string().optional(),
});

export const listSanitarioQuerySchema = z.object({
  search: z.string().trim().max(200).optional(),
  estado: z
    .enum(["VALIDO", "EXPIRADO", "RECALL", "QUARENTENA", "BLOQUEADO", "CRITICO"])
    .optional(),
  alertaTipo: z
    .enum([
      "ESTOQUE_BAIXO",
      "PRODUTO_ESGOTADO",
      "LOTE_EXPIRADO",
      "LOTE_A_EXPIRAR",
      "PRECO_SUBIU",
      "SEM_FORNECEDOR",
    ])
    .optional(),
  produtoId: z.string().trim().regex(/^\d+$/, "produtoId inválido").optional(),
  sortBy: z
    .enum(["dataValidade", "produtoNomeComercial", "quantidadeAtual", "estadoSanitario"])
    .optional(),
  sortDir: sortDirSchema,
  page: z.coerce.number().int().positive().optional(),
  pageSize: z.coerce.number().int().positive().max(100).optional(),
});

export const listSanitarioReportsQuerySchema = z.object({
  tipo: z
    .enum([
      "MAPA_MENSAL_PSICOTROPICOS",
      "MAPA_MENSAL_NARCOTICOS",
      "RELATORIO_EXPIRADOS",
      "RELATORIO_QUARENTENA",
      "RELATORIO_INCINERACAO",
      "BALANCO_ESTOQUE_ANUAL",
    ])
    .optional(),
  page: z.coerce.number().int().positive().optional(),
  pageSize: z.coerce.number().int().positive().max(100).optional(),
});
