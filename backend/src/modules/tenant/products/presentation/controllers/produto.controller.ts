import { ProdutoService } from "../../application/services/produto.service";
import { ListTaxRulesUseCase } from "../../../pos/application/use-cases/list-tax-rules.use-case";
import {
  createProdutoSchema,
  searchProdutosQuerySchema,
  updateProdutoSchema,
} from "../../application/dto/produto.dto";
import {
  parseJsonBody,
  parseSearchParams,
} from "../../../../../shared/http/request-validation";
import { controllerErrorResponse } from "../../../../../shared/http/controller-error";
import { z } from "zod";

export class ProdutoController {
  private service = new ProdutoService();
  private listTaxRulesUseCase = new ListTaxRulesUseCase();

  async create(req: Request, userId: string) {
    try {
      const body = await parseJsonBody(req, createProdutoSchema);
      const result = await this.service.create(body, userId);
      return Response.json(this.serialize(result), { status: 201 });
    } catch (error: any) {
      return controllerErrorResponse(error);
    }
  }

  async search(req: Request) {
    try {
      const url = new URL(req.url);
      const {
        q,
        barcode,
        categoriaId,
        categoria,
        fornecedorId,
        tipoDispensacao,
        ativo,
        includeInactive = false,
        sortBy,
        sortOrder,
        page = 1,
        pageSize = 20,
      } = parseSearchParams(url, searchProdutosQuerySchema);

      const result = await this.service.search({
        query: q,
        barcode,
        categoriaId: categoriaId ?? categoria,
        fornecedorId,
        tipoDispensacao,
        ativo,
        includeInactive,
        sortBy,
        sortOrder,
        page,
        pageSize,
      });

      return Response.json(this.serialize(result));
    } catch (error: any) {
      return controllerErrorResponse(error, 500);
    }
  }

  async get(id: string) {
    try {
      const result = await this.service.get(BigInt(id));
      return Response.json(this.serialize(result));
    } catch (error: any) {
      return controllerErrorResponse(error, 404);
    }
  }

  async dashboard() {
    try {
      const result = await this.service.getDashboard();
      return Response.json(this.serialize(result));
    } catch (error: any) {
      return controllerErrorResponse(error, 500);
    }
  }

  async listSuppliers(req: Request, id: string) {
    try {
      void req;
      const result = await this.service.listSuppliers(BigInt(id));
      return Response.json(this.serialize(result));
    } catch (error: any) {
      return controllerErrorResponse(error, 404);
    }
  }

  async listHistory(req: Request, id: string) {
    try {
      const url = new URL(req.url);
      const { page, pageSize } = parseSearchParams(url, z.object({
        page: z.coerce.number().int().positive().optional(),
        pageSize: z.coerce.number().int().positive().max(100).optional(),
      }));
      const result = await this.service.listClassificationHistory(
        BigInt(id),
        page,
        pageSize,
      );
      return Response.json(this.serialize(result));
    } catch (error: any) {
      return controllerErrorResponse(error, 404);
    }
  }

  async listAudit(req: Request, id: string) {
    try {
      const url = new URL(req.url);
      const { page, pageSize } = parseSearchParams(url, z.object({
        page: z.coerce.number().int().positive().optional(),
        pageSize: z.coerce.number().int().positive().max(100).optional(),
      }));
      const result = await this.service.listAuditLogs(BigInt(id), page, pageSize);
      return Response.json(this.serialize(result));
    } catch (error: any) {
      return controllerErrorResponse(error, 404);
    }
  }

  async update(id: string, req: Request, userId: string) {
    try {
      const body = await parseJsonBody(req, updateProdutoSchema);
      const result = await this.service.update(BigInt(id), body, userId);
      return Response.json(this.serialize(result));
    } catch (error: any) {
      return controllerErrorResponse(error);
    }
  }

  async delete(id: string, userId: string) {
    try {
      await this.service.delete(BigInt(id), userId);
      return Response.json({ message: "Produto desativado com sucesso" });
    } catch (error: any) {
      return controllerErrorResponse(error);
    }
  }

  async listTaxRules() {
    try {
      const result = await this.listTaxRulesUseCase.execute();
      return Response.json(this.serialize(result));
    } catch (error: any) {
      return controllerErrorResponse(error, 500);
    }
  }

  /**
   * Helper to convert BigInt to String for JSON serialization
   */
  private serialize(data: any) {
    return JSON.parse(JSON.stringify(data, (_key, value) =>
      typeof value === 'bigint' ? value.toString() : value
    ));
  }
}
