/** Preços POS: sempre da base de dados; valores do cliente são ignorados. */

export function resolveProdutoPrecoVendaFromRow(produto: {
  nome?: string;
  precoVenda?: unknown;
  preco_venda?: unknown;
}): number {
  const preco = Number(produto.precoVenda ?? produto.preco_venda ?? 0);
  if (!Number.isFinite(preco) || preco <= 0) {
    const nome = produto.nome?.trim() || "Produto";
    throw new Error(
      `O produto «${nome}» não pode ser vendido: preço de venda (precoVenda) deve ser superior a zero.`,
    );
  }
  return preco;
}

export function resolveServicoPrecoFromRow(servico: { nome?: string; preco?: unknown }): number {
  const preco = Number(servico.preco ?? 0);
  if (!Number.isFinite(preco) || preco <= 0) {
    const nome = servico.nome?.trim() || "Serviço";
    throw new Error(
      `O serviço «${nome}» não pode ser vendido: o preço deve ser superior a zero.`,
    );
  }
  return preco;
}

/** Regista quando o cliente envia preço diferente do servidor (compatibilidade / auditoria). */
export function warnIgnoredClientUnitPrice(params: {
  context: string;
  entityId: string;
  entityLabel?: string;
  clientPreco?: number;
  serverPreco: number;
}): void {
  const client = params.clientPreco;
  if (client === undefined || client === null || !Number.isFinite(client)) {
    return;
  }
  const diff = Math.abs(Number(client) - params.serverPreco);
  if (diff < 0.0001) {
    return;
  }
  const label = params.entityLabel ? ` (${params.entityLabel})` : "";
  console.warn(
    `[POS pricing] ${params.context} ${params.entityId}${label}: precoUnit cliente=${client} ignorado; usado servidor=${params.serverPreco}`,
  );
}
