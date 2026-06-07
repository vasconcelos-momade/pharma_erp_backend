function toAscii(value: unknown): string {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\x20-\x7E]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function formatMoney(value: unknown): string {
  const numeric = Number(String(value ?? "0").replace(",", "."));
  if (!Number.isFinite(numeric)) {
    return "0.00";
  }
  return numeric.toFixed(2);
}

function escapePdfText(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

function buildSimplePdf(lines: string[]): Uint8Array {
  const encoder = new TextEncoder();
  const safeLines = lines.map((line) => escapePdfText(toAscii(line)));
  const streamLines = ["BT", "/F1 11 Tf", "50 790 Td"];

  for (const line of safeLines) {
    streamLines.push(`(${line}) Tj`);
    streamLines.push("0 -14 Td");
  }

  streamLines.push("ET");
  const stream = `${streamLines.join("\n")}\n`;
  const streamBytes = encoder.encode(stream);
  const streamLength = streamBytes.length;

  const objects = [
    "1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n",
    "2 0 obj\n<< /Type /Pages /Count 1 /Kids [3 0 R] >>\nendobj\n",
    "3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>\nendobj\n",
    "4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n",
    `5 0 obj\n<< /Length ${streamLength} >>\nstream\n${stream}endstream\nendobj\n`,
  ];

  let pdf = "%PDF-1.4\n";
  const offsets = [0];

  for (const object of objects) {
    offsets.push(encoder.encode(pdf).length);
    pdf += object;
  }

  const xrefOffset = encoder.encode(pdf).length;
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += "0000000000 65535 f \n";

  for (let index = 1; index < offsets.length; index += 1) {
    pdf += `${String(offsets[index]).padStart(10, "0")} 00000 n \n`;
  }

  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  return encoder.encode(pdf);
}

function concatUint8Arrays(arrays: Uint8Array[]): Uint8Array {
  const totalLength = arrays.reduce((acc, arr) => acc + arr.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const arr of arrays) {
    result.set(arr, offset);
    offset += arr.length;
  }
  return result;
}

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

export type InvoiceDocumentPayload = {
  id: string;
  numero: string;
  serie?: string | null;
  createdAt?: string | Date;
  cliente?: {
    nome?: string | null;
    documento?: string | null;
  } | null;
  terminal?: {
    nome?: string | null;
    codigo?: string | null;
  } | null;
  user?: {
    name?: string | null;
  } | null;
  items?: Array<{
    descricao?: string | null;
    quantidade?: string | number | null;
    precoUnit?: string | number | null;
    total?: string | number | null;
  }>;
  payments?: Array<{
    metodo?: string | null;
    valor?: string | number | null;
    referencia?: string | null;
  }>;
  subtotal?: string | number | null;
  desconto?: string | number | null;
  ivaTotal?: string | number | null;
  total?: string | number | null;
  valorRecebido?: string | number | null;
  troco?: string | number | null;
  estado?: string | null;
};

export class FaturaDocumentService {
  static buildPdf(invoice: InvoiceDocumentPayload): {
    bytes: Uint8Array;
    fileName: string;
    contentType: string;
  } {
    const createdAt = invoice.createdAt
      ? new Date(invoice.createdAt).toISOString().slice(0, 19).replace("T", " ")
      : "-";
    const paymentLines = [
      ...(invoice.valorRecebido != null
        ? [`Valor recebido: ${formatMoney(invoice.valorRecebido)}`]
        : []),
      ...(invoice.troco != null && Number(invoice.troco) > 0
        ? [`Troco: ${formatMoney(invoice.troco)}`]
        : []),
    ];
    const lines = [
      "Skalway Pharm - Fatura",
      `Numero: ${invoice.numero}`,
      `Serie: ${invoice.serie ?? "-"}`,
      `Data: ${createdAt}`,
      `Estado: ${invoice.estado ?? "-"}`,
      `Cliente: ${invoice.cliente?.nome ?? "Consumidor final"}`,
      `Documento: ${invoice.cliente?.documento ?? "-"}`,
      `Terminal: ${invoice.terminal?.codigo ?? invoice.terminal?.nome ?? "-"}`,
      `Operador: ${invoice.user?.name ?? "-"}`,
      "",
      "Itens:",
      ...(invoice.items ?? []).map((item, index) =>
        `${index + 1}. ${item.descricao ?? "Linha"} x${item.quantidade ?? 0} @ ${formatMoney(item.precoUnit)} = ${formatMoney(item.total)}`,
      ),
      "",
      "Pagamentos:",
      ...(invoice.payments ?? []).map((payment, index) =>
        `${index + 1}. ${payment.metodo ?? "-"} ${formatMoney(payment.valor)}${payment.referencia ? ` ref ${payment.referencia}` : ""}`,
      ),
      "",
      `Subtotal: ${formatMoney(invoice.subtotal)}`,
      `Desconto: ${formatMoney(invoice.desconto)}`,
      `IVA: ${formatMoney(invoice.ivaTotal)}`,
      `Total: ${formatMoney(invoice.total)}`,
      ...paymentLines,
    ];

    return {
      bytes: buildSimplePdf(lines),
      fileName: `fatura-${toAscii(invoice.numero || invoice.id || "documento")}.pdf`,
      contentType: "application/pdf",
    };
  }

  static buildPrintArtifact(invoice: InvoiceDocumentPayload): {
    payloadBase64: string;
    fileName: string;
    contentType: string;
  } {
    const encoder = new TextEncoder();
    const paymentLines = [
      ...(invoice.valorRecebido != null
        ? [`Valor recebido: ${formatMoney(invoice.valorRecebido)}`]
        : []),
      ...(invoice.troco != null && Number(invoice.troco) > 0
        ? [`Troco: ${formatMoney(invoice.troco)}`]
        : []),
    ];
    const lines = [
      "SKALWAY PHARM",
      "FATURA",
      `Numero: ${toAscii(invoice.numero)}`,
      `Serie: ${toAscii(invoice.serie ?? "-")}`,
      `Cliente: ${toAscii(invoice.cliente?.nome ?? "Consumidor final")}`,
      `Estado: ${toAscii(invoice.estado ?? "-")}`,
      "--------------------------------",
      ...(invoice.items ?? []).map((item) =>
        `${toAscii(item.descricao ?? "Linha")} | ${item.quantidade ?? 0} x ${formatMoney(item.precoUnit)} = ${formatMoney(item.total)}`,
      ),
      "--------------------------------",
      `Subtotal: ${formatMoney(invoice.subtotal)}`,
      `Desconto: ${formatMoney(invoice.desconto)}`,
      `IVA: ${formatMoney(invoice.ivaTotal)}`,
      `Total: ${formatMoney(invoice.total)}`,
      ...paymentLines,
      "",
      "Pagamentos:",
      ...(invoice.payments ?? []).map((payment) =>
        `${toAscii(payment.metodo ?? "-")} ${formatMoney(payment.valor)}${payment.referencia ? ` ref ${toAscii(payment.referencia)}` : ""}`,
      ),
      "",
      "Emitido por Skalway Pharm",
      "\n\n\n",
    ];

    const textPayload = `${lines.join("\n")}\n`;
    const escposBytes = concatUint8Arrays([
      new Uint8Array([0x1b, 0x40]), // Init
      encoder.encode(textPayload),
      new Uint8Array([0x1d, 0x56, 0x41, 0x10]), // Cut
    ]);

    return {
      payloadBase64: toBase64(escposBytes),
      fileName: `fatura-${toAscii(invoice.numero || invoice.id || "documento")}.escpos`,
      contentType: "application/octet-stream",
    };
  }
}
