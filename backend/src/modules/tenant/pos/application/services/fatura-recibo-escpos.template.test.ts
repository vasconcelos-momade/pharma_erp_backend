import { describe, expect, test } from "bun:test";
import { gerarFaturaReciboEscpos } from "./fatura-recibo-escpos.template";
import { FaturaDocumentService } from "./fatura-document.service";

function bytesToLatin1(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("latin1");
}

describe("gerarFaturaReciboEscpos (FR 80mm)", () => {
  test("emite INIT, tipografia e layout comercial", () => {
    const bytes = gerarFaturaReciboEscpos({
      empresa: { nome: "Farmacia Demo", nuit: "400123456" },
      numero: "FR-1",
      serie: "2026",
      data: new Date("2026-07-23T10:30:00"),
      cliente: "Consumidor Final",
      terminalCodigo: "T1",
      operador: "Dono Central",
      subtotal: 100,
      desconto: 0,
      taxaIvaAplicada: 0,
      ivaTotal: 0,
      total: 100,
      moeda: "MZN",
      valorRecebido: 100,
      troco: 0,
      itens: [{ nome: "Paracetamol 500mg", quantidade: 2, total: 100 }],
      pagamentos: [{ metodo: "CASH", valor: 100 }],
    });

    expect(bytes[0]).toBe(0x1b);
    expect(bytes[1]).toBe(0x40);
    expect(Array.from(bytes.slice(2, 5))).toEqual([0x1b, 0x4d, 0x00]);

    const text = bytesToLatin1(bytes);
    expect(text).toContain("FARMACIA DEMO");
    expect(text).toContain("NUIT: 400123456");
    expect(text).toContain("FATURA SIMPLIFICADA");
    expect(text).toContain("No: FR-1");
    expect(text).toContain("Serie: 2026");
    expect(text).toContain("Terminal: T1");
    expect(text).toContain("Cliente:");
    expect(text).toContain("Operador:");
    expect(text).toContain("Dono Central");
    expect(text).toContain("Paracetamol 500mg");
    expect(text).toContain("TOTAL MZN 100.00");
    expect(text).toContain("DINHEIRO");
    expect(text).toContain("Obrigado pela preferencia!");
    expect(text).toContain("Documento processado por computador");
    expect(text).not.toContain("OP:");
    expect(text).not.toContain("SkalWay Health v1.0");

    // Double height + bold no nome (GS ! 0x01 e ESC E 1)
    expect(text).toContain(String.fromCharCode(0x1d, 0x21, 0x01));
    expect(text).toContain(String.fromCharCode(0x1b, 0x45, 0x01));
  });

  test("corta papel com GS V", () => {
    const bytes = gerarFaturaReciboEscpos({
      empresa: { nome: "X" },
      numero: "1",
      data: new Date(),
      cliente: "Y",
      subtotal: 1,
      desconto: 0,
      ivaTotal: 0,
      total: 1,
      itens: [{ nome: "A", quantidade: 1, total: 1 }],
    });
    expect(Array.from(bytes.slice(-3))).toEqual([0x1d, 0x56, 0x01]);
  });
});

describe("FaturaDocumentService.buildPrintArtifact", () => {
  test("usa template 80mm e devolve base64", () => {
    const artifact = FaturaDocumentService.buildPrintArtifact({
      id: "9",
      numero: "FR-9",
      serie: "2026",
      createdAt: "2026-07-23T12:00:00.000Z",
      empresa: { nome: "Farm Demo", nuit: "123" },
      cliente: { nome: "Joao", documento: "110101" },
      terminal: { codigo: "POS-01" },
      user: { name: "Ana" },
      items: [
        {
          descricao: "Amoxicilina 500mg",
          quantidade: 1,
          precoUnit: 50,
          total: 50,
          taxaAplicada: 0,
        },
      ],
      payments: [{ metodo: "MPESA", valor: 50 }],
      subtotal: 50,
      desconto: 0,
      ivaTotal: 0,
      total: 50,
      valorRecebido: 50,
      troco: 0,
      moeda: "MZN",
    });

    expect(artifact.contentType).toBe("application/octet-stream");
    expect(artifact.fileName).toContain("FR-9");
    expect(artifact.payloadBase64.length).toBeGreaterThan(40);

    const decoded = Buffer.from(artifact.payloadBase64, "base64").toString(
      "latin1",
    );
    expect(decoded).toContain("FARM DEMO");
    expect(decoded).toContain("FATURA SIMPLIFICADA");
    expect(decoded).toContain("Amoxicilina 500mg");
    expect(decoded).toContain("FORMA PAGTO:");
    expect(decoded).toContain("MPESA");
    expect(decoded).toContain("Operador:");
  });
});
