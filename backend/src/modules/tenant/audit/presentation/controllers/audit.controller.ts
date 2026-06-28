import { z } from "zod";
import { getPrisma } from "../../../../../infrastructure/prisma/tenant-prisma.factory";
import { ComplianceAuditService } from "../../../../../shared/services/compliance-audit.service";
import { parseDateRange } from "../../../regulatory/application/use-cases/regulatory.helpers";
import {
  parseSearchParams,
} from "../../../../../shared/http/request-validation";
import { controllerErrorResponse } from "../../../../../shared/http/controller-error";
import { success } from "../../../../../shared/http/api-response";

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

export class AuditController {
  private auditService = new ComplianceAuditService();

  private get prisma() {
    return getPrisma() as any;
  }

  private serialize(data: unknown) {
    return JSON.parse(
      JSON.stringify(data, (_key, value) =>
        typeof value === "bigint" ? value.toString() : value,
      ),
    );
  }

  async dashboard() {
    try {
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
            action: { in: ["PERMISSION_GRANT", "PERMISSION_REVOKE", "USER_PERMISSION_GRANT", "USER_PERMISSION_DENY"] },
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

      return success(
        this.serialize({
          totalLogs,
          logsLast24h: recentLogs,
          criticalEventsLast7d: criticalEvents,
          permissionChangesLast7d: permissionChanges,
          userChangesLast7d: userChanges,
          recentEvents: recentEvents.map((e: any) => ({
            id: e.id.toString(),
            type: e.type,
            entity: e.entity,
            entityId: e.entityId?.toString() ?? null,
            createdAt: e.createdAt.toISOString(),
            user: e.user
              ? { id: e.user.id.toString(), nome: e.user.name, email: e.user.email ?? null }
              : null,
          })),
        }),
      );
    } catch (error: any) {
      return controllerErrorResponse(error, 500);
    }
  }

  async listAuditLogs(req: Request) {
    try {
      const url = new URL(req.url);
      const params = parseSearchParams(url, searchAuditQuerySchema);
      const page = Math.max(1, params.page ?? 1);
      const pageSize = Math.min(100, Math.max(1, params.pageSize ?? 20));
      const { from, to } = parseDateRange(params.dateFrom, params.dateTo);
      const query = params.q?.trim();

      const where: any = {
        ...(params.userId ? { userId: BigInt(params.userId) } : {}),
        ...(params.entity ? { entity: params.entity } : {}),
        ...(params.action ? { action: params.action } : {}),
        ...(from || to
          ? {
              createdAt: {
                ...(from ? { gte: from } : {}),
                ...(to ? { lte: to } : {}),
              },
            }
          : {}),
        ...(query
          ? {
              OR: [
                { action: { contains: query } },
                { entity: { contains: query } },
              ],
            }
          : {}),
      };

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

      const items = rows.slice(0, pageSize).map((row: any) => ({
        id: row.id.toString(),
        action: row.action,
        entity: row.entity,
        entityId: row.entityId?.toString() ?? null,
        before: row.before ?? null,
        after: row.after ?? null,
        ip: row.ip ?? null,
        createdAt: row.createdAt.toISOString(),
        user: row.user
          ? { id: row.user.id.toString(), nome: row.user.name, email: row.user.email ?? null }
          : null,
      }));

      return success(this.serialize(items), 200, {
        page,
        pageSize,
        hasMore: rows.length > pageSize,
        totalCount,
      });
    } catch (error: any) {
      return controllerErrorResponse(error, 500);
    }
  }

  async listBusinessEvents(req: Request) {
    try {
      const url = new URL(req.url);
      const params = parseSearchParams(url, searchAuditQuerySchema);
      const page = Math.max(1, params.page ?? 1);
      const pageSize = Math.min(100, Math.max(1, params.pageSize ?? 20));
      const { from, to } = parseDateRange(params.dateFrom, params.dateTo);

      const where: any = {
        ...(params.userId ? { userId: BigInt(params.userId) } : {}),
        ...(params.entity ? { entity: params.entity } : {}),
        ...(params.type ? { type: params.type } : {}),
        ...(from || to
          ? {
              createdAt: {
                ...(from ? { gte: from } : {}),
                ...(to ? { lte: to } : {}),
              },
            }
          : {}),
      };

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

      const items = rows.slice(0, pageSize).map((row: any) => ({
        id: row.id.toString(),
        type: row.type,
        entity: row.entity,
        entityId: row.entityId?.toString() ?? null,
        payload: row.payload ?? null,
        createdAt: row.createdAt.toISOString(),
        user: row.user
          ? { id: row.user.id.toString(), nome: row.user.name, email: row.user.email ?? null }
          : null,
      }));

      return success(this.serialize(items), 200, {
        page,
        pageSize,
        hasMore: rows.length > pageSize,
        totalCount,
      });
    } catch (error: any) {
      return controllerErrorResponse(error, 500);
    }
  }

  async verifyIntegrity() {
    try {
      const result = await this.auditService.verifyIntegrity();
      return success(this.serialize(result));
    } catch (error: any) {
      return controllerErrorResponse(error, 500);
    }
  }
}
