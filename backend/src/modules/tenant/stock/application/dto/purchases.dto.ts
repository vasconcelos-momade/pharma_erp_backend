import { z } from "zod";

export const createPendingPurchaseSchema = z.object({
  fornecedorId: z.string().trim().min(1, "Fornecedor é obrigatório"),
  numeroDocumento: z.string().trim().min(1, "Número do documento é obrigatório"),
});

export type CreatePendingPurchaseDTO = z.infer<typeof createPendingPurchaseSchema>;

export const addPurchaseItemSchema = z.object({
  produtoId: z.string().trim().min(1, "Produto é obrigatório"),
  numeroLote: z.string().trim().min(1, "Número do lote é obrigatório"),
  dataValidade: z.string().trim().min(1, "Data de validade é obrigatória"),
  quantidade: z.coerce.number().positive("Quantidade deve ser maior que zero"),
  precoCompra: z.coerce.number().nonnegative("Preço de compra inválido"),
  precoVenda: z.coerce.number().nonnegative("Preço de venda inválido").optional(),
});

export type AddPurchaseItemDTO = z.infer<typeof addPurchaseItemSchema>;
