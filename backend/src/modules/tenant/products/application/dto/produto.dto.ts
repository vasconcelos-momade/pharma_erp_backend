import { z } from "zod";

export const categoriaIdSchema = z
  .string()
  .trim()
  .regex(/^\d+$/, "categoriaId inválido");

const ativoSchema = z.coerce.boolean().optional();

const produtoBaseSchema = z.looseObject({
  nomeComercial: z.string().trim().min(1),
  barcode: z.string().trim().min(1).optional(),
  categoriaId: categoriaIdSchema.optional(),
  ativo: ativoSchema,
  activo: ativoSchema,
  nomeGenerico: z.string().trim().min(1).optional(),
  dosagem: z.string().trim().min(1).optional(),
  forma: z.string().trim().min(1).optional(),
  apresentacao: z.string().trim().min(1).optional(),
  estoqueMinimo: z.coerce.number().nonnegative().optional(),
  tipoDispensacao: z.string().trim().min(1).optional(),
  requiresManualReview: z.coerce.boolean().optional(),
});

export const createProdutoSchema = produtoBaseSchema;

export const updateProdutoSchema = produtoBaseSchema.partial().refine(
  (data: Record<string, unknown>) => Object.keys(data).length > 0,
  { message: "Informe ao menos um campo para atualizar" },
);

const sortBySchema = z
  .enum(["nomeComercial", "nome", "estoqueAtual", "createdAt"])
  .optional()
  .transform((value) => (value === "nome" ? "nomeComercial" : value));

const sortOrderSchema = z.enum(["asc", "desc"]).optional();

const tipoDispensacaoSchema = z
  .enum([
    "VENDA_LIVRE",
    "RECEITA_SIMPLES",
    "RECEITA_CONTROLADA",
    "RECEITA_OBRIGATORIA",
    "PSICOTROPICO",
    "NARCOTICO",
  ])
  .optional();

export const searchProdutosQuerySchema = z.object({
  q: z.string().trim().min(1).optional(),
  barcode: z.string().trim().min(1).optional(),
  categoriaId: categoriaIdSchema.optional(),
  /** Alias legado do frontend — tratado como categoriaId */
  categoria: categoriaIdSchema.optional(),
  fornecedorId: categoriaIdSchema.optional(),
  tipoDispensacao: tipoDispensacaoSchema,
  ativo: z.coerce.boolean().optional(),
  includeInactive: z.coerce.boolean().optional(),
  sortBy: sortBySchema,
  sortOrder: sortOrderSchema,
  page: z.coerce.number().int().positive().optional(),
  pageSize: z.coerce.number().int().positive().max(100).optional(),
});

export const searchProdutosCategoriaQuerySchema = z.object({
  categoriaId: categoriaIdSchema.optional(),
});

export const listProdutoRelatedQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  pageSize: z.coerce.number().int().positive().max(100).optional(),
});

export type CreateProdutoDTO = z.infer<typeof createProdutoSchema>;
export type UpdateProdutoDTO = z.infer<typeof updateProdutoSchema>;
export type SearchProdutosQueryDTO = z.infer<typeof searchProdutosQuerySchema>;
