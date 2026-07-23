import { prismaCentralUnscoped } from "../../../../../infrastructure/prisma/prisma-central.service";
import { runWithCentralTenant } from "../../../../../shared/context/central-tenant-context";
import { serializePrinter } from "../../domain/printer.mapper";
import type {
  CreatePrinterInput,
  ListPrintersFilters,
  UpdatePrinterInput,
} from "../../domain/printer.types";
import { writeCentralAuditLog } from "../central-audit.helper";

const printerInclude = {
  device: { select: { id: true, name: true, code: true } },
  branch: { select: { id: true, code: true, name: true } },
} as const;

export class PrinterRepository {
  private get prisma() {
    return prismaCentralUnscoped as any;
  }

  async create(input: CreatePrinterInput, userId?: bigint | null) {
    return runWithCentralTenant(input.tenantId.toString(), async () => {
      const created = await this.prisma.$transaction(async (tx: any) => {
        await this.assertBranchBelongsToTenant(tx, input.tenantId, input.branchId);
        if (input.deviceId != null) {
          await this.assertDeviceBelongsToBranch(
            tx,
            input.tenantId,
            input.branchId,
            input.deviceId,
          );
        }

        const printer = await tx.printer.create({
          data: {
            tenantId: input.tenantId,
            branchId: input.branchId,
            deviceId: input.deviceId ?? null,
            name: input.name.trim(),
            type: input.type,
            connection: input.connection,
            ip: input.ip?.trim() || null,
            port: input.port ?? (input.connection === "NETWORK" ? 9100 : null),
            model: input.model?.trim() || null,
            manufacturer: input.manufacturer?.trim() || null,
            active: input.active ?? true,
          },
          include: printerInclude,
        });

        const serialized = serializePrinter(printer);
        await writeCentralAuditLog(
          {
            tenantId: input.tenantId,
            branchId: input.branchId,
            userId: userId ?? null,
            action: "CREATE",
            entity: "Printer",
            entityId: printer.id.toString(),
            newData: serialized,
          },
          tx,
        );

        return printer;
      });

      return serializePrinter(created);
    });
  }

  async update(
    id: bigint,
    tenantId: bigint,
    input: UpdatePrinterInput,
    userId?: bigint | null,
  ) {
    return runWithCentralTenant(tenantId.toString(), async () => {
      const existing = await this.prisma.printer.findFirst({
        where: { id, tenantId, deletedAt: null },
        include: printerInclude,
      });
      if (!existing) throw new Error("Impressora não encontrada");
      if (existing.version !== input.version) {
        throw new Error("Conflito de versão: a impressora foi alterada por outro processo");
      }

      const branchId = existing.branchId as bigint;
      if (input.deviceId !== undefined && input.deviceId != null) {
        await this.assertDeviceBelongsToBranch(
          this.prisma,
          tenantId,
          branchId,
          input.deviceId,
        );
      }

      const updated = await this.prisma.$transaction(async (tx: any) => {
        const printer = await tx.printer.update({
          where: { id, version: existing.version },
          data: {
            ...(input.deviceId !== undefined ? { deviceId: input.deviceId } : {}),
            ...(input.name !== undefined ? { name: input.name.trim() } : {}),
            ...(input.type !== undefined ? { type: input.type } : {}),
            ...(input.connection !== undefined ? { connection: input.connection } : {}),
            ...(input.ip !== undefined ? { ip: input.ip?.trim() || null } : {}),
            ...(input.port !== undefined ? { port: input.port } : {}),
            ...(input.model !== undefined ? { model: input.model?.trim() || null } : {}),
            ...(input.manufacturer !== undefined
              ? { manufacturer: input.manufacturer?.trim() || null }
              : {}),
            ...(input.active !== undefined ? { active: input.active } : {}),
            version: { increment: 1 },
          },
          include: printerInclude,
        });

        const before = serializePrinter(existing);
        const after = serializePrinter(printer);
        await writeCentralAuditLog(
          {
            tenantId,
            branchId,
            userId: userId ?? null,
            action: "UPDATE",
            entity: "Printer",
            entityId: printer.id.toString(),
            oldData: before,
            newData: after,
          },
          tx,
        );

        return printer;
      });

      return serializePrinter(updated);
    });
  }

  async softDelete(id: bigint, tenantId: bigint, userId?: bigint | null) {
    return runWithCentralTenant(tenantId.toString(), async () => {
      const existing = await this.prisma.printer.findFirst({
        where: { id, tenantId, deletedAt: null },
        include: printerInclude,
      });
      if (!existing) throw new Error("Impressora não encontrada");

      const deleted = await this.prisma.$transaction(async (tx: any) => {
        const printer = await tx.printer.update({
          where: { id, version: existing.version },
          data: {
            active: false,
            deletedAt: new Date(),
            version: { increment: 1 },
          },
          include: printerInclude,
        });

        await writeCentralAuditLog(
          {
            tenantId,
            branchId: existing.branchId,
            userId: userId ?? null,
            action: "DELETE",
            entity: "Printer",
            entityId: printer.id.toString(),
            oldData: serializePrinter(existing),
            newData: serializePrinter(printer),
          },
          tx,
        );

        return printer;
      });

      return serializePrinter(deleted);
    });
  }

  async findById(id: bigint, tenantId: bigint) {
    return runWithCentralTenant(tenantId.toString(), async () => {
      const printer = await this.prisma.printer.findFirst({
        where: { id, tenantId, deletedAt: null },
        include: printerInclude,
      });
      return printer ? serializePrinter(printer) : null;
    });
  }

  async list(filters: ListPrintersFilters) {
    return runWithCentralTenant(filters.tenantId.toString(), async () => {
      const page = Math.max(1, filters.page ?? 1);
      const pageSize = Math.min(100, Math.max(1, filters.pageSize ?? 20));
      const search = filters.search?.trim();

      const where: Record<string, unknown> = {
        tenantId: filters.tenantId,
        deletedAt: null,
        ...(filters.branchId != null ? { branchId: filters.branchId } : {}),
        ...(filters.deviceId != null ? { deviceId: filters.deviceId } : {}),
        ...(filters.active !== undefined ? { active: filters.active } : {}),
        ...(filters.type ? { type: filters.type } : {}),
        ...(filters.connection ? { connection: filters.connection } : {}),
        ...(search
          ? {
              OR: [
                { name: { contains: search } },
                { model: { contains: search } },
                { manufacturer: { contains: search } },
                { ip: { contains: search } },
              ],
            }
          : {}),
      };

      const [totalCount, rows] = await this.prisma.$transaction([
        this.prisma.printer.count({ where }),
        this.prisma.printer.findMany({
          where,
          include: printerInclude,
          orderBy: [{ active: "desc" }, { name: "asc" }],
          skip: (page - 1) * pageSize,
          take: pageSize,
        }),
      ]);

      return {
        items: rows.map(serializePrinter),
        page,
        pageSize,
        totalCount,
        totalPages: Math.max(1, Math.ceil(totalCount / pageSize)),
        hasMore: page * pageSize < totalCount,
        hasPrevious: page > 1,
      };
    });
  }

  private async assertBranchBelongsToTenant(
    tx: any,
    tenantId: bigint,
    branchId: bigint,
  ) {
    const branch = await tx.branch.findFirst({
      where: { id: branchId, tenantId, deletedAt: null },
      select: { id: true },
    });
    if (!branch) throw new Error("Filial inválida para o tenant");
  }

  private async assertDeviceBelongsToBranch(
    tx: any,
    tenantId: bigint,
    branchId: bigint,
    deviceId: bigint,
  ) {
    const device = await tx.device.findFirst({
      where: {
        id: deviceId,
        tenantId,
        branchId,
        deletedAt: null,
      },
      select: { id: true },
    });
    if (!device) throw new Error("Device inválido para a filial");
  }
}
