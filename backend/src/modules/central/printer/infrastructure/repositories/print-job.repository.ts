import { prismaCentralUnscoped } from "../../../../../infrastructure/prisma/prisma-central.service";
import { runWithCentralTenant } from "../../../../../shared/context/central-tenant-context";
import { serializePrintJob } from "../../domain/printer.mapper";
import type {
  ClaimPrintJobInput,
  CreatePrintJobInput,
  ListPrintJobsFilters,
  PrintStatusValue,
} from "../../domain/printer.types";
import { writeCentralAuditLog } from "../central-audit.helper";

const printJobInclude = {
  printer: {
    include: {
      device: { select: { id: true, name: true, code: true } },
      branch: { select: { id: true, code: true, name: true } },
    },
  },
} as const;

export class PrintJobRepository {
  private get prisma() {
    return prismaCentralUnscoped as any;
  }

  async create(input: CreatePrintJobInput, userId?: bigint | null) {
    return runWithCentralTenant(input.tenantId.toString(), async () => {
      const created = await this.prisma.$transaction(async (tx: any) => {
        const printer = await tx.printer.findFirst({
          where: {
            id: input.printerId,
            tenantId: input.tenantId,
            branchId: input.branchId,
            deletedAt: null,
            active: true,
          },
          include: {
            device: { select: { id: true, name: true, code: true } },
            branch: { select: { id: true, code: true, name: true } },
          },
        });
        if (!printer) {
          throw new Error("Impressora não encontrada ou inactiva");
        }

        const job = await tx.printJob.create({
          data: {
            tenantId: input.tenantId,
            branchId: input.branchId,
            printerId: input.printerId,
            document: input.document.trim(),
            payload: input.payload as object,
            status: "PENDING",
            attempts: 0,
            maxAttempts: input.maxAttempts ?? 3,
          },
          include: printJobInclude,
        });

        await writeCentralAuditLog(
          {
            tenantId: input.tenantId,
            branchId: input.branchId,
            userId: userId ?? null,
            action: "CREATE",
            entity: "PrintJob",
            entityId: job.id.toString(),
            newData: serializePrintJob(job),
          },
          tx,
        );

        return job;
      });

      return serializePrintJob(created);
    });
  }

  async findById(id: bigint, tenantId: bigint) {
    return runWithCentralTenant(tenantId.toString(), async () => {
      const job = await this.prisma.printJob.findFirst({
        where: { id, tenantId, deletedAt: null },
        include: printJobInclude,
      });
      return job ? serializePrintJob(job) : null;
    });
  }

  async list(filters: ListPrintJobsFilters) {
    return runWithCentralTenant(filters.tenantId.toString(), async () => {
      const page = Math.max(1, filters.page ?? 1);
      const pageSize = Math.min(100, Math.max(1, filters.pageSize ?? 20));

      const where: Record<string, unknown> = {
        tenantId: filters.tenantId,
        deletedAt: null,
        ...(filters.branchId != null ? { branchId: filters.branchId } : {}),
        ...(filters.printerId != null ? { printerId: filters.printerId } : {}),
        ...(filters.status ? { status: filters.status } : {}),
        ...(filters.document
          ? { document: { contains: filters.document.trim() } }
          : {}),
      };

      const [totalCount, rows] = await this.prisma.$transaction([
        this.prisma.printJob.count({ where }),
        this.prisma.printJob.findMany({
          where,
          include: printJobInclude,
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
          skip: (page - 1) * pageSize,
          take: pageSize,
        }),
      ]);

      return {
        items: rows.map(serializePrintJob),
        page,
        pageSize,
        totalCount,
        totalPages: Math.max(1, Math.ceil(totalCount / pageSize)),
        hasMore: page * pageSize < totalCount,
        hasPrevious: page > 1,
      };
    });
  }

  /**
   * Reserva jobs PENDING para o worker (lock optimista).
   * Usa prisma unscoped — o worker processa jobs de todos os tenants.
   */
  async claimPendingJobs(input: ClaimPrintJobInput) {
    const maxJobs = Math.min(50, Math.max(1, input.maxJobs ?? 5));
    const now = new Date();

    const candidates = await this.prisma.printJob.findMany({
      where: {
        deletedAt: null,
        status: "PENDING",
        OR: [{ lockedAt: null }, { lockedAt: { lt: new Date(now.getTime() - 60_000) } }],
      },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      take: maxJobs,
      select: { id: true, tenantId: true },
    });

    const claimed = [];
    for (const candidate of candidates) {
      const updated = await this.prisma.printJob.updateMany({
        where: {
          id: candidate.id,
          status: "PENDING",
          deletedAt: null,
          OR: [{ lockedAt: null }, { lockedAt: { lt: new Date(now.getTime() - 60_000) } }],
        },
        data: {
          status: "PROCESSING",
          lockedAt: now,
          lockedBy: input.workerId,
          attempts: { increment: 1 },
        },
      });

      if (updated.count !== 1) continue;

      const job = await this.prisma.printJob.findFirst({
        where: { id: candidate.id },
        include: printJobInclude,
      });
      if (job) claimed.push(serializePrintJob(job));
    }

    return claimed;
  }

  async markPrinted(
    id: bigint,
    tenantId: bigint,
    workerId?: string,
    artifact?: {
      mimeType: string;
      base64: string;
      driver: string;
      bytesSent?: number;
    },
  ) {
    return this.finishJob(id, tenantId, "PRINTED", {
      printedAt: new Date(),
      errorMessage: null,
      workerId,
      artifact,
    });
  }

  async markFailed(
    id: bigint,
    tenantId: bigint,
    errorMessage: string,
    options?: { retry?: boolean; workerId?: string },
  ) {
    return runWithCentralTenant(tenantId.toString(), async () => {
      const existing = await this.prisma.printJob.findFirst({
        where: { id, tenantId, deletedAt: null },
        include: printJobInclude,
      });
      if (!existing) throw new Error("PrintJob não encontrado");

      const shouldRetry =
        (options?.retry ?? true) && existing.attempts < existing.maxAttempts;
      const nextStatus: PrintStatusValue = shouldRetry ? "PENDING" : "FAILED";

      const updated = await this.prisma.$transaction(async (tx: any) => {
        const job = await tx.printJob.update({
          where: { id },
          data: {
            status: nextStatus,
            errorMessage: errorMessage.slice(0, 4000),
            lockedAt: null,
            lockedBy: null,
            ...(nextStatus === "FAILED" ? {} : {}),
          },
          include: printJobInclude,
        });

        await writeCentralAuditLog(
          {
            tenantId,
            branchId: existing.branchId,
            action: nextStatus === "FAILED" ? "PRINT_FAILED" : "PRINT_RETRY",
            entity: "PrintJob",
            entityId: job.id.toString(),
            oldData: serializePrintJob(existing),
            newData: serializePrintJob(job),
            data: { workerId: options?.workerId ?? null, errorMessage },
          },
          tx,
        );

        return job;
      });

      return serializePrintJob(updated);
    });
  }

  async cancel(id: bigint, tenantId: bigint, userId?: bigint | null) {
    return runWithCentralTenant(tenantId.toString(), async () => {
      const existing = await this.prisma.printJob.findFirst({
        where: {
          id,
          tenantId,
          deletedAt: null,
          status: { in: ["PENDING", "PROCESSING", "FAILED"] },
        },
        include: printJobInclude,
      });
      if (!existing) throw new Error("PrintJob não encontrado ou não cancelável");

      const updated = await this.prisma.$transaction(async (tx: any) => {
        const job = await tx.printJob.update({
          where: { id },
          data: {
            status: "CANCELLED",
            lockedAt: null,
            lockedBy: null,
          },
          include: printJobInclude,
        });

        await writeCentralAuditLog(
          {
            tenantId,
            branchId: existing.branchId,
            userId: userId ?? null,
            action: "CANCEL",
            entity: "PrintJob",
            entityId: job.id.toString(),
            oldData: serializePrintJob(existing),
            newData: serializePrintJob(job),
          },
          tx,
        );

        return job;
      });

      return serializePrintJob(updated);
    });
  }

  private async finishJob(
    id: bigint,
    tenantId: bigint,
    status: "PRINTED",
    extra: {
      printedAt: Date;
      errorMessage: null;
      workerId?: string;
      artifact?: {
        mimeType: string;
        base64: string;
        driver: string;
        bytesSent?: number;
      };
    },
  ) {
    return runWithCentralTenant(tenantId.toString(), async () => {
      const existing = await this.prisma.printJob.findFirst({
        where: { id, tenantId, deletedAt: null },
        include: printJobInclude,
      });
      if (!existing) throw new Error("PrintJob não encontrado");

      const previousPayload =
        existing.payload && typeof existing.payload === "object"
          ? (existing.payload as Record<string, unknown>)
          : {};

      const nextPayload = extra.artifact
        ? {
            ...previousPayload,
            _result: {
              mimeType: extra.artifact.mimeType,
              base64: extra.artifact.base64,
              driver: extra.artifact.driver,
              bytesSent: extra.artifact.bytesSent ?? null,
              generatedAt: new Date().toISOString(),
            },
          }
        : previousPayload;

      const updated = await this.prisma.$transaction(async (tx: any) => {
        const job = await tx.printJob.update({
          where: { id },
          data: {
            status,
            printedAt: extra.printedAt,
            errorMessage: extra.errorMessage,
            lockedAt: null,
            lockedBy: null,
            ...(extra.artifact ? { payload: nextPayload } : {}),
          },
          include: printJobInclude,
        });

        await writeCentralAuditLog(
          {
            tenantId,
            branchId: existing.branchId,
            action: "PRINTED",
            entity: "PrintJob",
            entityId: job.id.toString(),
            oldData: serializePrintJob(existing),
            newData: serializePrintJob(job),
            data: {
              workerId: extra.workerId ?? null,
              driver: extra.artifact?.driver ?? null,
              mimeType: extra.artifact?.mimeType ?? null,
            },
          },
          tx,
        );

        return job;
      });

      return serializePrintJob(updated);
    });
  }

  /**
   * Reserva um job específico se ainda estiver PENDING.
   */
  async claimById(id: bigint, tenantId: bigint, workerId: string) {
    const now = new Date();
    const updated = await this.prisma.printJob.updateMany({
      where: {
        id,
        tenantId,
        deletedAt: null,
        status: "PENDING",
      },
      data: {
        status: "PROCESSING",
        lockedAt: now,
        lockedBy: workerId,
        attempts: { increment: 1 },
      },
    });

    if (updated.count !== 1) {
      return this.findById(id, tenantId);
    }

    return this.findById(id, tenantId);
  }
}
