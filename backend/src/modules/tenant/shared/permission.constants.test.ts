import { describe, expect, test } from "bun:test";
import {
  DEFAULT_ROLE_PERMISSION_MATRIX,
  TENANT_PERMISSION_ROLES,
  expandRolePermissionMatrix,
  listStandardActions,
  listStandardModules,
  isCriticalPermissionAction,
} from "./permission.constants";

describe("DEFAULT_ROLE_PERMISSION_MATRIX", () => {
  test("define matriz para todos os roles tenant", () => {
    for (const role of TENANT_PERMISSION_ROLES) {
      expect(DEFAULT_ROLE_PERMISSION_MATRIX[role].length).toBeGreaterThan(0);
    }
  });

  test("ADMIN tem todas as acoes em todos os modulos standard", () => {
    const modules = listStandardModules();
    const actions = listStandardActions();
    const adminGrants = DEFAULT_ROLE_PERMISSION_MATRIX.ADMIN;

    for (const module of modules) {
      const grant = adminGrants.find((entry) => entry.module === module);
      expect(grant).toBeDefined();
      for (const action of actions) {
        expect(grant!.actions).toContain(action);
      }
    }
  });

  test("CAIXA nao tem DELETE em PRODUTOS nem COMPRAS", () => {
    const caixaGrants = DEFAULT_ROLE_PERMISSION_MATRIX.CAIXA;
    const produtos = caixaGrants.find((entry) => entry.module === "PRODUTOS");
    const compras = caixaGrants.find((entry) => entry.module === "COMPRAS");

    expect(produtos?.actions).toEqual(["VIEW"]);
    expect(compras).toBeUndefined();
  });

  test("expandRolePermissionMatrix gera linhas unicas role+module+action", () => {
    const rows = expandRolePermissionMatrix();
    const keys = new Set(rows.map((row) => `${row.role}:${row.module}:${row.action}`));

    expect(rows.length).toBe(keys.size);
    expect(rows.length).toBeGreaterThan(250);
  });

  test("acoes criticas estao marcadas", () => {
    expect(isCriticalPermissionAction("APPROVE")).toBe(true);
    expect(isCriticalPermissionAction("VIEW")).toBe(false);
  });
});
