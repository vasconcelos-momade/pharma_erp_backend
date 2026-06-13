import type { TenantSystemModule } from "./permission.constants";

export function resolveStockDocumentPermissionModule(
  tipo: string | null | undefined,
): TenantSystemModule {
  return tipo === "COMPRA" ? "COMPRAS" : "REQUISICOES";
}
