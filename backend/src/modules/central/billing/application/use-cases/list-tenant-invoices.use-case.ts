import { prismaCentralUnscoped } from "../../../../../infrastructure/prisma/prisma-central.service";
import { runWithCentralTenant } from "../../../../../shared/context/central-tenant-context";
import {
  DEFAULT_INVOICE_CURRENCY,
  mapInvoiceFinancialFields,
} from "../services/invoice-response.mapper";

export interface ListTenantInvoicesDTO {
  tenantId: string;
  status?: string;
  limit?: number;
}

export class ListTenantInvoicesUseCase {
  async execute(data: ListTenantInvoicesDTO) {
    return runWithCentralTenant(data.tenantId, async () => {
      const prisma = prismaCentralUnscoped as any;
      const limit = Math.min(Math.max(data.limit ?? 50, 1), 100);

      const invoices = await prisma.invoice.findMany({
        where: {
          tenantId: BigInt(data.tenantId),
          deletedAt: null,
          ...(data.status ? { status: data.status } : {}),
        },
        select: {
          id: true,
          number: true,
          amount: true,
          paidAmount: true,
          remainingAmount: true,
          status: true,
          dueDate: true,
          paidAt: true,
          periodStart: true,
          periodEnd: true,
          branchesUsed: true,
          extraBranches: true,
          description: true,
          subscriptionId: true,
          createdAt: true,
        },
        orderBy: { createdAt: "desc" },
        take: limit,
      });

      return invoices.map((invoice: any) => {
        const financials = mapInvoiceFinancialFields(invoice);
        return {
        id: invoice.id.toString(),
        subscriptionId: invoice.subscriptionId.toString(),
        number: invoice.number,
        ...financials,
        currency: DEFAULT_INVOICE_CURRENCY,
        status: invoice.status,
        dueDate: invoice.dueDate,
        paidAt: invoice.paidAt,
        periodStart: invoice.periodStart,
        periodEnd: invoice.periodEnd,
        branchesUsed: invoice.branchesUsed,
        extraBranches: invoice.extraBranches,
        description: invoice.description,
        createdAt: invoice.createdAt,
      };
      });
    });
  }
}
