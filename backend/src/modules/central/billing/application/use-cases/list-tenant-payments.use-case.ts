import { prismaCentralUnscoped } from "../../../../../infrastructure/prisma/prisma-central.service";
import { runWithCentralTenant } from "../../../../../shared/context/central-tenant-context";
import { DEFAULT_INVOICE_CURRENCY } from "../services/invoice-response.mapper";

export interface ListTenantPaymentsDTO {
  tenantId: string;
  invoiceId?: string;
  status?: string;
  limit?: number;
}

export class ListTenantPaymentsUseCase {
  async execute(data: ListTenantPaymentsDTO) {
    return runWithCentralTenant(data.tenantId, async () => {
      const prisma = prismaCentralUnscoped as any;
      const limit = Math.min(Math.max(data.limit ?? 50, 1), 100);

      const payments = await prisma.payment.findMany({
        where: {
          tenantId: BigInt(data.tenantId),
          deletedAt: null,
          ...(data.status ? { status: data.status } : {}),
          ...(data.invoiceId ? { invoiceId: BigInt(data.invoiceId) } : {}),
        },
        select: {
          id: true,
          invoiceId: true,
          amount: true,
          method: true,
          status: true,
          reference: true,
          proofUrl: true,
          confirmedAt: true,
          createdAt: true,
        },
        orderBy: { createdAt: "desc" },
        take: limit,
      });

      return payments.map((payment: any) => ({
        id: payment.id.toString(),
        invoiceId: payment.invoiceId?.toString() ?? null,
        amount: payment.amount,
        currency: DEFAULT_INVOICE_CURRENCY,
        method: payment.method,
        status: payment.status,
        reference: payment.reference,
        proofUrl: payment.proofUrl,
        confirmedAt: payment.confirmedAt,
        createdAt: payment.createdAt,
      }));
    });
  }
}
