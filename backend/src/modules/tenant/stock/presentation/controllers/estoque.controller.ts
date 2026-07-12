import {
  EstoqueDashboardUseCase,
  SearchEstoqueUseCase,
} from "../../application/use-cases/estoque/search-estoque.use-case";
import { EntradaCompraUseCase } from "../../application/use-cases/estoque/entrada-compra.use-case";
import { entradaCompraBodySchema, searchEstoqueQuerySchema } from "../../application/dto/estoque.dto";
import { parseSearchParams, parseJsonBody } from "../../../../../shared/http/request-validation";
import { controllerErrorResponse } from "../../../../../shared/http/controller-error";

export class EstoqueController {
  private dashboardUseCase = new EstoqueDashboardUseCase();
  private searchUseCase = new SearchEstoqueUseCase();
  private entradaCompraUseCase = new EntradaCompraUseCase();

  async dashboard(_req: Request) {
    try {
      const result = await this.dashboardUseCase.execute();
      return Response.json(this.serialize(result));
    } catch (error: any) {
      return controllerErrorResponse(error);
    }
  }

  async search(req: Request) {
    try {
      const url = new URL(req.url);
      const query = parseSearchParams(url, searchEstoqueQuerySchema);
      const result = await this.searchUseCase.execute(query);
      return Response.json(this.serialize(result));
    } catch (error: any) {
      return controllerErrorResponse(error);
    }
  }

  async entradaCompra(req: Request, userId: string) {
    try {
      const body = await parseJsonBody(req, entradaCompraBodySchema);
      const result = await this.entradaCompraUseCase.execute({ ...body, userId });
      return Response.json(this.serialize(result), { status: 201 });
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
