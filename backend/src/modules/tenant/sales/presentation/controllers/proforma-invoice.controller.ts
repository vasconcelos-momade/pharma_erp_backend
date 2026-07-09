import { success } from "../../../../../shared/http/api-response";
import { controllerErrorResponse } from "../../../../../shared/http/controller-error";
import {
  parseJsonBody,
  parseSearchParams,
} from "../../../../../shared/http/request-validation";
import type {
  AddProformaInvoiceItemDTO,
  CreateProformaInvoiceDTO,
  UpdateProformaInvoiceDTO,
  UpdateProformaInvoiceItemDTO,
} from "../../application/dto/proforma-invoice.dto";
import {
  addProformaInvoiceItemSchema,
  createProformaInvoiceSchema,
  proformaInvoiceItemIdParamSchema,
  listProformaInvoiceAuditQuerySchema,
  mutateProformaInvoiceStatusSchema,
  searchProformaInvoicesQuerySchema,
  updateProformaInvoiceItemSchema,
  updateProformaInvoiceSchema,
} from "../../application/dto/proforma-invoice.dto";
import { ProformaInvoiceService } from "../../application/services/proforma-invoice.service";

export class ProformaInvoiceController {
  private service = new ProformaInvoiceService();

  private serialize(data: unknown) {
    return JSON.parse(
      JSON.stringify(data, (_key, value) =>
        typeof value === "bigint" ? value.toString() : value,
      ),
    );
  }

  async create(req: Request, userId: string) {
    try {
      const body = await parseJsonBody<CreateProformaInvoiceDTO>(req, createProformaInvoiceSchema);
      const result = await this.service.create(body, userId);
      return success(this.serialize(result), 201);
    } catch (error: any) {
      return controllerErrorResponse(error);
    }
  }

  async search(req: Request) {
    try {
      const url = new URL(req.url);
      const params = parseSearchParams(url, searchProformaInvoicesQuerySchema);
      const result = await this.service.search({
        query: params.q ?? params.search,
        estado: params.estado,
        clienteId: params.clienteId ? BigInt(params.clienteId) : undefined,
        userId: params.userId ? BigInt(params.userId) : undefined,
        validadeFrom: params.validadeFrom,
        validadeTo: params.validadeTo,
        createdFrom: params.createdFrom,
        createdTo: params.createdTo,
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
      return controllerErrorResponse(error);
    }
  }

  async get(proformaInvoiceId: string) {
    try {
      const result = await this.service.get(proformaInvoiceId);
      return success(this.serialize(result));
    } catch (error: any) {
      return controllerErrorResponse(error, 404);
    }
  }

  async update(proformaInvoiceId: string, req: Request, userId: string) {
    try {
      const body = await parseJsonBody<UpdateProformaInvoiceDTO>(req, updateProformaInvoiceSchema);
      const result = await this.service.update(proformaInvoiceId, body, userId);
      return success(this.serialize(result));
    } catch (error: any) {
      return controllerErrorResponse(error);
    }
  }

  async addItem(proformaInvoiceId: string, req: Request, userId: string) {
    try {
      const body = await parseJsonBody<AddProformaInvoiceItemDTO>(req, addProformaInvoiceItemSchema);
      const result = await this.service.addItem(proformaInvoiceId, body, userId);
      return success(this.serialize(result));
    } catch (error: any) {
      return controllerErrorResponse(error);
    }
  }

  async updateItem(proformaInvoiceId: string, itemId: string, req: Request, userId: string) {
    try {
      const body = await parseJsonBody<UpdateProformaInvoiceItemDTO>(
        req,
        updateProformaInvoiceItemSchema,
      );
      const result = await this.service.updateItem(proformaInvoiceId, itemId, body, userId);
      return success(this.serialize(result));
    } catch (error: any) {
      return controllerErrorResponse(error);
    }
  }

  async removeItem(proformaInvoiceId: string, itemId: string, userId: string) {
    try {
      const result = await this.service.removeItem(proformaInvoiceId, itemId, userId);
      return success(this.serialize(result));
    } catch (error: any) {
      return controllerErrorResponse(error);
    }
  }

  async delete(proformaInvoiceId: string, userId: string) {
    try {
      await this.service.delete(proformaInvoiceId, userId);
      return success({ deleted: true });
    } catch (error: any) {
      return controllerErrorResponse(error);
    }
  }

  async approve(proformaInvoiceId: string, req: Request, userId: string) {
    try {
      const body = await parseJsonBody(req, mutateProformaInvoiceStatusSchema);
      const result = await this.service.approve(
        proformaInvoiceId,
        userId,
        body.observacoes,
      );
      return success(this.serialize(result));
    } catch (error: any) {
      return controllerErrorResponse(error);
    }
  }

  async reject(proformaInvoiceId: string, req: Request, userId: string) {
    try {
      const body = await parseJsonBody(req, mutateProformaInvoiceStatusSchema);
      const result = await this.service.reject(
        proformaInvoiceId,
        userId,
        body.observacoes,
      );
      return success(this.serialize(result));
    } catch (error: any) {
      return controllerErrorResponse(error);
    }
  }

  async expire(proformaInvoiceId: string, req: Request, userId: string) {
    try {
      const body = await parseJsonBody(req, mutateProformaInvoiceStatusSchema);
      const result = await this.service.expire(
        proformaInvoiceId,
        userId,
        body.observacoes,
      );
      return success(this.serialize(result));
    } catch (error: any) {
      return controllerErrorResponse(error);
    }
  }

  async listAudit(req: Request, proformaInvoiceId: string) {
    try {
      const url = new URL(req.url);
      const { page, pageSize } = parseSearchParams(url, listProformaInvoiceAuditQuerySchema);
      const result = await this.service.listAudit(proformaInvoiceId, page, pageSize);
      return success(this.serialize(result.items), 200, {
        page: result.page,
        pageSize: result.pageSize,
        hasMore: result.hasMore,
        totalCount: result.totalCount,
      });
    } catch (error: any) {
      return controllerErrorResponse(error);
    }
  }
}
