import { describe, expect, test } from "bun:test";
import {
  createPrinterSchema,
  updatePrinterSchema,
  testPrinterSchema,
} from "./dto/printer.dto";
import {
  buildEscPosBytes,
  EscPosEncoder,
} from "../infrastructure/drivers/escpos-encoder";

describe("createPrinterSchema", () => {
  test("aceita NETWORK com IP", () => {
    const result = createPrinterSchema.parse({
      name: "XP-80T Caixa",
      type: "ESC_POS",
      connection: "NETWORK",
      ip: "192.168.1.50",
      port: 9100,
    });
    expect(result.ip).toBe("192.168.1.50");
    expect(result.port).toBe(9100);
  });

  test("rejeita NETWORK sem IP", () => {
    expect(() =>
      createPrinterSchema.parse({
        name: "Sem IP",
        connection: "NETWORK",
      }),
    ).toThrow(/IP é obrigatório/);
  });

  test("aceita PDF sem IP", () => {
    const result = createPrinterSchema.parse({
      name: "PDF Web",
      connection: "PDF",
    });
    expect(result.connection).toBe("PDF");
  });
});

describe("updatePrinterSchema", () => {
  test("exige version e pelo menos um campo", () => {
    expect(() => updatePrinterSchema.parse({ version: 0 })).toThrow();
    const result = updatePrinterSchema.parse({
      version: 1,
      active: false,
    });
    expect(result.version).toBe(1);
    expect(result.active).toBe(false);
  });
});

describe("testPrinterSchema", () => {
  test("aceita message e platform opcionais", () => {
    const result = testPrinterSchema.parse({
      message: "Hello",
      platform: "desktop",
    });
    expect(result.message).toBe("Hello");
    expect(result.platform).toBe("desktop");
  });
});

describe("EscPosEncoder / buildEscPosBytes", () => {
  test("init emite ESC @", () => {
    const bytes = new EscPosEncoder().init().encode();
    expect(Array.from(bytes.slice(0, 2))).toEqual([0x1b, 0x40]);
  });

  test("buildEscPosBytes TEST inclui mensagem", () => {
    const bytes = buildEscPosBytes("TEST", {
      kind: "TEST",
      message: "Impressora OK XP-80T",
    });
    const text = Buffer.from(bytes).toString("latin1");
    expect(text).toContain("SKALWAY HEALTH");
    expect(text).toContain("Impressora OK XP-80T");
  });

  test("remove acentos do texto ESC/POS", () => {
    const bytes = new EscPosEncoder().init().text("Farmácia").encode();
    const text = Buffer.from(bytes).toString("latin1");
    expect(text).toContain("Farmacia");
  });
});
