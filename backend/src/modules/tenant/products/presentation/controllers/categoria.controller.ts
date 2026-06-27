import { CategoriaService } from "../../application/services/categoria.service";
import {
  createCategoriaSchema,
  searchCategoriasQuerySchema,
  updateCategoriaSchema,
} from "../../application/dto/categoria.dto";
import {
  parseJsonBody,
  parseSearchParams,
} from "../../../../../shared/http/request-validation";
import { controllerErrorResponse } from "../../../../../shared/http/controller-error";

export class CategoriaController {
  private service = new CategoriaService();

  async create(req: Request, userId: string) {
    try {
      const body = await parseJsonBody(req, createCategoriaSchema);
      const result = await this.service.create(body, userId);
      return Response.json(this.serialize(result), { status: 201 });
    } catch (error: any) {
      return controllerErrorResponse(error);
    }
  }

  async search(req: Request) {
    try {
      const url = new URL(req.url);
      const { q, includeInactive = false, page = 1, pageSize = 20 } =
        parseSearchParams(url, searchCategoriasQuerySchema);

      const result = await this.service.search({
        query: q,
        includeInactive,
        page,
        pageSize,
      });

      return Response.json(this.serialize(result));
    } catch (error: any) {
      return controllerErrorResponse(error, 500);
    }
  }

  async listActive() {
    try {
      const result = await this.service.listActive();
      return Response.json(this.serialize(result));
    } catch (error: any) {
      return controllerErrorResponse(error, 500);
    }
  }

  async stats() {
    try {
      const result = await this.service.getStats();
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
      const body = await parseJsonBody(req, updateCategoriaSchema);
      const result = await this.service.update(BigInt(id), body, userId);
      return Response.json(this.serialize(result));
    } catch (error: any) {
      return controllerErrorResponse(error);
    }
  }

  async delete(id: string, userId: string) {
    try {
      await this.service.delete(BigInt(id), userId);
      return Response.json({ message: "Categoria excluída com sucesso" });
    } catch (error: any) {
      return controllerErrorResponse(error);
    }
  }

  private serialize(data: any) {
    return JSON.parse(
      JSON.stringify(data, (_key, value) =>
        typeof value === "bigint" ? value.toString() : value,
      ),
    );
  }
}
