import { prismaCentralUnscoped } from "../../../../../infrastructure/prisma/prisma-central.service";

export interface AllocatedInvoiceFiscal {
  fiscalYear: number;
  sequence: number;
  number: string;
}

/**
 * Aloca número fiscal sequencial por tenant/ano (concorrência segura via counter + unique).
 */
export async function allocateInvoiceFiscal(
  tenantId: bigint,
  referenceDate: Date,
  tx?: any,
): Promise<AllocatedInvoiceFiscal> {
  const fiscalYear = referenceDate.getUTCFullYear();
  const db = tx ?? prismaCentralUnscoped;

  const counter = await db.invoiceFiscalCounter.upsert({
    where: {
      tenantId_fiscalYear: {
        tenantId,
        fiscalYear,
      },
    },
    create: {
      tenantId,
      fiscalYear,
      lastSequence: 1,
    },
    update: {
      lastSequence: { increment: 1 },
    },
  });

  const sequence = Number(counter.lastSequence);
  const number = `INV-${fiscalYear}-${String(sequence).padStart(6, "0")}`;

  return { fiscalYear, sequence, number };
}
