import { z } from "zod";

export const cashflowOrigemSchema = z.enum([
  "PAGAMENTO",
  "PEDIDO",
  "COMPRA",
  "SANGRIA",
  "REFORCO",
  "OUTRO",
]);

export const cashflowOperationBodySchema = z.object({
  valor: z.coerce.number().positive("Valor deve ser maior que zero"),
  origem: cashflowOrigemSchema,
  descricao: z.string().trim().max(500).optional(),
  idempotencyKey: z.string().trim().min(8).max(120).optional(),
});

export const cashflowMovementsQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  pageSize: z.coerce.number().int().positive().max(100).optional(),
  period: z.string().trim().optional(),
  days: z.coerce.number().int().positive().max(366).optional(),
  from: z.string().trim().optional(),
  to: z.string().trim().optional(),
  search: z.string().trim().optional(),
  sortBy: z.enum(["createdAt", "data", "tipo", "valor", "saldoAnterior", "saldoFinal"]).optional(),
  sortDir: z.enum(["asc", "desc"]).optional(),
});

export type CashflowOperationBody = z.infer<typeof cashflowOperationBodySchema>;
export type CashflowOrigem = z.infer<typeof cashflowOrigemSchema>;
export type CashflowMovementsQuery = z.infer<typeof cashflowMovementsQuerySchema>;
