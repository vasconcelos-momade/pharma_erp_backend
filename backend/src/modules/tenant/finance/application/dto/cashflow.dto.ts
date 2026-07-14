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

export type CashflowOperationBody = z.infer<typeof cashflowOperationBodySchema>;
export type CashflowOrigem = z.infer<typeof cashflowOrigemSchema>;
