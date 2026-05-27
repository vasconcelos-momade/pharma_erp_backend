import type { GeneratedDocumentArtifact, InvoiceDocumentSnapshotPayload } from "../../domain/document.types";

function encoder(value: string) {
  return new TextEncoder().encode(value);
}

function concat(parts: Uint8Array[]) {
  const size = parts.reduce((sum, item) => sum + item.byteLength, 0);
  const output = new Uint8Array(size);
  let offset = 0;
  for (const part of parts) {
    output.set(part, offset);
    offset += part.byteLength;
  }
  return output;
}

export class EscPosEngineService {
  generateReceipt(snapshot: InvoiceDocumentSnapshotPayload, widthMm: 58 | 80 = 80): GeneratedDocumentArtifact {
    const chars = widthMm === 58 ? 32 : 42;
    const divider = "-".repeat(chars);
    const lines = [
      "\x1b@\x1b!\x20",
      `${snapshot.branding.companyName}\n`,
      "\x1b!\x00",
      `${snapshot.type} ${snapshot.number}\n`,
      `${divider}\n`,
      `Cliente: ${snapshot.customer.name}\n`,
      `Data: ${new Date(snapshot.createdAt).toLocaleString("pt-PT")}\n`,
      `Terminal: ${snapshot.terminal.code ?? snapshot.terminal.name ?? "-"}\n`,
      `${divider}\n`,
      ...snapshot.items.flatMap((item) => [
        `${item.description}\n`,
        `${item.quantity.toFixed(item.quantity % 1 === 0 ? 0 : 2)} x ${item.unitPrice.toFixed(2)} = ${item.total.toFixed(2)}\n`,
      ]),
      `${divider}\n`,
      `Subtotal: ${snapshot.totals.subtotal.toFixed(2)}\n`,
      `IVA: ${snapshot.totals.tax.toFixed(2)}\n`,
      `Total: ${snapshot.totals.total.toFixed(2)} ${snapshot.currency}\n`,
      `${divider}\n`,
      ...(snapshot.fiscal.qrPayload ? [`QR: ${snapshot.fiscal.qrPayload}\n`] : []),
      ...snapshot.fiscal.legalText.map((line) => `${line}\n`),
      "\n\n\n",
    ];

    const qrNote = snapshot.fiscal.qrPayload
      ? encoder(`${snapshot.fiscal.qrPayload}\n`)
      : new Uint8Array();

    const bytes = concat([
      ...lines.map((line) => encoder(line)),
      qrNote,
      new Uint8Array([0x1d, 0x56, 0x41, 0x10]),
      new Uint8Array([0x1b, 0x70, 0x00, 0x19, 0xfa]),
    ]);

    return {
      kind: "INVOICE_ESC_POS",
      format: "ESC_POS",
      fileName: `recibo-${snapshot.number}-${widthMm}mm.bin`,
      contentType: "application/octet-stream",
      bytes,
      cacheKey: `invoice:${snapshot.invoiceId}:escpos:${widthMm}:v${snapshot.snapshotVersion}`,
      metadata: {
        invoiceId: snapshot.invoiceId,
        profile: "epson-generic",
        printerWidthMm: widthMm,
        supportsDrawer: true,
        supportsCut: true,
      },
      engine: "escpos-manual",
      engineVersion: "v1",
    };
  }
}
