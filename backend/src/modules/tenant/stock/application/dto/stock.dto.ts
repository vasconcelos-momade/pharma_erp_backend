import { z } from "zod";

const optionalStringSchema = z
  .string()
  .trim()
  .min(1)
  .optional()
  .transform((value: string | undefined) => {
    const normalized = value?.trim();
    return normalized && normalized.length > 0 ? normalized : undefined;
  });

const stockMovementTypeSchema = z.enum([
  "ENTRADA",
  "COMPRA",
  "SAIDA",
  "AJUSTE",
  "DEVOLUCAO",
  "QUARENTENA",
  "INCINERACAO",
]);

export const listStockMovementsQuerySchema = z
  .object({
    q: optionalStringSchema,
    tipo: stockMovementTypeSchema.optional(),
    origem: optionalStringSchema,
    produtoId: z.string().trim().regex(/^\d+$/).optional(),
    loteId: z.string().trim().regex(/^\d+$/).optional(),
    dataInicio: optionalStringSchema,
    dataFim: optionalStringSchema,
    page: z.coerce.number().int().positive().optional(),
    pageSize: z.coerce.number().int().positive().max(100).optional(),
  })
  .superRefine((data: any, ctx: any) => {
    const parseDate = (value?: string) => {
      if (!value) {
        return null;
      }
      return Number.isNaN(Date.parse(value)) ? null : new Date(value);
    };

    const start = parseDate(data.dataInicio);
    const end = parseDate(data.dataFim);

    if (data.dataInicio && !start) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["dataInicio"],
        message: "Data inicial invalida",
      });
    }

    if (data.dataFim && !end) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["dataFim"],
        message: "Data final invalida",
      });
    }

    if (start && end && start.getTime() > end.getTime()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["dataFim"],
        message: "Data final deve ser maior ou igual a data inicial",
      });
    }
  });
