import { describe, expect, mock, test } from "bun:test";
import { ForbiddenApiError } from "../../../shared/http/api-error";
import { PermissionService } from "./permission.service";

function createPermissionPrisma(overrides: Partial<any> = {}) {
  return {
    user: {
      findUnique: mock(async () => ({
        id: 1n,
        role: "CAIXA",
        active: true,
        deletedAt: null,
      })),
      ...(overrides.user ?? {}),
    },
    userPermission: {
      findFirst: mock(async () => overrides.userPermission ?? null),
      ...(overrides.userPermissionClient ?? {}),
    },
    rolePermission: {
      findFirst: mock(async () => overrides.rolePermission ?? null),
      ...(overrides.rolePermissionClient ?? {}),
    },
  };
}

describe("PermissionService", () => {
  test("prioriza user_permissions sobre role_permissions", async () => {
    const prisma = createPermissionPrisma({
      userPermission: {
        allowed: false,
        module: "POS",
        action: "CREATE",
      },
      rolePermission: {
        module: "POS",
        action: "CREATE",
      },
    });

    const service = new PermissionService(prisma as any);
    const decision = await service.resolvePermission("1", "POS", "CREATE");

    expect(decision.allowed).toBe(false);
    expect(decision.source).toBe("user_permissions");
  });

  test("usa role_permissions quando nao existe override do utilizador", async () => {
    const prisma = createPermissionPrisma({
      rolePermission: {
        module: "POS",
        action: "VIEW",
      },
    });

    const service = new PermissionService(prisma as any);
    const decision = await service.resolvePermission("1", "POS", "VIEW");

    expect(decision.allowed).toBe(true);
    expect(decision.source).toBe("role_permissions");
  });

  test("nega acesso quando nao ha permissao explicita", async () => {
    const service = new PermissionService(createPermissionPrisma() as any);
    const decision = await service.resolvePermission("1", "UTILIZADORES", "DELETE");

    expect(decision.allowed).toBe(false);
    expect(decision.source).toBe("none");
  });

  test("assertPermission lança 403 quando acesso é negado", async () => {
    const service = new PermissionService(createPermissionPrisma() as any);

    await expect(
      service.assertPermission("1", "INVENTARIO", "APPROVE"),
    ).rejects.toBeInstanceOf(ForbiddenApiError);
  });

  test("resolve alias de ação UPDATE via EDIT legado", async () => {
    const prisma = createPermissionPrisma({
      rolePermission: {
        module: "PRODUTOS",
        action: "EDIT",
      },
    });

    const service = new PermissionService(prisma as any);
    const decision = await service.resolvePermission("1", "PRODUTOS", "UPDATE");

    expect(decision.allowed).toBe(true);
    expect(decision.matchedAction).toBe("EDIT");
  });
});
