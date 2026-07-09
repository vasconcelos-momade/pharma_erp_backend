import { z } from "zod";

export const proformaInvoiceIdParamSchema = z.object({
  proformaInvoiceId: z.string().regex(/^\d+$/, "proformaInvoiceId inválido"),
});

export const proformaInvoiceItemIdParamSchema = z.object({
  proformaInvoiceId: z.string().regex(/^\d+$/, "proformaInvoiceId inválido"),
  itemId: z.string().regex(/^\d+$/, "itemId inválido"),
});

const estadoProformaInvoiceSchema = z.enum([
  "PENDENTE",
  "APROVADA",
  "REJEITADA",
  "EXPIRADA",
]);

const proformaInvoiceItemInputSchema = z
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

export const createProformaInvoiceSchema = z
  .object({
    cliente: z.string().trim().min(1).max(191),
    clienteId: z.string().regex(/^\d+$/).optional(),
    nuit: z.string().trim().max(50).optional(),
    contacto: z.string().trim().max(50).optional(),
    validade: z.coerce.date(),
    observacoes: z.string().trim().max(2000).optional(),
    desconto: z.coerce.number().min(0).optional(),
    items: z.array(proformaInvoiceItemInputSchema).optional(),
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

export const updateProformaInvoiceSchema = z
  .object({
    cliente: z.string().trim().min(1).max(191).optional(),
    clienteId: z.string().regex(/^\d+$/).nullable().optional(),
    nuit: z.string().trim().max(50).nullable().optional(),
    contacto: z.string().trim().max(50).nullable().optional(),
    validade: z.coerce.date().optional(),
    observacoes: z.string().trim().max(2000).nullable().optional(),
    desconto: z.coerce.number().min(0).optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "Informe ao menos um campo para atualizar",
  });

export const addProformaInvoiceItemSchema = proformaInvoiceItemInputSchema.safeExtend({
  quantidade: z.coerce.number().positive().default(1),
});

export const updateProformaInvoiceItemSchema = z
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

export const mutateProformaInvoiceStatusSchema = z.object({
  observacoes: z.string().trim().max(2000).optional(),
});

export const searchProformaInvoicesQuerySchema = z.object({
  q: z.string().trim().min(1).optional(),
  search: z.string().trim().min(1).optional(),
  estado: estadoProformaInvoiceSchema.optional(),
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

export const listProformaInvoiceAuditQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  pageSize: z.coerce.number().int().positive().max(100).optional(),
});

export type CreateProformaInvoiceDTO = z.infer<typeof createProformaInvoiceSchema>;
export type UpdateProformaInvoiceDTO = z.infer<typeof updateProformaInvoiceSchema>;
export type AddProformaInvoiceItemDTO = z.infer<typeof addProformaInvoiceItemSchema>;
export type UpdateProformaInvoiceItemDTO = z.infer<typeof updateProformaInvoiceItemSchema>;
export type SearchProformaInvoicesQueryDTO = z.infer<typeof searchProformaInvoicesQuerySchema>;
