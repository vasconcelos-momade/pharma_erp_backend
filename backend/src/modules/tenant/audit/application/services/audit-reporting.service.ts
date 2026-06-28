import { z } from "zod";
import { getPrisma } from "../../../../../infrastructure/prisma/tenant-prisma.factory";
import {
  parseSearchParams,
} from "../../../../../shared/http/request-validation";
import { ComplianceAuditService } from "../../../../../shared/services/compliance-audit.service";
import { parseDateRange } from "../../../regulatory/application/use-cases/regulatory.helpers";

const searchAuditQuerySchema = z.object({
  q: z.string().trim().min(1).optional(),
  userId: z.string().regex(/^\d+$/).optional(),
  entity: z.string().trim().min(1).optional(),
  action: z.string().trim().min(1).optional(),
  type: z.string().trim().min(1).optional(),
  dateFrom: z.string().trim().min(1).optional(),
  dateTo: z.string().trim().min(1).optional(),
  page: z.coerce.number().int().positive().optional(),
  pageSize: z.coerce.number().int().positive().max(100).optional(),
});

export type AuditSearchQuery = z.infer<typeof searchAuditQuerySchema>;

export type AuditActorSummary = {
  id: string;
  nome: string;
  email: string | null;
};

export type AuditLogSummary = {
  id: string;
  action: string;
  entity: string;
  entityId: string | null;
  before: unknown;
  after: unknown;
  ip: string | null;
  createdAt: string;
  user: AuditActorSummary | null;
};

export type BusinessEventSummary = {
  id: string;
  type: string;
  entity: string;
  entityId: string | null;
  payload: unknown;
  createdAt: string;
  user: AuditActorSummary | null;
};

export type AuditDashboardSnapshot = {
  totalLogs: number;
  logsLast24h: number;
  criticalEventsLast7d: number;
  permissionChangesLast7d: number;
  userChangesLast7d: number;
  recentEvents: BusinessEventSummary[];
};

export type AuditListResult<T> = {
  items: T[];
  page: number;
  pageSize: number;
  hasMore: boolean;
  totalCount: number;
};

export class AuditReportingService {
  private readonly auditService = new ComplianceAuditService();

  private get prisma() {
    return getPrisma() as any;
  }

  parseQuery(url: URL): AuditSearchQuery {
    return parseSearchParams(url, searchAuditQuerySchema);
  }

  async dashboard(): Promise<AuditDashboardSnapshot> {
    const now = new Date();
    const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const last7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const [
      totalLogs,
      recentLogs,
      criticalEvents,
      permissionChanges,
      userChanges,
      recentEvents,
    ] = await Promise.all([
      this.prisma.auditLog.count(),
      this.prisma.auditLog.count({ where: { createdAt: { gte: last24h } } }),
      this.prisma.businessEvent.count({
        where: {
          type: { in: ["SALE_CANCELED", "STOCK_REVERSED", "PERMISSION_DENIED"] },
          createdAt: { gte: last7d },
        },
      }),
      this.prisma.auditLog.count({
        where: {
          action: {
            in: [
              "PERMISSION_GRANT",
              "PERMISSION_REVOKE",
              "USER_PERMISSION_GRANT",
              "USER_PERMISSION_DENY",
            ],
          },
          createdAt: { gte: last7d },
        },
      }),
      this.prisma.auditLog.count({
        where: {
          entity: "User",
          createdAt: { gte: last7d },
        },
      }),
      this.prisma.businessEvent.findMany({
        orderBy: { createdAt: "desc" },
        take: 10,
        include: { user: { select: { id: true, name: true, email: true } } },
      }),
    ]);

    return {
      totalLogs,
      logsLast24h: recentLogs,
      criticalEventsLast7d: criticalEvents,
      permissionChangesLast7d: permissionChanges,
      userChangesLast7d: userChanges,
      recentEvents: recentEvents.map((event: any) => this.mapBusinessEvent(event)),
    };
  }

  async listAuditLogs(query: AuditSearchQuery): Promise<AuditListResult<AuditLogSummary>> {
    const page = Math.max(1, query.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, query.pageSize ?? 20));
    const where = this.buildAuditLogWhere(query);

    const [totalCount, rows] = await this.prisma.$transaction([
      this.prisma.auditLog.count({ where }),
      this.prisma.auditLog.findMany({
        where,
        include: { user: { select: { id: true, name: true, email: true } } },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        skip: (page - 1) * pageSize,
        take: pageSize + 1,
      }),
    ]);

    return {
      items: rows.slice(0, pageSize).map((row: any) => this.mapAuditLog(row)),
      page,
      pageSize,
      hasMore: rows.length > pageSize,
      totalCount,
    };
  }

  async listBusinessEvents(
    query: AuditSearchQuery,
  ): Promise<AuditListResult<BusinessEventSummary>> {
    const page = Math.max(1, query.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, query.pageSize ?? 20));
    const where = this.buildBusinessEventWhere(query);

    const [totalCount, rows] = await this.prisma.$transaction([
      this.prisma.businessEvent.count({ where }),
      this.prisma.businessEvent.findMany({
        where,
        include: { user: { select: { id: true, name: true, email: true } } },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        skip: (page - 1) * pageSize,
        take: pageSize + 1,
      }),
    ]);

    return {
      items: rows.slice(0, pageSize).map((row: any) => this.mapBusinessEvent(row)),
      page,
      pageSize,
      hasMore: rows.length > pageSize,
      totalCount,
    };
  }

  async verifyIntegrity() {
    return this.auditService.verifyIntegrity();
  }

  private buildAuditLogWhere(query: AuditSearchQuery) {
    const { from, to } = parseDateRange(query.dateFrom, query.dateTo);
    const search = query.q?.trim();

    return {
      ...(query.userId ? { userId: BigInt(query.userId) } : {}),
      ...(query.entity ? { entity: query.entity } : {}),
      ...(query.action ? { action: query.action } : {}),
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
  }

  private buildBusinessEventWhere(query: AuditSearchQuery) {
    const { from, to } = parseDateRange(query.dateFrom, query.dateTo);

    return {
      ...(query.userId ? { userId: BigInt(query.userId) } : {}),
      ...(query.entity ? { entity: query.entity } : {}),
      ...(query.type ? { type: query.type } : {}),
      ...(from || to
        ? {
            createdAt: {
              ...(from ? { gte: from } : {}),
              ...(to ? { lte: to } : {}),
            },
          }
        : {}),
    };
  }

  private mapUser(user: any): AuditActorSummary | null {
    if (!user) {
      return null;
    }

    return {
      id: user.id.toString(),
      nome: user.name,
      email: user.email ?? null,
    };
  }

  private mapAuditLog(row: any): AuditLogSummary {
    return {
      id: row.id.toString(),
      action: row.action,
      entity: row.entity,
      entityId: row.entityId?.toString() ?? null,
      before: row.before ?? null,
      after: row.after ?? null,
      ip: row.ip ?? null,
      createdAt: row.createdAt.toISOString(),
      user: this.mapUser(row.user),
    };
  }

  private mapBusinessEvent(row: any): BusinessEventSummary {
    return {
      id: row.id.toString(),
      type: row.type,
      entity: row.entity,
      entityId: row.entityId?.toString() ?? null,
      payload: row.payload ?? null,
      createdAt: row.createdAt.toISOString(),
      user: this.mapUser(row.user),
    };
  }
}
