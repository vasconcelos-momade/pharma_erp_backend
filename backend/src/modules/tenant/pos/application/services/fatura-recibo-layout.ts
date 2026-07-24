/**
 * Layout textual partilhado do recibo térmico 80mm (48 cols).
 * Usado pelo PDF preview e espelhado no ESC/POS.
 *
 * Ref.: prompt tipografia / cabeçalho / rodapé FR.
 */

import type { FaturaReciboEscposInput } from "./fatura-recibo-escpos.template";
import {
  formatItemTableHeader,
  formatItemTableRows,
  THERMAL_COLS,
} from "./fatura-recibo-colunas";

export const THERMAL_FOOTER_LINES = [
  "Obrigado pela preferencia!",
  "",
  "A sua saude e a nossa prioridade.",
  "",
  "Documento processado por computador",
] as const;

/**
 * Separa nome comercial do NUIT quando o cadastro junta ambos
 * (ex.: "Farmacia Demo 1784820311" + nuit null).
 */
export function normalizeEmpresaHeader(input: {
  nome?: string | null;
  nuit?: string | null;
}): { nome: string; nuit: string | null } {
  let nome = String(input.nome ?? "").trim() || "Empresa nao configurada";
  let nuit = input.nuit != null ? String(input.nuit).trim() : "";
  if (!nuit) {
    const match = nome.match(/^(.*?)[\s\-]+(\d{6,})$/);
    if (match) {
      nome = match[1]!.trim() || nome;
      nuit = match[2]!;
    }
  } else {
    const escaped = nuit.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    nome = nome.replace(new RegExp(`[\\s\\-]+${escaped}$`), "").trim() || nome;
  }
  return { nome, nuit: nuit || null };
}

function toAscii(value: unknown): string {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\x20-\x7E]/g, "?");
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

function padLine(
  left: string,
  right: string,
  width = THERMAL_COLS.paperWidth,
): string {
  const l = left.slice(0, width);
  const r = right.slice(0, Math.max(0, width - l.length));
  const gap = Math.max(1, width - l.length - r.length);
  return `${l}${" ".repeat(gap)}${r}`;
}

export function centerLine(
  text: string,
  width = THERMAL_COLS.paperWidth,
): string {
  const raw = toAscii(text).slice(0, width);
  const pad = Math.max(0, width - raw.length);
  const left = Math.floor(pad / 2);
  return " ".repeat(left) + raw + " ".repeat(pad - left);
}

function hr(width = THERMAL_COLS.paperWidth): string {
  return "-".repeat(width);
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

/**
 * Linhas do recibo (48 cols), alinhadas ao layout comercial do prompt.
 */
export function buildThermalReceiptLines(
  recibo: FaturaReciboEscposInput,
): string[] {
  const width = THERMAL_COLS.paperWidth;
  const moeda = String(recibo.moeda ?? "MZN").trim() || "MZN";
  const subtotal = toNumber(recibo.subtotal);
  const desconto = toNumber(recibo.desconto);
  const iva = toNumber(recibo.ivaTotal);
  const total = toNumber(recibo.total);
  const taxaIva = toNumber(recibo.taxaIvaAplicada);
  const valorRecebido = toNumber(recibo.valorRecebido);
  const troco = toNumber(recibo.troco);
  const pctDesconto =
    subtotal > 0 && desconto > 0
      ? Math.round((desconto / subtotal) * 1000) / 10
      : 0;

  const date = recibo.data ? new Date(recibo.data) : new Date();
  const terminal = recibo.terminalCodigo
    ? toAscii(recibo.terminalCodigo)
    : "";
  const serie = recibo.serie != null ? toAscii(recibo.serie) : "";
  const operador = recibo.operador ? toAscii(recibo.operador) : "";
  const cliente = toAscii(recibo.cliente || "Consumidor Final");
  const pagamentos = Array.isArray(recibo.pagamentos) ? recibo.pagamentos : [];
  const metodo =
    pagamentos.length > 0
      ? mapMetodoPagamento(String(pagamentos[0]?.metodo ?? ""))
      : "";

  const empresa = normalizeEmpresaHeader({
    nome: recibo.empresa.nome,
    nuit: recibo.empresa.nuit,
  });
  const empresaNome = toAscii(empresa.nome.toUpperCase()).slice(0, width);

  const lines: string[] = [centerLine(empresaNome)];

  if (empresa.nuit) {
    lines.push(centerLine(`NUIT: ${toAscii(empresa.nuit)}`));
  }
  if (recibo.empresa.endereco) {
    lines.push(centerLine(toAscii(recibo.empresa.endereco)));
  }
  if (recibo.empresa.telefone) {
    lines.push(centerLine(`Tel: ${toAscii(recibo.empresa.telefone)}`));
  }
  if (recibo.empresa.email) {
    lines.push(centerLine(`Email: ${toAscii(recibo.empresa.email)}`));
  }

  lines.push(hr());
  lines.push(centerLine("FATURA SIMPLIFICADA"));
  lines.push("");
  lines.push(`No: ${toAscii(recibo.numero)}`.slice(0, width));
  lines.push(
    padLine(
      serie ? `Serie: ${serie}` : "Serie:",
      terminal ? `Terminal: ${terminal}` : "",
    ),
  );
  lines.push(
    padLine(`Data: ${fmtDate(date)}`, `Hora: ${fmtTime(date)}`),
  );
  lines.push("");
  lines.push("Cliente:");
  lines.push(cliente.slice(0, width));
  if (recibo.clienteDocumento) {
    lines.push(`Doc: ${toAscii(recibo.clienteDocumento)}`.slice(0, width));
  }
  lines.push("Operador:");
  lines.push((operador || "-").slice(0, width));
  lines.push(hr());

  lines.push(formatItemTableHeader());
  lines.push(hr());

  const itens = recibo.itens ?? [];
  for (let i = 0; i < itens.length; i += 1) {
    const item = itens[i]!;
    lines.push(
      ...formatItemTableRows({
        nome: item.nome,
        quantidade: toNumber(item.quantidade),
        precoUnitario: item.precoUnitario,
        total: toNumber(item.total),
      }),
    );
    if (i < itens.length - 1) {
      lines.push("");
    }
  }

  lines.push(hr());
  lines.push(padLine("SUBTOTAL", money(subtotal)));
  lines.push(padLine(`DESCONTO (${pctDesconto}%)`, money(desconto)));
  lines.push(padLine(`IVA incluso (${taxaIva || 0}%)`, money(iva)));
  lines.push(hr());
  lines.push(padLine("TOTAL", `${moeda} ${money(total)}`));
  lines.push(hr());

  if (metodo) lines.push(padLine("FORMA PAGTO:", metodo));
  if (
    metodo === "PENDENTE" ||
    metodo === "FIADO" ||
    metodo === "CONVENIO"
  ) {
    lines.push(padLine("TOTAL A PAGAR:", `${moeda} ${money(total)}`));
  } else if (metodo) {
    lines.push(padLine("VALOR RECEBIDO:", money(valorRecebido || total)));
    lines.push(padLine("TROCO:", money(troco)));
  }

  lines.push(hr());
  for (const footerLine of THERMAL_FOOTER_LINES) {
    lines.push(footerLine);
  }

  return lines;
}
