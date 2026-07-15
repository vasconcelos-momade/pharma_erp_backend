import { readLoteDisponivel, readLoteTotal } from "./lote-stock-read.util";

export type MovimentacaoSanitariaTipo =
  | "QUARENTENA"
  | "LIBERACAO"
  | "INCINERACAO"
  | "RECALL"
  | "DEVOLUCAO_FORNECEDOR";

/** Estado sanitário efectivo para a UI (inclui QUARENTENA/INCINERADO derivados). */
export type EstadoSanitarioEfetivo =
  | "VALIDO"
  | "QUARENTENA"
  | "RECALL"
  | "EXPIRADO"
  | "INCINERADO";

export type LoteSanitarioSnapshot = {
  estadoSanitario?: string | null;
  disponibilidade?: string | null;
  quantidadeQuarentena?: unknown;
  quantidadeIncinerada?: unknown;
  quantidadeDisponivel?: unknown;
  quantidadeTotal?: unknown;
  stockBalance?: {
    quantidadeDisponivel?: unknown;
    quantidadeTotal?: unknown;
  } | null;
};

const ACTION_LABELS: Record<MovimentacaoSanitariaTipo, string> = {
  QUARENTENA: "Quarentena",
  LIBERACAO: "Liberação",
  INCINERACAO: "Incineração",
  RECALL: "Recall",
  DEVOLUCAO_FORNECEDOR: "Devolução ao fornecedor",
};

export function resolveEstadoSanitarioEfetivo(
  lote: LoteSanitarioSnapshot,
): EstadoSanitarioEfetivo {
  const estado = lote.estadoSanitario?.toString() ?? "VALIDO";
  if (estado === "RECALL") return "RECALL";
  if (estado === "EXPIRADO") return "EXPIRADO";

  const quarentena = Math.max(0, Number(lote.quantidadeQuarentena ?? 0) || 0);
  const incinerada = Math.max(0, Number(lote.quantidadeIncinerada ?? 0) || 0);
  const disponivel = Math.max(0, readLoteDisponivel(lote));
  const total = Math.max(0, readLoteTotal(lote));

  // Após incineração completa: sem stock útil restante.
  if (incinerada > 0 && disponivel <= 0 && quarentena <= 0 && total <= 0) {
    return "INCINERADO";
  }

  if (quarentena > 0) return "QUARENTENA";
  return "VALIDO";
}

/**
 * Regras:
 * - QUARENTENA → apenas LIBERACAO ou INCINERACAO
 * - INCINERADO → nenhuma nova movimentação
 * - RECALL → apenas INCINERACAO (destruição)
 * - EXPIRADO → apenas INCINERACAO
 * - VALIDO → QUARENTENA, INCINERACAO, RECALL, DEVOLUCAO_FORNECEDOR
 */
export function resolveAcoesSanitariasPermitidas(
  lote: LoteSanitarioSnapshot,
): MovimentacaoSanitariaTipo[] {
  const efetivo = resolveEstadoSanitarioEfetivo(lote);

  switch (efetivo) {
    case "INCINERADO":
      return [];
    case "QUARENTENA":
      return ["LIBERACAO", "INCINERACAO"];
    case "RECALL":
      return ["INCINERACAO"];
    case "EXPIRADO":
      return ["INCINERACAO"];
    case "VALIDO":
    default:
      return ["QUARENTENA", "INCINERACAO", "RECALL", "DEVOLUCAO_FORNECEDOR"];
  }
}

export function assertMovimentacaoSanitariaPermitida(
  lote: LoteSanitarioSnapshot,
  tipo: MovimentacaoSanitariaTipo,
): void {
  const permitidas = resolveAcoesSanitariasPermitidas(lote);
  if (!permitidas.includes(tipo)) {
    const efetivo = resolveEstadoSanitarioEfetivo(lote);
    const allowed =
      permitidas.length === 0
        ? "nenhuma acção permitida"
        : permitidas.map((a) => ACTION_LABELS[a]).join(", ");
    throw new Error(
      `Movimentação ${ACTION_LABELS[tipo]} não permitida no estado ${efetivo}. Permitidas: ${allowed}.`,
    );
  }
}

export function buildSanitarioUiMeta(lote: LoteSanitarioSnapshot) {
  const estadoSanitarioEfetivo = resolveEstadoSanitarioEfetivo(lote);
  const acoesPermitidas = resolveAcoesSanitariasPermitidas(lote);

  return {
    estadoSanitarioEfetivo,
    acoesPermitidas,
    acoesPermitidasOpcoes: acoesPermitidas.map((value) => ({
      value,
      label: ACTION_LABELS[value],
    })),
    quantidadeIncinerada: Math.max(
      0,
      Number(lote.quantidadeIncinerada ?? 0) || 0,
    ),
  };
}
