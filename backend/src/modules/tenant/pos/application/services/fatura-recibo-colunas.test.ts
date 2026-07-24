import { describe, expect, test } from "bun:test";
import {
  formatItemTableHeader,
  formatItemTableRows,
  formatProdutoItemLabel,
  wrapItemName,
} from "./fatura-recibo-colunas";
import {
  buildThermalReceiptLines,
  gerarFaturaReciboPdf80mm,
  maxCharsForThermalPdf,
} from "./fatura-recibo-pdf-80mm";

describe("colunas Item | PU | Qtd | Total", () => {
  test("rótulo junta nome comercial, dosagem e forma", () => {
    expect(
      formatProdutoItemLabel({
        nomeComercial: "AMINOPHYLLINE",
        dosagem: "100mg",
        forma: "Comprimido",
      }),
    ).toBe("AMINOPHYLLINE 100mg Comprimido");
  });

  test("quebra nome por palavras sem cortar no meio", () => {
    const lines = wrapItemName("AMINOPHYLLINE 100mg Comprimidos", 20);
    expect(lines[0]).toBe("AMINOPHYLLINE 100mg");
    expect(lines[1]).toBe("Comprimidos");
  });

  test("cabeçalho alinhado com espacos de padding", () => {
    const header = formatItemTableHeader();
    expect(header).toContain("Item");
    expect(header).toContain("PU");
    expect(header).toContain("Qtd");
    expect(header).toContain("Total");
    expect(header.length).toBe(47);
  });

  test("linha de item com PU, Qtd e Total alinhados à direita", () => {
    const [row] = formatItemTableRows({
      nome: "Paracetamol 500mg",
      quantidade: 2,
      precoUnitario: 50,
      total: 100,
    });
    expect(row.length).toBe(47);
    expect(row.slice(0, 20).trimEnd()).toBe("Paracetamol 500mg");
    expect(row.slice(21, 30).trim()).toBe("50.00");
    expect(row.slice(31, 36).trim()).toBe("2");
    expect(row.slice(37).trim()).toBe("100.00");
  });

  test("nome longo: precos na 1a linha e continuacao sem precos", () => {
    const rows = formatItemTableRows({
      nome: "AMINOPHYLLINE 100mg Comprimidos",
      quantidade: 1,
      precoUnitario: 95.85,
      total: 95.85,
    });
    expect(rows.length).toBe(2);
    expect(rows[0]!.slice(0, 20).trimEnd()).toBe("AMINOPHYLLINE 100mg");
    expect(rows[0]!.slice(37).trim()).toBe("95.85");
    expect(rows[1]!.trim()).toBe("Comprimidos");
    expect(rows[1]!.length).toBe(20);
  });

  test("calcula PU a partir do total se em falta", () => {
    const [row] = formatItemTableRows({
      nome: "Item",
      quantidade: 4,
      total: 40,
    });
    expect(row.slice(21, 30).trim()).toBe("10.00");
  });

  test("layout FR: cabecalho comercial e rodape neutro", () => {
    const lines = buildThermalReceiptLines({
      empresa: { nome: "Farmacia Demo", nuit: "1784820311" },
      numero: "FR-17846294801",
      serie: "2026",
      data: new Date("2026-07-23T19:04:00"),
      cliente: "Consumidor Final",
      terminalCodigo: "01",
      operador: "Dono Central",
      subtotal: 100,
      desconto: 0,
      ivaTotal: 0,
      total: 100,
      itens: [
        {
          nome: "Amoxicilina 500mg",
          quantidade: 2,
          precoUnitario: 50,
          total: 100,
        },
      ],
      pagamentos: [{ metodo: "CASH", valor: 100 }],
    });

    expect(lines.some((l) => l.includes("FARMACIA DEMO"))).toBe(true);
    expect(lines.some((l) => l.includes("NUIT: 1784820311"))).toBe(true);
    expect(lines.some((l) => l.includes("FATURA SIMPLIFICADA"))).toBe(true);
    expect(lines.some((l) => l.startsWith("No: FR-17846294801"))).toBe(true);
    expect(lines.some((l) => l.includes("Serie: 2026"))).toBe(true);
    expect(lines.some((l) => l.includes("Terminal: 01"))).toBe(true);
    expect(lines).toContain("Cliente:");
    expect(lines).toContain("Consumidor Final");
    expect(lines).toContain("Operador:");
    expect(lines).toContain("Dono Central");
    expect(lines).toContain("Obrigado pela preferencia!");
    expect(lines).toContain("A sua saude e a nossa prioridade.");
    expect(lines).toContain("Documento processado por computador");
    expect(lines.every((l) => !l.includes("OP:"))).toBe(true);
    expect(lines.every((l) => !l.includes("VOLTE SEMPRE"))).toBe(true);

    const header = lines.find((l) => l.includes("Item") && l.includes("PU"));
    expect(header).toBe(formatItemTableHeader());
    const itemLine = lines.find((l) => l.includes("Amoxicilina"));
    expect(itemLine!.slice(21, 30).trim()).toBe("50.00");
  });

  test("PDF preserva espacos das colunas no stream", () => {
    const header = formatItemTableHeader();
    const bytes = gerarFaturaReciboPdf80mm({
      empresa: { nome: "Farm" },
      numero: "FR-1",
      data: new Date(),
      cliente: "Cliente",
      subtotal: 20,
      desconto: 0,
      ivaTotal: 0,
      total: 20,
      itens: [
        { nome: "Produto X", quantidade: 2, precoUnitario: 10, total: 20 },
      ],
    });
    const pdf = Buffer.from(bytes).toString("latin1");
    expect(pdf).toContain(header);
    expect(pdf).toContain("Produto X");
    expect(pdf).toContain("FATURA SIMPLIFICADA");
    expect(pdf).toContain("Documento processado por computador");
  });

  test("separa NUIT embutido no nome da empresa", () => {
    const lines = buildThermalReceiptLines({
      empresa: { nome: "Farmacia Demo 1784820311", nuit: null },
      numero: "FR-1",
      data: new Date("2026-07-23T19:04:00"),
      cliente: "Consumidor Final",
      subtotal: 10,
      desconto: 0,
      ivaTotal: 0,
      total: 10,
      itens: [{ nome: "A", quantidade: 1, total: 10 }],
    });
    expect(lines.some((l) => /^\s*FARMACIA DEMO\s*$/.test(l))).toBe(true);
    expect(lines.some((l) => l.includes("NUIT: 1784820311"))).toBe(true);
    expect(lines.every((l) => !/FARMACIA DEMO 1784820311/.test(l))).toBe(true);
  });

  test("fonte e margem cabem 48 cols em 80mm", () => {
    expect(maxCharsForThermalPdf()).toBeGreaterThanOrEqual(48);
  });
});
