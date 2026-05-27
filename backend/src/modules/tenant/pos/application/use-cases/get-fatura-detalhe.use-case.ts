import { getPrisma } from "../../../../../infrastructure/prisma/tenant-prisma.factory";

const cancellationRoles = new Set(["ADMIN", "GERENTE", "DIRETOR_TECNICO"]);

type UserSummary = {
  id: bigint;
  name: string;
  role: string;
} | null;

export class GetFaturaDetalheUseCase {
  async execute(faturaId: string, viewerUserId: string) {
    const prisma = getPrisma();
    const parsedFaturaId = this.parseUnsignedBigInt(faturaId, "saleId inválido.");
    const parsedViewerId = this.parseUnsignedBigInt(viewerUserId, "Utilizador inválido.");

    const [viewer, fatura] = await Promise.all([
      prisma.user.findFirst({
        where: {
          id: parsedViewerId,
          deletedAt: null,
          active: true,
        },
        select: {
          id: true,
          name: true,
          role: true,
        },
      }),
      prisma.fatura.findFirst({
        where: {
          id: parsedFaturaId,
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
            orderBy: [{ id: "asc" }],
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
              lote: {
                select: {
                  id: true,
                  numeroLote: true,
                },
              },
            },
          },
          pagamentos: {
            where: {
              deletedAt: null,
            },
            orderBy: [{ createdAt: "asc" }, { id: "asc" }],
            select: {
              id: true,
              metodo: true,
              valor: true,
              status: true,
              referencia: true,
              createdAt: true,
            },
          },
        },
      }),
    ]);

    if (!viewer) {
      throw new Error("Sem permissão para consultar a fatura.");
    }

    if (!fatura) {
      throw new Error("Fatura não encontrada.");
    }

    return {
      id: fatura.id.toString(),
      numero: fatura.numero,
      serie: fatura.serie,
      tipo: String(fatura.tipo),
      estado: String(fatura.estado),
      createdAt: fatura.createdAt,
      updatedAt: fatura.updatedAt,
      cancelledAt: fatura.cancelledAt,
      subtotal: this.asNumber(fatura.subtotal),
      desconto: this.asNumber(fatura.desconto),
      ivaTotal: this.asNumber(fatura.ivaTotal),
      total: this.asNumber(fatura.total),
      moeda: fatura.moeda,
      tipoPagamento: String(fatura.tipoPagamento),
      tipoOperacao: String(fatura.tipoOperacao),
      qrCode: fatura.qrCode,
      cliente: fatura.cliente
        ? {
            id: fatura.cliente.id.toString(),
            nome: fatura.cliente.nome,
            documento: fatura.cliente.documento,
          }
        : null,
      terminal: fatura.terminal
        ? {
            id: fatura.terminal.id.toString(),
            nome: fatura.terminal.nome,
            codigo: fatura.terminal.codigo,
          }
        : null,
      user: this.mapUser(fatura.user),
      cancelledBy: this.mapUser(fatura.cancelledBy),
      anulacao: fatura.anulacao
        ? {
            motivo: fatura.anulacao.motivo,
            observacoes: fatura.anulacao.observacoes,
            createdAt: fatura.anulacao.createdAt,
            user: this.mapUser(fatura.anulacao.user),
          }
        : null,
      items: fatura.items.map((item) => ({
        id: item.id.toString(),
        tipo: item.servicoId ? "servico" : "produto",
        produtoId: item.produtoId?.toString() ?? null,
        servicoId: item.servicoId?.toString() ?? null,
        descricao: item.descricao,
        quantidade: this.asNumber(item.quantidade),
        precoUnit: this.asNumber(item.precoUnit),
        baseCalculo: this.asNumber(item.baseCalculo),
        iva: this.asNumber(item.iva),
        valorIva: this.asNumber(item.valorIva),
        taxaAplicada: this.asNumber(item.taxaAplicada),
        codigoRegraFiscal: item.codigoRegraFiscal,
        motivoIsencao: item.motivoIsencao,
        total: this.asNumber(item.total),
        lotes: item.lote == null
          ? []
          : [{
              loteId: item.lote.id.toString(),
              codigo: item.lote.numeroLote,
              quantidade: this.asNumber(item.quantidade),
              ordemFefo: 1,
            }],
      })),
      payments: fatura.pagamentos.map((payment) => ({
        id: payment.id.toString(),
        metodo: String(payment.metodo),
        valor: this.asNumber(payment.valor),
        status: String(payment.status),
        referencia: payment.referencia,
        createdAt: payment.createdAt,
      })),
      summary: {
        itemCount: fatura.items.length,
        paymentCount: fatura.pagamentos.length,
      },
      permissions: {
        canCancel:
          cancellationRoles.has(viewer.role) && String(fatura.estado) !== "ANULADA",
        canPrint: true,
        canExportPdf: true,
      },
      documents: {
        pdfUrl: `/api/v1/tenant/pos/faturas/${fatura.id.toString()}/pdf`,
        printUrl: `/api/v1/tenant/pos/faturas/${fatura.id.toString()}/print`,
      },
    };
  }

  private mapUser(user: UserSummary) {
    if (!user) {
      return null;
    }

    return {
      id: user.id.toString(),
      name: user.name,
      role: String(user.role),
    };
  }

  private asNumber(value: unknown) {
    if (typeof value === "number") {
      return value;
    }
    return Number(value ?? 0);
  }

  private parseUnsignedBigInt(value: string, message: string) {
    const normalized = value.trim();
    if (!/^\d+$/.test(normalized)) {
      throw new Error(message);
    }
    return BigInt(normalized);
  }
}
