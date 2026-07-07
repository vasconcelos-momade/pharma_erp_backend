export type FefoLoteRow = {
  id: bigint;
  numeroLote: string;
  dataValidade: Date;
  quantidadeQuarentena?: unknown;
  precoCompra: unknown;
  precoVenda?: unknown | null;
};
