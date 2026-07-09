/// <reference lib="dom" />
import { controllerErrorResponse } from "../../../../../shared/http/controller-error";
import {
  parseReportQuery,
  resolveReportDisposition,
} from "../../application/dto/report.dto";
import { REPORT_KEYS, type ReportKey } from "../../application/constants/report-keys";
import { ReportService } from "../../application/services/report.service";
import { type ReportArtifact } from "../../application/types/report.types";

export class ReportsController {
  private readonly reportService = new ReportService();

  async expiry(req: Request, userId: string) {
    return this.generate(REPORT_KEYS.EXPIRY, req, {}, userId);
  }

  async invoice(req: Request, params: Record<string, string>, userId: string) {
    return this.generate(REPORT_KEYS.INVOICE, req, params, userId);
  }

  async invoiceList(req: Request, userId: string) {
    return this.generate(REPORT_KEYS.INVOICE_LIST, req, {}, userId);
  }

  async salesHistory(req: Request, userId: string) {
    return this.generate(REPORT_KEYS.SALES_HISTORY, req, {}, userId);
  }

  async customers(req: Request, userId: string) {
    return this.generate(REPORT_KEYS.CUSTOMERS, req, {}, userId);
  }

  async proformaInvoice(req: Request, params: Record<string, string>, userId: string) {
    return this.generate(REPORT_KEYS.PROFORMA_INVOICE, req, params, userId);
  }

  async proformaInvoiceList(req: Request, userId: string) {
    return this.generate(REPORT_KEYS.PROFORMA_INVOICE_LIST, req, {}, userId);
  }

  async dashboardExecutive(req: Request, userId: string) {
    return this.generate(REPORT_KEYS.DASHBOARD_EXECUTIVE, req, {}, userId);
  }

  async dashboardFinance(req: Request, userId: string) {
    return this.generate(REPORT_KEYS.DASHBOARD_FINANCE, req, {}, userId);
  }

  async dashboardPharmacy(req: Request, userId: string) {
    return this.generate(REPORT_KEYS.DASHBOARD_PHARMACY, req, {}, userId);
  }

  async dashboardStock(req: Request, userId: string) {
    return this.generate(REPORT_KEYS.DASHBOARD_STOCK, req, {}, userId);
  }

  async pharmacyReport(reportKey: ReportKey, req: Request, userId: string) {
    return this.generate(reportKey, req, {}, userId);
  }

  async stockReport(reportKey: ReportKey, req: Request, userId: string) {
    return this.generate(reportKey, req, {}, userId);
  }

  async stockReportWithParams(
    reportKey: ReportKey,
    req: Request,
    params: Record<string, string>,
    userId: string,
  ) {
    return this.generate(reportKey, req, params, userId);
  }

  async financeReport(reportKey: ReportKey, req: Request, userId: string) {
    return this.generate(reportKey, req, {}, userId);
  }

  async regulatoryReport(reportKey: ReportKey, req: Request, userId: string) {
    return this.generate(reportKey, req, {}, userId);
  }

  async auditReport(reportKey: ReportKey, req: Request, userId: string) {
    return this.generate(reportKey, req, {}, userId);
  }

  async adminReport(reportKey: ReportKey, req: Request, userId: string) {
    return this.generate(reportKey, req, {}, userId);
  }

  private async generate(
    reportKey: ReportKey,
    req: Request,
    params: Record<string, string>,
    userId: string,
  ) {
    try {
      const url = new URL(req.url);
      const query = parseReportQuery(url);
      const format = query.format ?? "pdf";
      const artifact = await this.reportService.generate({
        reportKey,
        userId,
        routeParams: params,
        url,
        format,
        disposition: resolveReportDisposition(format, query.disposition),
      });
      return this.toResponse(artifact);
    } catch (error: any) {
      return controllerErrorResponse(error);
    }
  }

  async generateArtifact(input: {
    reportKey: ReportKey;
    userId: string;
    routeParams?: Record<string, string>;
    url: URL;
    format?: "pdf" | "csv" | "excel";
    disposition?: "inline" | "attachment";
  }): Promise<ReportArtifact> {
    const format = input.format ?? "pdf";
    return this.reportService.generate({
      reportKey: input.reportKey,
      userId: input.userId,
      routeParams: input.routeParams ?? {},
      url: input.url,
      format,
      disposition: resolveReportDisposition(format, input.disposition),
    });
  }

  private toResponse(artifact: ReportArtifact) {
    const body = new Blob([artifact.bytes as BlobPart], {
      type: artifact.contentType,
    });

    return new Response(body, {
      headers: {
        "Content-Type": artifact.contentType,
        "Content-Disposition": `${artifact.disposition}; filename="${artifact.fileName}"`,
      },
    });
  }
}
