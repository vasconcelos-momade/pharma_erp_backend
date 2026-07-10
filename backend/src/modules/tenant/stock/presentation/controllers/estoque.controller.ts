import {
  EstoqueDashboardUseCase,
  SearchEstoqueUseCase,
} from "../../application/use-cases/estoque/search-estoque.use-case";
import { searchEstoqueQuerySchema } from "../../application/dto/estoque.dto";
import { parseSearchParams } from "../../../../../shared/http/request-validation";
import { controllerErrorResponse } from "../../../../../shared/http/controller-error";

export class EstoqueController {
  private dashboardUseCase = new EstoqueDashboardUseCase();
  private searchUseCase = new SearchEstoqueUseCase();

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

  private serialize(data: any) {
    return JSON.parse(
      JSON.stringify(data, (_key, value) =>
        typeof value === "bigint" ? value.toString() : value,
      ),
    );
  }
}
