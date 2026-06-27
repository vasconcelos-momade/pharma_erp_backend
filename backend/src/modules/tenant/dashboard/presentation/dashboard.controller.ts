import { ExecutiveDashboardUseCase } from "../application/executive-dashboard.use-case";
import { FinanceDashboardUseCase } from "../application/finance-dashboard.use-case";
import { PharmacyDashboardUseCase } from "../application/pharmacy-dashboard.use-case";
import { StockDashboardUseCase } from "../application/stock-dashboard.use-case";
import {
  dashboardPeriodQuerySchema,
  executiveDashboardTableQuerySchema,
  financeDashboardTableQuerySchema,
  pharmacyDashboardTableQuerySchema,
  stockDashboardTableQuerySchema,
} from "../application/dashboard.dto";
import { parseSearchParams } from "../../../../shared/http/request-validation";
import { controllerErrorResponse } from "../../../../shared/http/controller-error";

export class DashboardController {
  private executiveUseCase = new ExecutiveDashboardUseCase();
  private financeUseCase = new FinanceDashboardUseCase();
  private pharmacyUseCase = new PharmacyDashboardUseCase();
  private stockUseCase = new StockDashboardUseCase();

  async executive(req: Request) {
    try {
      const query = parseSearchParams(new URL(req.url), dashboardPeriodQuerySchema);
      const result = await this.executiveUseCase.execute(query);
      return Response.json(this.serialize(result));
    } catch (error: any) {
      return controllerErrorResponse(error);
    }
  }

  async finance(req: Request) {
    try {
      const query = parseSearchParams(new URL(req.url), dashboardPeriodQuerySchema);
      const result = await this.financeUseCase.execute(query);
      return Response.json(this.serialize(result));
    } catch (error: any) {
      return controllerErrorResponse(error);
    }
  }

  async financeTable(req: Request) {
    try {
      const query = parseSearchParams(
        new URL(req.url),
        financeDashboardTableQuerySchema,
      );
      const result = await this.financeUseCase.listTable(query);
      return Response.json(this.serialize(result));
    } catch (error: any) {
      return controllerErrorResponse(error);
    }
  }

  async pharmacy(req: Request) {
    try {
      const query = parseSearchParams(new URL(req.url), dashboardPeriodQuerySchema);
      const result = await this.pharmacyUseCase.execute(query);
      return Response.json(this.serialize(result));
    } catch (error: any) {
      return controllerErrorResponse(error);
    }
  }

  async pharmacyTable(req: Request) {
    try {
      const query = parseSearchParams(
        new URL(req.url),
        pharmacyDashboardTableQuerySchema,
      );
      const result = await this.pharmacyUseCase.listTable(query);
      return Response.json(this.serialize(result));
    } catch (error: any) {
      return controllerErrorResponse(error);
    }
  }

  async executiveTable(req: Request) {
    try {
      const query = parseSearchParams(
        new URL(req.url),
        executiveDashboardTableQuerySchema,
      );
      const result = await this.executiveUseCase.listTable(query);
      return Response.json(this.serialize(result));
    } catch (error: any) {
      return controllerErrorResponse(error);
    }
  }

  async stock(req: Request) {
    try {
      const query = parseSearchParams(new URL(req.url), dashboardPeriodQuerySchema);
      const result = await this.stockUseCase.execute(query);
      return Response.json(this.serialize(result));
    } catch (error: any) {
      return controllerErrorResponse(error);
    }
  }

  async stockTable(req: Request) {
    try {
      const query = parseSearchParams(
        new URL(req.url),
        stockDashboardTableQuerySchema,
      );
      const result = await this.stockUseCase.listTable(query);
      return Response.json(this.serialize(result));
    } catch (error: any) {
      return controllerErrorResponse(error);
    }
  }

  private serialize(data: unknown) {
    return JSON.parse(
      JSON.stringify(data, (_key, value) =>
        typeof value === "bigint" ? value.toString() : value,
      ),
    );
  }
}
