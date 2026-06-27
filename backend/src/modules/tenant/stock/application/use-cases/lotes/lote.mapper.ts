import { loteQuantidadeDisponivel } from "../../../domain/fefo-lote.service";

export function mapLoteListItem(lote: any, now = new Date()) {
  const disponivel = loteQuantidadeDisponivel(lote);
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
    produtoNome: lote.produto?.nome ?? null,
    produtoBarcode: lote.produto?.barcode ?? null,
    fornecedorId: lote.fornecedorId?.toString() ?? null,
    fornecedorNome: lote.fornecedor?.nome ?? null,
    numeroLote: lote.numeroLote,
    dataValidade: lote.dataValidade.toISOString(),
    diasRestantes,
    indicadorValidade,
    quantidadeAtual: Number(lote.quantidadeAtual),
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
