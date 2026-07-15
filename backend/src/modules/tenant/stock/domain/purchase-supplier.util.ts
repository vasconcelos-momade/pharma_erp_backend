type ProdutoFornecedorRow = {
  fornecedorPrincipal?: boolean;
  fornecedorId?: bigint;
  fornecedor?: { id: bigint; nome?: string } | null;
};

/** Resolve o fornecedor principal do produto (ou o primeiro disponível). */
export function resolvePrincipalSupplierId(
  fornecedores: ProdutoFornecedorRow[] | null | undefined,
): bigint | null {
  if (!fornecedores?.length) return null;

  const principal = fornecedores.find((row) => row.fornecedorPrincipal);
  if (principal?.fornecedorId) return principal.fornecedorId;
  if (principal?.fornecedor?.id) return principal.fornecedor.id;

  const first = fornecedores[0];
  return first?.fornecedorId ?? first?.fornecedor?.id ?? null;
}

export function resolvePrincipalSupplierName(
  fornecedores: ProdutoFornecedorRow[] | null | undefined,
  storedFornecedor?: { nome?: string | null } | null,
): string {
  if (storedFornecedor?.nome?.trim()) {
    return storedFornecedor.nome.trim();
  }
  if (!fornecedores?.length) return "Sem fornecedor";

  const principal =
    fornecedores.find((row) => row.fornecedorPrincipal) ?? fornecedores[0];
  return principal?.fornecedor?.nome?.trim() || "Sem fornecedor";
}
