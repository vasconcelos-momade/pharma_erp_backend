/** Campos persistidos apenas em `produtos` (catálogo regulatório e fiscal). */

const CATALOG_KEYS = new Set([
  "nomeComercial",
  "nomeGenerico",
  "dosagem",
  "forma",
  "apresentacao",
  "ativo",
  "barcode",
  "categoriaId",
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
