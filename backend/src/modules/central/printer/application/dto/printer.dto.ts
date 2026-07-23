import { z } from "zod";

const idSchema = z.string().regex(/^\d+$/, "id inválido");

export const printerTypeSchema = z.enum(["ESC_POS", "A4", "LABEL"]);
export const printerConnectionSchema = z.enum([
  "NETWORK",
  "USB",
  "BLUETOOTH",
  "PDF",
]);
export const printStatusSchema = z.enum([
  "PENDING",
  "PROCESSING",
  "PRINTED",
  "FAILED",
  "CANCELLED",
]);

export const printerIdParamSchema = z.object({
  id: idSchema,
});

export const printJobIdParamSchema = z.object({
  id: idSchema,
});

export const createPrinterSchema = z
  .object({
    branchId: idSchema.optional(),
    deviceId: idSchema.nullable().optional(),
    name: z.string().trim().min(1).max(191),
    type: printerTypeSchema.default("ESC_POS"),
    connection: printerConnectionSchema.default("NETWORK"),
    ip: z.string().trim().min(1).max(45).nullable().optional(),
    port: z.coerce.number().int().min(1).max(65535).nullable().optional(),
    model: z.string().trim().min(1).max(128).nullable().optional(),
    manufacturer: z.string().trim().min(1).max(128).nullable().optional(),
    active: z.coerce.boolean().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.connection === "NETWORK" && !data.ip?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["ip"],
        message: "IP é obrigatório para impressoras de rede",
      });
    }
  });

export const updatePrinterSchema = z
  .object({
    deviceId: idSchema.nullable().optional(),
    name: z.string().trim().min(1).max(191).optional(),
    type: printerTypeSchema.optional(),
    connection: printerConnectionSchema.optional(),
    ip: z.string().trim().min(1).max(45).nullable().optional(),
    port: z.coerce.number().int().min(1).max(65535).nullable().optional(),
    model: z.string().trim().min(1).max(128).nullable().optional(),
    manufacturer: z.string().trim().min(1).max(128).nullable().optional(),
    active: z.coerce.boolean().optional(),
    version: z.coerce.number().int().nonnegative(),
  })
  .refine(
    (data) =>
      Object.keys(data).some((key) => key !== "version" && data[key as keyof typeof data] !== undefined),
    { message: "Informe ao menos um campo para atualizar" },
  );

export const listPrintersQuerySchema = z.object({
  branchId: idSchema.optional(),
  deviceId: idSchema.optional(),
  active: z.coerce.boolean().optional(),
  type: printerTypeSchema.optional(),
  connection: printerConnectionSchema.optional(),
  q: z.string().trim().min(1).optional(),
  search: z.string().trim().min(1).optional(),
  page: z.coerce.number().int().positive().optional(),
  pageSize: z.coerce.number().int().positive().max(100).optional(),
});

export const createPrintJobSchema = z.object({
  printerId: idSchema,
  branchId: idSchema.optional(),
  document: z.string().trim().min(1).max(128),
  payload: z.unknown(),
  maxAttempts: z.coerce.number().int().min(1).max(10).optional(),
  platform: z.enum(["web", "desktop", "mobile"]).optional(),
  forcePdf: z.coerce.boolean().optional(),
});

export const listPrintJobsQuerySchema = z.object({
  branchId: idSchema.optional(),
  printerId: idSchema.optional(),
  status: printStatusSchema.optional(),
  document: z.string().trim().min(1).optional(),
  page: z.coerce.number().int().positive().optional(),
  pageSize: z.coerce.number().int().positive().max(100).optional(),
});

export const testPrinterSchema = z.object({
  message: z.string().trim().min(1).max(500).optional(),
  platform: z.enum(["web", "desktop", "mobile"]).optional(),
});

export type CreatePrinterDTO = z.infer<typeof createPrinterSchema>;
export type UpdatePrinterDTO = z.infer<typeof updatePrinterSchema>;
export type ListPrintersQueryDTO = z.infer<typeof listPrintersQuerySchema>;
export type CreatePrintJobDTO = z.infer<typeof createPrintJobSchema>;
export type ListPrintJobsQueryDTO = z.infer<typeof listPrintJobsQuerySchema>;
export type TestPrinterDTO = z.infer<typeof testPrinterSchema>;
