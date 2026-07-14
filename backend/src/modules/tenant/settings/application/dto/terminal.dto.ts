import { z } from "zod";

export const searchTerminalsQuerySchema = z.object({
  q: z.string().trim().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  includeInactive: z.coerce.boolean().optional(),
});

export const createTerminalSchema = z.object({
  codigo: z.string().trim().min(1).max(32),
  nome: z.string().trim().min(1).max(120),
  localizacao: z.string().trim().max(120).optional().nullable(),
  ativo: z.boolean().optional(),
});

export const updateTerminalSchema = z.object({
  nome: z.string().trim().min(1).max(120).optional(),
  localizacao: z.string().trim().max(120).optional().nullable(),
  ativo: z.boolean().optional(),
});
