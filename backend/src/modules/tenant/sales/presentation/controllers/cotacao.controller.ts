import { success } from "../../../../../shared/http/api-response";
import { controllerErrorResponse } from "../../../../../shared/http/controller-error";
import {
  parseJsonBody,
  parseSearchParams,
} from "../../../../../shared/http/request-validation";
import type {
  CreateCotacaoDTO,
  UpdateCotacaoDTO,
} from "../../application/dto/cotacao.dto";
import {
  createCotacaoSchema,
  listCotacaoAuditQuerySchema,
  mutateCotacaoStatusSchema,
  searchCotacoesQuerySchema,
  updateCotacaoSchema,
} from "../../application/dto/cotacao.dto";
import { CotacaoService } from "../../application/services/cotacao.service";

export class CotacaoController {
  private service = new CotacaoService();

  private serialize(data: unknown) {
    return JSON.parse(
      JSON.stringify(data, (_key, value) =>
        typeof value === "bigint" ? value.toString() : value,
      ),
    );
  }

  async create(req: Request, userId: string) {
    try {
      const body = await parseJsonBody<CreateCotacaoDTO>(req, createCotacaoSchema);
      const result = await this.service.create(body, userId);
      return success(this.serialize(result), 201);
    } catch (error: any) {
      return controllerErrorResponse(error);
    }
  }

  async search(req: Request) {
    try {
      const url = new URL(req.url);
      const params = parseSearchParams(url, searchCotacoesQuerySchema);
      const result = await this.service.search({
        query: params.q ?? params.search,
        estado: params.estado,
        clienteId: params.clienteId ? BigInt(params.clienteId) : undefined,
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

  async get(cotacaoId: string) {
    try {
      const result = await this.service.get(cotacaoId);
      return success(this.serialize(result));
    } catch (error: any) {
      return controllerErrorResponse(error, 404);
    }
  }

  async update(cotacaoId: string, req: Request, userId: string) {
    try {
      const body = await parseJsonBody<UpdateCotacaoDTO>(req, updateCotacaoSchema);
      const result = await this.service.update(cotacaoId, body, userId);
      return success(this.serialize(result));
    } catch (error: any) {
      return controllerErrorResponse(error);
    }
  }

  async delete(cotacaoId: string, userId: string) {
    try {
      await this.service.delete(cotacaoId, userId);
      return success({ deleted: true });
    } catch (error: any) {
      return controllerErrorResponse(error);
    }
  }

  async approve(cotacaoId: string, req: Request, userId: string) {
    try {
      const body = await parseJsonBody(req, mutateCotacaoStatusSchema);
      const result = await this.service.approve(
        cotacaoId,
        userId,
        body.observacoes,
      );
      return success(this.serialize(result));
    } catch (error: any) {
      return controllerErrorResponse(error);
    }
  }

  async reject(cotacaoId: string, req: Request, userId: string) {
    try {
      const body = await parseJsonBody(req, mutateCotacaoStatusSchema);
      const result = await this.service.reject(
        cotacaoId,
        userId,
        body.observacoes,
      );
      return success(this.serialize(result));
    } catch (error: any) {
      return controllerErrorResponse(error);
    }
  }

  async expire(cotacaoId: string, req: Request, userId: string) {
    try {
      const body = await parseJsonBody(req, mutateCotacaoStatusSchema);
      const result = await this.service.expire(
        cotacaoId,
        userId,
        body.observacoes,
      );
      return success(this.serialize(result));
    } catch (error: any) {
      return controllerErrorResponse(error);
    }
  }

  async listAudit(req: Request, cotacaoId: string) {
    try {
      const url = new URL(req.url);
      const { page, pageSize } = parseSearchParams(url, listCotacaoAuditQuerySchema);
      const result = await this.service.listAudit(cotacaoId, page, pageSize);
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
