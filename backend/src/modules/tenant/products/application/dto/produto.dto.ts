import { z } from "zod";

export enum CategoriaProduto {
  MEDICAMENTO = "MEDICAMENTO",
  CONSUMIVEL = "CONSUMIVEL",
  EQUIPAMENTO = "EQUIPAMENTO",
  HIGIENE = "HIGIENE",
  SUPLEMENTO = "SUPLEMENTO",
  OUTRO = "OUTRO",
}

export const categoriaProdutoSchema = z.nativeEnum(CategoriaProduto);
export type CategoriaProdutoValue = z.infer<typeof categoriaProdutoSchema>;

const produtoBaseSchema = z.looseObject({
  nome: z.string().trim().min(1),
  barcode: z.string().trim().min(1).optional(),
  categoria: categoriaProdutoSchema.optional(),
  substanciaActiva: z.string().trim().min(1).optional(),
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

export const searchProdutosQuerySchema = z.object({
  q: z.string().trim().min(1).optional(),
  barcode: z.string().trim().min(1).optional(),
  categoria: categoriaProdutoSchema.optional(),
  page: z.coerce.number().int().positive().optional(),
  pageSize: z.coerce.number().int().positive().max(100).optional(),
});

export const searchProdutosCategoriaQuerySchema = z.object({
  categoria: categoriaProdutoSchema.optional(),
});

export type CreateProdutoDTO = z.infer<typeof createProdutoSchema>;
export type UpdateProdutoDTO = z.infer<typeof updateProdutoSchema>;
export type SearchProdutosQueryDTO = z.infer<typeof searchProdutosQuerySchema>;
