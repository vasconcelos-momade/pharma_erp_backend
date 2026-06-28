import { getPrisma } from "../../../../../infrastructure/prisma/tenant-prisma.factory";
import { ComplianceAuditService } from "../../../../../shared/services/compliance-audit.service";
import type { CreateUserDTO, UpdateUserDTO } from "../../application/dto/user.dto";

type UserSearchFilters = {
  query?: string;
  role?: string;
  active?: boolean;
  sortBy?: "name" | "createdAt" | "role";
  sortOrder?: "asc" | "desc";
  page?: number;
  pageSize?: number;
};

function serializeUser(row: any) {
  return {
    id: row.id.toString(),
    name: row.name,
    email: row.email ?? null,
    role: row.role,
    active: Boolean(row.active),
    centralUserId: row.centralUserId?.toString() ?? null,
    version: row.version,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    permissionCount: row._count?.userPermissions ?? undefined,
    eventCount: row._count?.businessEvents ?? undefined,
    auditCount: row._count?.auditLogs ?? undefined,
  };
}

export class UserRepository {
  private audit = new ComplianceAuditService();

  private get prisma() {
    return getPrisma() as any;
  }

  async create(data: CreateUserDTO, actorId: bigint) {
    const email = data.email.trim().toLowerCase();
    const existing = await this.prisma.user.findFirst({
      where: { email, deletedAt: null },
    });
    if (existing) throw new Error("Email já registado");

    const created = await this.prisma.$transaction(async (tx: any) => {
      const user = await tx.user.create({
        data: {
          name: data.name,
          email,
          role: data.role,
          active: data.active ?? true,
          centralUserId: data.centralUserId ? BigInt(data.centralUserId) : null,
        },
      });

      await this.audit.createImmutableLog(
        {
          userId: actorId,
          action: "CREATE",
          entity: "User",
          entityId: user.id,
          after: serializeUser(user),
        },
        tx,
      );

      return user;
    });

    return serializeUser(created);
  }

  async update(id: bigint, data: UpdateUserDTO, actorId: bigint) {
    const existing = await this.prisma.user.findFirst({
      where: { id, deletedAt: null },
    });
    if (!existing) throw new Error("Utilizador não encontrado");

    if (data.version !== undefined && data.version !== existing.version) {
      throw new Error("Conflito de versão — registo foi alterado por outro utilizador");
    }

    const updated = await this.prisma.$transaction(async (tx: any) => {
      const user = await tx.user.update({
        where: { id },
        data: {
          ...(data.name !== undefined ? { name: data.name } : {}),
          ...(data.email !== undefined ? { email: data.email.trim().toLowerCase() } : {}),
          ...(data.role !== undefined ? { role: data.role } : {}),
          ...(data.active !== undefined ? { active: data.active } : {}),
          version: { increment: 1 },
        },
      });

      await this.audit.createImmutableLog(
        {
          userId: actorId,
          action: "UPDATE",
          entity: "User",
          entityId: id,
          before: serializeUser(existing),
          after: serializeUser(user),
        },
        tx,
      );

      return user;
    });

    return serializeUser(updated);
  }

  async softDelete(id: bigint, actorId: bigint) {
    const existing = await this.prisma.user.findFirst({
      where: { id, deletedAt: null },
    });
    if (!existing) throw new Error("Utilizador não encontrado");

    await this.prisma.$transaction(async (tx: any) => {
      await tx.user.update({
        where: { id },
        data: { deletedAt: new Date(), active: false, version: { increment: 1 } },
      });
      await this.audit.createImmutableLog(
        {
          userId: actorId,
          action: "DELETE",
          entity: "User",
          entityId: id,
          before: serializeUser(existing),
        },
        tx,
      );
    });
  }

  async search(filters: UserSearchFilters = {}) {
    const query = (filters.query ?? "").trim() || undefined;
    const page = Math.max(1, filters.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, filters.pageSize ?? 20));
    const sortBy = filters.sortBy ?? "name";
    const sortOrder = filters.sortOrder === "desc" ? "desc" : "asc";

    const where: any = {
      deletedAt: null,
      ...(filters.role ? { role: filters.role } : {}),
      ...(filters.active !== undefined ? { active: filters.active } : {}),
      ...(query
        ? {
            OR: [
              { name: { contains: query } },
              { email: { contains: query } },
            ],
          }
        : {}),
    };

    const orderBy =
      sortBy === "createdAt"
        ? [{ createdAt: sortOrder }, { id: sortOrder }]
        : sortBy === "role"
          ? [{ role: sortOrder }, { name: "asc" }]
          : [{ name: sortOrder }, { id: sortOrder }];

    const [totalCount, rows] = await this.prisma.$transaction([
      this.prisma.user.count({ where }),
      this.prisma.user.findMany({
        where,
        include: {
          _count: { select: { userPermissions: true, businessEvents: true, auditLogs: true } },
        },
        orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize + 1,
      }),
    ]);

    return {
      items: rows.slice(0, pageSize).map(serializeUser),
      page,
      pageSize,
      hasMore: rows.length > pageSize,
      totalCount,
    };
  }

  async getById(id: bigint) {
    const row = await this.prisma.user.findFirst({
      where: { id, deletedAt: null },
      include: {
        userPermissions: true,
        _count: { select: { businessEvents: true, auditLogs: true, faturas: true } },
      },
    });
    if (!row) throw new Error("Utilizador não encontrado");

    return {
      ...serializeUser(row),
      permissions: row.userPermissions.map((p: any) => ({
        id: p.id.toString(),
        module: p.module,
        action: p.action,
        allowed: Boolean(p.allowed),
      })),
      stats: {
        faturas: row._count.faturas,
        eventos: row._count.businessEvents,
        auditLogs: row._count.auditLogs,
      },
    };
  }

  async getDashboard() {
    const [total, ativos, inativos, ultimosAcessos] = await Promise.all([
      this.prisma.user.count({ where: { deletedAt: null } }),
      this.prisma.user.count({ where: { deletedAt: null, active: true } }),
      this.prisma.user.count({ where: { deletedAt: null, active: false } }),
      this.prisma.auditLog.findMany({
        where: { action: { in: ["LOGIN", "AUTHORIZATION_GRANTED"] } },
        include: { user: { select: { id: true, name: true, email: true } } },
        orderBy: { createdAt: "desc" },
        take: 10,
      }),
    ]);

    return {
      totalUtilizadores: total,
      ativos,
      inativos,
      ultimosAcessos: ultimosAcessos.map((log: any) => ({
        id: log.id.toString(),
        action: log.action,
        createdAt: log.createdAt.toISOString(),
        user: log.user
          ? { id: log.user.id.toString(), nome: log.user.name, email: log.user.email ?? null }
          : null,
      })),
    };
  }

  async listAuditLogs(userId: bigint, page = 1, pageSize = 20) {
    const safePage = Math.max(1, page);
    const safeSize = Math.min(100, Math.max(1, pageSize));
    const where = { userId };

    const [totalCount, rows] = await this.prisma.$transaction([
      this.prisma.auditLog.count({ where }),
      this.prisma.auditLog.findMany({
        where,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        skip: (safePage - 1) * safeSize,
        take: safeSize + 1,
      }),
    ]);

    return {
      items: rows.slice(0, safeSize).map((row: any) => ({
        id: row.id.toString(),
        action: row.action,
        entity: row.entity,
        entityId: row.entityId?.toString() ?? null,
        before: row.before ?? null,
        after: row.after ?? null,
        createdAt: row.createdAt.toISOString(),
      })),
      page: safePage,
      pageSize: safeSize,
      hasMore: rows.length > safeSize,
      totalCount,
    };
  }

  async listBusinessEvents(userId: bigint, page = 1, pageSize = 20) {
    const safePage = Math.max(1, page);
    const safeSize = Math.min(100, Math.max(1, pageSize));
    const where = { userId };

    const [totalCount, rows] = await this.prisma.$transaction([
      this.prisma.businessEvent.count({ where }),
      this.prisma.businessEvent.findMany({
        where,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        skip: (safePage - 1) * safeSize,
        take: safeSize + 1,
      }),
    ]);

    return {
      items: rows.slice(0, safeSize).map((row: any) => ({
        id: row.id.toString(),
        type: row.type,
        entity: row.entity,
        entityId: row.entityId?.toString() ?? null,
        payload: row.payload ?? null,
        createdAt: row.createdAt.toISOString(),
      })),
      page: safePage,
      pageSize: safeSize,
      hasMore: rows.length > safeSize,
      totalCount,
    };
  }
}
