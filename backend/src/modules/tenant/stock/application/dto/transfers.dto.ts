import { z } from "zod";

export const createTransferSchema = z.object({
  numeroDocumento: z
    .string()
    .trim()
    .min(1, "Número do documento é obrigatório"),
  origem: z.string().trim().min(1, "Origem é obrigatória"),
  destino: z.string().trim().min(1, "Destino é obrigatório"),
  tipo: z.enum(["SAIDA", "ENTRADA"]).optional(),
  observacao: z.string().trim().max(2000).optional(),
});

export type CreateTransferDTO = z.infer<typeof createTransferSchema>;

export const addTransferItemSchema = z.object({
  produtoId: z.string().trim().min(1, "Produto é obrigatório"),
  loteId: z.string().trim().min(1).optional(),
  quantidade: z.coerce.number().positive("Quantidade deve ser maior que zero"),
});

export type AddTransferItemDTO = z.infer<typeof addTransferItemSchema>;

export const updateTransferItemSchema = z.object({
  quantidade: z.coerce.number().positive("Quantidade deve ser maior que zero"),
});

export type UpdateTransferItemDTO = z.infer<typeof updateTransferItemSchema>;

export const listTransfersQuerySchema = z.object({
  status: z.enum(["RASCUNHO", "CONFIRMADA", "CANCELADA"]).optional(),
  origem: z.string().trim().min(1).optional(),
  destino: z.string().trim().min(1).optional(),
});

export type ListTransfersQueryDTO = z.infer<typeof listTransfersQuerySchema>;
