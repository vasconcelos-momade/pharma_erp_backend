import {
  parseJsonBody,
  parseSearchParams,
} from "../../../../../shared/http/request-validation";
import { controllerErrorResponse } from "../../../../../shared/http/controller-error";
import {
  createReceitaSchema,
  listLivroPsicotropicosQuerySchema,
  listLivroReceitasQuerySchema,
  listReceitasQuerySchema,
  receitasDashboardQuerySchema,
  listSanitarioQuerySchema,
  listSanitarioReportsQuerySchema,
  sanitarioDashboardQuerySchema,
  updateReceitaSchema,
} from "../../application/dto/regulatory.dto";
import {
  CreateReceitaUseCase,
  DeleteReceitaUseCase,
  GetReceitaDetailUseCase,
  ListReceitasUseCase,
  ReceitasDashboardUseCase,
  UpdateReceitaUseCase,
} from "../../application/use-cases/receitas.use-case";
import {
  GetLivroReceitaDetailUseCase,
  LivroReceitasDashboardUseCase,
  ListLivroReceitasUseCase,
} from "../../application/use-cases/livro-receitas.use-case";
import {
  GetLivroPsicotropicoDetailUseCase,
  LivroPsicotropicosDashboardUseCase,
  ListLivroPsicotropicosUseCase,
} from "../../application/use-cases/livro-psicotropicos.use-case";
import {
  GetLoteSanitarioHistoryUseCase,
  ListSanitarioReportsUseCase,
  ListSanitarioUseCase,
  SanitarioDashboardUseCase,
} from "../../application/use-cases/sanitario.use-case";

export class RegulatoryController {
  private receitasDashboardUseCase = new ReceitasDashboardUseCase();
  private listReceitasUseCase = new ListReceitasUseCase();
  private getReceitaDetailUseCase = new GetReceitaDetailUseCase();
  private createReceitaUseCase = new CreateReceitaUseCase();
  private updateReceitaUseCase = new UpdateReceitaUseCase();
  private deleteReceitaUseCase = new DeleteReceitaUseCase();

  private livroReceitasDashboardUseCase = new LivroReceitasDashboardUseCase();
  private listLivroReceitasUseCase = new ListLivroReceitasUseCase();
  private getLivroReceitaDetailUseCase = new GetLivroReceitaDetailUseCase();

  private livroPsicotropicosDashboardUseCase = new LivroPsicotropicosDashboardUseCase();
  private listLivroPsicotropicosUseCase = new ListLivroPsicotropicosUseCase();
  private getLivroPsicotropicoDetailUseCase = new GetLivroPsicotropicoDetailUseCase();

  private sanitarioDashboardUseCase = new SanitarioDashboardUseCase();
  private listSanitarioUseCase = new ListSanitarioUseCase();
  private getLoteSanitarioHistoryUseCase = new GetLoteSanitarioHistoryUseCase();
  private listSanitarioReportsUseCase = new ListSanitarioReportsUseCase();

  async receitasDashboard(req: Request) {
    try {
      const query = parseSearchParams(
        new URL(req.url),
        receitasDashboardQuerySchema,
      );
      return Response.json(await this.receitasDashboardUseCase.execute(query));
    } catch (error: any) {
      return controllerErrorResponse(error);
    }
  }

  async listReceitas(req: Request) {
    try {
      const query = parseSearchParams(new URL(req.url), listReceitasQuerySchema);
      return Response.json(await this.listReceitasUseCase.execute(query));
    } catch (error: any) {
      return controllerErrorResponse(error);
    }
  }

  async getReceita(receitaId: string) {
    try {
      return Response.json(await this.getReceitaDetailUseCase.execute(receitaId));
    } catch (error: any) {
      return controllerErrorResponse(error);
    }
  }

  async createReceita(req: Request) {
    try {
      const body = await parseJsonBody(req, createReceitaSchema);
      return Response.json(await this.createReceitaUseCase.execute(body), {
        status: 201,
      });
    } catch (error: any) {
      return controllerErrorResponse(error);
    }
  }

  async updateReceita(receitaId: string, req: Request) {
    try {
      const body = await parseJsonBody(req, updateReceitaSchema);
      return Response.json(await this.updateReceitaUseCase.execute(receitaId, body));
    } catch (error: any) {
      return controllerErrorResponse(error);
    }
  }

  async deleteReceita(receitaId: string) {
    try {
      return Response.json(await this.deleteReceitaUseCase.execute(receitaId));
    } catch (error: any) {
      return controllerErrorResponse(error);
    }
  }

  async livroReceitasDashboard(req: Request) {
    try {
      const query = parseSearchParams(
        new URL(req.url),
        listLivroReceitasQuerySchema.partial(),
      );
      return Response.json(await this.livroReceitasDashboardUseCase.execute(query));
    } catch (error: any) {
      return controllerErrorResponse(error);
    }
  }

  async listLivroReceitas(req: Request) {
    try {
      const query = parseSearchParams(
        new URL(req.url),
        listLivroReceitasQuerySchema,
      );
      return Response.json(await this.listLivroReceitasUseCase.execute(query));
    } catch (error: any) {
      return controllerErrorResponse(error);
    }
  }

  async getLivroReceita(entryId: string) {
    try {
      return Response.json(await this.getLivroReceitaDetailUseCase.execute(entryId));
    } catch (error: any) {
      return controllerErrorResponse(error);
    }
  }

  async livroPsicotropicosDashboard(req: Request) {
    try {
      const query = parseSearchParams(
        new URL(req.url),
        listLivroPsicotropicosQuerySchema.partial(),
      );
      return Response.json(
        await this.livroPsicotropicosDashboardUseCase.execute(query),
      );
    } catch (error: any) {
      return controllerErrorResponse(error);
    }
  }

  async listLivroPsicotropicos(req: Request) {
    try {
      const query = parseSearchParams(
        new URL(req.url),
        listLivroPsicotropicosQuerySchema,
      );
      return Response.json(await this.listLivroPsicotropicosUseCase.execute(query));
    } catch (error: any) {
      return controllerErrorResponse(error);
    }
  }

  async getLivroPsicotropico(entryId: string) {
    try {
      return Response.json(
        await this.getLivroPsicotropicoDetailUseCase.execute(entryId),
      );
    } catch (error: any) {
      return controllerErrorResponse(error);
    }
  }

  async sanitarioDashboard(req: Request) {
    try {
      const query = parseSearchParams(
        new URL(req.url),
        sanitarioDashboardQuerySchema,
      );
      return Response.json(await this.sanitarioDashboardUseCase.execute(query));
    } catch (error: any) {
      return controllerErrorResponse(error);
    }
  }

  async listSanitario(req: Request) {
    try {
      const query = parseSearchParams(new URL(req.url), listSanitarioQuerySchema);
      return Response.json(await this.listSanitarioUseCase.execute(query));
    } catch (error: any) {
      return controllerErrorResponse(error);
    }
  }

  async getSanitarioLoteHistory(loteId: string) {
    try {
      return Response.json(await this.getLoteSanitarioHistoryUseCase.execute(loteId));
    } catch (error: any) {
      return controllerErrorResponse(error);
    }
  }

  async listSanitarioReports(req: Request) {
    try {
      const query = parseSearchParams(
        new URL(req.url),
        listSanitarioReportsQuerySchema,
      );
      return Response.json(await this.listSanitarioReportsUseCase.execute(query));
    } catch (error: any) {
      return controllerErrorResponse(error);
    }
  }
}
