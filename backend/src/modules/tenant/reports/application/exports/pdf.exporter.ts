import {
  type ReportArtifact,
  type ReportDefinition,
  type ReportDisposition,
  type ReportExporter,
} from "../types/report.types";
import { toReportFileName } from "../helpers/report-export.helper";
import { renderInstitutionalReportHtml } from "../templates/html-template.renderer";
import { convertHtmlToPdf } from "../templates/pdf-html.converter";

export class PdfExporter implements ReportExporter {
  readonly format = "pdf" as const;

  async export(
    definition: ReportDefinition,
    disposition: ReportDisposition,
  ): Promise<ReportArtifact> {
    const html = renderInstitutionalReportHtml(definition);
    const bytes = await convertHtmlToPdf(html, definition);

    return {
      bytes,
      fileName: `${toReportFileName(definition.fileBaseName)}.pdf`,
      contentType: "application/pdf",
      disposition,
    };
  }
}
