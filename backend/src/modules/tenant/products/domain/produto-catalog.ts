/** Campos persistidos apenas em `produtos` (catálogo e preço). */

const CATALOG_KEYS = new Set([
  "nome",
  "substanciaActiva",
  "dosagem",
  "forma",
  "apresentacao",
  "ativo",
  "barcode",
  "precoVenda",
  "estoqueMinimo",
  "taxRuleId",
]);

export function extractCatalogData(
  data: Record<string, unknown>,
): Record<string, unknown> {
  const catalog: Record<string, unknown> = {};
  for (const key of CATALOG_KEYS) {
    if (key in data && data[key] !== undefined) {
      catalog[key] = data[key];
    }
  }
  return catalog;
}
