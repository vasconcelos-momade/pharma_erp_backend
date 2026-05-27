import { prismaCentral } from "../../../../../infrastructure/prisma/prisma-central.service";
import { EmailService } from "../../../../../infrastructure/notifications/email.service";
import { allocateInvoiceFiscal } from "./allocate-invoice-fiscal.service";
import {
  assertInvoiceAmounts,
  deriveInvoiceStatus,
} from "./invoice-financial-integrity.service";

export interface GenerateMonthlyBillingInput {
  referenceDate?: Date | string;
  tenantId?: string;
  subscriptionId?: string;
  dueDays?: number;
  dryRun?: boolean;
  includeTrial?: boolean;
}

export interface GeneratedBillingItem {
  tenantId: string;
  subscriptionId: string;
  planSlug: string;
  periodStart: string;
  periodEnd: string;
  dueDate: string;
  branchesUsed: number;
  includedBranches: number;
  extraBranches: number;
  subtotal: string;
  total: string;
  snapshotAction: "preview" | "created" | "updated";
  invoiceAction: "preview" | "created" | "updated" | "kept_paid";
  invoiceId?: string;
  invoiceNumber?: string;
  companyName?: string;
  ownerName?: string | null;
  ownerEmail?: string | null;
}

export interface GenerateMonthlyBillingResult {
  periodStart: string;
  periodEnd: string;
  dueDate: string;
  dryRun: boolean;
  processed: number;
  generated: number;
  updated: number;
  skipped: number;
  items: GeneratedBillingItem[];
}

function parseReferenceDate(input?: Date | string): Date {
  if (!input) return new Date();
  const parsed = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error("referenceDate invalida.");
  }
  return parsed;
}

function startOfMonthUTC(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1, 0, 0, 0, 0));
}

function endOfMonthUTC(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0, 23, 59, 59, 999));
}

function addDaysUTC(date: Date, days: number): Date {
  const next = new Date(date.getTime());
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function toCents(value: unknown): number {
  return Math.round(Number(value ?? 0) * 100);
}

function fromCents(value: number): string {
  return (value / 100).toFixed(2);
}

function buildInvoiceDescription(params: {
  planName: string;
  planSlug: string;
  isEnterprise: boolean;
  branchesUsed: number;
  includedBranches: number;
  extraBranches: number;
  periodStart: Date;
  periodEnd: Date;
}): string {
  const periodLabel = `${params.periodStart.toISOString().slice(0, 10)} a ${params.periodEnd
    .toISOString()
    .slice(0, 10)}`;

  if (params.isEnterprise) {
    return `Faturacao mensal Enterprise (${params.planName}) para o periodo ${periodLabel}. Branches ativas: ${params.branchesUsed}.`;
  }

  return `Faturacao mensal do plano ${params.planName} (${params.planSlug}) para o periodo ${periodLabel}. Branches usadas: ${params.branchesUsed}. Incluidas: ${params.includedBranches}. Extras: ${params.extraBranches}.`;
}

export class GenerateMonthlyBillingService {
  async execute(input: GenerateMonthlyBillingInput = {}): Promise<GenerateMonthlyBillingResult> {
    const prisma = prismaCentral as any;
    const referenceDate = parseReferenceDate(input.referenceDate);
    const periodStart = startOfMonthUTC(referenceDate);
    const periodEnd = endOfMonthUTC(referenceDate);
    const dueDate = addDaysUTC(periodEnd, input.dueDays ?? 3);
    const dryRun = Boolean(input.dryRun);
    const statuses = input.includeTrial ? ["trial", "ativo"] : ["ativo"];

    const subscriptions = await prisma.subscription.findMany({
      where: {
        status: { in: statuses },
        deletedAt: null,
        startDate: { lte: periodEnd },
        OR: [{ endDate: null }, { endDate: { gte: periodStart } }],
        ...(input.tenantId ? { tenantId: BigInt(input.tenantId) } : {}),
        ...(input.subscriptionId ? { id: BigInt(input.subscriptionId) } : {}),
      },
      include: {
        plan: true,
        tenant: {
          select: {
            id: true,
            name: true,
            companyName: true,
            owner: {
              select: {
                name: true,
                email: true,
              },
            },
          },
        },
      },
      orderBy: [{ tenantId: "asc" }, { createdAt: "asc" }],
    });

    const items: GeneratedBillingItem[] = [];
    let generated = 0;
    let updated = 0;
    let skipped = 0;

    for (const subscription of subscriptions) {
      if (!subscription.plan?.active) {
        skipped++;
        continue;
      }

      const item = dryRun
        ? await this.previewSubscription({
            subscription,
            periodStart,
            periodEnd,
            dueDate,
          })
        : await this.persistSubscription({
            subscription,
            periodStart,
            periodEnd,
            dueDate,
          });

      if (item.invoiceAction === "created") generated++;
      if (item.invoiceAction === "updated") updated++;
      if (item.invoiceAction === "kept_paid") skipped++;
      items.push(item);

      if (!dryRun && ["created", "updated"].includes(item.invoiceAction)) {
        await this.sendRecurringInvoiceEmail(item);
      }
    }

    return {
      periodStart: periodStart.toISOString(),
      periodEnd: periodEnd.toISOString(),
      dueDate: dueDate.toISOString(),
      dryRun,
      processed: subscriptions.length,
      generated,
      updated,
      skipped,
      items,
    };
  }

  private async previewSubscription(params: {
    subscription: any;
    periodStart: Date;
    periodEnd: Date;
    dueDate: Date;
  }): Promise<GeneratedBillingItem> {
    const branchesUsed = await this.countActiveBranchesForPeriod(
      BigInt(params.subscription.tenantId),
      params.periodStart,
      params.periodEnd,
    );

    const totals = this.calculateTotals(params.subscription.plan, branchesUsed);

    return {
      tenantId: params.subscription.tenantId.toString(),
      subscriptionId: params.subscription.id.toString(),
      planSlug: String(params.subscription.plan.slug),
      periodStart: params.periodStart.toISOString(),
      periodEnd: params.periodEnd.toISOString(),
      dueDate: params.dueDate.toISOString(),
      branchesUsed,
      includedBranches: totals.includedBranches,
      extraBranches: totals.extraBranches,
      subtotal: fromCents(totals.subtotalCents),
      total: fromCents(totals.totalCents),
      snapshotAction: "preview",
      invoiceAction: "preview",
    };
  }

  private async persistSubscription(params: {
    subscription: any;
    periodStart: Date;
    periodEnd: Date;
    dueDate: Date;
  }): Promise<GeneratedBillingItem> {
    const prisma = prismaCentral as any;

    return prisma.$transaction(async (tx: any) => {
      const branchesUsed = await this.countActiveBranchesForPeriod(
        BigInt(params.subscription.tenantId),
        params.periodStart,
        params.periodEnd,
        tx,
      );

      const totals = this.calculateTotals(params.subscription.plan, branchesUsed);
      const description = buildInvoiceDescription({
        planName: String(params.subscription.plan.name),
        planSlug: String(params.subscription.plan.slug),
        isEnterprise: Boolean(params.subscription.plan.isEnterprise),
        branchesUsed,
        includedBranches: totals.includedBranches,
        extraBranches: totals.extraBranches,
        periodStart: params.periodStart,
        periodEnd: params.periodEnd,
      });

      await tx.subscription.update({
        where: { id: params.subscription.id },
        data: { branchesUsed },
      });

      const existingSnapshot = await tx.billingSnapshot.findUnique({
        where: {
          subscriptionId_periodStart_periodEnd: {
            subscriptionId: params.subscription.id,
            periodStart: params.periodStart,
            periodEnd: params.periodEnd,
          },
        },
      });

      const snapshot = await tx.billingSnapshot.upsert({
        where: {
          subscriptionId_periodStart_periodEnd: {
            subscriptionId: params.subscription.id,
            periodStart: params.periodStart,
            periodEnd: params.periodEnd,
          },
        },
        update: {
          planMonthlyPrice: fromCents(totals.planMonthlyPriceCents),
          includedBranches: totals.includedBranches,
          extraBranchesUsed: totals.extraBranches,
          extraBranchPrice: fromCents(totals.extraBranchPriceCents),
          totalBranchesUsed: branchesUsed,
          subtotal: fromCents(totals.subtotalCents),
          total: fromCents(totals.totalCents),
        },
        create: {
          tenantId: params.subscription.tenantId,
          subscriptionId: params.subscription.id,
          periodStart: params.periodStart,
          periodEnd: params.periodEnd,
          planMonthlyPrice: fromCents(totals.planMonthlyPriceCents),
          includedBranches: totals.includedBranches,
          extraBranchesUsed: totals.extraBranches,
          extraBranchPrice: fromCents(totals.extraBranchPriceCents),
          totalBranchesUsed: branchesUsed,
          subtotal: fromCents(totals.subtotalCents),
          total: fromCents(totals.totalCents),
        },
      });

      const existingInvoice = await tx.invoice.findUnique({
        where: { billingSnapshotId: snapshot.id },
      });

      let invoiceAction: GeneratedBillingItem["invoiceAction"] = "created";
      let invoiceId: string | undefined;
      let invoiceNumber: string | undefined;

      if (existingInvoice?.status === "pago") {
        invoiceAction = "kept_paid";
        invoiceId = existingInvoice.id.toString();
        invoiceNumber = String(existingInvoice.number);
      } else if (existingInvoice) {
        const amountStr = fromCents(totals.totalCents);
        const paid = Number(existingInvoice.paidAmount);
        const amount = Number(amountStr);
        assertInvoiceAmounts(amount, paid);
        const status = deriveInvoiceStatus(amount, paid, existingInvoice.status);

        const updatedInvoice = await tx.invoice.update({
          where: { id: existingInvoice.id },
          data: {
            tenantId: params.subscription.tenantId,
            subscriptionId: params.subscription.id,
            amount: amountStr,
            status,
            dueDate: params.dueDate,
            periodStart: params.periodStart,
            periodEnd: params.periodEnd,
            branchesUsed,
            extraBranches: totals.extraBranches,
            description,
          },
        });
        invoiceAction = "updated";
        invoiceId = updatedInvoice.id.toString();
        invoiceNumber = String(updatedInvoice.number);
      } else {
        const fiscal = await allocateInvoiceFiscal(
          params.subscription.tenantId,
          params.periodStart,
          tx,
        );

        const amountStr = fromCents(totals.totalCents);

        const createdInvoice = await tx.invoice.create({
          data: {
            tenantId: params.subscription.tenantId,
            fiscalYear: fiscal.fiscalYear,
            sequence: fiscal.sequence,
            subscriptionId: params.subscription.id,
            billingSnapshotId: snapshot.id,
            number: fiscal.number,
            amount: amountStr,
            paidAmount: 0,
            remainingAmount: amountStr,
            status: "pendente",
            dueDate: params.dueDate,
            periodStart: params.periodStart,
            periodEnd: params.periodEnd,
            branchesUsed,
            extraBranches: totals.extraBranches,
            description,
          },
        });
        invoiceId = createdInvoice.id.toString();
        invoiceNumber = String(createdInvoice.number);
      }

      const nextBillingAt = addDaysUTC(params.periodEnd, 1);
      await tx.subscription.update({
        where: { id: params.subscription.id },
        data: {
          lastBillingAt: new Date(),
          nextBillingAt,
        },
      });

      return {
        tenantId: params.subscription.tenantId.toString(),
        subscriptionId: params.subscription.id.toString(),
        planSlug: String(params.subscription.plan.slug),
        periodStart: params.periodStart.toISOString(),
        periodEnd: params.periodEnd.toISOString(),
        dueDate: params.dueDate.toISOString(),
        branchesUsed,
        includedBranches: totals.includedBranches,
        extraBranches: totals.extraBranches,
        subtotal: fromCents(totals.subtotalCents),
        total: fromCents(totals.totalCents),
        snapshotAction: existingSnapshot ? "updated" : "created",
        invoiceAction,
        invoiceId,
        invoiceNumber,
        companyName: String(params.subscription.tenant.companyName),
        ownerName: params.subscription.tenant.owner?.name
          ? String(params.subscription.tenant.owner.name)
          : null,
        ownerEmail: params.subscription.tenant.owner?.email
          ? String(params.subscription.tenant.owner.email)
          : null,
      } satisfies GeneratedBillingItem;
    });
  }

  private async sendRecurringInvoiceEmail(item: GeneratedBillingItem): Promise<void> {
    if (!item.ownerEmail || !item.companyName || !item.invoiceNumber) return;

    await EmailService.send({
      to: item.ownerEmail,
      subject: `Factura emitida para ${item.companyName}`,
      text: [
        `Foi emitida a factura ${item.invoiceNumber} para a empresa ${item.companyName}.`,
        `Valor: ${item.total} MZN.`,
        `Periodo faturado: ${item.periodStart.slice(0, 10)} a ${item.periodEnd.slice(0, 10)}.`,
        `Prazo limite de pagamento: ${item.dueDate.slice(0, 10)}.`,
        item.ownerName ? `Responsavel: ${item.ownerName}.` : undefined,
        "Se nao houver pagamento ate ao vencimento, o tenant sera suspenso automaticamente.",
      ]
        .filter(Boolean)
        .join("\n"),
    });
  }

  private calculateTotals(plan: any, branchesUsed: number) {
    const includedBranches = Number(plan.includedBranches ?? 1);
    const planMonthlyPriceCents = toCents(plan.monthlyPrice);
    const extraBranchPriceCents = plan.isEnterprise ? 0 : toCents(plan.extraBranchPrice);
    const extraBranches = plan.isEnterprise ? 0 : Math.max(0, branchesUsed - includedBranches);
    const subtotalCents = planMonthlyPriceCents + extraBranches * extraBranchPriceCents;

    return {
      includedBranches,
      extraBranches,
      planMonthlyPriceCents,
      extraBranchPriceCents,
      subtotalCents,
      totalCents: subtotalCents,
    };
  }

  private async countActiveBranchesForPeriod(
    tenantId: bigint,
    periodStart: Date,
    periodEnd: Date,
    prisma: any = prismaCentral as any,
  ): Promise<number> {
    return prisma.branch.count({
      where: {
        tenantId,
        active: true,
        createdAt: { lte: periodEnd },
        OR: [{ deletedAt: null }, { deletedAt: { gte: periodStart } }],
      },
    });
  }
}
