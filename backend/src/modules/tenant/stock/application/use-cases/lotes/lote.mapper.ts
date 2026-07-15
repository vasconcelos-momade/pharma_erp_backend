import { readLoteDisponivel, readLoteTotal } from "../../../domain/lote-stock-read.util";
import { buildSanitarioUiMeta } from "../../../domain/lote-sanitario-policy";

export function mapLoteListItem(lote: any, now = new Date()) {
  const total = readLoteTotal(lote);
  const disponivel = readLoteDisponivel(lote);
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

  const sanitario = buildSanitarioUiMeta(lote);

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
    quantidadeIncinerada: sanitario.quantidadeIncinerada,
    quantidadeDisponivel: disponivel,
    precoCompra: Number(lote.precoCompra),
    precoVenda: lote.precoVenda != null ? Number(lote.precoVenda) : null,
    estadoSanitario: lote.estadoSanitario,
    estadoSanitarioEfetivo: sanitario.estadoSanitarioEfetivo,
    acoesPermitidas: sanitario.acoesPermitidas,
    acoesPermitidasOpcoes: sanitario.acoesPermitidasOpcoes,
    disponibilidade: lote.disponibilidade,
    ativo: lote.ativo,
    valorEmStock: disponivel * Number(lote.precoCompra ?? 0),
    createdAt: lote.createdAt?.toISOString?.() ?? null,
  };
}
