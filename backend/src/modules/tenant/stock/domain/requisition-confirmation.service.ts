import {
  NotFoundApiError,
  ValidationApiError,
} from "../../../../shared/http/api-error";
import {
  getQuantidadeDisponivel,
  getQuantidadeTotalFromMovements,
  syncStockBalanceCache,
  type StockTx,
} from "./produto-stock.service";

type RequisitionConfirmationTx = StockTx & {
  $executeRaw: (
    query: TemplateStringsArray,
    ...values: unknown[]
  ) => Promise<unknown>;
  produto: {
    findUnique: (args: {
      where: { id: bigint };
      select?: {
        id?: boolean;
        nome?: boolean;
      };
    }) => Promise<
      | {
          id?: bigint;
          nome?: string;
        }
      | null
    >;
  };
  lote: NonNullable<StockTx["lote"]> & {
    findUnique: (args: {
      where: { id: bigint };
      select?: {
        id?: boolean;
        produtoId?: boolean;
        quantidadeAtual?: boolean;
        numeroLote?: boolean;
      };
    }) => Promise<
      | {
          id?: bigint;
          produtoId?: bigint;
          quantidadeAtual?: unknown;
          numeroLote?: string;
        }
      | null
    >;
    update: (args: {
      where: { id: bigint };
      data: Record<string, unknown>;
    }) => Promise<unknown>;
    findMany: (args: {
      where: Record<string, unknown>;
      select?: Record<string, boolean>;
    }) => Promise<Array<{ quantidadeAtual: unknown }>>;
  };
  estoqueMovimento: {
    create: (args: { data: Record<string, unknown> }) => Promise<unknown>;
  };
};

export interface RequisitionConfirmationItem {
  id: bigint;
  produtoId: bigint;
  loteId: bigint | null;
  quantidadeSolicitada: number;
}

export interface ConfirmRequisitionInput {
  requisicaoId: bigint;
  numeroDocumento: string;
  origem: string | null;
  destino: string | null;
  tipo: "SAIDA" | "ENTRADA";
  userId: bigint;
  itens: RequisitionConfirmationItem[];
}

type MovementKind = "SAIDA" | "ENTRADA";

function normalizeLocation(value: string | null | undefined): string | null {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

function validateRequestLocations(
  tipo: ConfirmRequisitionInput["tipo"],
  origem: string | null,
  destino: string | null,
): void {
  if (tipo === "SAIDA") {
    if (!destino) {
      throw new ValidationApiError("Requisicoes do tipo SAIDA exigem o destino");
    }
    if (origem) {
      throw new ValidationApiError("Origem deve ser nula para requisicoes do tipo SAIDA");
    }
  }

  if (tipo === "ENTRADA") {
    if (!origem) {
      throw new ValidationApiError("Requisicoes do tipo ENTRADA exigem a origem");
    }
    if (destino) {
      throw new ValidationApiError("Destino deve ser nulo para requisicoes do tipo ENTRADA");
    }
  }
}

function buildObservationBase(input: ConfirmRequisitionInput): string {
  const origem = normalizeLocation(input.origem) ?? "SEM_ORIGEM";
  const destino = normalizeLocation(input.destino) ?? "SEM_DESTINO";
  return `Requisicao ${input.numeroDocumento}: ${input.tipo} - ${origem} -> ${destino}`;
}

async function validateStockAvailability(
  tx: RequisitionConfirmationTx,
  produtoId: bigint,
  loteId: bigint | null,
  quantidadeSolicitada: number,
  productName: string,
): Promise<void> {
  const quantidadeDisponivel =
    loteId != null
      ? Number(
          (
            await tx.lote.findUnique({
              where: { id: loteId },
              select: { quantidadeAtual: true },
            })
          )?.quantidadeAtual ?? 0,
        )
      : await getQuantidadeDisponivel(tx, produtoId);

  if (quantidadeDisponivel < quantidadeSolicitada) {
    throw new ValidationApiError(
      `Stock insuficiente para o produto ${productName}`,
    );
  }
}

async function getEstoqueTotalProdutoReference(
  tx: RequisitionConfirmationTx,
  produtoId: bigint,
): Promise<number> {
  // Fonte de verdade: ledger. Fallback: StockBalance (bases novas / seeds / testes).
  const fromLedger = await getQuantidadeTotalFromMovements(tx, produtoId);
  if (fromLedger > 0) {
    return fromLedger;
  }
  const balance = await tx.stockBalance.findUnique({ where: { produtoId } });
  return Number(balance?.quantidadeTotal ?? 0);
}

async function applyMovement(
  tx: RequisitionConfirmationTx,
  input: ConfirmRequisitionInput,
  item: RequisitionConfirmationItem,
  produto: { id: bigint; nome?: string },
  kind: MovementKind,
  observacaoBase: string,
): Promise<void> {
  const estoqueAnterior =
    item.loteId != null
      ? Number(
          (
            await tx.lote.findUnique({
              where: { id: item.loteId },
              select: { quantidadeAtual: true },
            })
          )?.quantidadeAtual ?? 0,
        )
      : await getEstoqueTotalProdutoReference(tx, produto.id);
  const delta =
    kind === "SAIDA" ? -item.quantidadeSolicitada : item.quantidadeSolicitada;

  if (item.loteId != null) {
    if (kind === "SAIDA") {
      await tx.lote.update({
        where: { id: item.loteId },
        data: {
          quantidadeAtual: { decrement: item.quantidadeSolicitada },
          version: { increment: 1 },
        },
      });
    } else {
      await tx.lote.update({
        where: { id: item.loteId },
        data: {
          quantidadeAtual: { increment: item.quantidadeSolicitada },
          quantidadeInicial: { increment: item.quantidadeSolicitada },
          version: { increment: 1 },
        },
      });
    }
  }

  const estoqueFinal = estoqueAnterior + delta;

  await tx.estoqueMovimento.create({
    data: {
      produtoId: produto.id,
      loteId: item.loteId,
      userId: input.userId,
      tipo: kind,
      quantidade: item.quantidadeSolicitada,
      estoqueAnterior,
      estoqueFinal,
      origem: `REQUISICAO:${input.requisicaoId.toString()}`,
      idempotencyKey: `REQUISICAO:${input.requisicaoId.toString()}:item:${item.id.toString()}:${kind.toLowerCase()}`,
      observacoes: `${observacaoBase}`,
    },
  });

  await syncStockBalanceCache(tx, produto.id);
}

export async function confirmRequisitionStockMovements(
  tx: RequisitionConfirmationTx,
  input: ConfirmRequisitionInput,
): Promise<void> {
  const origem = normalizeLocation(input.origem);
  const destino = normalizeLocation(input.destino);
  validateRequestLocations(input.tipo, origem, destino);

  if (input.itens.length === 0) {
    throw new ValidationApiError(
      "A requisicao deve possuir pelo menos um item",
    );
  }

  const observacaoBase = buildObservationBase({
    ...input,
    origem,
    destino,
  });
  const kind: MovementKind = input.tipo;

  for (const item of input.itens) {
    if (item.quantidadeSolicitada <= 0) {
      throw new ValidationApiError(
        "Quantidade solicitada invalida para a requisicao",
      );
    }

    const produto = await tx.produto.findUnique({
      where: { id: item.produtoId },
      select: { id: true, nome: true },
    });

    if (!produto?.id) {
      throw new NotFoundApiError(
        `Produto ${item.produtoId.toString()} nao encontrado`,
      );
    }

    await tx.$executeRaw`SELECT id FROM produtos WHERE id = ${produto.id} FOR UPDATE`;

    if (item.loteId != null) {
      await tx.$executeRaw`SELECT id FROM lotes WHERE id = ${item.loteId} FOR UPDATE`;
      const lote = await tx.lote.findUnique({
        where: { id: item.loteId },
        select: {
          id: true,
          produtoId: true,
          quantidadeAtual: true,
          numeroLote: true,
        },
      });

      if (!lote?.id || lote.produtoId == null) {
        throw new NotFoundApiError(
          `Lote ${item.loteId.toString()} nao encontrado`,
        );
      }

      if (lote.produtoId !== produto.id) {
        throw new ValidationApiError(
          `O lote ${item.loteId.toString()} nao pertence ao produto informado`,
        );
      }
    }

    if (kind === "SAIDA") {
      await validateStockAvailability(
        tx,
        produto.id,
        item.loteId,
        item.quantidadeSolicitada,
        produto.nome ?? produto.id.toString(),
      );
    }

    await applyMovement(tx, input, item, produto as { id: bigint; nome?: string }, kind, observacaoBase);
  }
}
