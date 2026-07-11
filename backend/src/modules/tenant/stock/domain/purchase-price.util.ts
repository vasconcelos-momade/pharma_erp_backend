import { toNumber } from "../../dashboard/application/dashboard-date.util";

type ProdutoFornecedorRow = {
  precoCompra: unknown;
  fornecedorPrincipal: boolean;
};

type HistoricoPrecoRow = {
  precoNovo: unknown;
  data: Date;
};

type LoteRow = {
  precoCompra: unknown;
  createdAt: Date;
};

export function resolveUltimoPrecoCompra(input: {
  fornecedores: ProdutoFornecedorRow[];
  historicoPrecos: HistoricoPrecoRow[];
  lotes: LoteRow[];
}): number {
  const principal = input.fornecedores.find((row) => row.fornecedorPrincipal);
  if (principal) {
    const preco = toNumber(principal.precoCompra);
    if (preco > 0) {
      return preco;
    }
  }

  const historico = [...input.historicoPrecos].sort(
    (a, b) => b.data.getTime() - a.data.getTime(),
  )[0];
  if (historico) {
    const preco = toNumber(historico.precoNovo);
    if (preco > 0) {
      return preco;
    }
  }

  const lote = [...input.lotes].sort(
    (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
  )[0];
  if (lote) {
    const preco = toNumber(lote.precoCompra);
    if (preco > 0) {
      return preco;
    }
  }

  return 0;
}
