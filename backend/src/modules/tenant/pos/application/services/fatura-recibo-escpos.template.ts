/**
 * Template ESC/POS 80mm (Font A, 48 col) — Fatura Simplificada (FR).
 *
 * Tipografia (prompt):
 * - Nome farmácia: Double Height + Bold, centro
 * - Cabeçalho tabela: Bold
 * - TOTAL: Double Height + Bold, centro
 * - Produtos / preços / rodapé: Normal
 */

import {
  formatItemTableHeader,
  formatItemTableRows,
  THERMAL_COLS,
} from "./fatura-recibo-colunas";
import {
  normalizeEmpresaHeader,
  THERMAL_FOOTER_LINES,
} from "./fatura-recibo-layout";

export type FaturaReciboEscposInput = {
  empresa: {
    nome: string;
    nuit?: string | null;
    endereco?: string | null;
    email?: string | null;
    telefone?: string | null;
  };
  numero: string | number;
  serie?: string | null;
  data: Date | string;
  cliente: string;
  clienteDocumento?: string | null;
  terminalCodigo?: string | null;
  operador?: string | null;
  subtotal: number;
  desconto: number;
  taxaIvaAplicada?: number;
  ivaTotal: number;
  total: number;
  moeda?: string | null;
  valorRecebido?: number;
  troco?: number;
  itens: Array<{
    nome: string | null;
    quantidade: number;
    precoUnitario?: number | null;
    total: number;
  }>;
  pagamentos?: Array<{
    metodo: string;
    valor: number;
  }>;
  /** Conteúdo do QR (URL ou payload fiscal). Se vazio, gera URL padrão. */
  qrPayload?: string | null;
};

function u16le(n: number): [number, number] {
  const v = Math.max(0, Math.floor(n));
  return [v & 0xff, (v >> 8) & 0xff];
}

function esc(...bytes: number[]): Uint8Array {
  return new Uint8Array(bytes);
}

function normalizeText(text: string): string {
  return String(text ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function txt(value: string): Uint8Array {
  const normalized = normalizeText(value);
  const out = new Uint8Array(normalized.length);
  for (let i = 0; i < normalized.length; i++) {
    out[i] = normalized.charCodeAt(i) & 0xff;
  }
  return out;
}

function newLine(): Uint8Array {
  return txt("\n");
}

function hr(width = THERMAL_COLS.paperWidth): Uint8Array {
  return txt("-".repeat(width) + "\n");
}

function padLine(left: string, right: string, width = THERMAL_COLS.paperWidth): string {
  const l = left.slice(0, width);
  const r = right.slice(0, Math.max(0, width - l.length));
  const gap = Math.max(1, width - l.length - r.length);
  return `${l}${" ".repeat(gap)}${r}`;
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

function fmtDate(d: Date): string {
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = String(d.getFullYear());
  return `${dd}/${mm}/${yyyy}`;
}

function fmtTime(d: Date): string {
  const hh = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  return `${hh}:${min}`;
}

function mapMetodoPagamento(metodo: string): string {
  const raw = String(metodo ?? "").trim().toUpperCase();
  if (raw === "CASH" || raw === "DINHEIRO") return "DINHEIRO";
  if (raw === "CARD" || raw === "CARTAO" || raw === "CARTÃO") return "CARTAO";
  return raw;
}

function concat(parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((acc, p) => acc + p.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

function qrCode(data: string): Uint8Array {
  const store = new TextEncoder().encode(data);
  const size = 6;
  const ecc = 48; // L
  const parts: Uint8Array[] = [];

  parts.push(esc(0x1d, 0x28, 0x6b, 0x04, 0x00, 0x31, 0x41, 0x32, 0x00));
  parts.push(esc(0x1d, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x43, size));
  parts.push(esc(0x1d, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x45, ecc));

  const [pL, pH] = u16le(store.length + 3);
  parts.push(esc(0x1d, 0x28, 0x6b, pL, pH, 0x31, 0x50, 0x30));
  parts.push(store);
  parts.push(esc(0x1d, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x51, 0x30));

  return concat(parts);
}

function descontoPercent(subtotal: number, desconto: number): number {
  if (subtotal <= 0 || desconto <= 0) return 0;
  return Math.round((desconto / subtotal) * 1000) / 10;
}

const COL_TOTAL = [34, 14] as const;

function line(columns: Array<string | number>, widths: readonly number[]): string {
  return columns
    .map((col, i) => {
      const w = widths[i] ?? 0;
      const text = String(col ?? "");
      if (text.length > w) return text.slice(0, w);
      if (i === 0) return text.padEnd(w, " ");
      return text.padStart(w, " ");
    })
    .join("");
}

/**
 * Gera bytes ESC/POS para impressora térmica 80mm (48 colunas).
 */
export function gerarFaturaReciboEscpos(recibo: FaturaReciboEscposInput): Uint8Array {
  const parts: Uint8Array[] = [];
  const push = (b: Uint8Array) => parts.push(b);

  const PAPER_WIDTH = THERMAL_COLS.paperWidth;
  const moeda = String(recibo.moeda ?? "MZN").trim() || "MZN";
  const subtotal = toNumber(recibo.subtotal);
  const desconto = toNumber(recibo.desconto);
  const iva = toNumber(recibo.ivaTotal);
  const total = toNumber(recibo.total);
  const taxaIva = toNumber(recibo.taxaIvaAplicada);
  const valorRecebido = toNumber(recibo.valorRecebido);
  const troco = toNumber(recibo.troco);
  const pctDesconto = descontoPercent(subtotal, desconto);

  const numero = recibo.numero ?? "";
  const date = recibo.data ? new Date(recibo.data) : new Date();
  const datePart = fmtDate(date);
  const timePart = fmtTime(date);
  const terminalText = recibo.terminalCodigo
    ? String(recibo.terminalCodigo)
    : "";
  const serieText = recibo.serie != null ? String(recibo.serie) : "";
  const operador = recibo.operador ? String(recibo.operador) : "";
  const cliente = recibo.cliente || "Consumidor Final";

  const empresa = normalizeEmpresaHeader({
    nome: recibo.empresa.nome,
    nuit: recibo.empresa.nuit,
  });

  // INIT + Font A
  push(esc(0x1b, 0x40));
  push(esc(0x1b, 0x4d, 0x00));

  // --- Cabeçalho institucional ---
  push(esc(0x1b, 0x61, 0x01)); // center
  push(esc(0x1b, 0x45, 0x01)); // bold
  push(esc(0x1d, 0x21, 0x01)); // double height
  push(txt(empresa.nome.toUpperCase()));
  push(newLine());
  push(esc(0x1d, 0x21, 0x00));
  push(esc(0x1b, 0x45, 0x00));

  if (empresa.nuit) {
    push(txt(`NUIT: ${empresa.nuit}`));
    push(newLine());
  }
  if (recibo.empresa.endereco) {
    push(txt(String(recibo.empresa.endereco)));
    push(newLine());
  }
  if (recibo.empresa.telefone) {
    push(txt(`Tel: ${recibo.empresa.telefone}`));
    push(newLine());
  }
  if (recibo.empresa.email) {
    push(txt(`Email: ${recibo.empresa.email}`));
    push(newLine());
  }

  push(hr(PAPER_WIDTH));
  push(esc(0x1b, 0x45, 0x01));
  push(txt("FATURA SIMPLIFICADA"));
  push(newLine());
  push(esc(0x1b, 0x45, 0x00));
  push(esc(0x1b, 0x61, 0x00)); // left
  push(newLine());

  push(txt(`No: ${String(numero)}`.slice(0, PAPER_WIDTH)));
  push(newLine());
  push(
    txt(
      padLine(
        serieText ? `Serie: ${serieText}` : "Serie:",
        terminalText ? `Terminal: ${terminalText}` : "",
      ),
    ),
  );
  push(newLine());
  push(txt(padLine(`Data: ${datePart}`, `Hora: ${timePart}`)));
  push(newLine());
  push(newLine());

  push(txt("Cliente:"));
  push(newLine());
  push(txt(String(cliente).slice(0, PAPER_WIDTH)));
  push(newLine());
  if (recibo.clienteDocumento) {
    push(txt(`Doc: ${String(recibo.clienteDocumento)}`.slice(0, PAPER_WIDTH)));
    push(newLine());
  }
  push(txt("Operador:"));
  push(newLine());
  push(txt((operador || "-").slice(0, PAPER_WIDTH)));
  push(newLine());
  push(hr(PAPER_WIDTH));

  // --- Tabela ---
  push(esc(0x1b, 0x45, 0x01));
  push(txt(formatItemTableHeader()));
  push(newLine());
  push(esc(0x1b, 0x45, 0x00));
  push(hr(PAPER_WIDTH));

  const itens = recibo.itens ?? [];
  for (let i = 0; i < itens.length; i += 1) {
    const item = itens[i]!;
    for (const row of formatItemTableRows({
      nome: item.nome,
      quantidade: toNumber(item.quantidade),
      precoUnitario: item.precoUnitario,
      total: toNumber(item.total),
    })) {
      push(txt(row));
      push(newLine());
    }
    if (i < itens.length - 1) {
      push(newLine());
    }
  }

  push(hr(PAPER_WIDTH));
  push(txt(line(["SUBTOTAL", money(subtotal)], COL_TOTAL)));
  push(newLine());
  push(txt(line([`DESCONTO (${pctDesconto}%)`, money(desconto)], COL_TOTAL)));
  push(newLine());
  push(txt(line([`IVA incluso (${taxaIva || 0}%)`, money(iva)], COL_TOTAL)));
  push(newLine());
  push(hr(PAPER_WIDTH));

  // TOTAL com destaque
  push(esc(0x1b, 0x61, 0x01));
  push(esc(0x1b, 0x45, 0x01));
  push(esc(0x1d, 0x21, 0x01)); // double height
  push(txt(`TOTAL ${moeda} ${money(total)}`));
  push(newLine());
  push(esc(0x1d, 0x21, 0x00));
  push(esc(0x1b, 0x45, 0x00));
  push(esc(0x1b, 0x61, 0x00));
  push(hr(PAPER_WIDTH));

  const pagamentos = Array.isArray(recibo.pagamentos) ? recibo.pagamentos : [];
  const metodoPagamento =
    pagamentos.length > 0
      ? mapMetodoPagamento(String(pagamentos[0]?.metodo ?? ""))
      : "";

  if (pagamentos.length > 0) {
    push(txt(line(["FORMA PAGTO:", metodoPagamento], COL_TOTAL)));
    push(newLine());
  }

  if (
    metodoPagamento === "PENDENTE" ||
    metodoPagamento === "FIADO" ||
    metodoPagamento === "CONVENIO"
  ) {
    push(txt(line(["TOTAL A PAGAR:", `${moeda} ${money(total)}`], COL_TOTAL)));
    push(newLine());
  } else if (pagamentos.length > 0) {
    push(
      txt(line(["VALOR RECEBIDO:", money(valorRecebido || total)], COL_TOTAL)),
    );
    push(newLine());
    push(txt(line(["TROCO:", money(troco)], COL_TOTAL)));
    push(newLine());
  }

  push(hr(PAPER_WIDTH));

  const qrPayload =
    (recibo.qrPayload && String(recibo.qrPayload).trim()) ||
    `https://app.skalway.com/fatura/${encodeURIComponent(String(numero))}`;

  push(esc(0x1b, 0x61, 0x01));
  push(qrCode(qrPayload));
  push(newLine());
  push(newLine());

  // Rodapé (normal / pequeno — Font B)
  push(esc(0x1b, 0x4d, 0x01)); // Font B
  for (const footerLine of THERMAL_FOOTER_LINES) {
    if (footerLine === "") {
      push(newLine());
    } else {
      push(txt(footerLine));
      push(newLine());
    }
  }
  push(esc(0x1b, 0x4d, 0x00)); // Font A
  push(newLine());

  push(esc(0x1b, 0x64, 0x06));
  push(esc(0x1d, 0x56, 0x01));

  return concat(parts);
}
