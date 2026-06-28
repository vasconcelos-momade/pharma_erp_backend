import {
  type ReportArtifact,
  type ReportDefinition,
  type ReportDisposition,
  type ReportExporter,
} from "../types/report.types";
import { buildInstitutionalReportView } from "../templates/report-presentation.builder";
import {
  encodeUtf8,
  toReportFileName,
} from "../helpers/report-export.helper";

function escapeCsv(value: unknown): string {
  const text = String(value ?? "");
  if (text.includes(",") || text.includes('"') || text.includes("\n")) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

export class CsvExporter implements ReportExporter {
  readonly format = "csv" as const;

  export(definition: ReportDefinition, disposition: ReportDisposition): ReportArtifact {
    const view = buildInstitutionalReportView(definition);
    const lines: string[] = [
      ...view.headerLines.map((line) => escapeCsv(line)),
      "",
    ];

    if (view.filters.length > 0) {
      lines.push("Filtros,Valor");
      lines.push(...view.filters.map((row) => `${escapeCsv(row.label)},${escapeCsv(row.value)}`));
      lines.push("");
    }

    if (view.kpis.length > 0) {
      lines.push("KPIs,Valor");
      lines.push(...view.kpis.map((row) => `${escapeCsv(row.label)},${escapeCsv(row.value)}`));
      lines.push("");
    }

    for (const table of view.tables) {
      if (table.title) {
        lines.push(escapeCsv(table.title));
      }
      lines.push(table.columns.map(escapeCsv).join(","));
      lines.push(...table.rows.map((row) => row.map(escapeCsv).join(",")));
      lines.push("");
    }

    if (view.totals.length > 0) {
      lines.push("Totais,Valor");
      lines.push(...view.totals.map((row) => `${escapeCsv(row.label)},${escapeCsv(row.value)}`));
      lines.push("");
    }

    if (view.observations.length > 0) {
      lines.push("Observacoes");
      lines.push(...view.observations.map((item) => escapeCsv(item)));
      lines.push("");
    }

    lines.push(...view.footerLines.map((line) => escapeCsv(line)));

    return {
      bytes: encodeUtf8(lines.join("\n")),
      fileName: `${toReportFileName(definition.fileBaseName)}.csv`,
      contentType: "text/csv; charset=utf-8",
      disposition,
    };
  }
}
