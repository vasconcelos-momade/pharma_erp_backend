import { z } from "zod";

export const openInventorySchema = z.object({
  observacao: z.string().trim().max(2000).optional(),
});

export type OpenInventoryDTO = z.infer<typeof openInventorySchema>;

export const recordInventoryCountSchema = z.object({
  estoqueContado: z.coerce.number().nonnegative("Quantidade contada inválida"),
});

export type RecordInventoryCountDTO = z.infer<typeof recordInventoryCountSchema>;

export const listInventoryItemsQuerySchema = z.object({
  q: z.string().trim().min(1).optional(),
  page: z.coerce.number().int().positive().optional(),
  pageSize: z.coerce.number().int().positive().max(100).optional(),
  nomeGenerico: z.string().trim().min(1).optional(),
  forma: z.string().trim().min(1).optional(),
  fornecedorNome: z.string().trim().min(1).optional(),
});

export type ListInventoryItemsQueryDTO = z.infer<
  typeof listInventoryItemsQuerySchema
>;
