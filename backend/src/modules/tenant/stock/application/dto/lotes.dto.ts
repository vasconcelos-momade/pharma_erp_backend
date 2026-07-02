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
