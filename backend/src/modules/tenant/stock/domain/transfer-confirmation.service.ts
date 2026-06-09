import {
  NotFoundApiError,
  ValidationApiError,
} from "../../../../shared/http/api-error";
import { getQuantidadeDisponivel, type StockTx } from "./produto-stock.service";

type TransferConfirmationTx = StockTx & {
  $executeRaw: (
    query: TemplateStringsArray,
    ...values: unknown[]
  ) => Promise<unknown>;
  produto: StockTx["produto"] & {
    findUnique: (args: {
      where: { id: bigint };
      select?: {
        id?: boolean;
        nome?: boolean;
        estoqueAtual?: boolean;
      };
    }) => Promise<
      | {
          id?: bigint;
          nome?: string;
          estoqueAtual?: unknown;
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
  };
  estoqueMovimento: {
    create: (args: { data: Record<string, unknown> }) => Promise<unknown>;
  };
};

export interface TransferConfirmationItem {
  id: bigint;
  produtoId: bigint;
  loteId: bigint | null;
  quantidade: number;
}

export interface ConfirmTransferInput {
  transferenciaId: bigint;
  numeroDocumento: string;
  origem: string;
  destino: string;
  tipo: "SAIDA" | "ENTRADA";
  userId: bigint;
  itens: TransferConfirmationItem[];
}

export async function confirmTransferStockMovements(
  tx: TransferConfirmationTx,
  input: ConfirmTransferInput,
): Promise<void> {
  if (input.origem.trim() === input.destino.trim()) {
    throw new ValidationApiError(
      "Origem e destino da transferência devem ser diferentes",
    );
  }

  if (input.itens.length === 0) {
    throw new ValidationApiError(
      "A transferência deve possuir pelo menos um item",
    );
  }

  const movementTipo = input.tipo === "ENTRADA" ? "ENTRADA" : "SAIDA";
  const movementLabel =
    input.tipo === "ENTRADA" ? "ENTRADA DOCUMENTAL" : "SAIDA DOCUMENTAL";
  const movementSuffix = input.tipo === "ENTRADA" ? "entrada" : "saida";

  for (const item of input.itens) {
    const produto = await tx.produto.findUnique({
      where: { id: item.produtoId },
      select: { id: true, nome: true, estoqueAtual: true },
    });

    if (!produto?.id) {
      throw new NotFoundApiError(
        `Produto ${item.produtoId.toString()} não encontrado`,
      );
    }

    await tx.$executeRaw`SELECT id FROM produtos WHERE id = ${produto.id} FOR UPDATE`;

    let estoqueReferencia = await getQuantidadeDisponivel(tx, produto.id);

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
          `Lote ${item.loteId.toString()} não encontrado`,
        );
      }

      if (lote.produtoId !== produto.id) {
        throw new ValidationApiError(
          `O lote ${item.loteId.toString()} não pertence ao produto informado`,
        );
      }

      estoqueReferencia = Number(lote.quantidadeAtual ?? 0);
    }

    if (input.tipo === "SAIDA" && estoqueReferencia < item.quantidade) {
      throw new ValidationApiError(
        `Stock insuficiente para o produto ${produto.nome ?? produto.id.toString()}`,
      );
    }

    const referencia = `TRANSFERENCIA:${input.transferenciaId.toString()}`;
    const observacaoBase =
      `Transferência ${input.numeroDocumento}: ${input.origem} -> ${input.destino}`;

    await tx.estoqueMovimento.create({
      data: {
        produtoId: produto.id,
        loteId: item.loteId,
        userId: input.userId,
        tipo: movementTipo,
        quantidade: item.quantidade,
        estoqueAnterior: estoqueReferencia,
        estoqueFinal: estoqueReferencia,
        origem: referencia,
        idempotencyKey: `${referencia}:item:${item.id.toString()}:${movementSuffix}`,
        observacoes: `${observacaoBase} [${movementLabel}]`,
      },
    });
  }
}
