import { REPORT_KEYS, type ReportKey } from "../constants/report-keys";
import { reportDataProviders } from "../providers/report-providers.registry";

export class ReportRegistryValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ReportRegistryValidationError";
  }
}

export function validateReportRegistry(): void {
  const errors: string[] = [];

  const definedEntries = Object.entries(REPORT_KEYS);
  const definedValues = definedEntries.map(([, value]) => value);
  const definedValueSet = new Set(definedValues);

  const duplicateConstants = definedValues.filter(
    (value, index) => definedValues.indexOf(value) !== index,
  );
  for (const value of new Set(duplicateConstants)) {
    errors.push(`Valor duplicado em REPORT_KEYS: '${value}'`);
  }

  const registeredKeys = reportDataProviders.map((provider) => provider.reportKey);
  const registeredSet = new Set(registeredKeys);

  for (const [constantName, reportKey] of definedEntries) {
    if (!registeredSet.has(reportKey)) {
      errors.push(`REPORT_KEYS.${constantName} ('${reportKey}') nao possui Provider registado`);
    }
  }

  for (const provider of reportDataProviders) {
    const className = provider.constructor.name;

    if (!provider.reportKey) {
      errors.push(`Provider ${className} sem reportKey`);
      continue;
    }

    if (!definedValueSet.has(provider.reportKey as ReportKey)) {
      errors.push(
        `Provider ${className} ('${provider.reportKey}') nao existe em REPORT_KEYS`,
      );
    }

    if (typeof provider.build !== "function") {
      errors.push(`Provider ${className} nao implementa build()`);
    }
  }

  const duplicateProviders = registeredKeys.filter(
    (key, index) => registeredKeys.indexOf(key) !== index,
  );
  for (const reportKey of new Set(duplicateProviders)) {
    errors.push(`Existem Providers duplicados para reportKey '${reportKey}'`);
  }

  if (errors.length > 0) {
    throw new ReportRegistryValidationError(
      `Validacao do Reporting Engine falhou:\n- ${errors.join("\n- ")}`,
    );
  }
}
