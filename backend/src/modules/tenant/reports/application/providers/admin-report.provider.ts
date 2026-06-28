import { REPORT_KEYS } from "../constants/report-keys";
import { collectAllPages } from "../helpers/report-pagination.helper";
import { toText } from "../helpers/report-export.helper";
import {
  type ModuleReportDefinition,
  type ReportDataProvider,
  type ReportProviderContext,
} from "../types/report.types";
import { AdminReportingService } from "../../../users/application/services/admin-reporting.service";
import {
  buildAdminReportDefinition,
  auditFilterLabels,
  formatAdminDateTime,
  loginHistoryFilterLabels,
  permissionsFilterLabels,
  roleLabel,
  sessionFilterLabels,
  userFilterLabels,
} from "./helpers/admin-report.builder";
import { listStandardActions, listStandardModules } from "../../../shared/permission.constants";

export class AdminUsersReportProvider implements ReportDataProvider {
  readonly reportKey = REPORT_KEYS.ADMIN_USERS;

  private readonly adminService = new AdminReportingService();

  async build(context: ReportProviderContext): Promise<ModuleReportDefinition> {
    const query = this.adminService.parseUserQuery(context.url);
    const [dashboard, items] = await Promise.all([
      this.adminService.getUsersDashboard(),
      collectAllPages((page) =>
        this.adminService.searchUsers({ ...query, page, pageSize: 100 }),
      ),
    ]);

    return buildAdminReportDefinition({
      fileBaseName: "utilizadores",
      reportName: "Utilizadores",
      title: "Utilizadores",
      subtitle: "RBAC, multi-inquilino e politicas de sessao",
      filters: userFilterLabels(query),
      kpis: {
        Total: dashboard.totalUtilizadores,
        Activos: dashboard.ativos,
        Inactivos: dashboard.inativos,
        Registos: items.length,
      },
      tables: [
        {
          title: "Utilizadores",
          columns: ["Nome", "Email", "Perfil", "Estado", "Permissoes", "Registo"],
          rows: items.map((item: any) => [
            toText(item.name),
            toText(item.email),
            roleLabel(toText(item.role)),
            item.active ? "Activo" : "Inactivo",
            toText(item.permissionCount ?? 0),
            formatAdminDateTime(item.createdAt),
          ]),
        },
      ],
      totals: {
        Registos: items.length,
      },
    });
  }
}

export class AdminSessionsReportProvider implements ReportDataProvider {
  readonly reportKey = REPORT_KEYS.ADMIN_SESSIONS;

  private readonly adminService = new AdminReportingService();

  async build(context: ReportProviderContext): Promise<ModuleReportDefinition> {
    const query = this.adminService.parseSessionQuery(context.url);
    const items = await collectAllPages((page) =>
      this.adminService.listSessions({ ...query, page, pageSize: 100 }),
    );
    const activeCount = items.filter((item) => item.active).length;

    return buildAdminReportDefinition({
      fileBaseName: "sessoes",
      reportName: "Sessoes",
      title: "Sessoes de Utilizadores",
      subtitle: "Sessoes activas e historicas do inquilino",
      filters: sessionFilterLabels(query),
      kpis: {
        Total: items.length,
        Activas: activeCount,
        Expiradas: items.length - activeCount,
      },
      tables: [
        {
          title: "Sessoes",
          columns: [
            "Utilizador",
            "Email",
            "Estado",
            "Ultima actividade",
            "Expira em",
            "IP",
            "User-Agent",
          ],
          rows: items.map((item) => [
            toText(item.userName),
            toText(item.userEmail),
            item.active ? "Activa" : "Inactiva",
            formatAdminDateTime(item.lastActivityAt),
            formatAdminDateTime(item.expiresAt),
            toText(item.ip),
            toText(item.userAgent),
          ]),
        },
      ],
      totals: {
        Registos: items.length,
      },
    });
  }
}

export class AdminLastAccessReportProvider implements ReportDataProvider {
  readonly reportKey = REPORT_KEYS.ADMIN_LAST_ACCESS;

  private readonly adminService = new AdminReportingService();

  async build(context: ReportProviderContext): Promise<ModuleReportDefinition> {
    const query = this.adminService.parseAuditQuery(context.url);
    const [dashboard, items] = await Promise.all([
      this.adminService.getUsersDashboard(),
      collectAllPages((page) =>
        this.adminService.listLastAccesses({ ...query, page, pageSize: 100 }),
      ),
    ]);

    return buildAdminReportDefinition({
      fileBaseName: "ultimos-acessos",
      reportName: "Ultimos Acessos",
      title: "Ultimos Acessos",
      subtitle: "Registos recentes de login e autorizacao",
      filters: auditFilterLabels(query),
      kpis: {
        "Utilizadores": dashboard.totalUtilizadores,
        "Acessos recentes": dashboard.ultimosAcessos?.length ?? 0,
        Registos: items.length,
      },
      tables: [
        {
          title: "Ultimos acessos",
          columns: ["Data", "Acao", "Utilizador", "Email", "IP"],
          rows: items.map((item) => [
            formatAdminDateTime(item.createdAt),
            toText(item.action),
            toText(item.user?.nome, "Sistema"),
            toText(item.user?.email),
            toText(item.ip),
          ]),
        },
      ],
      totals: {
        Registos: items.length,
      },
    });
  }
}

export class AdminLoginHistoryReportProvider implements ReportDataProvider {
  readonly reportKey = REPORT_KEYS.ADMIN_LOGIN_HISTORY;

  private readonly adminService = new AdminReportingService();

  async build(context: ReportProviderContext): Promise<ModuleReportDefinition> {
    const query = this.adminService.parseLoginHistoryQuery(context.url);
    const items = await collectAllPages((page) =>
      this.adminService.listLoginHistory({ ...query, page, pageSize: 100 }),
    );
    const successCount = items.filter((item) => item.success).length;

    return buildAdminReportDefinition({
      fileBaseName: "historico-login",
      reportName: "Historico de Login",
      title: "Historico de Login",
      subtitle: "Tentativas de autenticacao do inquilino",
      filters: loginHistoryFilterLabels(query),
      kpis: {
        Total: items.length,
        Sucesso: successCount,
        Falhas: items.length - successCount,
      },
      tables: [
        {
          title: "Historico de login",
          columns: ["Data", "Email", "Utilizador", "Resultado", "IP", "User-Agent"],
          rows: items.map((item) => [
            formatAdminDateTime(item.createdAt),
            toText(item.email),
            toText(item.userName),
            item.success ? "Sucesso" : "Falha",
            toText(item.ip),
            toText(item.userAgent),
          ]),
        },
      ],
      totals: {
        Registos: items.length,
      },
    });
  }
}

export class AdminUserActivityReportProvider implements ReportDataProvider {
  readonly reportKey = REPORT_KEYS.ADMIN_USER_ACTIVITY;

  private readonly adminService = new AdminReportingService();

  async build(context: ReportProviderContext): Promise<ModuleReportDefinition> {
    const query = this.adminService.parseAuditQuery(context.url);
    const items = await collectAllPages((page) =>
      this.adminService.listUserActivity({ ...query, page, pageSize: 100 }),
    );

    return buildAdminReportDefinition({
      fileBaseName: "atividade-utilizadores",
      reportName: "Atividade dos Utilizadores",
      title: "Atividade dos Utilizadores",
      subtitle: "Eventos de negocio associados aos utilizadores",
      filters: auditFilterLabels(query),
      kpis: {
        Registos: items.length,
        Tipos: new Set(items.map((item) => item.type)).size,
        Entidades: new Set(items.map((item) => item.entity)).size,
      },
      tables: [
        {
          title: "Atividade",
          columns: ["Data", "Tipo", "Entidade", "ID", "Utilizador", "Email"],
          rows: items.map((item) => [
            formatAdminDateTime(item.createdAt),
            toText(item.type),
            toText(item.entity),
            toText(item.entityId),
            toText(item.user?.nome, "Sistema"),
            toText(item.user?.email),
          ]),
        },
      ],
      totals: {
        Registos: items.length,
      },
    });
  }
}

export class AdminAccessAuditReportProvider implements ReportDataProvider {
  readonly reportKey = REPORT_KEYS.ADMIN_ACCESS_AUDIT;

  private readonly adminService = new AdminReportingService();

  async build(context: ReportProviderContext): Promise<ModuleReportDefinition> {
    const query = this.adminService.parseAuditQuery(context.url);
    const items = await collectAllPages((page) =>
      this.adminService.listAccessAudit({ ...query, page, pageSize: 100 }),
    );

    return buildAdminReportDefinition({
      fileBaseName: "auditoria-acessos",
      reportName: "Auditoria de Acessos",
      title: "Auditoria de Acessos",
      subtitle: "Trilho de login, logout e autorizacoes",
      filters: auditFilterLabels(query),
      kpis: {
        Registos: items.length,
        Acoes: new Set(items.map((item) => item.action)).size,
      },
      tables: [
        {
          title: "Auditoria de acessos",
          columns: ["Data", "Acao", "Utilizador", "Email", "IP", "Entidade"],
          rows: items.map((item) => [
            formatAdminDateTime(item.createdAt),
            toText(item.action),
            toText(item.user?.nome, "Sistema"),
            toText(item.user?.email),
            toText(item.ip),
            toText(item.entity),
          ]),
        },
      ],
      totals: {
        Registos: items.length,
      },
    });
  }
}

export class AdminPermissionsMatrixReportProvider implements ReportDataProvider {
  readonly reportKey = REPORT_KEYS.ADMIN_PERMISSIONS_MATRIX;

  private readonly adminService = new AdminReportingService();

  async build(context: ReportProviderContext): Promise<ModuleReportDefinition> {
    const query = this.adminService.parsePermissionsQuery(context.url);
    const [dashboard, matrixResult] = await Promise.all([
      this.adminService.getPermissionsDashboard(),
      this.adminService.getPermissionMatrix(query.role),
    ]);

    const matrix = matrixResult.modules ?? [];
    const modules = matrixResult.availableModules ?? listStandardModules();
    const actions = matrixResult.availableActions ?? listStandardActions();

    return buildAdminReportDefinition({
      fileBaseName: "matriz-permissoes",
      reportName: "Matriz de Permissoes",
      title: "Matriz de Permissoes",
      subtitle: "Granularidade por modulo e accao",
      filters: permissionsFilterLabels(query),
      kpis: {
        "Concessoes por perfil": dashboard.totalRoleGrants,
        "Overrides de utilizador": dashboard.totalUserOverrides,
        Modulos: modules.length,
      },
      tables: [
        {
          title: "Matriz de permissoes",
          columns: ["Modulo", ...actions],
          rows: modules.map((module) => {
            const row = matrix.find((entry: any) => entry.module === module);
            const actionMap = row?.actions ?? {};
            return [
              module,
              ...actions.map((action) => {
                const value = actionMap[action];
                if (Array.isArray(value)) {
                  return value.length > 0 ? value.join(", ") : "Nao";
                }
                return value === true ? "Sim" : "Nao";
              }),
            ];
          }),
        },
      ],
      totals: {
        Modulos: modules.length,
      },
    });
  }
}

export class AdminRolesReportProvider implements ReportDataProvider {
  readonly reportKey = REPORT_KEYS.ADMIN_ROLES;

  private readonly adminService = new AdminReportingService();

  async build(context: ReportProviderContext): Promise<ModuleReportDefinition> {
    const roles = await this.adminService.listRoles();
    const totalUsers = roles.reduce((sum, role) => sum + role.userCount, 0);

    return buildAdminReportDefinition({
      fileBaseName: "perfis-acesso",
      reportName: "Perfis de Acesso",
      title: "Perfis de Acesso",
      subtitle: "Conjuntos de permissoes reutilizaveis por unidade",
      kpis: {
        Perfis: roles.length,
        Utilizadores: totalUsers,
      },
      tables: [
        {
          title: "Perfis",
          columns: ["Perfil", "Descricao", "Utilizadores"],
          rows: roles.map((role) => [
            roleLabel(role.role),
            toText(role.description),
            toText(role.userCount),
          ]),
        },
      ],
      totals: {
        Perfis: roles.length,
        Utilizadores: totalUsers,
      },
    });
  }
}
