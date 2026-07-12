import { z } from "zod";

const optionalIdSchema = z
  .string()
  .trim()
  .regex(/^\d+$/, "Identificador inválido")
  .optional();

const optionalStringSchema = z
  .string()
  .trim()
  .min(1)
  .optional()
  .transform((value) => {
    const normalized = value?.trim();
    return normalized && normalized.length > 0 ? normalized : undefined;
  });

export const searchLotesQuerySchema = z.object({
  q: optionalStringSchema,
  produtoId: optionalIdSchema,
  fornecedorId: optionalIdSchema,
  estadoSanitario: z
    .enum(["VALIDO", "RECALL", "EXPIRADO", "QUARENTENA", "BLOQUEADO"])
    .optional(),
  disponibilidade: z
    .enum(["DISPONIVEL", "RESERVADO", "BLOQUEADO", "INDISPONIVEL"])
    .optional(),
  validadeAte: optionalStringSchema,
  validadeDe: optionalStringSchema,
  expirado: z.coerce.boolean().optional(),
  page: z.coerce.number().int().positive().optional(),
  pageSize: z.coerce.number().int().positive().max(100).optional(),
  sortBy: z.enum(["dataValidade", "numeroLote", "quantidadeAtual", "createdAt"]).optional(),
  sortOrder: z.enum(["asc", "desc"]).optional(),
});

export const loteIdParamSchema = z.object({
  loteId: z.string().trim().regex(/^\d+$/, "loteId inválido"),
});

export const searchValidadesQuerySchema = z.object({
  q: optionalStringSchema,
  produtoId: optionalIdSchema,
  fornecedorId: optionalIdSchema,
  bucket: z.enum(["expirado", "30", "60", "todos"]).optional(),
  page: z.coerce.number().int().positive().optional(),
  pageSize: z.coerce.number().int().positive().max(100).optional(),
});

export const searchFefoAuditQuerySchema = z.object({
  q: optionalStringSchema,
  produtoId: optionalIdSchema,
  situacao: z.enum(["CONFORME", "VIOLACAO", "EXPIRADO", "QUARENTENA"]).optional(),
  page: z.coerce.number().int().positive().optional(),
  pageSize: z.coerce.number().int().positive().max(100).optional(),
});

export const listProductPriceHistoryQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  pageSize: z.coerce.number().int().positive().max(100).optional(),
});

export const moveLoteQuarentenaBodySchema = z.object({
  quantidade: z.coerce.number().positive(),
  motivo: z.string().trim().min(3, "Motivo obrigatório"),
  documentoReferencia: optionalStringSchema,
});

export const revertLoteQuarentenaBodySchema = z.object({
  quantidade: z.coerce.number().positive().optional(),
  motivo: z.string().trim().min(3, "Motivo obrigatório"),
  documentoReferencia: optionalStringSchema,
});

export const updateLotePrecosBodySchema = z.object({
  precoCompra: z.coerce.number().nonnegative("Preço de compra inválido"),
  precoVenda: z.coerce.number().nonnegative("Preço de venda inválido").nullable().optional(),
  motivo: optionalStringSchema,
});

export const updateLoteBodySchema = z.object({
  numeroLote: z.string().trim().min(1).optional(),
  dataValidade: z.string().trim().min(1).optional(),
  dataFabricacao: z.string().trim().optional().nullable(),
});

export const createLoteSchema = z.object({
  produtoId: z.string().trim().min(1, "Produto é obrigatório"),
  fornecedorId: z.string().trim().min(1, "Fornecedor é obrigatório"),
  numeroLote: z.string().trim().min(1, "Número do lote é obrigatório"),
  dataValidade: z.coerce.date(),
  quantidadeInicial: z.coerce.number().positive("Quantidade inicial inválida"),
  precoCompra: z.coerce.number().nonnegative("Preço de compra inválido"),
  precoVenda: z.coerce.number().positive("Preço de venda inválido"),
});

export const searchStockProdutosQuerySchema = z.object({
  q: z.string().trim().min(1).optional(),
  barcode: z.string().trim().min(1).optional(),
  categoriaId: z.string().trim().regex(/^\d+$/).optional(),
  page: z.coerce.number().int().positive().optional(),
  pageSize: z.coerce.number().int().positive().max(100).optional(),
});

export type CreateLoteDTO = z.infer<typeof createLoteSchema>;

export const loteMovimentacaoSanitariaBodySchema = z.object({
  tipo: z.enum([
    "QUARENTENA",
    "LIBERACAO",
    "INCINERACAO",
    "RECALL",
    "DEVOLUCAO_FORNECEDOR",
  ]),
  quantidade: z.coerce.number().positive().optional(),
  motivo: z.string().trim().min(3, "Motivo obrigatório"),
  documentoReferencia: optionalStringSchema,
});
