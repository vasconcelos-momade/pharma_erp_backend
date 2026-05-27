import puppeteer from "puppeteer";
import { renderInvoiceHtmlTemplate } from "../templates/invoice-html.template";
import type { GeneratedDocumentArtifact, InvoiceDocumentSnapshotPayload } from "../../domain/document.types";

export class PdfEngineService {
  async generateInvoicePdf(snapshot: InvoiceDocumentSnapshotPayload): Promise<GeneratedDocumentArtifact> {
    const browser = await puppeteer.launch({
      headless: true,
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH,
      args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
    });

    try {
      const page = await browser.newPage();
      const html = renderInvoiceHtmlTemplate(snapshot);
      await page.setContent(html, { waitUntil: "networkidle0" });
      const pdf = await page.pdf({
        format: "A4",
        printBackground: true,
        preferCSSPageSize: true,
        margin: {
          top: "8mm",
          right: "8mm",
          bottom: "8mm",
          left: "8mm",
        },
      });
      await page.close();

      return {
        kind: "INVOICE_PDF",
        format: "PDF",
        fileName: `fatura-${snapshot.number}.pdf`,
        contentType: "application/pdf",
        bytes: pdf,
        cacheKey: `invoice:${snapshot.invoiceId}:pdf:v${snapshot.snapshotVersion}`,
        metadata: {
          invoiceId: snapshot.invoiceId,
          number: snapshot.number,
          format: "A4",
        },
        engine: "puppeteer",
        engineVersion: "v1",
      };
    } finally {
      await browser.close();
    }
  }
}
