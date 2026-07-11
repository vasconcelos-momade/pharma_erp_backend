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
  quantidadeSugerida: z.coerce.number().nonnegative("Quantidade sugerida inválida").optional(),
  quantidadeAprovada: z.coerce.number().nonnegative("Quantidade aprovada inválida"),
  precoCompra: z.coerce.number().nonnegative("Preço de compra inválido"),
  precoVenda: z.coerce.number().nonnegative("Preço de venda inválido").optional(),
});

export type AddPurchaseItemDTO = z.infer<typeof addPurchaseItemSchema>;

export const createPurchasesFromSuggestionsSchema = z.object({
  items: z
    .array(
      z.object({
        produtoId: z.string().trim().min(1),
        quantidadeSugerida: z.coerce.number().nonnegative(),
        quantidadeAprovada: z.coerce.number().nonnegative(),
        fornecedorId: z.string().trim().min(1).optional(),
      }),
    )
    .min(1, "Selecione pelo menos um produto"),
});

export type CreatePurchasesFromSuggestionsDTO = z.infer<
  typeof createPurchasesFromSuggestionsSchema
>;
