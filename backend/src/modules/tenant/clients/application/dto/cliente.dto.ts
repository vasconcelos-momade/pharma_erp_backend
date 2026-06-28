import { z } from "zod";

export const clienteIdParamSchema = z.object({
  clienteId: z.string().regex(/^\d+$/, "clienteId inválido"),
});

const tipoClienteSchema = z.enum(["PACIENTE", "EMPRESA", "CONVENIO"]);

export const createClienteSchema = z.object({
  nome: z.string().trim().min(1),
  telefone: z.string().trim().min(1).optional(),
  email: z.string().trim().email().optional(),
  tipo: tipoClienteSchema,
  documento: z.string().trim().min(1).optional(),
  dataNascimento: z.string().trim().min(1).optional(),
  sexo: z.string().trim().min(1).optional(),
  nuit: z.string().trim().min(1).optional(),
  endereco: z.string().trim().min(1).optional(),
  empresaId: z.string().regex(/^\d+$/).optional(),
  limiteCredito: z.coerce.number().nonnegative().optional(),
  temPrescricao: z.coerce.boolean().optional(),
});

export const updateClienteSchema = createClienteSchema.partial().refine(
  (data) => Object.keys(data).length > 0,
  { message: "Informe ao menos um campo para atualizar" },
);

export const searchClientesQuerySchema = z.object({
  q: z.string().trim().min(1).optional(),
  search: z.string().trim().min(1).optional(),
  tipo: tipoClienteSchema.optional(),
  empresaId: z.string().regex(/^\d+$/).optional(),
  comCredito: z.coerce.boolean().optional(),
  temPrescricao: z.coerce.boolean().optional(),
  dateFrom: z.string().trim().min(1).optional(),
  dateTo: z.string().trim().min(1).optional(),
  sortBy: z.enum(["nome", "createdAt", "saldoAtual"]).optional(),
  sortOrder: z.enum(["asc", "desc"]).optional(),
  page: z.coerce.number().int().positive().optional(),
  pageSize: z.coerce.number().int().positive().max(100).optional(),
});

export const listRelatedQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  pageSize: z.coerce.number().int().positive().max(100).optional(),
});

export type CreateClienteDTO = z.infer<typeof createClienteSchema>;
export type UpdateClienteDTO = z.infer<typeof updateClienteSchema>;
export type SearchClientesQueryDTO = z.infer<typeof searchClientesQuerySchema>;
