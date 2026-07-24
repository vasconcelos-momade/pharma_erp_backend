import { z } from "zod";
/// <reference lib="dom" />
import { ListFaturasUseCase } from "../../modules/tenant/pos/application/use-cases/list-faturas.use-case";
import { GetFaturaDetalheUseCase } from "../../modules/tenant/pos/application/use-cases/get-fatura-detalhe.use-case";
import { FaturaDocumentService, isThermalReceiptTipo } from "../../modules/tenant/pos/application/services/fatura-document.service";
import { ReportsController } from "../../modules/tenant/reports";
import { REPORT_KEYS } from "../../modules/tenant/reports/application/constants/report-keys";
import { getPrisma } from "../../infrastructure/prisma/tenant-prisma.factory";
import {
  tenantAuthMiddleware,
  tenantBranchContextMiddleware,
  requirePermission,
  getTenantAuth,
} from "../../shared/http/auth-middlewares";
import { parseRouteParams, parseSearchParams } from "../../shared/http/request-validation";
import { controllerErrorResponse } from "../../shared/http/controller-error";
import { success } from "../../shared/http/api-response";
import { parseDateRange, toNumber } from "../../modules/tenant/regulatory/application/use-cases/regulatory.helpers";
import type { Router } from "../../shared/http/router";

const listFaturas = new ListFaturasUseCase();
const getFaturaDetalhe = new GetFaturaDetalheUseCase();
const reportsController = new ReportsController();

const faturaIdParamSchema = z.object({
  faturaId: z.string().regex(/^\d+$/, "faturaId inválido"),
});

const listQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  pageSize: z.coerce.number().int().positive().max(100).optional(),
  search: z.string().trim().min(1).optional(),
  q: z.string().trim().min(1).optional(),
  clienteId: z.string().regex(/^\d+$/).optional(),
  status: z.string().trim().min(1).optional(),
  dateFrom: z.string().trim().min(1).optional(),
  dateTo: z.string().trim().min(1).optional(),
  terminalId: z.string().regex(/^\d+$/).optional(),
  userId: z.string().regex(/^\d+$/).optional(),
});

function serialize(data: unknown) {
  return JSON.parse(
    JSON.stringify(data, (_key, value) =>
      typeof value === "bigint" ? value.toString() : value,
    ),
  );
}

async function handleListFaturas(req: Request) {
  try {
    const url = new URL(req.url);
    const params = parseSearchParams(url, listQuerySchema);
    const result = await listFaturas.execute({
      page: params.page,
      pageSize: params.pageSize,
      search: params.search ?? params.q,
      clienteId: params.clienteId,
      status: params.status,
      dateFrom: params.dateFrom,
      dateTo: params.dateTo,
      terminalId: params.terminalId,
      userId: params.userId,
    });
    return success(serialize(result.items), 200, {
      page: result.page,
      pageSize: result.pageSize,
      hasMore: result.hasMore,
      summary: result.summary,
    });
  } catch (error: any) {
    return controllerErrorResponse(error, 500);
  }
}

async function handleDashboard() {
  try {
    const prisma = getPrisma() as any;
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfDay = new Date(now);
    startOfDay.setHours(0, 0, 0, 0);

    const baseWhere = { deletedAt: null };

    const [totalMes, totalHoje, pagas, pendentes, anuladas, receitaMes] =
      await Promise.all([
        prisma.fatura.count({
          where: { ...baseWhere, createdAt: { gte: startOfMonth } },
        }),
        prisma.fatura.count({
          where: { ...baseWhere, createdAt: { gte: startOfDay } },
        }),
        prisma.fatura.count({ where: { ...baseWhere, estado: "PAGA" } }),
        prisma.fatura.count({
          where: { ...baseWhere, estado: { in: ["EMITIDA", "PARCIAL"] } },
        }),
        prisma.fatura.count({ where: { ...baseWhere, estado: "ANULADA" } }),
        prisma.fatura.aggregate({
          where: {
            ...baseWhere,
            estado: { in: ["PAGA", "PARCIAL"] },
            createdAt: { gte: startOfMonth },
          },
          _sum: { total: true },
        }),
      ]);

    return success(
      serialize({
        faturasMes: totalMes,
        faturasHoje: totalHoje,
        pagas,
        pendentes,
        anuladas,
        receitaMes: toNumber(receitaMes._sum.total),
      }),
    );
  } catch (error: any) {
    return controllerErrorResponse(error, 500);
  }
}

async function handleSalesHistoryDashboard(req: Request) {
  try {
    const url = new URL(req.url);
    const params = parseSearchParams(url, z.object({
      dateFrom: z.string().trim().min(1).optional(),
      dateTo: z.string().trim().min(1).optional(),
    }));
    const { from, to } = parseDateRange(params.dateFrom, params.dateTo);

    const prisma = getPrisma() as any;
    const where: any = {
      deletedAt: null,
      estado: { in: ["PAGA", "PARCIAL", "EMITIDA"] },
      ...(from || to
        ? {
            createdAt: {
              ...(from ? { gte: from } : {}),
              ...(to ? { lte: to } : {}),
            },
          }
        : {}),
    };

    const [totalVendas, receitaTotal, ticketMedio, topProdutos] = await Promise.all([
      prisma.fatura.count({ where }),
      prisma.fatura.aggregate({ where, _sum: { total: true } }),
      prisma.fatura.aggregate({ where, _avg: { total: true } }),
      prisma.faturaItem.groupBy({
        by: ["produtoId"],
        where: {
          fatura: where,
          produtoId: { not: null },
        },
        _sum: { quantidade: true, total: true },
        orderBy: { _sum: { total: "desc" } },
        take: 5,
      }),
    ]);

    const produtoIds = topProdutos
      .map((p: any) => p.produtoId)
      .filter(Boolean);
    const produtos = produtoIds.length
      ? await prisma.produto.findMany({
          where: { id: { in: produtoIds } },
          select: { id: true, nome: true },
        })
      : [];
    const produtoMap = new Map(produtos.map((p: any) => [p.id.toString(), p.nomeComercial]));

    return success(
      serialize({
        totalVendas,
        receitaTotal: toNumber(receitaTotal._sum.total),
        ticketMedio: toNumber(ticketMedio._avg.total),
        topProdutos: topProdutos.map((p: any) => ({
          produtoId: p.produtoId?.toString() ?? null,
          nome: produtoMap.get(p.produtoId?.toString()) ?? "—",
          quantidade: toNumber(p._sum.quantidade),
          receita: toNumber(p._sum.total),
        })),
      }),
    );
  } catch (error: any) {
    return controllerErrorResponse(error, 500);
  }
}

function registerFaturaResource(router: Router, basePath: string): void {
  router.get(
    basePath,
    tenantAuthMiddleware(),
    tenantBranchContextMiddleware(),
    requirePermission("FATURAS", "VIEW"),
    async (context) => handleListFaturas(context.req),
  );

  router.get(
    `${basePath}/dashboard`,
    tenantAuthMiddleware(),
    tenantBranchContextMiddleware(),
    requirePermission("FATURAS", "VIEW"),
    async () => handleDashboard(),
  );

  router.get(
    `${basePath}/:faturaId`,
    tenantAuthMiddleware(),
    tenantBranchContextMiddleware(),
    requirePermission("FATURAS", "VIEW"),
    async (context) => {
      try {
        const { faturaId } = parseRouteParams(context.params, faturaIdParamSchema);
        const result = await getFaturaDetalhe.execute(faturaId);
        return success(serialize(result));
      } catch (error: any) {
        return controllerErrorResponse(error, 404);
      }
    },
  );

  router.get(
    `${basePath}/:faturaId/pdf`,
    tenantAuthMiddleware(),
    tenantBranchContextMiddleware(),
    requirePermission("FATURAS", "EXPORT"),
    async (context) => {
      try {
        const { faturaId } = parseRouteParams(context.params, faturaIdParamSchema);
        const fatura = await getFaturaDetalhe.execute(faturaId);

        if (isThermalReceiptTipo((fatura as any).tipo)) {
          const { bytes, fileName, contentType } =
            FaturaDocumentService.buildThermal80mmPdf(fatura as any);
          const body = new Blob([bytes as BlobPart], { type: contentType });
          return new Response(body, {
            headers: {
              "Content-Type": contentType,
              "Content-Disposition": `inline; filename="${fileName}"`,
              "X-Document-Mode": "thermal_80mm",
            },
          });
        }

        const artifact = await reportsController.generateArtifact({
          reportKey: REPORT_KEYS.INVOICE,
          userId: getTenantAuth(context).userId,
          routeParams: { faturaId },
          url: new URL(context.req.url),
          format: "pdf",
          disposition: "inline",
        });
        const body = new Blob([artifact.bytes as BlobPart], {
          type: artifact.contentType,
        });
        return new Response(body, {
          headers: {
            "Content-Type": artifact.contentType,
            "Content-Disposition": `inline; filename="${artifact.fileName}"`,
            "X-Document-Mode": "pdf_a4",
          },
        });
      } catch (error: any) {
        return controllerErrorResponse(error, 404);
      }
    },
  );

  router.get(
    `${basePath}/:faturaId/print`,
    tenantAuthMiddleware(),
    tenantBranchContextMiddleware(),
    requirePermission("FATURAS", "VIEW"),
    async (context) => {
      try {
        const { faturaId } = parseRouteParams(context.params, faturaIdParamSchema);
        const fatura = await getFaturaDetalhe.execute(faturaId);
        const userId = getTenantAuth(context).userId;

        if (!isThermalReceiptTipo((fatura as any).tipo)) {
          const artifact = await reportsController.generateArtifact({
            reportKey: REPORT_KEYS.INVOICE,
            userId,
            routeParams: { faturaId },
            url: new URL(context.req.url),
            format: "pdf",
            disposition: "inline",
          });
          return success(
            serialize({
              mode: "pdf_a4",
              tipo: (fatura as any).tipo ?? "FT",
              payloadBase64: Buffer.from(artifact.bytes).toString("base64"),
              fileName: artifact.fileName,
              contentType: artifact.contentType,
            }),
          );
        }

        const result = FaturaDocumentService.buildPrintArtifact(fatura as any);
        return success(
          serialize({
            mode: "thermal_80mm",
            tipo: "FR",
            ...result,
          }),
        );
      } catch (error: any) {
        return controllerErrorResponse(error, 404);
      }
    },
  );

  router.get(
    `${basePath}/:faturaId/auditoria`,
    tenantAuthMiddleware(),
    tenantBranchContextMiddleware(),
    requirePermission("FATURAS", "VIEW"),
    async (context) => {
      try {
        const { faturaId } = parseRouteParams(context.params, faturaIdParamSchema);
        const url = new URL(context.req.url);
        const { page, pageSize } = parseSearchParams(url, z.object({
          page: z.coerce.number().int().positive().optional(),
          pageSize: z.coerce.number().int().positive().max(100).optional(),
        }));
        const safePage = Math.max(1, page ?? 1);
        const safeSize = Math.min(100, Math.max(1, pageSize ?? 20));
        const prisma = getPrisma() as any;
        const where = { entity: "Fatura", entityId: BigInt(faturaId) };

        const [totalCount, rows] = await prisma.$transaction([
          prisma.auditLog.count({ where }),
          prisma.auditLog.findMany({
            where,
            include: { user: { select: { id: true, name: true, email: true } } },
            orderBy: [{ createdAt: "desc" }, { id: "desc" }],
            skip: (safePage - 1) * safeSize,
            take: safeSize + 1,
          }),
        ]);

        const items = rows.slice(0, safeSize).map((row: any) => ({
          id: row.id.toString(),
          action: row.action,
          before: row.before ?? null,
          after: row.after ?? null,
          createdAt: row.createdAt.toISOString(),
          user: row.user
            ? { id: row.user.id.toString(), nome: row.user.name, email: row.user.email ?? null }
            : null,
        }));

        return success(serialize(items), 200, {
          page: safePage,
          pageSize: safeSize,
          hasMore: rows.length > safeSize,
          totalCount,
        });
      } catch (error: any) {
        return controllerErrorResponse(error, 404);
      }
    },
  );
}

export function registerFaturasRoutes(router: Router, prefix: string): void {
  registerFaturaResource(router, `${prefix}/tenant/faturas`);
  registerFaturaResource(router, `${prefix}/tenant/invoices`);

  const historyPaths = [
    `${prefix}/tenant/vendas/historico`,
    `${prefix}/tenant/sales/history`,
  ];

  for (const path of historyPaths) {
    router.get(
      path,
      tenantAuthMiddleware(),
      tenantBranchContextMiddleware(),
      requirePermission("RELATORIOS", "VIEW"),
      async (context) => handleListFaturas(context.req),
    );

    router.get(
      `${path}/dashboard`,
      tenantAuthMiddleware(),
      tenantBranchContextMiddleware(),
      requirePermission("RELATORIOS", "VIEW"),
      async (context) => handleSalesHistoryDashboard(context.req),
    );
  }
}
