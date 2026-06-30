import bcrypt from "bcryptjs";
import { z } from "zod";
import { LoginUseCase } from "../../modules/central/auth/application/use-cases/login.use-case";
import { ForgotPasswordUseCase } from "../../modules/central/auth/application/use-cases/forgot-password.use-case";
import { prismaCentral } from "../../infrastructure/prisma/prisma-central.service";
import { Role } from "../../infrastructure/prisma/central/generated/central";
import { parseJsonBody } from "../../shared/http/request-validation";
import { createRateLimitMiddleware } from "../../shared/http/middlewares";
import type { Router } from "../../shared/http/router";

const loginSchema = z.object({
  email: z.string().trim().pipe(z.email()),
  password: z.string().min(1),
});

const createCentralUserSchema = z.object({
  name: z.string().trim().min(1),
  email: z.string().trim().pipe(z.email()),
  password: z.string().min(6),
  role: z.enum(["superadmin", "admin", "usuario"]).optional(),
});

function parseCentralRole(input: string | undefined, fallback: Role): Role {
  if (input === "superadmin") return Role.superadmin;
  if (input === "admin") return Role.admin;
  if (input === "usuario") return Role.usuario;
  return fallback;
}

const forgotPasswordSchema = z.object({
  email: z.string().trim().pipe(z.email()),
});

export function registerAuthRoutes(router: Router, prefix: string): void {
  router.post(
    `${prefix}/central/auth/login`,
    createRateLimitMiddleware({ keyPrefix: "central-login", windowMs: 5 * 60_000, max: 10 }),
    async ({ req }) => {
      const body = await parseJsonBody(req, loginSchema);
      const loginUseCase = new LoginUseCase();
      return loginUseCase.execute(body.email, body.password);
    },
  );

  router.post(
    `${prefix}/central/auth/forgot-password`,
    createRateLimitMiddleware({
      keyPrefix: "central-forgot-password",
      windowMs: 15 * 60_000,
      max: 5,
    }),
    async ({ req }) => {
      const body = await parseJsonBody(req, forgotPasswordSchema);
      const useCase = new ForgotPasswordUseCase();
      const result = await useCase.execute(body.email);
      return new Response(JSON.stringify(result), {
        status: 200,
        headers: { "content-type": "application/json; charset=utf-8" },
      });
    },
  );

  router.post(
    `${prefix}/central/users`,
    createRateLimitMiddleware({ keyPrefix: "central-users-create", windowMs: 60_000, max: 20 }),
    async ({ req }) => {
      const body = await parseJsonBody(req, createCentralUserSchema);
      const hashedPassword = await bcrypt.hash(body.password, 10);

      const user = await prismaCentral.user.create({
        data: {
          name: body.name,
          email: body.email,
          password: hashedPassword,
          role: parseCentralRole(body.role, Role.usuario),
        },
        select: { id: true, name: true, email: true, role: true, active: true },
      });

      return new Response(
        JSON.stringify({
          id: user.id.toString(),
          name: user.name,
          email: user.email,
          role: user.role,
          active: user.active,
        }),
        {
          status: 201,
          headers: { "content-type": "application/json; charset=utf-8" },
        },
      );
    },
  );
}
