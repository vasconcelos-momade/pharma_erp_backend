import { ProdutoService } from "../../application/services/produto.service";
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

export class ProdutoController {
  private service = new ProdutoService();

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
      const { q, barcode, categoria, page = 1, pageSize = 20 } =
        parseSearchParams(url, searchProdutosQuerySchema);

      const result = await this.service.search({
        query: q,
        barcode,
        categoria,
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

  /**
   * Helper to convert BigInt to String for JSON serialization
   */
  private serialize(data: any) {
    return JSON.parse(JSON.stringify(data, (_key, value) =>
      typeof value === 'bigint' ? value.toString() : value
    ));
  }
}
