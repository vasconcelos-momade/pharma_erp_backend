import { z } from "zod";

export const categoriaIdParamSchema = z.object({
  categoryId: z.string().trim().regex(/^\d+$/, "categoryId inválido"),
});

const descricaoSchema = z
  .string()
  .trim()
  .max(2000, "Descrição excede o tamanho máximo permitido")
  .optional()
  .transform((value) => {
    const normalized = value?.trim();
    return normalized && normalized.length > 0 ? normalized : undefined;
  });

export const createCategoriaSchema = z.object({
  nome: z.string().trim().min(1, "Nome é obrigatório").max(191),
  descricao: descricaoSchema,
  ativo: z.coerce.boolean().optional(),
});

export const updateCategoriaSchema = z
  .object({
    nome: z.string().trim().min(1, "Nome é obrigatório").max(191).optional(),
    descricao: descricaoSchema.nullable().optional(),
    ativo: z.coerce.boolean().optional(),
  })
  .refine(
    (data: Record<string, unknown>) => Object.keys(data).length > 0,
    { message: "Informe ao menos um campo para actualizar" },
  );

export const searchCategoriasQuerySchema = z.object({
  q: z.string().trim().min(1).optional(),
  includeInactive: z.coerce.boolean().optional(),
  page: z.coerce.number().int().positive().optional(),
  pageSize: z.coerce.number().int().positive().max(100).optional(),
});

export type CreateCategoriaDTO = z.infer<typeof createCategoriaSchema>;
export type UpdateCategoriaDTO = z.infer<typeof updateCategoriaSchema>;
export type SearchCategoriasQueryDTO = z.infer<typeof searchCategoriasQuerySchema>;
