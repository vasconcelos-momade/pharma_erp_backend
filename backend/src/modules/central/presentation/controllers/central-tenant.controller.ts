import bcrypt from "bcryptjs";
import { z } from "zod";
import { Role } from "../../../../infrastructure/prisma/central/generated/central";
import { prismaCentral } from "../../../../infrastructure/prisma/prisma-central.service";
import { JobQueueService } from "../../../../infrastructure/queue/job-queue.service";
import { RegisterTenantUseCase } from "../../tenants/application/use-cases/register-tenant.use-case";
import type { CentralAuthContext } from "../../../../shared/http/central-auth";
import { serializeForJson } from "../../../../shared/http/serialize-json";
import { parseJsonBody, parseSearchParams } from "../../../../shared/http/request-validation";

const ownerUserSchema = z.object({
  name: z.string().trim().min(1),
  email: z.string().trim().pipe(z.email()),
  password: z.string().min(6),
  role: z.enum(["superadmin", "admin", "usuario"]).optional(),
});

const registerTenantSchema = z
  .object({
    nomeEmpresa: z.string().trim().min(1),
    nomeTenant: z.string().trim().min(1),
    adminName: z.string().trim().min(1),
    adminEmail: z.string().trim().pipe(z.email()),
    adminPassword: z.string().min(1).optional(),
    userId: z.string().trim().min(1).optional(),
    ownerUser: ownerUserSchema.optional(),
    email: z.string().trim().pipe(z.email()).optional().nullable(),
    endereco: z.string().trim().min(1).optional().nullable(),
    nuit: z.string().trim().min(1).optional().nullable(),
  })
  .superRefine((value, ctx) => {
    if (!value.userId && !value.ownerUser) {
      ctx.addIssue({
        code: "custom",
        message: "Informe userId ou ownerUser para registrar o tenant.",
        path: ["ownerUser"],
      });
    }
  });

const registerTenantQuerySchema = z.object({
  async: z
    .enum(["true", "false"])
    .transform((value) => value === "true")
    .optional(),
});

function parseCentralRole(input: unknown, fallback: Role): Role {
  if (input === Role.superadmin || input === Role.admin || input === Role.usuario) {
    return input;
  }
  if (typeof input === "string") {
    const value = input.toLowerCase();
    if (value === "superadmin") return Role.superadmin;
    if (value === "admin") return Role.admin;
    if (value === "usuario") return Role.usuario;
  }
  return fallback;
}

function isPublicRegistrationAllowed(): boolean {
  return process.env.PUBLIC_TENANT_REGISTRATION !== "false";
}

const tenantListSelect = {
  id: true,
  ownerId: true,
  companyName: true,
  name: true,
  nuit: true,
  email: true,
  endereco: true,
  status: true,
  createdAt: true,
  branches: {
    select: {
      id: true,
      code: true,
      name: true,
      active: true,
    },
    orderBy: { createdAt: "asc" as const },
  },
};

function mapTenantRecord(tenant: any) {
  return {
    ...tenant,
    id: tenant.id.toString(),
    ownerId: tenant.ownerId.toString(),
    branches: tenant.branches.map((branch: any) => ({
      ...branch,
      id: branch.id.toString(),
    })),
  };
}

export class CentralTenantController {
  async list(auth: CentralAuthContext): Promise<Response> {
    const prisma = prismaCentral as any;

    const where =
      auth.role === Role.superadmin
        ? {}
        : {
            id: {
              in: auth.payload.tenants.map((tenant) => BigInt(tenant.id)),
            },
          };

    const tenants = await prisma.tenant.findMany({
      where,
      orderBy: { createdAt: "desc" },
      select: tenantListSelect,
    });

    return Response.json(serializeForJson(tenants.map(mapTenantRecord)));
  }

  async getById(_auth: CentralAuthContext, tenantId: string): Promise<Response> {
    const prisma = prismaCentral as any;
    const tenant = await prisma.tenant.findUnique({
      where: { id: BigInt(tenantId) },
      select: tenantListSelect,
    });

    if (!tenant) {
      return Response.json({ error: "Tenant not found" }, { status: 404 });
    }

    return Response.json(serializeForJson(mapTenantRecord(tenant)));
  }

  async register(req: Request, url: URL, auth: CentralAuthContext | null): Promise<Response> {
    const hasBearer = Boolean(req.headers.get("Authorization")?.startsWith("Bearer "));

    if (!hasBearer && !isPublicRegistrationAllowed()) {
      return Response.json(
        { error: "Registo público desactivado. Autentique-se ou defina PUBLIC_TENANT_REGISTRATION=true." },
        { status: 401 },
      );
    }

    if (hasBearer && auth && auth.role !== Role.superadmin && !isPublicRegistrationAllowed()) {
      return Response.json({ error: "Apenas superadmin pode criar tenants." }, { status: 403 });
    }

    const body = await parseJsonBody(req, registerTenantSchema);

    let ownerUserId = body.userId;
    if (!ownerUserId) {
      const ownerUser = body.ownerUser!;

      const hashedPassword = await bcrypt.hash(ownerUser.password, 10);
      const createdUser = await prismaCentral.user.create({
        data: {
          name: ownerUser.name,
          email: ownerUser.email,
          password: hashedPassword,
          role: parseCentralRole(ownerUser.role, Role.admin),
        },
      });
      ownerUserId = createdUser.id.toString();
    }

    const tenantRegistrationPayload = {
      nomeEmpresa: body.nomeEmpresa,
      nomeTenant: body.nomeTenant,
      adminName: body.adminName,
      adminEmail: body.adminEmail,
      adminPassword: body.adminPassword ?? "",
      userId: ownerUserId,
      email: body.email ?? null,
      endereco: body.endereco ?? null,
      nuit: body.nuit ?? null,
    };

    const { async: runAsync = false } = parseSearchParams(url, registerTenantQuerySchema);
    if (runAsync) {
      const queue = new JobQueueService();
      const job = await queue.enqueue("tenant.register", tenantRegistrationPayload);
      return Response.json(
        serializeForJson({
          status: "queued",
          jobId: job.id,
          type: job.type,
          queuedAt: job.createdAt,
        }),
        { status: 202 },
      );
    }

    const registerTenant = new RegisterTenantUseCase();
    const result = await registerTenant.execute(tenantRegistrationPayload);
    return Response.json(serializeForJson(result), { status: 201 });
  }
}
