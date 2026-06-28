import { describe, expect, test } from "bun:test";
import { REPORT_KEYS } from "../constants/report-keys";
import { validateReportRegistry } from "../validation/report-registry.validator";
import { reportDataProviders } from "../providers/report-providers.registry";

describe("validateReportRegistry", () => {
  test("passa com o registry actual", () => {
    expect(() => validateReportRegistry()).not.toThrow();
  });

  test("cada REPORT_KEY possui Provider registado", () => {
    const registered = new Set(reportDataProviders.map((provider) => provider.reportKey));
    for (const [name, key] of Object.entries(REPORT_KEYS)) {
      expect(registered.has(key)).toBe(true);
    }
  });

  test("nao existem Providers orfaos", () => {
    const defined = new Set(Object.values(REPORT_KEYS));
    for (const provider of reportDataProviders) {
      expect(defined.has(provider.reportKey as (typeof REPORT_KEYS)[keyof typeof REPORT_KEYS])).toBe(
        true,
      );
    }
  });
});
