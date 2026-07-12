import {
  LotesDashboardUseCase,
  SearchLotesUseCase,
} from "../../application/use-cases/lotes/search-lotes.use-case";
import { GetLoteDetailUseCase } from "../../application/use-cases/lotes/get-lote-detail.use-case";
import {
  ValidadesDashboardUseCase,
  SearchValidadesUseCase,
} from "../../application/use-cases/lotes/validades.use-case";
import {
  FefoDashboardUseCase,
  SearchFefoOverviewUseCase,
  SearchFefoAuditUseCase,
} from "../../application/use-cases/lotes/fefo.use-case";
import {
  ListLoteMovimentosUseCase,
  ListLoteReservasUseCase,
  ListLoteDispensacoesUseCase,
  ListLoteIncineracoesUseCase,
  ListProductPriceHistoryUseCase,
} from "../../application/use-cases/lotes/lote-detail-lists.use-case";
import {
  MoveLoteToQuarentenaUseCase,
  RevertLoteQuarentenaUseCase,
} from "../../application/use-cases/lotes/lote-quarentena.use-case";
import { UpdateLotePrecosUseCase } from "../../application/use-cases/lotes/update-lote-precos.use-case";
import { UpdateLoteUseCase } from "../../application/use-cases/lotes/update-lote.use-case";
import { LoteMovimentacaoSanitariaUseCase } from "../../application/use-cases/lotes/lote-movimentacao-sanitaria.use-case";
import { CreateLoteUseCase } from "../../application/use-cases/lotes/create-lote.use-case";
import { ListProductLotsUseCase } from "../../application/use-cases/lotes/list-product-lots.use-case";
import { SearchStockProdutosUseCase } from "../../application/use-cases/lotes/search-stock-produtos.use-case";
import {
  searchLotesQuerySchema,
  searchValidadesQuerySchema,
  searchFefoAuditQuerySchema,
  listProductPriceHistoryQuerySchema,
  moveLoteQuarentenaBodySchema,
  revertLoteQuarentenaBodySchema,
  updateLotePrecosBodySchema,
  updateLoteBodySchema,
  loteMovimentacaoSanitariaBodySchema,
  createLoteSchema,
  searchStockProdutosQuerySchema,
} from "../../application/dto/lotes.dto";
import { parseSearchParams, parseJsonBody } from "../../../../../shared/http/request-validation";
import { controllerErrorResponse } from "../../../../../shared/http/controller-error";
import { z } from "zod";

export class LotesController {
  private lotesDashboardUseCase = new LotesDashboardUseCase();
  private searchLotesUseCase = new SearchLotesUseCase();
  private getLoteDetailUseCase = new GetLoteDetailUseCase();
  private validadesDashboardUseCase = new ValidadesDashboardUseCase();
  private searchValidadesUseCase = new SearchValidadesUseCase();
  private fefoDashboardUseCase = new FefoDashboardUseCase();
  private searchFefoOverviewUseCase = new SearchFefoOverviewUseCase();
  private searchFefoAuditUseCase = new SearchFefoAuditUseCase();
  private listLoteMovimentosUseCase = new ListLoteMovimentosUseCase();
  private listLoteReservasUseCase = new ListLoteReservasUseCase();
  private listLoteDispensacoesUseCase = new ListLoteDispensacoesUseCase();
  private listLoteIncineracoesUseCase = new ListLoteIncineracoesUseCase();
  private listProductPriceHistoryUseCase = new ListProductPriceHistoryUseCase();
  private moveLoteToQuarentenaUseCase = new MoveLoteToQuarentenaUseCase();
  private revertLoteQuarentenaUseCase = new RevertLoteQuarentenaUseCase();
  private updateLotePrecosUseCase = new UpdateLotePrecosUseCase();
  private updateLoteUseCase = new UpdateLoteUseCase();
  private loteMovimentacaoSanitariaUseCase = new LoteMovimentacaoSanitariaUseCase();
  private createLoteUseCase = new CreateLoteUseCase();
  private listProductLotsUseCase = new ListProductLotsUseCase();
  private searchStockProdutosUseCase = new SearchStockProdutosUseCase();

  private extractLoteId(req: Request): string {
    const parts = new URL(req.url).pathname.split("/");
    return parts[parts.indexOf("lotes") + 1];
  }

  async search(req: Request) {
    try {
      const url = new URL(req.url);
      const query = parseSearchParams(url, searchLotesQuerySchema);
      const result = await this.searchLotesUseCase.execute(query);
      return Response.json(this.serialize(result));
    } catch (error: any) {
      return controllerErrorResponse(error);
    }
  }

  async dashboard(_req: Request) {
    try {
      const result = await this.lotesDashboardUseCase.execute();
      return Response.json(this.serialize(result));
    } catch (error: any) {
      return controllerErrorResponse(error);
    }
  }

  async get(req: Request) {
    try {
      const loteId = req.url.split("/").filter(Boolean).pop()!;
      const result = await this.getLoteDetailUseCase.execute(loteId);
      return Response.json(this.serialize(result));
    } catch (error: any) {
      return controllerErrorResponse(error, 404);
    }
  }

  async validadesDashboard(_req: Request) {
    try {
      const result = await this.validadesDashboardUseCase.execute();
      return Response.json(this.serialize(result));
    } catch (error: any) {
      return controllerErrorResponse(error);
    }
  }

  async searchValidades(req: Request) {
    try {
      const url = new URL(req.url);
      const query = parseSearchParams(url, searchValidadesQuerySchema);
      const result = await this.searchValidadesUseCase.execute(query);
      return Response.json(this.serialize(result));
    } catch (error: any) {
      return controllerErrorResponse(error);
    }
  }

  async fefoDashboard(_req: Request) {
    try {
      const result = await this.fefoDashboardUseCase.execute();
      return Response.json(this.serialize(result));
    } catch (error: any) {
      return controllerErrorResponse(error);
    }
  }

  async searchFefoOverview(req: Request) {
    try {
      const url = new URL(req.url);
      const query = parseSearchParams(
        url,
        z.object({
          q: z.string().optional(),
          produtoId: z.string().optional(),
          page: z.coerce.number().optional(),
          pageSize: z.coerce.number().optional(),
        }),
      );
      const result = await this.searchFefoOverviewUseCase.execute(query);
      return Response.json(this.serialize(result));
    } catch (error: any) {
      return controllerErrorResponse(error);
    }
  }

  async searchFefoAudit(req: Request) {
    try {
      const url = new URL(req.url);
      const query = parseSearchParams(url, searchFefoAuditQuerySchema);
      const result = await this.searchFefoAuditUseCase.execute(query);
      return Response.json(this.serialize(result));
    } catch (error: any) {
      return controllerErrorResponse(error);
    }
  }

  async listMovimentos(req: Request) {
    try {
      const parts = new URL(req.url).pathname.split("/");
      const loteId = parts[parts.indexOf("lotes") + 1];
      const url = new URL(req.url);
      const page = Number(url.searchParams.get("page") ?? "1");
      const pageSize = Number(url.searchParams.get("pageSize") ?? "20");
      const result = await this.listLoteMovimentosUseCase.execute(loteId, page, pageSize);
      return Response.json(this.serialize(result));
    } catch (error: any) {
      return controllerErrorResponse(error);
    }
  }

  async listReservas(req: Request) {
    try {
      const parts = new URL(req.url).pathname.split("/");
      const loteId = parts[parts.indexOf("lotes") + 1];
      const result = await this.listLoteReservasUseCase.execute(loteId);
      return Response.json(this.serialize(result));
    } catch (error: any) {
      return controllerErrorResponse(error);
    }
  }

  async listDispensacoes(req: Request) {
    try {
      const parts = new URL(req.url).pathname.split("/");
      const loteId = parts[parts.indexOf("lotes") + 1];
      const result = await this.listLoteDispensacoesUseCase.execute(loteId);
      return Response.json(this.serialize(result));
    } catch (error: any) {
      return controllerErrorResponse(error);
    }
  }

  async listIncineracoes(req: Request) {
    try {
      const parts = new URL(req.url).pathname.split("/");
      const loteId = parts[parts.indexOf("lotes") + 1];
      const result = await this.listLoteIncineracoesUseCase.execute(loteId);
      return Response.json(this.serialize(result));
    } catch (error: any) {
      return controllerErrorResponse(error);
    }
  }

  async listProductPriceHistory(req: Request) {
    try {
      const parts = new URL(req.url).pathname.split("/");
      const productId = parts[parts.indexOf("produtos") + 1];
      const url = new URL(req.url);
      const { page, pageSize } = parseSearchParams(
        url,
        listProductPriceHistoryQuerySchema,
      );
      const result = await this.listProductPriceHistoryUseCase.execute(
        productId,
        page,
        pageSize,
      );
      return Response.json(this.serialize(result));
    } catch (error: any) {
      return controllerErrorResponse(error);
    }
  }

  async moveToQuarentena(req: Request, userId: string) {
    try {
      const loteId = this.extractLoteId(req);
      const body = await parseJsonBody(req, moveLoteQuarentenaBodySchema);
      const result = await this.moveLoteToQuarentenaUseCase.execute({
        loteId,
        quantidade: body.quantidade,
        motivo: body.motivo,
        userId,
        documentoReferencia: body.documentoReferencia,
      });
      return Response.json(this.serialize(result));
    } catch (error: any) {
      return controllerErrorResponse(error);
    }
  }

  async revertQuarentena(req: Request, userId: string) {
    try {
      const loteId = this.extractLoteId(req);
      const body = await parseJsonBody(req, revertLoteQuarentenaBodySchema);
      const result = await this.revertLoteQuarentenaUseCase.execute({
        loteId,
        quantidade: body.quantidade,
        motivo: body.motivo,
        userId,
        documentoReferencia: body.documentoReferencia,
      });
      return Response.json(this.serialize(result));
    } catch (error: any) {
      return controllerErrorResponse(error);
    }
  }

  async updatePrecos(req: Request, userId: string) {
    try {
      const loteId = this.extractLoteId(req);
      const body = await parseJsonBody(req, updateLotePrecosBodySchema);
      const result = await this.updateLotePrecosUseCase.execute({
        loteId,
        precoCompra: body.precoCompra,
        precoVenda: body.precoVenda,
        motivo: body.motivo,
        userId,
      });
      return Response.json(this.serialize(result));
    } catch (error: any) {
      return controllerErrorResponse(error);
    }
  }

  async update(req: Request, userId: string) {
    try {
      const loteId = this.extractLoteId(req);
      const body = await parseJsonBody(req, updateLoteBodySchema);
      const result = await this.updateLoteUseCase.execute({
        loteId,
        numeroLote: body.numeroLote,
        dataValidade: body.dataValidade,
        dataFabricacao: body.dataFabricacao,
        userId,
      });
      return Response.json(this.serialize(result));
    } catch (error: any) {
      return controllerErrorResponse(error);
    }
  }

  async movimentacaoSanitaria(req: Request, userId: string) {
    try {
      const loteId = this.extractLoteId(req);
      const body = await parseJsonBody(req, loteMovimentacaoSanitariaBodySchema);
      const result = await this.loteMovimentacaoSanitariaUseCase.execute({
        loteId,
        tipo: body.tipo,
        quantidade: body.quantidade,
        motivo: body.motivo,
        userId,
        documentoReferencia: body.documentoReferencia,
      });
      return Response.json(this.serialize(result));
    } catch (error: any) {
      return controllerErrorResponse(error);
    }
  }

  async createLote(req: Request, userId: string) {
    try {
      const body = await parseJsonBody(req, createLoteSchema);
      const result = await this.createLoteUseCase.execute({ ...body, userId });
      return Response.json(this.serialize(result), { status: 201 });
    } catch (error: any) {
      return controllerErrorResponse(error);
    }
  }

  async listProductLots(req: Request) {
    try {
      const parts = new URL(req.url).pathname.split("/");
      const produtoId = parts[parts.indexOf("produtos") + 1];
      const result = await this.listProductLotsUseCase.execute(produtoId);
      return Response.json(this.serialize(result));
    } catch (error: any) {
      return controllerErrorResponse(error);
    }
  }

  async searchProdutos(req: Request) {
    try {
      const url = new URL(req.url);
      const params = parseSearchParams(url, searchStockProdutosQuerySchema);
      const result = await this.searchStockProdutosUseCase.execute({
        q: params.q ?? params.barcode,
        categoriaId: params.categoriaId ? BigInt(params.categoriaId) : undefined,
        page: params.page,
        pageSize: params.pageSize,
      });
      return Response.json(this.serialize(result));
    } catch (error: any) {
      return controllerErrorResponse(error, 500);
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
