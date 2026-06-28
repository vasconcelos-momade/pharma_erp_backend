import {
  type ReportArtifact,
  type ReportDefinition,
  type ReportDisposition,
  type ReportExporter,
} from "../types/report.types";
import { buildInstitutionalReportView } from "../templates/report-presentation.builder";
import { encodeUtf8, toReportFileName } from "../helpers/report-export.helper";

function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export class ExcelExporter implements ReportExporter {
  readonly format = "excel" as const;

  export(definition: ReportDefinition, disposition: ReportDisposition): ReportArtifact {
    const view = buildInstitutionalReportView(definition);
    const sections: string[] = [
      "<html><head><meta charset=\"utf-8\"></head><body>",
      `<h2>${escapeHtml(definition.reportName)}</h2>`,
    ];

    sections.push("<h3>Cabecalho</h3><table border=\"1\">");
    for (const line of view.headerLines) {
      sections.push(`<tr><td>${escapeHtml(line)}</td></tr>`);
    }
    sections.push("</table>");

    if (view.filters.length > 0) {
      sections.push("<h3>Filtros</h3><table border=\"1\">");
      for (const row of view.filters) {
        sections.push(`<tr><th>${escapeHtml(row.label)}</th><td>${escapeHtml(row.value)}</td></tr>`);
      }
      sections.push("</table>");
    }

    if (view.kpis.length > 0) {
      sections.push("<h3>KPIs</h3><table border=\"1\">");
      for (const row of view.kpis) {
        sections.push(`<tr><th>${escapeHtml(row.label)}</th><td>${escapeHtml(row.value)}</td></tr>`);
      }
      sections.push("</table>");
    }

    for (const table of view.tables) {
      if (table.title) {
        sections.push(`<h3>${escapeHtml(table.title)}</h3>`);
      }
      sections.push("<table border=\"1\"><tr>");
      for (const column of table.columns) {
        sections.push(`<th>${escapeHtml(column)}</th>`);
      }
      sections.push("</tr>");
      for (const row of table.rows) {
        sections.push("<tr>");
        for (const cell of row) {
          sections.push(`<td>${escapeHtml(cell)}</td>`);
        }
        sections.push("</tr>");
      }
      sections.push("</table>");
    }

    if (view.totals.length > 0) {
      sections.push("<h3>Totais</h3><table border=\"1\">");
      for (const row of view.totals) {
        sections.push(`<tr><th>${escapeHtml(row.label)}</th><td>${escapeHtml(row.value)}</td></tr>`);
      }
      sections.push("</table>");
    }

    if (view.observations.length > 0) {
      sections.push("<h3>Observacoes</h3><table border=\"1\">");
      for (const item of view.observations) {
        sections.push(`<tr><td>${escapeHtml(item)}</td></tr>`);
      }
      sections.push("</table>");
    }

    sections.push("<h3>Rodape</h3><table border=\"1\">");
    for (const line of view.footerLines) {
      sections.push(`<tr><td>${escapeHtml(line)}</td></tr>`);
    }
    sections.push("</table></body></html>");

    return {
      bytes: encodeUtf8(sections.join("")),
      fileName: `${toReportFileName(definition.fileBaseName)}.xls`,
      contentType: "application/vnd.ms-excel",
      disposition,
    };
  }
}
