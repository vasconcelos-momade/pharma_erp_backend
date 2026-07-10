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
  days: z.coerce.number().int().positive().max(365).optional(),
  from: z.string().trim().optional(),
  to: z.string().trim().optional(),
});
