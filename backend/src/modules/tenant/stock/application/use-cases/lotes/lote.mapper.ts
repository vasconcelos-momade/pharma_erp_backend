export function mapLoteListItem(lote: any, now = new Date()) {
  const total = Number(lote.stockBalance?.quantidadeTotal ?? 0);
  const disponivel = Number(lote.stockBalance?.quantidadeDisponivel ?? 0);
  const validade = new Date(lote.dataValidade);
  const diasRestantes = Math.ceil(
    (validade.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
  );

  let indicadorValidade: "EXPIRADO" | "30_DIAS" | "60_DIAS" | "OK" = "OK";
  if (diasRestantes < 0) {
    indicadorValidade = "EXPIRADO";
  } else if (diasRestantes <= 30) {
    indicadorValidade = "30_DIAS";
  } else if (diasRestantes <= 60) {
    indicadorValidade = "60_DIAS";
  }

  return {
    id: lote.id.toString(),
    produtoId: lote.produtoId.toString(),
    produtoNome: lote.produto?.nomeComercial ?? null,
    produtoNomeComercial: lote.produto?.nomeComercial ?? null,
    produtoBarcode: lote.produto?.barcode ?? null,
    fornecedorId: lote.fornecedorId?.toString() ?? null,
    fornecedorNome: lote.fornecedor?.nome ?? null,
    numeroLote: lote.numeroLote,
    dataValidade: lote.dataValidade.toISOString(),
    diasRestantes,
    indicadorValidade,
    quantidadeTotal: total,
    quantidadeQuarentena: Number(lote.quantidadeQuarentena ?? 0),
    quantidadeDisponivel: disponivel,
    precoCompra: Number(lote.precoCompra),
    precoVenda: lote.precoVenda != null ? Number(lote.precoVenda) : null,
    estadoSanitario: lote.estadoSanitario,
    disponibilidade: lote.disponibilidade,
    ativo: lote.ativo,
    valorEmStock: disponivel * Number(lote.precoCompra ?? 0),
    createdAt: lote.createdAt?.toISOString?.() ?? null,
  };
}
