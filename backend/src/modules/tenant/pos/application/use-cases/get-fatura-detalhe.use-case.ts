import { NotFoundApiError } from "../../../../../shared/http/api-error";
import { getPrisma } from "../../../../../infrastructure/prisma/tenant-prisma.factory";
import { mapAllocationsToApiLotes } from "../../../sales/domain/fatura-item-lote.service";
import { resolveTenantEmpresaProfile } from "../services/tenant-empresa-profile.service";

export class GetFaturaDetalheUseCase {
  async execute(faturaId: string) {
    const prisma = getPrisma() as any;
    const id = BigInt(faturaId);

    const fatura: any = await prisma.fatura.findFirst({
      where: {
        id,
        deletedAt: null,
      },
      select: {
        id: true,
        numero: true,
        serie: true,
        tipo: true,
        estado: true,
        createdAt: true,
        updatedAt: true,
        cancelledAt: true,
        subtotal: true,
        desconto: true,
        ivaTotal: true,
        total: true,
        valorRecebido: true,
        troco: true,
        moeda: true,
        tipoPagamento: true,
        tipoOperacao: true,
        qrCode: true,
        cliente: {
          select: {
            id: true,
            nome: true,
            documento: true,
          },
        },
        terminal: {
          select: {
            id: true,
            nome: true,
            codigo: true,
          },
        },
        user: {
          select: {
            id: true,
            name: true,
            role: true,
          },
        },
        cancelledBy: {
          select: {
            id: true,
            name: true,
            role: true,
          },
        },
        anulacao: {
          select: {
            motivo: true,
            observacoes: true,
            createdAt: true,
            user: {
              select: {
                id: true,
                name: true,
                role: true,
              },
            },
          },
        },
        items: {
          select: {
            id: true,
            produtoId: true,
            servicoId: true,
            descricao: true,
            quantidade: true,
            precoUnit: true,
            baseCalculo: true,
            iva: true,
            valorIva: true,
            taxaAplicada: true,
            codigoRegraFiscal: true,
            motivoIsencao: true,
            total: true,
            produto: {
              select: {
                nomeComercial: true,
                dosagem: true,
                forma: true,
              },
            },
            lotesAlocacao: {
              orderBy: { ordemFefo: "asc" },
              select: {
                loteId: true,
                quantidade: true,
                ordemFefo: true,
                lote: { select: { numeroLote: true } },
              },
            },
          },
          orderBy: [{ id: "asc" }],
        },
        pagamentos: {
          where: {
            deletedAt: null,
          },
          select: {
            id: true,
            metodo: true,
            valor: true,
            status: true,
            referencia: true,
            createdAt: true,
          },
          orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        },
        _count: {
          select: {
            items: true,
            pagamentos: true,
          },
        },
      },
    });

    if (!fatura) {
      throw new NotFoundApiError("Fatura não encontrada");
    }

    const empresa = await resolveTenantEmpresaProfile();

    return {
      id: fatura.id,
      numero: fatura.numero,
      serie: fatura.serie,
      tipo: fatura.tipo,
      estado: fatura.estado,
      createdAt: fatura.createdAt,
      updatedAt: fatura.updatedAt,
      cancelledAt: fatura.cancelledAt,
      subtotal: fatura.subtotal,
      desconto: fatura.desconto,
      ivaTotal: fatura.ivaTotal,
      total: fatura.total,
      valorRecebido: fatura.valorRecebido,
      troco: fatura.troco,
      moeda: fatura.moeda,
      tipoPagamento: fatura.tipoPagamento,
      tipoOperacao: fatura.tipoOperacao,
      qrCode: fatura.qrCode,
      empresa,
      cliente: fatura.cliente,
      terminal: fatura.terminal,
      user: fatura.user,
      cancelledBy: fatura.cancelledBy,
      anulacao: fatura.anulacao,
      items: fatura.items.map((item: any) => ({
        id: item.id,
        tipo: item.produtoId ? "produto" : "servico",
        produtoId: item.produtoId,
        servicoId: item.servicoId,
        descricao: item.descricao,
        nomeComercial: item.produto?.nomeComercial ?? null,
        dosagem: item.produto?.dosagem ?? null,
        forma: item.produto?.forma ?? null,
        quantidade: item.quantidade,
        precoUnit: item.precoUnit,
        baseCalculo: item.baseCalculo,
        iva: item.iva,
        valorIva: item.valorIva,
        taxaAplicada: item.taxaAplicada,
        codigoRegraFiscal: item.codigoRegraFiscal,
        motivoIsencao: item.motivoIsencao,
        total: item.total,
        lotes: mapAllocationsToApiLotes(item.lotesAlocacao ?? []),
      })),
      payments: fatura.pagamentos,
      summary: {
        itemCount: fatura._count.items,
        paymentCount: fatura._count.pagamentos,
      },
      permissions: {
        canCancel: fatura.estado !== "ANULADA",
        canPrint: true,
        // FR: PDF 80mm de preview; FT: PDF A4
        canExportPdf: true,
      },
      documents: {
        mode: fatura.tipo === "FR" ? "thermal_80mm" : "pdf_a4",
        pdfUrl: `/api/v1/tenant/pos/faturas/${fatura.id.toString()}/pdf`,
        printUrl: `/api/v1/tenant/pos/faturas/${fatura.id.toString()}/print`,
      },
    };
  }
}
