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

export const searchEstoqueQuerySchema = z.object({
  q: optionalStringSchema,
  categoriaId: optionalIdSchema,
  fornecedorId: optionalIdSchema,
  estadoSanitario: z
    .enum(["VALIDO", "RECALL", "EXPIRADO", "QUARENTENA", "BLOQUEADO"])
    .optional(),
  disponibilidade: z
    .enum(["DISPONIVEL", "RESERVADO", "BLOQUEADO", "INDISPONIVEL"])
    .optional(),
  semStock: z.coerce.boolean().optional(),
  aExpirar: z.coerce.boolean().optional(),
  expirado: z.coerce.boolean().optional(),
  validadeAte: optionalStringSchema,
  validadeDe: optionalStringSchema,
  page: z.coerce.number().int().positive().optional(),
  pageSize: z.coerce.number().int().positive().max(100).optional(),
  sortBy: z
    .enum(["dataValidade", "numeroLote", "quantidadeAtual", "createdAt", "updatedAt"])
    .optional(),
  sortOrder: z.enum(["asc", "desc"]).optional(),
});
