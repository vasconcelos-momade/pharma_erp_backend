export type DraftCartProdutoItemInput = {
  produtoId: string;
  loteId?: string;
  quantidade: number;
  precoUnit?: number;
};

export type DraftCartServicoItemInput = {
  servicoId: string;
  quantidade: number;
  precoUnit?: number;
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

export type DraftCartPaymentPreview = {
  total: number;
  valorRecebido: number | null;
  troco: number;
  cobreTotal: boolean | null;
};

export type DraftCartCheckoutHints = {
  requiresPrescription: boolean;
  taxLabel: string;
  paymentPreview: DraftCartPaymentPreview;
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
  ivaLabel: string;
  taxRule: {
    tipo: string;
    taxa: number;
    codigo: string;
  } | null;
  requiresPrescription: boolean;
  tipoDispensacao: string | null;
  requiresDoubleCheck: boolean;
  requiresPsychotropicBook: boolean;
  estoqueAtual: number | null;
  estoqueDisponivel: number | null;
  tipoServicoClinico: string | null;
  dosagem: string | null;
  forma: string | null;
  nomeGenerico: string | null;
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
  checkout: DraftCartCheckoutHints;
};
