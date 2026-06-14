import { z } from "zod";

const optionalLocationSchema = z
  .string()
  .trim()
  .max(100, "Local excede o tamanho máximo permitido")
  .optional()
  .transform((value: string | undefined) => {
    const normalized = value?.trim();
    return normalized && normalized.length > 0 ? normalized : undefined;
  });

const requisitionTypeSchema = z.enum(["COMPRA", "SAIDA", "ENTRADA"]);
const requisitionStatusSchema = z.enum([
  "PENDENTE",
  "APROVADA",
  "REJEITADA",
  "CONCLUIDA",
  "CANCELADA",
]);

export const createRequisitionSchema = z
  .object({
    numeroDocumento: z
      .string()
      .trim()
      .min(1, "Numero do documento e obrigatorio"),
    fornecedorId: z.string().trim().min(1).optional(),
    origem: optionalLocationSchema,
    destino: optionalLocationSchema,
    tipo: requisitionTypeSchema,
    observacao: z.string().trim().max(2000).optional(),
  })
  .superRefine((data: any, ctx: any) => {
    if (data.tipo === "COMPRA") {
      if (!data.fornecedorId) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["fornecedorId"],
          message: "Fornecedor e obrigatorio para requisicoes do tipo COMPRA",
        });
      }
      if (data.origem || data.destino) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["origem"],
          message: "Origem e destino devem ser nulos para requisicoes do tipo COMPRA",
        });
      }
    }

    if (data.tipo === "SAIDA") {
      if (!data.destino) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["destino"],
          message: "Destino e obrigatorio para requisicoes do tipo SAIDA",
        });
      }
      if (data.origem) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["origem"],
          message: "Origem deve ser nulo para requisicoes do tipo SAIDA",
        });
      }
    }

    if (data.tipo === "ENTRADA") {
      if (!data.origem) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["origem"],
          message: "Origem e obrigatoria para requisicoes do tipo ENTRADA",
        });
      }
      if (data.destino) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["destino"],
          message: "Destino deve ser nulo para requisicoes do tipo ENTRADA",
        });
      }
    }
  });

export type CreateRequisitionDTO = z.infer<typeof createRequisitionSchema>;

export const updateRequisitionSchema = z
  .object({
    numeroDocumento: z
      .string()
      .trim()
      .min(1, "Numero do documento e obrigatorio")
      .optional(),
    fornecedorId: z.string().trim().min(1).nullable().optional(),
    origem: optionalLocationSchema,
    destino: optionalLocationSchema,
    observacao: z.string().trim().max(2000).nullable().optional(),
  })
  .superRefine((data: any, ctx: any) => {
    const hasField =
      data.numeroDocumento !== undefined ||
      data.fornecedorId !== undefined ||
      data.origem !== undefined ||
      data.destino !== undefined ||
      data.observacao !== undefined;

    if (!hasField) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Informe ao menos um campo para actualizar",
      });
    }
  });

export type UpdateRequisitionDTO = z.infer<typeof updateRequisitionSchema>;

export const addRequisitionItemSchema = z.object({
  produtoId: z.string().trim().min(1, "Produto e obrigatorio"),
  loteId: z.string().trim().min(1).optional(),
  quantidadeSolicitada: z.coerce
    .number()
    .positive("Quantidade solicitada deve ser maior que zero"),
});

export type AddRequisitionItemDTO = z.infer<typeof addRequisitionItemSchema>;

export const addRequisitionCompraItemSchema = z.object({
  produtoId: z.string().trim().min(1, "Produto e obrigatorio"),
  numeroLote: z.string().trim().min(1, "Numero do lote e obrigatorio"),
  dataValidade: z.coerce.date(),
  quantidadeSolicitada: z.coerce
    .number()
    .positive("Quantidade solicitada deve ser maior que zero"),
  precoCompra: z.coerce.number().positive("Preco de compra deve ser maior que zero"),
  precoVenda: z.coerce.number().positive().optional(),
});

export type AddRequisitionCompraItemDTO = z.infer<
  typeof addRequisitionCompraItemSchema
>;

export const updateRequisitionItemSchema = z.object({
  quantidadeSolicitada: z.coerce
    .number()
    .positive("Quantidade solicitada deve ser maior que zero"),
});

export type UpdateRequisitionItemDTO = z.infer<typeof updateRequisitionItemSchema>;

export const updateRequisitionCompraItemSchema = z.object({
  numeroLote: z.string().trim().min(1).optional(),
  dataValidade: z.coerce.date().optional(),
  quantidadeSolicitada: z.coerce.number().positive().optional(),
  precoCompra: z.coerce.number().positive().optional(),
  precoVenda: z.coerce.number().positive().nullable().optional(),
});

export type UpdateRequisitionCompraItemDTO = z.infer<
  typeof updateRequisitionCompraItemSchema
>;

export const listRequisitionsQuerySchema = z.object({
  status: requisitionStatusSchema.optional(),
  tipo: requisitionTypeSchema.optional(),
  origem: z.string().trim().min(1).optional(),
  destino: z.string().trim().min(1).optional(),
  fornecedorId: z.string().trim().min(1).optional(),
});

export const createLoteSchema = z.object({
  produtoId: z.string().trim().min(1, "Produto e obrigatorio"),
  fornecedorId: z.string().trim().min(1, "Fornecedor e obrigatorio"),
  numeroLote: z.string().trim().min(1, "Numero do lote e obrigatorio"),
  dataValidade: z.coerce.date(),
  precoCompra: z.coerce.number().optional(),
});

export type CreateLoteDTO = z.infer<typeof createLoteSchema>;
export type ListRequisitionsQueryDTO = z.infer<typeof listRequisitionsQuerySchema>;
