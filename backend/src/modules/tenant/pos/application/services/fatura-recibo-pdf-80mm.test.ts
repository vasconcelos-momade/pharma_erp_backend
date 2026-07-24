import { describe, expect, test } from "bun:test";
import {
  THERMAL_80MM_PAGE_WIDTH_PT,
  gerarFaturaReciboPdf80mm,
  buildThermalReceiptLines,
} from "./fatura-recibo-pdf-80mm";
import { FaturaDocumentService } from "./fatura-document.service";

describe("PDF recibo 80mm", () => {
  test("largura MediaBox = 80mm em pontos", () => {
    expect(THERMAL_80MM_PAGE_WIDTH_PT).toBe(227);
    const bytes = gerarFaturaReciboPdf80mm({
      empresa: { nome: "Farmacia Demo", nuit: "400123456" },
      numero: "FR-1",
      serie: "2026",
      data: new Date("2026-07-23T10:30:00"),
      cliente: "Consumidor Final",
      terminalCodigo: "T1",
      operador: "Ana",
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
    const text = Buffer.from(bytes).toString("latin1");
    expect(text).toContain("MediaBox [0 0 227 ");
    expect(text).toContain("%PDF");
    expect(text).toContain("FARMACIA DEMO");
    expect(text).toContain("FATURA SIMPLIFICADA");
    expect(text).toContain("Paracetamol 500mg");
    expect(text).toContain("Documento processado por computador");
  });

  test("buildThermal80mmPdf via service", () => {
    const result = FaturaDocumentService.buildThermal80mmPdf({
      id: "1",
      numero: "FR-9",
      serie: "2026",
      tipo: "FR",
      empresa: { nome: "Farm Demo" },
      items: [
        {
          nomeComercial: "AMINOPHYLLINE",
          dosagem: "100mg",
          forma: "Comprimidos",
          descricao: "AMINOPHYLLINE",
          quantidade: 1,
          total: 10,
        },
      ],
      subtotal: 10,
      desconto: 0,
      ivaTotal: 0,
      total: 10,
      moeda: "MZN",
    });
    const text = Buffer.from(result.bytes).toString("latin1");
    expect(result.contentType).toBe("application/pdf");
    expect(result.fileName).toContain("80mm");
    expect(text).toContain("MediaBox [0 0 227 ");
    expect(text).toContain("AMINOPHYLLINE 100mg");
    expect(text).toContain("Comprimidos");
  });

  test("linhas do recibo incluem totais", () => {
    const lines = buildThermalReceiptLines({
      empresa: { nome: "X" },
      numero: "1",
      data: new Date(),
      cliente: "Y",
      subtotal: 50,
      desconto: 5,
      ivaTotal: 0,
      total: 45,
      itens: [{ nome: "A", quantidade: 1, total: 50 }],
    });
    expect(lines.some((l) => l.includes("SUBTOTAL"))).toBe(true);
    expect(lines.some((l) => l.includes("TOTAL"))).toBe(true);
  });
});
