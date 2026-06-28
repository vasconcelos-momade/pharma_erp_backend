import { controllerErrorResponse } from "../../../../../shared/http/controller-error";
import { success } from "../../../../../shared/http/api-response";
import { AuditReportingService } from "../../application/services/audit-reporting.service";

export class AuditController {
  private readonly auditService = new AuditReportingService();

  async dashboard() {
    try {
      return success(await this.auditService.dashboard());
    } catch (error: any) {
      return controllerErrorResponse(error, 500);
    }
  }

  async listAuditLogs(req: Request) {
    try {
      const url = new URL(req.url);
      const result = await this.auditService.listAuditLogs(this.auditService.parseQuery(url));
      return success(result.items, 200, {
        page: result.page,
        pageSize: result.pageSize,
        hasMore: result.hasMore,
        totalCount: result.totalCount,
      });
    } catch (error: any) {
      return controllerErrorResponse(error, 500);
    }
  }

  async listBusinessEvents(req: Request) {
    try {
      const url = new URL(req.url);
      const result = await this.auditService.listBusinessEvents(
        this.auditService.parseQuery(url),
      );
      return success(result.items, 200, {
        page: result.page,
        pageSize: result.pageSize,
        hasMore: result.hasMore,
        totalCount: result.totalCount,
      });
    } catch (error: any) {
      return controllerErrorResponse(error, 500);
    }
  }

  async verifyIntegrity() {
    try {
      return success(await this.auditService.verifyIntegrity());
    } catch (error: any) {
      return controllerErrorResponse(error, 500);
    }
  }
}
