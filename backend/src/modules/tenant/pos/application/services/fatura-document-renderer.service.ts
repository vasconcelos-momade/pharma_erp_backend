export type InvoiceDocumentActor = {
  id: string;
  name: string;
  role: string | null;
} | null;

export type InvoiceDocumentDetail = {
  id: string;
  numero: string;
  serie: string | null;
  tipo: string;
  estado: string;
  createdAt: Date;
  updatedAt: Date;
  cancelledAt: Date | null;
  subtotal: number;
  desconto: number;
  ivaTotal: number;
  total: number;
  moeda: string;
  tipoPagamento: string | null;
  tipoOperacao: string | null;
  qrCode: string | null;
  cliente: {
    id: string;
    nome: string;
    documento: string | null;
  } | null;
  terminal: {
    id: string;
    nome: string;
    codigo: string | null;
  } | null;
  user: InvoiceDocumentActor;
  cancelledBy: InvoiceDocumentActor;
  anulacao: {
    motivo: string;
    observacoes: string | null;
    createdAt: Date;
    user: InvoiceDocumentActor;
  } | null;
  items: Array<{
    id: string;
    tipo: string;
    produtoId: string | null;
    servicoId: string | null;
    descricao: string;
    quantidade: number;
    precoUnit: number;
    baseCalculo: number;
    iva: number;
    valorIva: number;
    taxaAplicada: number;
    codigoRegraFiscal: string | null;
    motivoIsencao: string | null;
    total: number;
    lotes: Array<{
      loteId: string;
      codigo: string;
      quantidade: number;
      ordemFefo: number;
    }>;
  }>;
  payments: Array<{
    id: string;
    metodo: string;
    valor: number;
    status: string;
    referencia: string | null;
    createdAt: Date;
  }>;
  summary: {
    itemCount: number;
    paymentCount: number;
  };
};

export class FaturaDocumentRendererService {
  renderPdf(detail: InvoiceDocumentDetail): string {
    const lines = this.buildPrintableLines(detail);
    const content = [
      "BT",
      "/F1 10 Tf",
      "40 800 Td",
      ...lines.flatMap((line, index) => {
        const safeLine = this.escapePdfText(line);
        return index === 0 ? [`(${safeLine}) Tj`] : ["0 -14 Td", `(${safeLine}) Tj`];
      }),
      "ET",
    ].join("\n");

    const objects = [
      "<< /Type /Catalog /Pages 2 0 R >>",
      "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
      "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
      "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
      `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
    ];

    let pdf = "%PDF-1.4\n";
    const offsets = [0];
    for (let index = 0; index < objects.length; index++) {
      offsets.push(pdf.length);
      pdf += `${index + 1} 0 obj\n${objects[index]}\nendobj\n`;
    }

    const xrefOffset = pdf.length;
    pdf += `xref\n0 ${objects.length + 1}\n`;
    pdf += "0000000000 65535 f \n";
    for (let index = 1; index < offsets.length; index++) {
      pdf += `${offsets[index].toString().padStart(10, "0")} 00000 n \n`;
    }
    pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\n`;
    pdf += `startxref\n${xrefOffset}\n%%EOF`;

    return pdf;
  }

  renderEscPos(detail: InvoiceDocumentDetail) {
    const raw = this.buildPrintableLines(detail, 42).join("\n");
    return {
      printer_format: "escpos",
      raw,
      copies: 1,
      document: {
        invoiceId: detail.id,
        numero: detail.numero,
      },
    };
  }

  private buildPrintableLines(detail: InvoiceDocumentDetail, width = 80) {
    const lines: string[] = [
      "SKALWAY PHARMA ERP",
      `FATURA ${detail.numero}`,
      `Serie: ${detail.serie ?? "-"}`,
      `Estado: ${detail.estado}`,
      `Data: ${this.formatDateTime(detail.createdAt)}`,
      `Cliente: ${detail.cliente?.nome ?? "Consumidor final"}`,
      `Terminal: ${detail.terminal?.codigo ?? detail.terminal?.nome ?? "-"}`,
      `Operador: ${detail.user?.name ?? "-"}`,
      "-".repeat(Math.max(20, width)),
      "ITENS",
    ];

    for (const item of detail.items) {
      lines.push(this.fitText(item.descricao, width));
      lines.push(
        this.fitText(
          `${this.formatQty(item.quantidade)} x ${this.formatMoney(item.precoUnit, detail.moeda)}  IVA ${this.formatPercent(item.taxaAplicada)}  = ${this.formatMoney(item.total, detail.moeda)}`,
          width,
        ),
      );
      for (const lote of item.lotes) {
        lines.push(this.fitText(`  Lote ${lote.codigo}  Qtd ${this.formatQty(lote.quantidade)}`, width));
      }
    }

    lines.push("-".repeat(Math.max(20, width)));
    lines.push(`Subtotal: ${this.formatMoney(detail.subtotal, detail.moeda)}`);
    lines.push(`Desconto: ${this.formatMoney(detail.desconto, detail.moeda)}`);
    lines.push(`IVA: ${this.formatMoney(detail.ivaTotal, detail.moeda)}`);
    lines.push(`Total: ${this.formatMoney(detail.total, detail.moeda)}`);
    lines.push(`Pagamento: ${detail.tipoPagamento ?? "-"}`);

    if (detail.payments.length > 0) {
      lines.push("-".repeat(Math.max(20, width)));
      lines.push("PAGAMENTOS");
      for (const payment of detail.payments) {
        lines.push(
          this.fitText(
            `${payment.metodo}  ${this.formatMoney(payment.valor, detail.moeda)}  ${payment.status}`,
            width,
          ),
        );
      }
    }

    if (detail.anulacao != null) {
      lines.push("-".repeat(Math.max(20, width)));
      lines.push("ANULACAO");
      lines.push(this.fitText(`Motivo: ${detail.anulacao.motivo}`, width));
      if ((detail.anulacao.observacoes?.trim().length ?? 0) > 0) {
        lines.push(this.fitText(`Obs: ${detail.anulacao.observacoes}`, width));
      }
      lines.push(this.fitText(`Data: ${this.formatDateTime(detail.anulacao.createdAt)}`, width));
    }

    if ((detail.qrCode?.trim().length ?? 0) > 0) {
      lines.push("-".repeat(Math.max(20, width)));
      lines.push(this.fitText(`QR: ${detail.qrCode}`, width));
    }

    lines.push("-".repeat(Math.max(20, width)));
    lines.push("Documento gerado pelo backend.");
    return lines;
  }

  private fitText(value: string, width: number) {
    const normalized = this.normalizeAscii(value);
    if (normalized.length <= width) {
      return normalized;
    }
    return `${normalized.substring(0, Math.max(0, width - 3))}...`;
  }

  private escapePdfText(value: string) {
    return this.normalizeAscii(value)
      .replace(/\\/g, "\\\\")
      .replace(/\(/g, "\\(")
      .replace(/\)/g, "\\)");
  }

  private normalizeAscii(value: string) {
    return value
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^\x20-\x7E]/g, "?");
  }

  private formatMoney(value: number, currency: string) {
    return `${value.toFixed(2)} ${currency}`;
  }

  private formatPercent(value: number) {
    return `${value.toFixed(value % 1 === 0 ? 0 : 2)}%`;
  }

  private formatQty(value: number) {
    return value.toFixed(value % 1 === 0 ? 0 : 2);
  }

  private formatDateTime(value: Date) {
    const date = new Date(value);
    const day = date.getDate().toString().padStart(2, "0");
    const month = (date.getMonth() + 1).toString().padStart(2, "0");
    const year = date.getFullYear().toString().padStart(4, "0");
    const hour = date.getHours().toString().padStart(2, "0");
    const minute = date.getMinutes().toString().padStart(2, "0");
    return `${day}/${month}/${year} ${hour}:${minute}`;
  }
}
