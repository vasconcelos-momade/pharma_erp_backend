import { toText } from "../helpers/report-export.helper";
import { type ReportDefinition } from "../types/report.types";
import { buildInstitutionalReportView } from "./report-presentation.builder";

export type { ReportLabelValueRow } from "./report-presentation.builder";

export type InstitutionalReportView = ReturnType<typeof buildInstitutionalReportView>;

export function renderInstitutionalReportTextLines(definition: ReportDefinition): string[] {
  const view = buildInstitutionalReportView(definition);
  const lines = [...view.headerLines, ""];

  if (view.filters.length > 0) {
    lines.push("Filtros:");
    lines.push(...view.filters.map((row) => `- ${row.label}: ${row.value}`));
    lines.push("");
  }

  if (view.kpis.length > 0) {
    lines.push("KPIs:");
    lines.push(...view.kpis.map((row) => `- ${row.label}: ${row.value}`));
    lines.push("");
  }

  for (const table of view.tables) {
    if (table.title) {
      lines.push(table.title);
    }
    lines.push(table.columns.join(" | "));
    lines.push("-".repeat(Math.max(24, table.columns.join(" | ").length)));
    for (const row of table.rows) {
      lines.push(row.map((cell) => toText(cell)).join(" | "));
    }
    lines.push("");
  }

  if (view.totals.length > 0) {
    lines.push("Totais:");
    lines.push(...view.totals.map((row) => `- ${row.label}: ${row.value}`));
    lines.push("");
  }

  if (view.observations.length > 0) {
    lines.push("Observacoes:");
    lines.push(...view.observations.map((item) => `- ${item}`));
    lines.push("");
  }

  lines.push(...view.footerLines);
  return lines;
}
