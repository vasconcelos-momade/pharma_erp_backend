import { z } from "zod";
import { queryBooleanSchema } from "../../../../../shared/http/zod-query";

export const categoriaIdSchema = z
  .string()
  .trim()
  .regex(/^\d+$/, "categoriaId inválido");

const ativoSchema = queryBooleanSchema;

const tipoDispensacaoCreateSchema = z.enum([
  "VENDA_LIVRE",
  "RECEITA_NORMAL",
  "RECEITA_ESPECIAL",
]);

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
  tipoDispensacao: tipoDispensacaoCreateSchema.optional(),
});

export const createProdutoSchema = produtoBaseSchema.extend({
  categoriaId: categoriaIdSchema,
  tipoDispensacao: tipoDispensacaoCreateSchema,
});

export const updateProdutoSchema = produtoBaseSchema.partial().refine(
  (data: Record<string, unknown>) => Object.keys(data).length > 0,
  { message: "Informe ao menos um campo para atualizar" },
);

const sortBySchema = z
  .enum(["nomeComercial", "nome", "estoqueAtual", "createdAt"])
  .optional()
  .transform((value) => (value === "nome" ? "nomeComercial" : value));

const sortOrderSchema = z.enum(["asc", "desc"]).optional();

const tipoDispensacaoSchema = tipoDispensacaoCreateSchema.optional();

export const searchProdutosQuerySchema = z.object({
  q: z.string().trim().min(1).optional(),
  barcode: z.string().trim().min(1).optional(),
  categoriaId: categoriaIdSchema.optional(),
  /** Alias legado do frontend — tratado como categoriaId */
  categoria: categoriaIdSchema.optional(),
  fornecedorId: categoriaIdSchema.optional(),
  tipoDispensacao: tipoDispensacaoSchema,
  ativo: queryBooleanSchema,
  includeInactive: queryBooleanSchema,
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
