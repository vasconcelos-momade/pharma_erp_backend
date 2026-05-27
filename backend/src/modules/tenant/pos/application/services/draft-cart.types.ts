export type DraftCartProdutoItemInput = {
  produtoId: string;
  loteId?: string;
  quantidade: number;
};

export type DraftCartServicoItemInput = {
  servicoId: string;
  quantidade: number;
};

export type DraftCartItemInput = DraftCartProdutoItemInput | DraftCartServicoItemInput;

export function isDraftCartServicoItem(
  item: DraftCartItemInput,
): item is DraftCartServicoItemInput {
  return "servicoId" in item;
}

export type DraftCartMutationContext = {
  userId: string;
  idempotencyKey: string;
  clienteId?: string;
  terminalId?: string;
};

export type DraftCartItemView = {
  id: string;
  tipo: "produto" | "servico";
  produtoId: string | null;
  servicoId: string | null;
  loteId: string | null;
  nome: string;
  quantidade: number;
  precoUnit: number;
  baseCalculo: number;
  valorIva: number;
  total: number;
  ivaPercentual: number;
  taxRule: {
    tipo: string;
    taxa: number;
    codigo: string;
  } | null;
  requiresPrescription: boolean;
  estoqueAtual: number | null;
  estoqueDisponivel: number | null;
  tipoServicoClinico: string | null;
};

export type DraftCartView = {
  id: string;
  numero: string;
  estado: string;
  idempotencyKey: string | null;
  subtotal: number;
  desconto: number;
  ivaTotal: number;
  total: number;
  items: DraftCartItemView[];
};
