export const TENANT_PERMISSION_ROLES = [
  "ADMIN",
  "GERENTE",
  "FARMACEUTICO",
  "DIRETOR_TECNICO",
  "CAIXA",
] as const;

export type TenantPermissionRole = (typeof TENANT_PERMISSION_ROLES)[number];

export const TENANT_SYSTEM_MODULES = [
  "REQUISICOES",
  "COMPRAS",
  "PRODUTOS",
  "LOTES",
  "INVENTARIO",
  "FORNECEDORES",
  "CLIENTES",
  "PROFORMA_INVOICES",
  "POS",
  "RELATORIOS",
  "UTILIZADORES",
  "CONFIGURACOES",
  // Legado, mantido para compatibilidade de dados.
  "FATURAS",
  "CAIXA",
  "ESTOQUE",
  "PSICOTROPICOS",
  "AUDITORIA",
] as const;

export type TenantSystemModule = (typeof TENANT_SYSTEM_MODULES)[number];

export const TENANT_PERMISSION_ACTIONS = [
  "VIEW",
  "CREATE",
  "UPDATE",
  "DELETE",
  "APPROVE",
  "REJECT",
  "CANCEL",
  "EXPORT",
  "CREATE_LOTE",
  "ADJUST_STOCK",
  "CLOSE_SHIFT",
  // Legado, mantido para compatibilidade de dados.
  "EDIT",
] as const;

export type TenantPermissionAction = (typeof TENANT_PERMISSION_ACTIONS)[number];

export type PermissionGrant = {
  module: TenantSystemModule;
  actions: readonly TenantPermissionAction[];
};

const ALL_STANDARD_MODULES = [
  "REQUISICOES",
  "COMPRAS",
  "PRODUTOS",
  "LOTES",
  "INVENTARIO",
  "FORNECEDORES",
  "CLIENTES",
  "PROFORMA_INVOICES",
  "POS",
  "RELATORIOS",
  "UTILIZADORES",
  "CONFIGURACOES",
] as const satisfies readonly TenantSystemModule[];

const ALL_STANDARD_ACTIONS = [
  "VIEW",
  "CREATE",
  "UPDATE",
  "DELETE",
  "APPROVE",
  "REJECT",
  "CANCEL",
  "EXPORT",
  "CREATE_LOTE",
  "ADJUST_STOCK",
  "CLOSE_SHIFT",
] as const satisfies readonly TenantPermissionAction[];

export const CRITICAL_PERMISSION_ACTIONS = new Set<TenantPermissionAction>([
  "APPROVE",
  "REJECT",
  "CANCEL",
  "DELETE",
  "EXPORT",
  "CREATE_LOTE",
  "ADJUST_STOCK",
  "CLOSE_SHIFT",
]);

export const MODULE_PERMISSION_ALIASES: Record<TenantSystemModule, readonly TenantSystemModule[]> = {
  REQUISICOES: ["REQUISICOES", "ESTOQUE"],
  COMPRAS: ["COMPRAS", "ESTOQUE"],
  PRODUTOS: ["PRODUTOS"],
  LOTES: ["LOTES", "ESTOQUE"],
  INVENTARIO: ["INVENTARIO", "ESTOQUE"],
  FORNECEDORES: ["FORNECEDORES", "ESTOQUE"],
  CLIENTES: ["CLIENTES"],
  PROFORMA_INVOICES: ["PROFORMA_INVOICES", "CLIENTES", "POS"],
  POS: ["POS", "FATURAS", "CAIXA"],
  RELATORIOS: ["RELATORIOS", "AUDITORIA", "PSICOTROPICOS"],
  UTILIZADORES: ["UTILIZADORES"],
  CONFIGURACOES: ["CONFIGURACOES"],
  FATURAS: ["FATURAS", "POS"],
  CAIXA: ["CAIXA", "POS"],
  ESTOQUE: ["ESTOQUE", "REQUISICOES", "COMPRAS", "LOTES", "INVENTARIO", "FORNECEDORES"],
  PSICOTROPICOS: ["PSICOTROPICOS", "RELATORIOS"],
  AUDITORIA: ["AUDITORIA", "RELATORIOS"],
};

export const ACTION_PERMISSION_ALIASES: Record<TenantPermissionAction, readonly TenantPermissionAction[]> = {
  VIEW: ["VIEW"],
  CREATE: ["CREATE"],
  UPDATE: ["UPDATE", "EDIT"],
  DELETE: ["DELETE"],
  APPROVE: ["APPROVE"],
  REJECT: ["REJECT"],
  CANCEL: ["CANCEL"],
  EXPORT: ["EXPORT"],
  CREATE_LOTE: ["CREATE_LOTE"],
  ADJUST_STOCK: ["ADJUST_STOCK"],
  CLOSE_SHIFT: ["CLOSE_SHIFT"],
  EDIT: ["EDIT", "UPDATE"],
};

export const DEFAULT_ROLE_PERMISSION_MATRIX: Record<TenantPermissionRole, readonly PermissionGrant[]> = {
  ADMIN: [
    { module: "REQUISICOES", actions: ALL_STANDARD_ACTIONS },
    { module: "COMPRAS", actions: ALL_STANDARD_ACTIONS },
    { module: "PRODUTOS", actions: ALL_STANDARD_ACTIONS },
    { module: "LOTES", actions: ALL_STANDARD_ACTIONS },
    { module: "INVENTARIO", actions: ALL_STANDARD_ACTIONS },
    { module: "FORNECEDORES", actions: ALL_STANDARD_ACTIONS },
    { module: "CLIENTES", actions: ALL_STANDARD_ACTIONS },
    { module: "PROFORMA_INVOICES", actions: ALL_STANDARD_ACTIONS },
    { module: "POS", actions: ALL_STANDARD_ACTIONS },
    { module: "RELATORIOS", actions: ALL_STANDARD_ACTIONS },
    { module: "UTILIZADORES", actions: ALL_STANDARD_ACTIONS },
    { module: "CONFIGURACOES", actions: ALL_STANDARD_ACTIONS },
  ],
  GERENTE: [
    { module: "REQUISICOES", actions: ["VIEW", "CREATE", "UPDATE", "DELETE", "APPROVE", "REJECT", "CANCEL", "EXPORT"] },
    { module: "COMPRAS", actions: ["VIEW", "CREATE", "UPDATE", "DELETE", "APPROVE", "REJECT", "CANCEL", "EXPORT"] },
    { module: "PRODUTOS", actions: ["VIEW", "CREATE", "UPDATE", "DELETE", "EXPORT"] },
    { module: "LOTES", actions: ["VIEW", "CREATE", "UPDATE", "DELETE", "CREATE_LOTE", "EXPORT"] },
    { module: "INVENTARIO", actions: ["VIEW", "CREATE", "UPDATE", "APPROVE", "CANCEL", "ADJUST_STOCK", "EXPORT"] },
    { module: "FORNECEDORES", actions: ["VIEW", "CREATE", "UPDATE", "DELETE", "EXPORT"] },
    { module: "CLIENTES", actions: ["VIEW", "CREATE", "UPDATE", "DELETE", "EXPORT"] },
    { module: "PROFORMA_INVOICES", actions: ["VIEW", "CREATE", "UPDATE", "DELETE", "APPROVE", "REJECT", "EXPORT"] },
    { module: "POS", actions: ["VIEW", "CREATE", "UPDATE", "DELETE", "APPROVE", "CANCEL", "EXPORT", "CLOSE_SHIFT"] },
    { module: "RELATORIOS", actions: ["VIEW", "EXPORT"] },
    { module: "UTILIZADORES", actions: ["VIEW", "CREATE", "UPDATE", "DELETE"] },
    { module: "CONFIGURACOES", actions: ["VIEW", "CREATE", "UPDATE", "DELETE", "EXPORT"] },
  ],
  FARMACEUTICO: [
    { module: "REQUISICOES", actions: ["VIEW", "CREATE", "UPDATE", "APPROVE", "REJECT", "CANCEL"] },
    { module: "COMPRAS", actions: ["VIEW", "CREATE", "UPDATE"] },
    { module: "PRODUTOS", actions: ["VIEW"] },
    { module: "LOTES", actions: ["VIEW", "CREATE_LOTE"] },
    { module: "INVENTARIO", actions: ["VIEW", "ADJUST_STOCK"] },
    { module: "FORNECEDORES", actions: ["VIEW"] },
    { module: "CLIENTES", actions: ["VIEW", "CREATE", "UPDATE"] },
    { module: "PROFORMA_INVOICES", actions: ["VIEW", "CREATE", "UPDATE", "APPROVE", "REJECT"] },
    { module: "POS", actions: ["VIEW", "CREATE", "UPDATE", "APPROVE", "CLOSE_SHIFT"] },
    { module: "RELATORIOS", actions: ["VIEW", "EXPORT"] },
    { module: "UTILIZADORES", actions: ["VIEW"] },
    { module: "CONFIGURACOES", actions: ["VIEW"] },
  ],
  DIRETOR_TECNICO: [
    { module: "REQUISICOES", actions: ["VIEW", "CREATE", "UPDATE", "APPROVE", "REJECT", "CANCEL", "EXPORT"] },
    { module: "COMPRAS", actions: ["VIEW", "CREATE", "UPDATE", "APPROVE", "EXPORT"] },
    { module: "PRODUTOS", actions: ["VIEW", "CREATE", "UPDATE", "EXPORT"] },
    { module: "LOTES", actions: ["VIEW", "CREATE_LOTE", "EXPORT"] },
    { module: "INVENTARIO", actions: ["VIEW", "APPROVE", "ADJUST_STOCK", "EXPORT"] },
    { module: "FORNECEDORES", actions: ["VIEW"] },
    { module: "CLIENTES", actions: ["VIEW", "CREATE", "UPDATE"] },
    { module: "PROFORMA_INVOICES", actions: ["VIEW", "CREATE", "UPDATE", "APPROVE", "REJECT", "EXPORT"] },
    { module: "POS", actions: ["VIEW", "CREATE", "APPROVE", "CANCEL", "EXPORT", "CLOSE_SHIFT"] },
    { module: "RELATORIOS", actions: ["VIEW", "EXPORT"] },
    { module: "UTILIZADORES", actions: ["VIEW"] },
    { module: "CONFIGURACOES", actions: ["VIEW", "UPDATE"] },
  ],
  CAIXA: [
    { module: "PRODUTOS", actions: ["VIEW"] },
    { module: "CLIENTES", actions: ["VIEW", "CREATE", "UPDATE"] },
    { module: "PROFORMA_INVOICES", actions: ["VIEW", "CREATE", "UPDATE"] },
    { module: "POS", actions: ["VIEW", "CREATE", "UPDATE", "CLOSE_SHIFT"] },
    { module: "RELATORIOS", actions: ["VIEW"] },
  ],
};

export function expandRolePermissionMatrix() {
  return (Object.entries(DEFAULT_ROLE_PERMISSION_MATRIX) as Array<
    [TenantPermissionRole, readonly PermissionGrant[]]
  >).flatMap(([role, grants]) =>
    grants.flatMap((grant) =>
      grant.actions.map((action) => ({
        role,
        module: grant.module,
        action,
      })),
    ),
  );
}

export function isCriticalPermissionAction(action: TenantPermissionAction): boolean {
  return CRITICAL_PERMISSION_ACTIONS.has(action);
}

export function isTenantSystemModule(value: string): value is TenantSystemModule {
  return TENANT_SYSTEM_MODULES.includes(value as TenantSystemModule);
}

export function isTenantPermissionAction(value: string): value is TenantPermissionAction {
  return TENANT_PERMISSION_ACTIONS.includes(value as TenantPermissionAction);
}

export function listStandardModules() {
  return [...ALL_STANDARD_MODULES];
}

export function listStandardActions() {
  return [...ALL_STANDARD_ACTIONS];
}
