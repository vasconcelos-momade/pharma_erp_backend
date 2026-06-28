import { z } from "zod";
import { prismaCentralUnscoped } from "../../../../../infrastructure/prisma/prisma-central.service";
import { getPrisma } from "../../../../../infrastructure/prisma/tenant-prisma.factory";
import { parseSearchParams } from "../../../../../shared/http/request-validation";
import { getBranchStore } from "../../../../../shared/context/branch-context";
import { parseDateRange } from "../../../regulatory/application/use-cases/regulatory.helpers";
import {
  AuditReportingService,
  type AuditListResult,
  type AuditLogSummary,
  type BusinessEventSummary,
} from "../../../audit/application/services/audit-reporting.service";
import { UserService } from "./user.service";

const ACCESS_AUDIT_ACTIONS = ["LOGIN", "AUTHORIZATION_GRANTED", "LOGOUT", "SESSION_REVOKED"];

const adminUserQuerySchema = z.object({
  q: z.string().trim().min(1).optional(),
  search: z.string().trim().min(1).optional(),
  role: z.string().trim().min(1).optional(),
  active: z.coerce.boolean().optional(),
  sortBy: z.enum(["name", "createdAt", "role"]).optional(),
  sortOrder: z.enum(["asc", "desc"]).optional(),
  page: z.coerce.number().int().positive().optional(),
  pageSize: z.coerce.number().int().positive().max(100).optional(),
});

const adminSessionQuerySchema = z.object({
  q: z.string().trim().min(1).optional(),
  activeOnly: z.coerce.boolean().optional(),
  page: z.coerce.number().int().positive().optional(),
  pageSize: z.coerce.number().int().positive().max(100).optional(),
});

const adminLoginHistoryQuerySchema = z.object({
  q: z.string().trim().min(1).optional(),
  success: z.coerce.boolean().optional(),
  dateFrom: z.string().trim().min(1).optional(),
  dateTo: z.string().trim().min(1).optional(),
  page: z.coerce.number().int().positive().optional(),
  pageSize: z.coerce.number().int().positive().max(100).optional(),
});

const adminAuditQuerySchema = z.object({
  q: z.string().trim().min(1).optional(),
  userId: z.string().regex(/^\d+$/).optional(),
  dateFrom: z.string().trim().min(1).optional(),
  dateTo: z.string().trim().min(1).optional(),
  page: z.coerce.number().int().positive().optional(),
  pageSize: z.coerce.number().int().positive().max(100).optional(),
});

const adminPermissionsQuerySchema = z.object({
  role: z.string().trim().min(1).optional(),
});

export type AdminUserQuery = z.infer<typeof adminUserQuerySchema>;
export type AdminSessionQuery = z.infer<typeof adminSessionQuerySchema>;
export type AdminLoginHistoryQuery = z.infer<typeof adminLoginHistoryQuerySchema>;
export type AdminAuditQuery = z.infer<typeof adminAuditQuerySchema>;
export type AdminPermissionsQuery = z.infer<typeof adminPermissionsQuerySchema>;

export type AdminSessionSummary = {
  id: string;
  userId: string;
  userName: string;
  userEmail: string | null;
  expiresAt: string;
  revokedAt: string | null;
  lastActivityAt: string;
  ip: string | null;
  userAgent: string | null;
  active: boolean;
};

export type AdminLoginAttemptSummary = {
  id: string;
  email: string;
  success: boolean;
  userId: string | null;
  userName: string | null;
  ip: string | null;
  userAgent: string | null;
  createdAt: string;
};

export type AdminListResult<T> = {
  items: T[];
  page: number;
  pageSize: number;
  hasMore: boolean;
  totalCount: number;
};

export class AdminReportingService {
  private readonly userService = new UserService();
  private readonly auditService = new AuditReportingService();

  parseUserQuery(url: URL): AdminUserQuery {
    return parseSearchParams(url, adminUserQuerySchema);
  }

  parseSessionQuery(url: URL): AdminSessionQuery {
    return parseSearchParams(url, adminSessionQuerySchema);
  }

  parseLoginHistoryQuery(url: URL): AdminLoginHistoryQuery {
    return parseSearchParams(url, adminLoginHistoryQuerySchema);
  }

  parseAuditQuery(url: URL): AdminAuditQuery {
    return parseSearchParams(url, adminAuditQuerySchema);
  }

  parsePermissionsQuery(url: URL): AdminPermissionsQuery {
    return parseSearchParams(url, adminPermissionsQuerySchema);
  }

  searchUsers(query: AdminUserQuery) {
    return this.userService.search({
      query: query.q ?? query.search,
      role: query.role,
      active: query.active,
      sortBy: query.sortBy,
      sortOrder: query.sortOrder,
      page: query.page,
      pageSize: query.pageSize,
    });
  }

  getUsersDashboard() {
    return this.userService.getDashboard();
  }

  listRoles() {
    return this.userService.listRoles();
  }

  getPermissionMatrix(role?: string) {
    return this.userService.getPermissionMatrix(role);
  }

  getPermissionsDashboard() {
    return this.userService.getPermissionsDashboard();
  }

  async listAccessAudit(query: AdminAuditQuery): Promise<AuditListResult<AuditLogSummary>> {
    const page = Math.max(1, query.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, query.pageSize ?? 20));
    const { from, to } = parseDateRange(query.dateFrom, query.dateTo);
    const search = query.q?.trim();

    const where: Record<string, unknown> = {
      action: { in: ACCESS_AUDIT_ACTIONS },
      ...(query.userId ? { userId: BigInt(query.userId) } : {}),
      ...(from || to
        ? {
            createdAt: {
              ...(from ? { gte: from } : {}),
              ...(to ? { lte: to } : {}),
            },
          }
        : {}),
      ...(search
        ? {
            OR: [
              { action: { contains: search } },
              { entity: { contains: search } },
            ],
          }
        : {}),
    };

    const prisma = getPrisma() as any;
    const [totalCount, rows] = await prisma.$transaction([
      prisma.auditLog.count({ where }),
      prisma.auditLog.findMany({
        where,
        include: { user: { select: { id: true, name: true, email: true } } },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        skip: (page - 1) * pageSize,
        take: pageSize + 1,
      }),
    ]);

    return {
      items: rows.slice(0, pageSize).map((row: any) => ({
        id: row.id.toString(),
        action: row.action,
        entity: row.entity,
        entityId: row.entityId?.toString() ?? null,
        before: row.before ?? null,
        after: row.after ?? null,
        ip: row.ip ?? null,
        createdAt: row.createdAt.toISOString(),
        user: row.user
          ? {
              id: row.user.id.toString(),
              nome: row.user.name,
              email: row.user.email ?? null,
            }
          : null,
      })),
      page,
      pageSize,
      hasMore: rows.length > pageSize,
      totalCount,
    };
  }

  async listLastAccesses(query: AdminAuditQuery): Promise<AuditListResult<AuditLogSummary>> {
    return this.listAccessAudit(query);
  }

  listUserActivity(query: AdminAuditQuery): Promise<AuditListResult<BusinessEventSummary>> {
    return this.auditService.listBusinessEvents({
      q: query.q,
      userId: query.userId,
      dateFrom: query.dateFrom,
      dateTo: query.dateTo,
      page: query.page,
      pageSize: query.pageSize,
    });
  }

  async listSessions(query: AdminSessionQuery): Promise<AdminListResult<AdminSessionSummary>> {
    const tenantRefs = await this.getTenantCentralUserRefs();
    const centralUserIds = tenantRefs.userIds;
    const page = Math.max(1, query.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, query.pageSize ?? 20));
    const search = query.q?.trim().toLowerCase();
    const now = new Date();

    const userMap = new Map(
      tenantRefs.users.map((user) => [user.id, user]),
    );

    const where: Record<string, unknown> = {
      userId: { in: centralUserIds },
      deletedAt: null,
      ...(query.activeOnly
        ? { revokedAt: null, expiresAt: { gt: now } }
        : {}),
    };

    const prisma = prismaCentralUnscoped as any;
    const [totalCount, rows] = await prisma.$transaction([
      prisma.userSession.count({ where }),
      prisma.userSession.findMany({
        where,
        orderBy: [{ lastActivityAt: "desc" }, { id: "desc" }],
        skip: (page - 1) * pageSize,
        take: pageSize + 1,
      }),
    ]);

    let items = rows.slice(0, pageSize).map((row: any) => {
      const user = userMap.get(row.userId.toString());
      return {
        id: row.id.toString(),
        userId: row.userId.toString(),
        userName: user?.name ?? "-",
        userEmail: user?.email ?? null,
        expiresAt: row.expiresAt.toISOString(),
        revokedAt: row.revokedAt?.toISOString() ?? null,
        lastActivityAt: row.lastActivityAt.toISOString(),
        ip: row.ip ?? null,
        userAgent: row.userAgent ?? null,
        active: !row.revokedAt && row.expiresAt > now,
      };
    });

    if (search) {
      items = items.filter(
        (item) =>
          item.userName.toLowerCase().includes(search) ||
          (item.userEmail?.toLowerCase().includes(search) ?? false) ||
          (item.ip?.includes(search) ?? false),
      );
    }

    return {
      items,
      page,
      pageSize,
      hasMore: rows.length > pageSize,
      totalCount: search ? items.length : totalCount,
    };
  }

  async listLoginHistory(
    query: AdminLoginHistoryQuery,
  ): Promise<AdminListResult<AdminLoginAttemptSummary>> {
    const tenantRefs = await this.getTenantCentralUserRefs();
    const page = Math.max(1, query.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, query.pageSize ?? 20));
    const { from, to } = parseDateRange(query.dateFrom, query.dateTo);
    const search = query.q?.trim().toLowerCase();

    const userMap = new Map(
      tenantRefs.users.map((user) => [user.id, user]),
    );

    const where: Record<string, unknown> = {
      AND: [
        {
          OR: [
            { userId: { in: tenantRefs.userIds } },
            ...(tenantRefs.emails.length > 0
              ? [{ email: { in: tenantRefs.emails } }]
              : []),
          ],
        },
        ...(query.success !== undefined ? [{ success: query.success }] : []),
        ...(from || to
          ? [
              {
                createdAt: {
                  ...(from ? { gte: from } : {}),
                  ...(to ? { lte: to } : {}),
                },
              },
            ]
          : []),
        ...(search
          ? [
              {
                OR: [
                  { email: { contains: search } },
                  { ip: { contains: search } },
                ],
              },
            ]
          : []),
      ],
    };

    const prisma = prismaCentralUnscoped as any;
    const [totalCount, rows] = await prisma.$transaction([
      prisma.loginAttempt.count({ where }),
      prisma.loginAttempt.findMany({
        where,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        skip: (page - 1) * pageSize,
        take: pageSize + 1,
      }),
    ]);

    return {
      items: rows.slice(0, pageSize).map((row: any) => {
        const userId = row.userId?.toString() ?? null;
        const user = userId ? userMap.get(userId) : null;
        return {
          id: row.id.toString(),
          email: row.email,
          success: Boolean(row.success),
          userId,
          userName: user?.name ?? null,
          ip: row.ip ?? null,
          userAgent: row.userAgent ?? null,
          createdAt: row.createdAt.toISOString(),
        };
      }),
      page,
      pageSize,
      hasMore: rows.length > pageSize,
      totalCount,
    };
  }

  private async getTenantCentralUserRefs() {
    const tenantId = BigInt(getBranchStore().tenantId);
    const prisma = prismaCentralUnscoped as any;

    const links = await prisma.userTenant.findMany({
      where: { tenantId, active: true, deletedAt: null },
      select: {
        userId: true,
        user: { select: { name: true, email: true } },
      },
    });

    return {
      userIds: links.map((link: any) => link.userId),
      users: links.map((link: any) => ({
        id: link.userId.toString(),
        name: link.user.name,
        email: link.user.email ?? null,
      })),
      emails: links
        .map((link: any) => link.user.email?.trim().toLowerCase())
        .filter(Boolean),
    };
  }
}
