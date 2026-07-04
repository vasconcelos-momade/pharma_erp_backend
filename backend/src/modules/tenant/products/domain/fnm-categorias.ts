/** Categorias terapêuticas FNM (Nível 1) — Moçambique. */
export const FNM_CATEGORIAS = [
  { codigoFNM: "CARDIOVASCULAR", nome: "CARDIOVASCULAR" },
  { codigoFNM: "DIGESTIVO", nome: "DIGESTIVO" },
  {
    codigoFNM: "ENDOCRINOLOGIA_METABOLISMO",
    nome: "ENDOCRINOLOGIA_METABOLISMO",
  },
  { codigoFNM: "GENITO_URINARIO", nome: "GENITO_URINARIO" },
  { codigoFNM: "RESPIRATORIO", nome: "RESPIRATORIO" },
  { codigoFNM: "SANGUE_HEMATOPOIETICO", nome: "SANGUE_HEMATOPOIETICO" },
  {
    codigoFNM: "SISTEMA_NERVOSO_CENTRAL",
    nome: "SISTEMA_NERVOSO_CENTRAL",
  },
  { codigoFNM: "ANTIMICROBIANOS", nome: "ANTIMICROBIANOS" },
  {
    codigoFNM: "CITOSTATICOS_IMUNOSSUPRESSORES",
    nome: "CITOSTATICOS_IMUNOSSUPRESSORES",
  },
  { codigoFNM: "DIURETICOS", nome: "DIURETICOS" },
  {
    codigoFNM: "HIDROELETROLITICO_ACIDO_BASE",
    nome: "HIDROELETROLITICO_ACIDO_BASE",
  },
  {
    codigoFNM: "NUTRICAO_VITAMINAS_MINERAIS",
    nome: "NUTRICAO_VITAMINAS_MINERAIS",
  },
  { codigoFNM: "ANTI_ALERGICOS", nome: "ANTI_ALERGICOS" },
  { codigoFNM: "MUSCULO_ESQUELETICO", nome: "MUSCULO_ESQUELETICO" },
  { codigoFNM: "DERMATOLOGIA", nome: "DERMATOLOGIA" },
  {
    codigoFNM: "OTORRINOLARINGOLOGIA",
    nome: "OTORRINOLARINGOLOGIA",
  },
  { codigoFNM: "OFTALMOLOGIA", nome: "OFTALMOLOGIA" },
  { codigoFNM: "ANESTESIA_REANIMACAO", nome: "ANESTESIA_REANIMACAO" },
  { codigoFNM: "IMUNOLOGICOS", nome: "IMUNOLOGICOS" },
  {
    codigoFNM: "ANTISSEPTICOS_DESINFETANTES",
    nome: "ANTISSEPTICOS_DESINFETANTES",
  },
  { codigoFNM: "ANTIDOTOS", nome: "ANTIDOTOS" },
  { codigoFNM: "DIAGNOSTICO", nome: "DIAGNOSTICO" },
] as const;

export type FnmCodigo = (typeof FNM_CATEGORIAS)[number]["codigoFNM"];

export const FNM_CODIGO_ANTIMICROBIANOS = "ANTIMICROBIANOS" as const;

const FNM_NOMES = new Set(FNM_CATEGORIAS.map((c) => c.nome));

export function isFnmCategoriaNome(nome: string): boolean {
  return FNM_NOMES.has(nome.trim().toUpperCase() as (typeof FNM_CATEGORIAS)[number]["nome"]);
}

export function isAntimicrobianoFnm(categoria?: {
  nome?: string | null;
  codigoFNM?: string | null;
} | null): boolean {
  if (!categoria) return false;
  const codigo = categoria.codigoFNM?.trim().toUpperCase();
  const nome = categoria.nome?.trim().toUpperCase();
  return (
    codigo === FNM_CODIGO_ANTIMICROBIANOS ||
    nome === FNM_CODIGO_ANTIMICROBIANOS
  );
}

export function fnmCategoriaLabel(nome: string): string {
  return nome.replaceAll("_", " ");
}
