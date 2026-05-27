import { prismaCentralUnscoped } from "../../../../../infrastructure/prisma/prisma-central.service";
import { runWithCentralTenant } from "../../../../../shared/context/central-tenant-context";
import { applyPaymentToInvoice } from "../services/apply-payment-to-invoice.service";

export interface ConfirmPaymentDTO {
  tenantId: string;
  paymentId: string;
  confirmedByUserId: string;
}

export class ConfirmPaymentUseCase {
  async execute(data: ConfirmPaymentDTO) {
    return runWithCentralTenant(data.tenantId, async () => {
      const prisma = prismaCentralUnscoped as any;

      return prisma.$transaction(async (tx: any) =>
        applyPaymentToInvoice(tx, {
          tenantId: data.tenantId,
          paymentId: BigInt(data.paymentId),
          confirmedByUserId: data.confirmedByUserId,
        }),
      );
    });
  }
}
