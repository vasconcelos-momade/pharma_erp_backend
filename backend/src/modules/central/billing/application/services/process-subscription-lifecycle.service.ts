import { prismaCentralUnscoped } from "../../../../../infrastructure/prisma/prisma-central.service";
import { allocateInvoiceFiscal } from "./allocate-invoice-fiscal.service";
import { EmailService } from "../../../../../infrastructure/notifications/email.service";
import {
  assertInvoiceAmounts,
  computeRemainingAmount,
  deriveInvoiceStatus,
} from "./invoice-financial-integrity.service";

export interface ProcessSubscriptionLifecycleInput {
  referenceDate?: Date | string;
}

export interface ProcessSubscriptionLifecycleResult {
  referenceDate: string;
  trialInvoicesCreated: number;
  trialInvoicesUpdated: number;
  invoicesMarkedOverdue: number;
  tenantsSuspended: number;
  subscriptionsCancelled: number;
}

function parseReferenceDate(input?: Date | string): Date {
  if (!input) return new Date();
  const parsed = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error("referenceDate invalida.");
  }
  return parsed;
}

function addDaysUTC(date: Date, days: number): Date {
  const next = new Date(date.getTime());
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function addMonthsUTC(date: Date, months: number): Date {
  const next = new Date(date.getTime());
  next.setUTCMonth(next.getUTCMonth() + months);
  return next;
}

function endOfDayUTC(date: Date): Date {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 23, 59, 59, 999),
  );
}

function toCents(value: unknown): number {
  return Math.round(Number(value ?? 0) * 100);
}

function fromCents(value: number): string {
  return (value / 100).toFixed(2);
}

function buildTrialInvoiceDescription(params: {
  planName: string;
  planSlug: string;
  periodStart: Date;
  periodEnd: Date;
  branchesUsed: number;
  includedBranches: number;
  extraBranches: number;
}): string {
  const periodStart = params.periodStart.toISOString().slice(0, 10);
  const periodEnd = params.periodEnd.toISOString().slice(0, 10);

  return [
    `Conversao automatica do trial para o plano ${params.planName} (${params.planSlug}).`,
    `Periodo: ${periodStart} a ${periodEnd}.`,
    `Branches activas: ${params.branchesUsed}.`,
    `Incluidas: ${params.includedBranches}.`,
    `Extras: ${params.extraBranches}.`,
  ].join(" ");
}

function calculateTotals(plan: any, branchesUsed: number) {
  const includedBranches = Number(plan.includedBranches ?? 1);
  const monthlyPriceCents = toCents(plan.monthlyPrice);
  const extraBranchPriceCents = plan.isEnterprise ? 0 : toCents(plan.extraBranchPrice);
  const extraBranches = plan.isEnterprise ? 0 : Math.max(0, branchesUsed - includedBranches);
  const totalCents = monthlyPriceCents + extraBranches * extraBranchPriceCents;

  return {
    includedBranches,
    extraBranches,
    monthlyPriceCents,
    extraBranchPriceCents,
    totalCents,
  };
}

export class ProcessSubscriptionLifecycleService {
  async execute(
    input: ProcessSubscriptionLifecycleInput = {},
  ): Promise<ProcessSubscriptionLifecycleResult> {
    const prisma = prismaCentralUnscoped as any;
    const referenceDate = parseReferenceDate(input.referenceDate);

    const expiredTrials = await prisma.subscription.findMany({
      where: {
        status: "trial",
        deletedAt: null,
        trialEndsAt: { lte: referenceDate },
      },
      include: {
        plan: true,
        tenant: {
          select: {
            id: true,
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
      orderBy: { trialEndsAt: "asc" },
    });

    let trialInvoicesCreated = 0;
    let trialInvoicesUpdated = 0;

    for (const subscription of expiredTrials) {
      const result = await this.processExpiredTrial(subscription.id, referenceDate);
      if (!result) continue;

      if (result.invoiceAction === "created") {
        trialInvoicesCreated++;
      } else if (result.invoiceAction === "updated") {
        trialInvoicesUpdated++;
      }

      await this.sendTrialExpiredEmail(result);
    }

    const overdueInvoices = await prisma.invoice.findMany({
      where: {
        deletedAt: null,
        status: { in: ["pendente", "parcial"] },
        dueDate: { lt: referenceDate },
      },
      orderBy: { dueDate: "asc" },
      select: { id: true },
    });

    let invoicesMarkedOverdue = 0;
    let tenantsSuspended = 0;

    for (const invoice of overdueInvoices) {
      const result = await this.processOverdueInvoice(invoice.id, referenceDate);
      if (!result) continue;

      invoicesMarkedOverdue++;
      tenantsSuspended++;
      await this.sendSuspensionEmail(result);
    }

    const cancelAfter = addDaysUTC(referenceDate, -30);
    const cancellationCandidates = await prisma.invoice.findMany({
      where: {
        deletedAt: null,
        status: "vencido",
        dueDate: { lte: cancelAfter },
        subscription: {
          deletedAt: null,
          status: { not: "cancelado" },
        },
      },
      orderBy: { dueDate: "asc" },
      select: { id: true },
    });

    let subscriptionsCancelled = 0;

    for (const invoice of cancellationCandidates) {
      const result = await this.processCancelledSubscription(invoice.id, referenceDate);
      if (!result) continue;

      subscriptionsCancelled++;
      await this.sendCancellationEmail(result);
    }

    return {
      referenceDate: referenceDate.toISOString(),
      trialInvoicesCreated,
      trialInvoicesUpdated,
      invoicesMarkedOverdue,
      tenantsSuspended,
      subscriptionsCancelled,
    };
  }

  private async processExpiredTrial(subscriptionId: bigint, referenceDate: Date) {
    const prisma = prismaCentralUnscoped as any;

    return prisma.$transaction(async (tx: any) => {
      const subscription = await tx.subscription.findUnique({
        where: { id: subscriptionId },
        include: {
          plan: true,
          tenant: {
            select: {
              id: true,
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
      });

      if (
        !subscription ||
        subscription.deletedAt ||
        subscription.status !== "trial" ||
        !subscription.trialEndsAt ||
        subscription.trialEndsAt > referenceDate
      ) {
        return null;
      }

      const periodStart = new Date(subscription.trialEndsAt);
      const periodEnd = new Date(addMonthsUTC(periodStart, 1).getTime() - 1);
      const dueDate = endOfDayUTC(addDaysUTC(periodStart, 3));
      const nextBillingAt = addDaysUTC(periodEnd, 1);
      const branchesUsed = await tx.branch.count({
        where: {
          tenantId: subscription.tenantId,
          active: true,
          createdAt: { lte: periodEnd },
          OR: [{ deletedAt: null }, { deletedAt: { gte: periodStart } }],
        },
      });

      const totals = calculateTotals(subscription.plan, branchesUsed);
      const amountStr = fromCents(totals.totalCents);
      const description = buildTrialInvoiceDescription({
        planName: String(subscription.plan.name),
        planSlug: String(subscription.plan.slug),
        periodStart,
        periodEnd,
        branchesUsed,
        includedBranches: totals.includedBranches,
        extraBranches: totals.extraBranches,
      });

      const snapshot = await tx.billingSnapshot.upsert({
        where: {
          subscriptionId_periodStart_periodEnd: {
            subscriptionId: subscription.id,
            periodStart,
            periodEnd,
          },
        },
        update: {
          planMonthlyPrice: fromCents(totals.monthlyPriceCents),
          includedBranches: totals.includedBranches,
          extraBranchesUsed: totals.extraBranches,
          extraBranchPrice: fromCents(totals.extraBranchPriceCents),
          totalBranchesUsed: branchesUsed,
          subtotal: amountStr,
          total: amountStr,
        },
        create: {
          tenantId: subscription.tenantId,
          subscriptionId: subscription.id,
          periodStart,
          periodEnd,
          planMonthlyPrice: fromCents(totals.monthlyPriceCents),
          includedBranches: totals.includedBranches,
          extraBranchesUsed: totals.extraBranches,
          extraBranchPrice: fromCents(totals.extraBranchPriceCents),
          totalBranchesUsed: branchesUsed,
          subtotal: amountStr,
          total: amountStr,
        },
      });

      const existingInvoice = await tx.invoice.findUnique({
        where: { billingSnapshotId: snapshot.id },
      });

      let invoiceAction: "created" | "updated" = "created";
      let invoice = existingInvoice;

      if (!invoice) {
        const fiscal = await allocateInvoiceFiscal(subscription.tenantId, periodStart, tx);
        invoice = await tx.invoice.create({
          data: {
            tenantId: subscription.tenantId,
            fiscalYear: fiscal.fiscalYear,
            sequence: fiscal.sequence,
            subscriptionId: subscription.id,
            billingSnapshotId: snapshot.id,
            number: fiscal.number,
            amount: amountStr,
            paidAmount: 0,
            remainingAmount: amountStr,
            status: "pendente",
            dueDate,
            periodStart,
            periodEnd,
            branchesUsed,
            extraBranches: totals.extraBranches,
            description,
          },
        });
      } else {
        const paid = Number(existingInvoice.paidAmount);
        const amount = Number(amountStr);
        assertInvoiceAmounts(amount, paid);
        const status = deriveInvoiceStatus(amount, paid, String(existingInvoice.status));

        invoice = await tx.invoice.update({
          where: { id: existingInvoice.id },
          data: {
            amount: amountStr,
            remainingAmount: computeRemainingAmount(amount, paid),
            status,
            dueDate,
            periodStart,
            periodEnd,
            branchesUsed,
            extraBranches: totals.extraBranches,
            description,
          },
        });
        invoiceAction = "updated";
      }

      await tx.subscription.update({
        where: { id: subscription.id },
        data: {
          status: "ativo",
          branchesUsed,
          lastBillingAt: referenceDate,
          nextBillingAt,
        },
      });

      await tx.tenant.update({
        where: { id: subscription.tenantId },
        data: {
          status: "grace",
        },
      });

      return {
        invoiceAction,
        companyName: String(subscription.tenant.companyName),
        ownerName: subscription.tenant.owner?.name ? String(subscription.tenant.owner.name) : null,
        ownerEmail: subscription.tenant.owner?.email ? String(subscription.tenant.owner.email) : null,
        planName: String(subscription.plan.name),
        invoiceNumber: String(invoice.number),
        dueDate,
        amount: amountStr,
      };
    });
  }

  private async processOverdueInvoice(invoiceId: bigint, referenceDate: Date) {
    const prisma = prismaCentralUnscoped as any;

    return prisma.$transaction(async (tx: any) => {
      const invoice = await tx.invoice.findUnique({
        where: { id: invoiceId },
        include: {
          tenant: {
            select: {
              companyName: true,
              owner: {
                select: {
                  name: true,
                  email: true,
                },
              },
            },
          },
          subscription: {
            select: {
              id: true,
              status: true,
            },
          },
        },
      });

      if (
        !invoice ||
        invoice.deletedAt ||
        !["pendente", "parcial"].includes(String(invoice.status)) ||
        invoice.dueDate >= referenceDate
      ) {
        return null;
      }

      await tx.invoice.update({
        where: { id: invoice.id },
        data: {
          status: "vencido",
        },
      });

      await tx.subscription.update({
        where: { id: invoice.subscriptionId },
        data: {
          status: "expirado",
          nextBillingAt: null,
        },
      });

      await tx.tenant.update({
        where: { id: invoice.tenantId },
        data: {
          status: "suspenso",
        },
      });

      return {
        companyName: String(invoice.tenant.companyName),
        ownerName: invoice.tenant.owner?.name ? String(invoice.tenant.owner.name) : null,
        ownerEmail: invoice.tenant.owner?.email ? String(invoice.tenant.owner.email) : null,
        invoiceNumber: String(invoice.number),
        dueDate: invoice.dueDate,
        amount: String(invoice.amount),
      };
    });
  }

  private async processCancelledSubscription(invoiceId: bigint, referenceDate: Date) {
    const prisma = prismaCentralUnscoped as any;

    return prisma.$transaction(async (tx: any) => {
      const invoice = await tx.invoice.findUnique({
        where: { id: invoiceId },
        include: {
          tenant: {
            select: {
              companyName: true,
              owner: {
                select: {
                  name: true,
                  email: true,
                },
              },
            },
          },
          subscription: {
            select: {
              id: true,
              status: true,
            },
          },
        },
      });

      if (
        !invoice ||
        invoice.deletedAt ||
        String(invoice.status) !== "vencido" ||
        String(invoice.subscription?.status) === "cancelado" ||
        addDaysUTC(invoice.dueDate, 30) > referenceDate
      ) {
        return null;
      }

      await tx.subscription.update({
        where: { id: invoice.subscriptionId },
        data: {
          status: "cancelado",
          endDate: referenceDate,
          nextBillingAt: null,
        },
      });

      return {
        companyName: String(invoice.tenant.companyName),
        ownerName: invoice.tenant.owner?.name ? String(invoice.tenant.owner.name) : null,
        ownerEmail: invoice.tenant.owner?.email ? String(invoice.tenant.owner.email) : null,
        invoiceNumber: String(invoice.number),
        dueDate: invoice.dueDate,
        amount: String(invoice.amount),
      };
    });
  }

  private async sendTrialExpiredEmail(payload: {
    companyName: string;
    ownerName: string | null;
    ownerEmail: string | null;
    planName: string;
    invoiceNumber: string;
    dueDate: Date;
    amount: string;
  }) {
    if (!payload.ownerEmail) return;

    await EmailService.send({
      to: payload.ownerEmail,
      subject: `Factura emitida para ${payload.companyName}`,
      text: [
        `O trial da empresa ${payload.companyName} terminou e a subscricao foi convertida para o plano ${payload.planName}.`,
        `Factura: ${payload.invoiceNumber}.`,
        `Valor: ${payload.amount} MZN.`,
        `Prazo limite de pagamento: ${payload.dueDate.toISOString().slice(0, 10)}.`,
        payload.ownerName ? `Responsavel: ${payload.ownerName}.` : undefined,
        "O tenant permanece em periodo de graca ate ao vencimento desta factura.",
      ]
        .filter(Boolean)
        .join("\n"),
    });
  }

  private async sendSuspensionEmail(payload: {
    companyName: string;
    ownerName: string | null;
    ownerEmail: string | null;
    invoiceNumber: string;
    dueDate: Date;
    amount: string;
  }) {
    if (!payload.ownerEmail) return;

    await EmailService.send({
      to: payload.ownerEmail,
      subject: `Tenant suspenso por falta de pagamento: ${payload.companyName}`,
      text: [
        `A factura ${payload.invoiceNumber} da empresa ${payload.companyName} venceu sem pagamento.`,
        `Valor pendente: ${payload.amount} MZN.`,
        `Data limite: ${payload.dueDate.toISOString().slice(0, 10)}.`,
        payload.ownerName ? `Responsavel: ${payload.ownerName}.` : undefined,
        "O tenant foi suspenso ate regularizacao financeira.",
      ]
        .filter(Boolean)
        .join("\n"),
    });
  }

  private async sendCancellationEmail(payload: {
    companyName: string;
    ownerName: string | null;
    ownerEmail: string | null;
    invoiceNumber: string;
    dueDate: Date;
    amount: string;
  }) {
    if (!payload.ownerEmail) return;

    await EmailService.send({
      to: payload.ownerEmail,
      subject: `Subscricao cancelada por falta de pagamento: ${payload.companyName}`,
      text: [
        `A factura ${payload.invoiceNumber} da empresa ${payload.companyName} permanece sem pagamento ha mais de 30 dias.`,
        `Valor pendente: ${payload.amount} MZN.`,
        `Vencimento original: ${payload.dueDate.toISOString().slice(0, 10)}.`,
        payload.ownerName ? `Responsavel: ${payload.ownerName}.` : undefined,
        "A subscricao foi cancelada. Para reactivar o tenant sera necessario regularizar a conta e activar uma nova subscricao.",
      ]
        .filter(Boolean)
        .join("\n"),
    });
  }
}
