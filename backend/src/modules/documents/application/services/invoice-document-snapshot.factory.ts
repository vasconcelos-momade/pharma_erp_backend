import { getBranchStore } from "../../../../shared/context/branch-context";
import type { InvoiceDocumentSnapshotPayload } from "../../domain/document.types";

type InvoiceDetailLike = {
  id: string;
  numero: string;
  serie: string | null;
  tipo: string;
  estado: string;
  createdAt: Date | string;
  updatedAt: Date | string;
  subtotal: number;
  desconto: number;
  ivaTotal: number;
  total: number;
  moeda: string;
  tipoPagamento: string | null;
  tipoOperacao: string | null;
  qrCode: string | null;
  cliente: { id: string; nome: string; documento: string | null } | null;
  terminal: { id: string; nome: string; codigo: string | null } | null;
  user: { id: string; name: string; role: string | null } | null;
  cancelledBy: { id: string; name: string; role: string | null } | null;
  anulacao: {
    motivo: string;
    observacoes: string | null;
    createdAt: Date | string;
    user: { id: string; name: string; role: string | null } | null;
  } | null;
  items: Array<{
    id: string;
    tipo: string;
    descricao: string;
    quantidade: number;
    precoUnit: number;
    valorIva: number;
    taxaAplicada: number;
    total: number;
    lotes: Array<{ loteId: string; codigo: string; quantidade: number }>;
  }>;
  payments: Array<{
    id: string;
    metodo: string;
    valor: number;
    status: string;
    referencia: string | null;
    createdAt: Date | string;
  }>;
};

export class InvoiceDocumentSnapshotFactory {
  build(detail: InvoiceDetailLike, qrCodeDataUrl: string | null): InvoiceDocumentSnapshotPayload {
    return {
      snapshotVersion: 1,
      invoiceId: detail.id,
      number: detail.numero,
      series: detail.serie,
      type: detail.tipo,
      status: detail.estado,
      currency: detail.moeda,
      createdAt: new Date(detail.createdAt).toISOString(),
      updatedAt: new Date(detail.updatedAt).toISOString(),
      customer: {
        id: detail.cliente?.id ?? null,
        name: detail.cliente?.nome ?? "Consumidor final",
        document: detail.cliente?.documento ?? null,
      },
      operator: {
        id: detail.user?.id ?? null,
        name: detail.user?.name ?? "-",
        role: detail.user?.role ?? null,
      },
      terminal: {
        id: detail.terminal?.id ?? null,
        name: detail.terminal?.nome ?? null,
        code: detail.terminal?.codigo ?? null,
        branchName: null,
      },
      totals: {
        subtotal: detail.subtotal,
        discount: detail.desconto,
        tax: detail.ivaTotal,
        total: detail.total,
      },
      payment: {
        method: detail.tipoPagamento,
        entries: detail.payments.map((payment) => ({
          id: payment.id,
          method: payment.metodo,
          amount: payment.valor,
          status: payment.status,
          reference: payment.referencia,
          createdAt: new Date(payment.createdAt).toISOString(),
        })),
      },
      cancellation: detail.anulacao
        ? {
            cancelledAt: new Date(detail.anulacao.createdAt).toISOString(),
            reason: detail.anulacao.motivo,
            notes: detail.anulacao.observacoes,
            cancelledBy: detail.anulacao.user
              ? {
                  id: detail.anulacao.user.id,
                  name: detail.anulacao.user.name,
                  role: detail.anulacao.user.role,
                }
              : detail.cancelledBy
                ? {
                    id: detail.cancelledBy.id,
                    name: detail.cancelledBy.name,
                    role: detail.cancelledBy.role,
                  }
                : null,
          }
        : null,
      fiscal: {
        operationType: detail.tipoOperacao,
        qrPayload: detail.qrCode,
        qrCodeDataUrl,
        legalText: [
          "Documento processado por sistema informatico.",
          "Reimpressao baseada em snapshot fiscal imutavel.",
        ],
        futureSignature: {
          signed: false,
          signatureHash: null,
        },
      },
      branding: {
        companyName: "SKALWAY PHARMA ERP",
        tagline: "ERP/POS Enterprise",
        logoUrl: null,
        address: null,
        taxId: null,
        contacts: [],
      },
      items: detail.items.map((item) => ({
        id: item.id,
        type: item.tipo === "servico" ? "servico" : "produto",
        description: item.descricao,
        quantity: item.quantidade,
        unitPrice: item.precoUnit,
        taxPercent: item.taxaAplicada,
        taxAmount: item.valorIva,
        discount: 0,
        total: item.total,
        lots: item.lotes.map((lot) => ({
          lotId: lot.loteId,
          code: lot.codigo,
          quantity: lot.quantidade,
        })),
      })),
    };
  }
}
