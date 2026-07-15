import { z } from "zod";

export const searchSuppliersQuerySchema = z.object({
  q: z.string().trim().optional(),
  page: z.coerce.number().int().positive().optional(),
  pageSize: z.coerce.number().int().positive().max(100).optional(),
  includeInactive: z.coerce.boolean().optional(),
});

export const createSupplierSchema = z.object({
  nome: z.string().trim().min(2, "Nome é obrigatório"),
  tipo: z.string().trim().optional(),
  nuit: z.string().trim().optional(),
  email: z.string().trim().email("Email inválido").optional().or(z.literal("")),
  telefone: z.string().trim().optional(),
  telefoneAlt: z.string().trim().optional(),
  endereco: z.string().trim().optional(),
  cidade: z.string().trim().optional(),
  provincia: z.string().trim().optional(),
  pais: z.string().trim().optional(),
  contatoNome: z.string().trim().optional(),
  observacoes: z.string().trim().optional(),
});

export const updateSupplierSchema = createSupplierSchema.partial().extend({
  ativo: z.boolean().optional(),
});

export const purchaseSuggestionsQuerySchema = z.object({
  q: z.string().trim().optional(),
  origem: z.enum(["AUTOMATICA", "MANUAL", "TODAS"]).optional(),
  supplierId: z.string().trim().optional(),
  sortBy: z
    .enum([
      "produtoNome",
      "estoqueAtual",
      "estoqueMinimo",
      "consumoMedioDiario",
      "quantidadeSugerida",
      "origem",
      "fornecedorNome",
    ])
    .optional(),
  sortOrder: z.enum(["asc", "desc"]).optional(),
  page: z.coerce.number().int().positive().optional(),
  pageSize: z.coerce.number().int().positive().max(100).optional(),
});

export const addManualPurchaseSuggestionSchema = z.object({
  produtoId: z.string().trim().min(1, "Produto é obrigatório"),
  supplierId: z.string().trim().min(1, "Fornecedor é obrigatório"),
  quantidadeSugerida: z.coerce
    .number()
    .positive("Quantidade sugerida deve ser maior que zero"),
  observacao: z.string().trim().optional(),
});

export type AddManualPurchaseSuggestionDTO = z.infer<
  typeof addManualPurchaseSuggestionSchema
>;
