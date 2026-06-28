import { ClienteService } from "../../application/services/cliente.service";
import {
  createClienteSchema,
  searchClientesQuerySchema,
  updateClienteSchema,
  listRelatedQuerySchema,
} from "../../application/dto/cliente.dto";
import {
  parseJsonBody,
  parseSearchParams,
} from "../../../../../shared/http/request-validation";
import { controllerErrorResponse } from "../../../../../shared/http/controller-error";
import { success } from "../../../../../shared/http/api-response";

export class ClienteController {
  private service = new ClienteService();

  private serialize(data: unknown) {
    return JSON.parse(
      JSON.stringify(data, (_key, value) =>
        typeof value === "bigint" ? value.toString() : value,
      ),
    );
  }

  async create(req: Request, userId: string) {
    try {
      const body = await parseJsonBody(req, createClienteSchema);
      const result = await this.service.create(body, userId);
      return success(this.serialize(result), 201);
    } catch (error: any) {
      return controllerErrorResponse(error);
    }
  }

  async search(req: Request) {
    try {
      const url = new URL(req.url);
      const params = parseSearchParams(url, searchClientesQuerySchema);
      const result = await this.service.search({
        query: params.q ?? params.search,
        tipo: params.tipo,
        empresaId: params.empresaId ? BigInt(params.empresaId) : undefined,
        comCredito: params.comCredito,
        temPrescricao: params.temPrescricao,
        dateFrom: params.dateFrom,
        dateTo: params.dateTo,
        sortBy: params.sortBy,
        sortOrder: params.sortOrder,
        page: params.page,
        pageSize: params.pageSize,
      });
      return success(this.serialize(result.items), 200, {
        page: result.page,
        pageSize: result.pageSize,
        hasMore: result.hasMore,
        totalCount: result.totalCount,
      });
    } catch (error: any) {
      return controllerErrorResponse(error, 500);
    }
  }

  async get(id: string) {
    try {
      const result = await this.service.get(id);
      return success(this.serialize(result));
    } catch (error: any) {
      return controllerErrorResponse(error, 404);
    }
  }

  async dashboard() {
    try {
      const result = await this.service.getDashboard();
      return success(this.serialize(result));
    } catch (error: any) {
      return controllerErrorResponse(error, 500);
    }
  }

  async update(id: string, req: Request, userId: string) {
    try {
      const body = await parseJsonBody(req, updateClienteSchema);
      const result = await this.service.update(id, body, userId);
      return success(this.serialize(result));
    } catch (error: any) {
      return controllerErrorResponse(error);
    }
  }

  async delete(id: string, userId: string) {
    try {
      await this.service.delete(id, userId);
      return success({ deleted: true });
    } catch (error: any) {
      return controllerErrorResponse(error, 404);
    }
  }

  async listFaturas(req: Request, id: string) {
    try {
      const url = new URL(req.url);
      const { page, pageSize } = parseSearchParams(url, listRelatedQuerySchema);
      const result = await this.service.listFaturas(id, page, pageSize);
      return success(this.serialize(result.items), 200, {
        page: result.page,
        pageSize: result.pageSize,
        hasMore: result.hasMore,
        totalCount: result.totalCount,
      });
    } catch (error: any) {
      return controllerErrorResponse(error, 404);
    }
  }

  async listContasReceber(req: Request, id: string) {
    try {
      const url = new URL(req.url);
      const { page, pageSize } = parseSearchParams(url, listRelatedQuerySchema);
      const result = await this.service.listContasReceber(id, page, pageSize);
      return success(this.serialize(result.items), 200, {
        page: result.page,
        pageSize: result.pageSize,
        hasMore: result.hasMore,
        totalCount: result.totalCount,
      });
    } catch (error: any) {
      return controllerErrorResponse(error, 404);
    }
  }

  async listReceitas(req: Request, id: string) {
    try {
      const url = new URL(req.url);
      const { page, pageSize } = parseSearchParams(url, listRelatedQuerySchema);
      const result = await this.service.listReceitas(id, page, pageSize);
      return success(this.serialize(result.items), 200, {
        page: result.page,
        pageSize: result.pageSize,
        hasMore: result.hasMore,
        totalCount: result.totalCount,
      });
    } catch (error: any) {
      return controllerErrorResponse(error, 404);
    }
  }

  async listAudit(req: Request, id: string) {
    try {
      const url = new URL(req.url);
      const { page, pageSize } = parseSearchParams(url, listRelatedQuerySchema);
      const result = await this.service.listAudit(id, page, pageSize);
      return success(this.serialize(result.items), 200, {
        page: result.page,
        pageSize: result.pageSize,
        hasMore: result.hasMore,
        totalCount: result.totalCount,
      });
    } catch (error: any) {
      return controllerErrorResponse(error, 404);
    }
  }
}
