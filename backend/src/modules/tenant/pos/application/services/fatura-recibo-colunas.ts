/**
 * Colunas do recibo térmico 80mm (Font A / Courier ≈ 48 cols):
 *
 * Item................PU......Qtd.....Total
 * |------ 20 ------| |--9--| |-5-| |--10--|
 * + 3 separadores = 47 chars
 */

export const THERMAL_COLS = {
  paperWidth: 48,
  item: 20,
  pu: 9,
  qtd: 5,
  total: 10,
} as const;

function toAscii(value: unknown): string {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\x20-\x7E]/g, "?");
}

function clip(text: string, width: number): string {
  const raw = toAscii(text);
  if (raw.length <= width) return raw;
  return raw.slice(0, width);
}

function padEnd(text: string, width: number): string {
  const raw = clip(String(text ?? ""), width);
  return raw + " ".repeat(Math.max(0, width - raw.length));
}

function padStart(text: string, width: number): string {
  const raw = clip(String(text ?? ""), width);
  return " ".repeat(Math.max(0, width - raw.length)) + raw;
}

function money(n: number): string {
  const v = Number.isFinite(n) ? n : 0;
  return v.toFixed(2);
}

function toNumber(value: unknown): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  const parsed = Number(String(value ?? "0").replace(",", "."));
  return Number.isFinite(parsed) ? parsed : 0;
}

/**
 * Quebra por palavras (evita cortar no meio de "AMINOPHYLLINE 100mg Comprimidos").
 */
export function wrapItemName(text: string, width: number): string[] {
  const nome = toAscii(String(text ?? "").trim() || "Item");
  if (nome.length <= width) return [nome];

  const words = nome.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";

  const flush = () => {
    if (current) {
      lines.push(current);
      current = "";
    }
  };

  for (const word of words) {
    if (word.length > width) {
      flush();
      let rest = word;
      while (rest.length > width) {
        lines.push(rest.slice(0, width));
        rest = rest.slice(width);
      }
      current = rest;
      continue;
    }
    const next = current ? `${current} ${word}` : word;
    if (next.length <= width) {
      current = next;
    } else {
      flush();
      current = word;
    }
  }
  flush();
  return lines.length > 0 ? lines : ["Item"];
}

/**
 * Rótulo da coluna Item: nome comercial + dosagem + forma.
 * Ex.: "AMINOPHYLLINE 100mg Comprimido"
 */
export function formatProdutoItemLabel(input: {
  nomeComercial?: string | null;
  dosagem?: string | null;
  forma?: string | null;
  fallback?: string | null;
}): string {
  const parts = [input.nomeComercial, input.dosagem, input.forma]
    .map((part) => String(part ?? "").trim())
    .filter((part) => part.length > 0);
  if (parts.length > 0) return parts.join(" ");
  const fallback = String(input.fallback ?? "").trim();
  return fallback || "Item";
}

/** Cabeçalho alinhado: Item                  PU   Qtd     Total */
export function formatItemTableHeader(): string {
  const { item, pu, qtd, total } = THERMAL_COLS;
  return (
    padEnd("Item", item) +
    " " +
    padStart("PU", pu) +
    " " +
    padStart("Qtd", qtd) +
    " " +
    padStart("Total", total)
  );
}

/**
 * Linha(s) de item alinhadas em colunas.
 * Nome longo continua na linha seguinte (quebra por palavras), só sob Item.
 * PU / Qtd / Total ficam na primeira linha.
 */
export function formatItemTableRows(input: {
  nome: string | null | undefined;
  quantidade: number;
  precoUnitario?: number | null;
  total: number;
}): string[] {
  const { item: itemW, pu, qtd, total: totalW } = THERMAL_COLS;
  const qty = toNumber(input.quantidade);
  const tot = toNumber(input.total);
  let unit = input.precoUnitario != null ? toNumber(input.precoUnitario) : null;
  if (unit == null || !Number.isFinite(unit)) {
    unit = qty > 0 ? tot / qty : tot;
  }

  const nameLines = wrapItemName(String(input.nome ?? "").trim() || "Item", itemW);
  const puText = money(unit);
  const qtdText = Number.isInteger(qty) ? String(qty) : String(qty);
  const totText = money(tot);

  const numericTail =
    " " +
    padStart(puText, pu) +
    " " +
    padStart(qtdText, qtd) +
    " " +
    padStart(totText, totalW);

  return nameLines.map((chunk, index) => {
    if (index === 0) {
      return padEnd(chunk, itemW) + numericTail;
    }
    return padEnd(chunk, itemW);
  });
}
