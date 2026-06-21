import {
  NotFoundApiError,
  ValidationApiError,
} from "../../../../shared/http/api-error";
import {
  applyStockReturnDelta,
  applyStockSaleDelta,
  getQuantidadeDisponivel,
  getQuantidadeTotal,
  syncProductStockFromLotes,
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

async function getCurrentStockReference(
  tx: RequisitionConfirmationTx,
  produtoId: bigint,
  loteId: bigint | null,
): Promise<number> {
  if (loteId != null) {
    const lote = await tx.lote.findUnique({
      where: { id: loteId },
      select: { quantidadeAtual: true },
    });
    return Number(lote?.quantidadeAtual ?? 0);
  }

  return getQuantidadeTotal(tx, produtoId);
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

async function applyMovement(
  tx: RequisitionConfirmationTx,
  input: ConfirmRequisitionInput,
  item: RequisitionConfirmationItem,
  produto: { id: bigint; nome?: string },
  kind: MovementKind,
  observacaoBase: string,
): Promise<void> {
  const estoqueAnterior = await getCurrentStockReference(
    tx,
    produto.id,
    item.loteId,
  );

  let estoqueFinal: number;
  if (kind === "SAIDA") {
    if (item.loteId != null) {
      await tx.lote.update({
        where: { id: item.loteId },
        data: {
          quantidadeAtual: { decrement: item.quantidadeSolicitada },
          version: { increment: 1 },
        },
      });
      await syncProductStockFromLotes(tx, produto.id);
      estoqueFinal = await getCurrentStockReference(
        tx,
        produto.id,
        item.loteId,
      );
    } else {
      await applyStockSaleDelta(tx, produto.id, item.quantidadeSolicitada);
      estoqueFinal = await getQuantidadeTotal(tx, produto.id);
    }
  } else if (item.loteId != null) {
    await tx.lote.update({
      where: { id: item.loteId },
      data: {
        quantidadeAtual: { increment: item.quantidadeSolicitada },
        quantidadeInicial: { increment: item.quantidadeSolicitada },
        version: { increment: 1 },
      },
    });
    await syncProductStockFromLotes(tx, produto.id);
    estoqueFinal = await getCurrentStockReference(
      tx,
      produto.id,
      item.loteId,
    );
  } else {
    estoqueFinal = await applyStockReturnDelta(
      tx,
      produto.id,
      item.quantidadeSolicitada,
    );
  }

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

export type TransferConfirmationTx = RequisitionConfirmationTx;
export type TransferConfirmationItem = RequisitionConfirmationItem;
export type ConfirmTransferInput = ConfirmRequisitionInput;
export const confirmTransferStockMovements = confirmRequisitionStockMovements;
