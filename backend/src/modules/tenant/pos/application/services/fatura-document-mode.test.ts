import { describe, expect, test } from "bun:test";
import {
  isThermalReceiptTipo,
  resolveInvoiceDocumentMode,
} from "./fatura-document.service";

describe("resolveInvoiceDocumentMode", () => {
  test("FR → thermal_80mm", () => {
    expect(resolveInvoiceDocumentMode("FR")).toBe("thermal_80mm");
    expect(isThermalReceiptTipo("FR")).toBe(true);
  });

  test("FT → pdf_a4", () => {
    expect(resolveInvoiceDocumentMode("FT")).toBe("pdf_a4");
    expect(isThermalReceiptTipo("FT")).toBe(false);
  });

  test("default e NC → pdf_a4", () => {
    expect(resolveInvoiceDocumentMode(null)).toBe("pdf_a4");
    expect(resolveInvoiceDocumentMode("NC")).toBe("pdf_a4");
  });
});
