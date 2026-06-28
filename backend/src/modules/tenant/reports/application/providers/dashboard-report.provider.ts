import { ExecutiveDashboardUseCase } from "../../../dashboard/application/executive-dashboard.use-case";
import { FinanceDashboardUseCase } from "../../../dashboard/application/finance-dashboard.use-case";
import { PharmacyDashboardUseCase } from "../../../dashboard/application/pharmacy-dashboard.use-case";
import { StockDashboardUseCase } from "../../../dashboard/application/stock-dashboard.use-case";
import {
  type ModuleReportDefinition,
  type ReportDataProvider,
  type ReportProviderContext,
} from "../types/report.types";
import { REPORT_KEYS } from "../constants/report-keys";
import {
  buildExecutiveDashboardReport,
  buildFinanceDashboardReport,
  buildPharmacyDashboardReport,
  buildStockDashboardReport,
} from "./helpers/dashboard-report.builder";

function parseDashboardPeriod(url: URL) {
  const query = url.searchParams;
  const days = query.get("days");
  const period = query.get("period");
  const from = query.get("from")?.trim() || undefined;
  const to = query.get("to")?.trim() || undefined;

  return {
    days: days ? Number(days) : undefined,
    period: period ?? undefined,
    from,
    to,
  };
}

export class ExecutiveDashboardReportProvider implements ReportDataProvider {
  readonly reportKey = REPORT_KEYS.DASHBOARD_EXECUTIVE;

  private readonly useCase = new ExecutiveDashboardUseCase();

  async build(context: ReportProviderContext): Promise<ModuleReportDefinition> {
    const data = await this.useCase.execute(parseDashboardPeriod(context.url));
    return buildExecutiveDashboardReport(data);
  }
}

export class FinanceDashboardReportProvider implements ReportDataProvider {
  readonly reportKey = REPORT_KEYS.DASHBOARD_FINANCE;

  private readonly useCase = new FinanceDashboardUseCase();

  async build(context: ReportProviderContext): Promise<ModuleReportDefinition> {
    const data = await this.useCase.execute(parseDashboardPeriod(context.url));
    return buildFinanceDashboardReport(data);
  }
}

export class PharmacyDashboardReportProvider implements ReportDataProvider {
  readonly reportKey = REPORT_KEYS.DASHBOARD_PHARMACY;

  private readonly useCase = new PharmacyDashboardUseCase();

  async build(context: ReportProviderContext): Promise<ModuleReportDefinition> {
    const data = await this.useCase.execute(parseDashboardPeriod(context.url));
    return buildPharmacyDashboardReport(data);
  }
}

export class StockDashboardReportProvider implements ReportDataProvider {
  readonly reportKey = REPORT_KEYS.DASHBOARD_STOCK;

  private readonly useCase = new StockDashboardUseCase();

  async build(context: ReportProviderContext): Promise<ModuleReportDefinition> {
    const data = await this.useCase.execute(parseDashboardPeriod(context.url));
    return buildStockDashboardReport(data);
  }
}
