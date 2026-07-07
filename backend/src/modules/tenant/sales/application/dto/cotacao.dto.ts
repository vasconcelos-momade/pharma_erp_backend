import { z } from "zod";

export const cotacaoIdParamSchema = z.object({
  cotacaoId: z.string().regex(/^\d+$/, "cotacaoId inválido"),
});

export const cotacaoItemIdParamSchema = z.object({
  cotacaoId: z.string().regex(/^\d+$/, "cotacaoId inválido"),
  itemId: z.string().regex(/^\d+$/, "itemId inválido"),
});

const estadoCotacaoSchema = z.enum([
  "PENDENTE",
  "APROVADA",
  "REJEITADA",
  "EXPIRADA",
]);

const cotacaoItemInputSchema = z
  .object({
    produtoId: z.string().regex(/^\d+$/).optional(),
    servicoId: z.string().regex(/^\d+$/).optional(),
    descricao: z.string().trim().min(1).max(255).optional(),
    quantidade: z.coerce.number().positive().optional(),
    precoUnit: z.coerce.number().positive().optional(),
    desconto: z.coerce.number().min(0).optional(),
    descontoPercent: z.coerce.number().min(0).max(100).optional(),
  })
  .superRefine((data, ctx) => {
    if (!data.produtoId && !data.servicoId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["produtoId"],
        message: "Informe um produto ou um serviço",
      });
    }

    if (data.produtoId && data.servicoId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["servicoId"],
        message: "Cada item deve referenciar apenas produto ou serviço",
      });
    }
  });

export const createCotacaoSchema = z
  .object({
    cliente: z.string().trim().min(1).max(191),
    clienteId: z.string().regex(/^\d+$/).optional(),
    validade: z.coerce.date(),
    observacoes: z.string().trim().max(2000).optional(),
    desconto: z.coerce.number().min(0).optional(),
    items: z.array(cotacaoItemInputSchema).optional(),
  })
  .superRefine((data, ctx) => {
    if (!data.cliente.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["cliente"],
        message: "Informe o nome do cliente",
      });
    }
  });

export const updateCotacaoSchema = z
  .object({
    cliente: z.string().trim().min(1).max(191).optional(),
    clienteId: z.string().regex(/^\d+$/).nullable().optional(),
    validade: z.coerce.date().optional(),
    observacoes: z.string().trim().max(2000).nullable().optional(),
    desconto: z.coerce.number().min(0).optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "Informe ao menos um campo para atualizar",
  });

export const addCotacaoItemSchema = cotacaoItemInputSchema.extend({
  quantidade: z.coerce.number().positive().default(1),
});

export const updateCotacaoItemSchema = z
  .object({
    descricao: z.string().trim().min(1).max(255).optional(),
    quantidade: z.coerce.number().positive().optional(),
    precoUnit: z.coerce.number().positive().optional(),
    desconto: z.coerce.number().min(0).optional(),
    descontoPercent: z.coerce.number().min(0).max(100).optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "Informe ao menos um campo para atualizar",
  });

export const mutateCotacaoStatusSchema = z.object({
  observacoes: z.string().trim().max(2000).optional(),
});

export const searchCotacoesQuerySchema = z.object({
  q: z.string().trim().min(1).optional(),
  search: z.string().trim().min(1).optional(),
  estado: estadoCotacaoSchema.optional(),
  clienteId: z.string().regex(/^\d+$/).optional(),
  userId: z.string().regex(/^\d+$/).optional(),
  validadeFrom: z.string().trim().min(1).optional(),
  validadeTo: z.string().trim().min(1).optional(),
  createdFrom: z.string().trim().min(1).optional(),
  createdTo: z.string().trim().min(1).optional(),
  sortBy: z
    .enum(["createdAt", "validade", "numero", "total", "clienteNome"])
    .optional(),
  sortOrder: z.enum(["asc", "desc"]).optional(),
  page: z.coerce.number().int().positive().optional(),
  pageSize: z.coerce.number().int().positive().max(100).optional(),
});

export const listCotacaoAuditQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  pageSize: z.coerce.number().int().positive().max(100).optional(),
});

export type CreateCotacaoDTO = z.infer<typeof createCotacaoSchema>;
export type UpdateCotacaoDTO = z.infer<typeof updateCotacaoSchema>;
export type AddCotacaoItemDTO = z.infer<typeof addCotacaoItemSchema>;
export type UpdateCotacaoItemDTO = z.infer<typeof updateCotacaoItemSchema>;
export type SearchCotacoesQueryDTO = z.infer<typeof searchCotacoesQuerySchema>;
