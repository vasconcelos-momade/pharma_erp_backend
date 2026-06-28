import { z } from "zod";
import { TENANT_PERMISSION_ROLES } from "../../../shared/permission.constants";

export const userIdParamSchema = z.object({
  userId: z.string().regex(/^\d+$/, "userId inválido"),
});

const roleSchema = z.enum(TENANT_PERMISSION_ROLES);

export const createUserSchema = z.object({
  name: z.string().trim().min(1),
  email: z.string().trim().email(),
  role: roleSchema,
  active: z.coerce.boolean().optional(),
  centralUserId: z.string().regex(/^\d+$/).optional(),
});

export const updateUserSchema = z.object({
  name: z.string().trim().min(1).optional(),
  email: z.string().trim().email().optional(),
  role: roleSchema.optional(),
  active: z.coerce.boolean().optional(),
  version: z.coerce.number().int().nonnegative().optional(),
}).refine(
  (data) => Object.keys(data).filter((k) => k !== "version").length > 0,
  { message: "Informe ao menos um campo para atualizar" },
);

export const searchUsersQuerySchema = z.object({
  q: z.string().trim().min(1).optional(),
  search: z.string().trim().min(1).optional(),
  role: roleSchema.optional(),
  active: z.coerce.boolean().optional(),
  sortBy: z.enum(["name", "createdAt", "role"]).optional(),
  sortOrder: z.enum(["asc", "desc"]).optional(),
  page: z.coerce.number().int().positive().optional(),
  pageSize: z.coerce.number().int().positive().max(100).optional(),
});

export const updateUserPermissionsSchema = z.object({
  permissions: z.array(
    z.object({
      module: z.string().trim().min(1),
      action: z.string().trim().min(1),
      allowed: z.boolean().optional(),
      clear: z.boolean().optional(),
    }).refine(
      (item) => item.clear === true || typeof item.allowed === "boolean",
      { message: "Informe allowed ou clear=true" },
    ),
  ),
});

export type CreateUserDTO = z.infer<typeof createUserSchema>;
export type UpdateUserDTO = z.infer<typeof updateUserSchema>;
