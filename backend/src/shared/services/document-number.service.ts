type PrismaTx = any;

export type NextProformaInvoiceNumberParams = {
  serie: string; // e.g. "FTP"
  padLength: number; // e.g. 7 => FTP-0000001
};

/**
 * Serviço genérico de numeração de documentos comerciais.
 * Atualmente implementado para ProformaInvoice (serie FTP).
 */
export class DocumentNumberService {
  async nextProformaInvoiceNumero(
    tx: PrismaTx,
    params: NextProformaInvoiceNumberParams,
  ): Promise<string> {
    const prefix = `${params.serie}-`;

    const last = await tx.proformaInvoice.findFirst({
      where: {
        deletedAt: null,
        numero: { startsWith: prefix },
      },
      orderBy: { createdAt: "desc" },
      select: { numero: true },
    });

    const lastNumero = last?.numero ?? null;
    const match = lastNumero?.match(new RegExp(`^${prefix}(\\d+)$`));
    const lastSeq = match ? Number(match[1]) : 0;

    const nextSeq = Math.max(1, lastSeq + 1);
    const padded = String(nextSeq).padStart(params.padLength, "0");
    return `${prefix}${padded}`;
  }
}

