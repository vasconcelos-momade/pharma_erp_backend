/// <reference lib="dom" />
import { SearchProdutosUseCase } from "../../application/use-cases/search-produtos.use-case";
import { SearchServicosUseCase } from "../../application/use-cases/search-servicos.use-case";
import { ValidarDispensacaoUseCase } from "../../application/use-cases/validar-dispensacao.use-case";
import { FinalizarVendaUseCase } from "../../application/use-cases/finalizar-venda.use-case";
import { AnularFaturaUseCase } from "../../application/use-cases/anular-fatura.use-case";
import { AbrirSessaoCaixaUseCase } from "../../application/use-cases/abrir-sessao-caixa.use-case";
import { FecharSessaoCaixaUseCase } from "../../application/use-cases/fechar-sessao-caixa.use-case";
import { CreateDraftSaleUseCase } from "../../application/use-cases/create-draft-sale.use-case";
import { GetDraftCartUseCase } from "../../application/use-cases/get-draft-cart.use-case";
import { AddDraftCartItemUseCase } from "../../application/use-cases/add-draft-cart-item.use-case";
import { IncrementDraftCartItemUseCase } from "../../application/use-cases/increment-draft-cart-item.use-case";
import { DecrementDraftCartItemUseCase } from "../../application/use-cases/decrement-draft-cart-item.use-case";
import { RemoveDraftCartItemUseCase } from "../../application/use-cases/remove-draft-cart-item.use-case";
import { LiquidarConvenioUseCase } from "../../application/use-cases/liquidar-convenio.use-case";
import { RelatorioDiferencaCaixaUseCase } from "../../application/use-cases/relatorio-diferenca-caixa.use-case";
import { ListTaxRulesUseCase } from "../../application/use-cases/list-tax-rules.use-case";
import { GetCurrentCaixaSessaoUseCase } from "../../application/use-cases/get-current-caixa-sessao.use-case";
import { ListAvailableCaixasUseCase } from "../../application/use-cases/list-available-caixas.use-case";
import { GetCatalogVersionUseCase } from "../../application/use-cases/get-catalog-version.use-case";
import { ListFaturasUseCase } from "../../application/use-cases/list-faturas.use-case";
import { GetFaturaDetalheUseCase } from "../../application/use-cases/get-fatura-detalhe.use-case";
import { GetFaturaPdfUseCase } from "../../application/use-cases/get-fatura-pdf.use-case";
import { GetFaturaPrintUseCase } from "../../application/use-cases/get-fatura-print.use-case";
import { z } from "zod";
import {
  getValidationErrorMessage,
  parseJsonBody,
  parseSearchParams,
} from "../../../../../shared/http/request-validation";

const validarDispensacaoSchema = z.object({
  produtoId: z.string().trim().min(1),
  quantidade: z.coerce.number().positive(),
});

const receitaSchema = z.object({
  numero: z.string().trim().min(1).optional(),
  medicoNome: z.string().trim().min(1).optional(),
  prescritor: z.string().trim().min(1).optional(),
  unidadeSanitaria: z.string().trim().min(1).optional(),
});

const pacienteSchema = z.object({
  nome: z.string().trim().min(1),
  idade: z.coerce.number().int().positive(),
  nid: z.string().trim().min(1),
});

const finalizarVendaSchema = z.object({
  clienteId: z.string().trim().min(1).optional(),
  terminalId: z.string().trim().min(1),
  idempotencyKey: z.string().trim().min(1).optional(),
  validatorUserId: z.string().trim().min(1).optional(),
  metodoPagamento: z.enum(["DINHEIRO", "CARTAO", "TRANSFERENCIA", "CARTEIRA_MOVEL", "EMOLA", "MPESA"]),
  paciente: pacienteSchema.optional(),
  receita: receitaSchema.optional(),
  items: z.array(z.object({
    tipo: z.enum(["produto", "servico"]),
    produtoId: z.string().trim().min(1).optional(),
    servicoId: z.string().trim().min(1).optional(),
    quantidade: z.coerce.number().positive(),
    receita: receitaSchema.optional(),
  })).min(1),
});

const anularFaturaSchema = z.object({
  motivo: z.string().trim().min(1),
  observacoes: z.string().trim().min(1).optional(),
});

const abrirSessaoSchema = z.object({
  caixaId: z.string().trim().min(1),
  valorAbertura: z.coerce.number().nonnegative(),
});

const fecharSessaoSchema = z.object({
  sessaoId: z.string().trim().min(1),
  valorContado: z.coerce.number().nonnegative(),
  observacoes: z.string().trim().min(1).optional(),
});

const createDraftSaleSchema = z.object({
  clienteId: z.string().trim().min(1).optional(),
  terminalId: z.string().trim().min(1).optional(),
  idempotencyKey: z.string().trim().min(1),
  items: z.array(z.object({
    produtoId: z.string().trim().min(1),
    loteId: z.string().trim().min(1).optional(),
    quantidade: z.coerce.number().positive(),
  })).min(1),
});

const draftCartContextSchema = z.object({
  idempotencyKey: z.string().trim().min(1),
  clienteId: z.string().trim().min(1).optional(),
  terminalId: z.string().trim().min(1).optional(),
});

const draftCartItemSchema = z
  .object({
    idempotencyKey: z.string().trim().min(1),
    produtoId: z.string().trim().min(1).optional(),
    servicoId: z.string().trim().min(1).optional(),
    loteId: z.string().trim().min(1).optional(),
    quantidade: z.coerce.number().positive().optional(),
    clienteId: z.string().trim().min(1).optional(),
    terminalId: z.string().trim().min(1).optional(),
  })
  .refine((data) => {
    const payload = data as { produtoId?: string; servicoId?: string };
    return Boolean(payload.produtoId) !== Boolean(payload.servicoId);
  }, {
    message: "Informe produtoId ou servicoId (apenas um).",
  });

const draftCartQuerySchema = z.object({
  idempotencyKey: z.string().trim().min(1),
});

const liquidarConvenioSchema = z.object({
  empresaId: z.string().trim().min(1),
  caixaId: z.string().trim().min(1),
  valorPagamento: z.coerce.number().positive(),
  metodoPagamento: z.enum(["TRANSFERENCIA", "DINHEIRO", "CARTAO"]),
  referencia: z.string().trim().min(1).optional(),
});

const searchProdutosQuerySchema = z.object({
  q: z.string().trim().min(1).optional(),
  barcode: z.string().trim().min(1).optional(),
  page: z.coerce.number().int().positive().optional(),
  pageSize: z.coerce.number().int().positive().max(100).optional(),
});

const searchServicosQuerySchema = z.object({
  q: z.string().trim().min(1).optional(),
});

const listFaturasQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  pageSize: z.coerce.number().int().positive().max(100).optional(),
  search: z.string().trim().min(1).optional(),
  clienteId: z.string().trim().regex(/^\d+$/, "clienteId inválido").optional(),
  status: z.enum(["RASCUNHO", "EMITIDA", "PAGA", "PARCIAL", "ANULADA"]).optional(),
  dateFrom: z.string().trim().min(1).optional(),
  dateTo: z.string().trim().min(1).optional(),
  terminalId: z.string().trim().regex(/^\d+$/, "terminalId inválido").optional(),
  userId: z.string().trim().regex(/^\d+$/, "userId inválido").optional(),
});

const relatorioDiferencaQuerySchema = z.object({
  sessaoId: z.string().trim().min(1),
});

type ValidarDispensacaoBody = {
  produtoId: string;
  quantidade: number;
};

type FinalizarVendaBody = {
  clienteId?: string;
  terminalId: string;
  idempotencyKey?: string;
  validatorUserId?: string;
  metodoPagamento: "DINHEIRO" | "CARTAO" | "TRANSFERENCIA" | "CARTEIRA_MOVEL" | "EMOLA" | "MPESA";
  paciente?: {
    nome: string;
    idade: number;
    nid: string;
  };
  receita?: {
    numero?: string;
    medicoNome?: string;
    prescritor?: string;
    unidadeSanitaria?: string;
  };
  items: {
    tipo: "produto" | "servico";
    produtoId?: string;
    servicoId?: string;
    quantidade: number;
    receita?: {
      numero?: string;
      medicoNome?: string;
      prescritor?: string;
      unidadeSanitaria?: string;
    };
  }[];
};

type AnularFaturaBody = {
  motivo: string;
  observacoes?: string;
};

type AbrirSessaoBody = {
  caixaId: string;
  valorAbertura: number;
};

type FecharSessaoBody = {
  sessaoId: string;
  valorContado: number;
  observacoes?: string;
};

type CreateDraftSaleBody = {
  clienteId?: string;
  terminalId?: string;
  idempotencyKey: string;
  items: {
    produtoId: string;
    loteId?: string;
    quantidade: number;
  }[];
};

type DraftCartContextBody = {
  idempotencyKey: string;
  clienteId?: string;
  terminalId?: string;
};

type DraftCartItemBody = {
  idempotencyKey: string;
  produtoId?: string;
  servicoId?: string;
  loteId?: string;
  quantidade?: number;
  clienteId?: string;
  terminalId?: string;
};

type LiquidarConvenioBody = {
  empresaId: string;
  caixaId: string;
  valorPagamento: number;
  metodoPagamento: "TRANSFERENCIA" | "DINHEIRO" | "CARTAO";
  referencia?: string;
};

type SearchProdutosQuery = {
  q?: string;
  barcode?: string;
  page?: number;
  pageSize?: number;
};

type SearchServicosQuery = {
  q?: string;
};

type ListFaturasQuery = {
  page?: number;
  pageSize?: number;
  search?: string;
  clienteId?: string;
  status?: "RASCUNHO" | "EMITIDA" | "PAGA" | "PARCIAL" | "ANULADA";
  dateFrom?: string;
  dateTo?: string;
  terminalId?: string;
  userId?: string;
};

type DraftCartQuery = {
  idempotencyKey: string;
};

type RelatorioDiferencaQuery = {
  sessaoId: string;
};

export class POSController {
  private searchProdutosUseCase = new SearchProdutosUseCase();
  private searchServicosUseCase = new SearchServicosUseCase();
  private validarDispensacaoUseCase = new ValidarDispensacaoUseCase();
  private finalizarVendaUseCase = new FinalizarVendaUseCase();
  private anularFaturaUseCase = new AnularFaturaUseCase();
  private abrirSessaoUseCase = new AbrirSessaoCaixaUseCase();
  private fecharSessaoUseCase = new FecharSessaoCaixaUseCase();
  private createDraftSaleUseCase = new CreateDraftSaleUseCase();
  private getDraftCartUseCase = new GetDraftCartUseCase();
  private addDraftCartItemUseCase = new AddDraftCartItemUseCase();
  private incrementDraftCartItemUseCase = new IncrementDraftCartItemUseCase();
  private decrementDraftCartItemUseCase = new DecrementDraftCartItemUseCase();
  private removeDraftCartItemUseCase = new RemoveDraftCartItemUseCase();
  private liquidarConvenioUseCase = new LiquidarConvenioUseCase();
  private relatorioDiferencaCaixaUseCase = new RelatorioDiferencaCaixaUseCase();
  private listTaxRulesUseCase = new ListTaxRulesUseCase();
  private getCurrentCaixaSessaoUseCase = new GetCurrentCaixaSessaoUseCase();
  private listAvailableCaixasUseCase = new ListAvailableCaixasUseCase();
  private getCatalogVersionUseCase = new GetCatalogVersionUseCase();
  private listFaturasUseCase = new ListFaturasUseCase();
  private getFaturaDetalheUseCase = new GetFaturaDetalheUseCase();
  private getFaturaPdfUseCase = new GetFaturaPdfUseCase();
  private getFaturaPrintUseCase = new GetFaturaPrintUseCase();

  async getCatalogVersion() {
    const result = await this.getCatalogVersionUseCase.execute();
    return Response.json({ success: true, data: result });
  }

  async searchProdutos(req: Request) {
    const url = new URL(req.url);
    const { q, barcode, page = 1, pageSize = 20 } = parseSearchParams<SearchProdutosQuery>(
      url,
      searchProdutosQuerySchema,
    );

    const result = await this.searchProdutosUseCase.execute({
      query: q,
      barcode,
      page,
      pageSize,
    });
    const { catalogVersion, productCount, maxUpdatedAt, ...pageData } = result;
    return Response.json(
      this.serialize({
        success: true,
        data: pageData,
        meta: { catalogVersion, productCount, maxUpdatedAt },
      }),
    );
  }

  async searchServicos(req: Request) {
    const url = new URL(req.url);
    const { q } = parseSearchParams<SearchServicosQuery>(url, searchServicosQuerySchema);
    
    const result = await this.searchServicosUseCase.execute(q);
    return Response.json(this.serialize(result));
  }

  async listFaturas(req: Request) {
    try {
      const url = new URL(req.url);
      const query = listFaturasQuerySchema.parse({
        page: url.searchParams.get("page") ?? undefined,
        pageSize: url.searchParams.get("pageSize") ?? undefined,
        search: url.searchParams.get("search") ?? undefined,
        clienteId: url.searchParams.get("clienteId") ?? undefined,
        status: url.searchParams.get("status") ?? undefined,
        dateFrom: url.searchParams.get("dateFrom") ?? undefined,
        dateTo: url.searchParams.get("dateTo") ?? undefined,
        terminalId: url.searchParams.get("terminalId") ?? undefined,
        userId: url.searchParams.get("userId") ?? undefined,
      }) as ListFaturasQuery;
      const result = await this.listFaturasUseCase.execute(query);

      return Response.json(
        this.serialize({
          success: true,
          data: result.items,
          meta: {
            page: result.page,
            pageSize: result.pageSize,
            total: result.total,
            hasMore: result.hasMore,
          },
        }),
      );
    } catch (error: any) {
      return Response.json({ error: getValidationErrorMessage(error) }, { status: 400 });
    }
  }

  async getFaturaDetalhe(saleId: string, userId: string) {
    try {
      const result = await this.getFaturaDetalheUseCase.execute(saleId, userId);
      return Response.json(
        this.serialize({
          success: true,
          data: result,
        }),
      );
    } catch (error: any) {
      const message = getValidationErrorMessage(error);
      const status =
        message === "Fatura não encontrada."
          ? 404
          : message === "Sem permissão para consultar a fatura."
            ? 403
            : 400;
      return Response.json({ error: message }, { status });
    }
  }

  async getFaturaPdf(saleId: string, userId: string) {
    try {
      return await this.getFaturaPdfUseCase.execute(saleId, userId);
    } catch (error: any) {
      const message = getValidationErrorMessage(error);
      const status =
        message === "Fatura não encontrada."
          ? 404
          : message === "Sem permissão para consultar a fatura."
            ? 403
            : 400;
      return Response.json({ error: message }, { status });
    }
  }

  async getFaturaPrint(saleId: string, userId: string) {
    try {
      const result = await this.getFaturaPrintUseCase.execute(saleId, userId);
      return Response.json(
        this.serialize({
          success: true,
          data: result,
        }),
      );
    } catch (error: any) {
      const message = getValidationErrorMessage(error);
      const status =
        message === "Fatura não encontrada."
          ? 404
          : message === "Sem permissão para consultar a fatura."
            ? 403
            : 400;
      return Response.json({ error: message }, { status });
    }
  }

  async validarDispensacao(req: Request) {
    try {
      const body = await parseJsonBody<ValidarDispensacaoBody>(req, validarDispensacaoSchema);
      const result = await this.validarDispensacaoUseCase.execute(body);
      return Response.json(this.serialize(result));
    } catch (error: any) {
      return Response.json({ error: getValidationErrorMessage(error) }, { status: 400 });
    }
  }

  async finalizarVenda(req: Request, userId: string) {
    try {
      const body = await parseJsonBody<FinalizarVendaBody>(req, finalizarVendaSchema);
      const result = await this.finalizarVendaUseCase.execute({
        ...body,
        userId,
      });
      return Response.json(
        this.serialize({ success: true, data: result }),
        { status: 201 },
      );
    } catch (error: any) {
      console.error("Erro ao finalizar venda:", error);
      return Response.json({ error: getValidationErrorMessage(error) }, { status: 400 });
    }
  }

  async anularFatura(req: Request, userId: string, faturaId: string) {
    try {
      const body = await parseJsonBody<AnularFaturaBody>(req, anularFaturaSchema);
      const result = await this.anularFaturaUseCase.execute({
        faturaId,
        userId,
        motivo: body.motivo,
        observacoes: body.observacoes
      });
      return Response.json(this.serialize(result));
    } catch (error: any) {
      console.error("Erro ao anular fatura:", error);
      return Response.json({ error: getValidationErrorMessage(error) }, { status: 400 });
    }
  }

  async abrirSessao(req: Request, userId: string) {
    try {
      const body = await parseJsonBody<AbrirSessaoBody>(req, abrirSessaoSchema);
      const result = await this.abrirSessaoUseCase.execute({
        ...body,
        userId
      });
      return Response.json(this.serialize(result), { status: 201 });
    } catch (error: any) {
      return Response.json({ error: getValidationErrorMessage(error) }, { status: 400 });
    }
  }

  async fecharSessao(req: Request, userId: string) {
    try {
      const body = await parseJsonBody<FecharSessaoBody>(req, fecharSessaoSchema);
      const result = await this.fecharSessaoUseCase.execute({
        ...body,
        userId
      });
      return Response.json(this.serialize(result));
    } catch (error: any) {
      return Response.json({ error: getValidationErrorMessage(error) }, { status: 400 });
    }
  }

  async getSessaoAtual(userId: string) {
    try {
      const result = await this.getCurrentCaixaSessaoUseCase.execute(userId);
      return Response.json(this.serialize(result));
    } catch (error: any) {
      return Response.json({ error: error.message }, { status: 400 });
    }
  }

  async listAvailableCaixas() {
    try {
      const result = await this.listAvailableCaixasUseCase.execute();
      return Response.json(this.serialize(result));
    } catch (error: any) {
      return Response.json({ error: error.message }, { status: 400 });
    }
  }

  async createDraftSale(req: Request, userId: string) {
    try {
      const body = await parseJsonBody<CreateDraftSaleBody>(req, createDraftSaleSchema);
      const result = await this.createDraftSaleUseCase.execute({
        ...body,
        userId,
      });
      return Response.json(this.serialize(result), { status: 201 });
    } catch (error: any) {
      return Response.json({ error: getValidationErrorMessage(error) }, { status: 400 });
    }
  }

  async getDraftCart(req: Request, userId: string) {
    try {
      const url = new URL(req.url);
      const { idempotencyKey } = parseSearchParams<DraftCartQuery>(url, draftCartQuerySchema);
      const result = await this.getDraftCartUseCase.execute({ userId, idempotencyKey });
      return Response.json(this.serialize(result));
    } catch (error: any) {
      return Response.json({ error: getValidationErrorMessage(error) }, { status: 400 });
    }
  }

  async addDraftCartItem(req: Request, userId: string) {
    try {
      const body = await parseJsonBody<DraftCartItemBody>(req, draftCartItemSchema);
      const { idempotencyKey, produtoId, servicoId, loteId, quantidade, clienteId, terminalId } =
        body;
      const item = servicoId
        ? { servicoId, quantidade: quantidade ?? 1 }
        : { produtoId: produtoId!, loteId, quantidade: quantidade ?? 1 };
      const result = await this.addDraftCartItemUseCase.execute(
        { userId, idempotencyKey, clienteId, terminalId },
        item,
      );
      return Response.json(this.serialize(result), { status: 201 });
    } catch (error: any) {
      return Response.json({ error: getValidationErrorMessage(error) }, { status: 400 });
    }
  }

  async incrementDraftCartItem(itemId: string, req: Request, userId: string) {
    try {
      const body = await parseJsonBody<DraftCartContextBody>(req, draftCartContextSchema);
      const result = await this.incrementDraftCartItemUseCase.execute(
        { userId, idempotencyKey: body.idempotencyKey },
        itemId,
      );
      return Response.json(this.serialize(result));
    } catch (error: any) {
      return Response.json({ error: getValidationErrorMessage(error) }, { status: 400 });
    }
  }

  async decrementDraftCartItem(itemId: string, req: Request, userId: string) {
    try {
      const body = await parseJsonBody<DraftCartContextBody>(req, draftCartContextSchema);
      const result = await this.decrementDraftCartItemUseCase.execute(
        { userId, idempotencyKey: body.idempotencyKey },
        itemId,
      );
      return Response.json(this.serialize(result));
    } catch (error: any) {
      return Response.json({ error: getValidationErrorMessage(error) }, { status: 400 });
    }
  }

  async removeDraftCartItem(itemId: string, req: Request, userId: string) {
    try {
      const body = await parseJsonBody<DraftCartContextBody>(req, draftCartContextSchema);
      const result = await this.removeDraftCartItemUseCase.execute(
        { userId, idempotencyKey: body.idempotencyKey },
        itemId,
      );
      return Response.json(this.serialize(result));
    } catch (error: any) {
      return Response.json({ error: getValidationErrorMessage(error) }, { status: 400 });
    }
  }

  async liquidarConvenio(req: Request, userId: string) {
    try {
      const body = await parseJsonBody<LiquidarConvenioBody>(req, liquidarConvenioSchema);
      const result = await this.liquidarConvenioUseCase.execute({
        ...body,
        userId
      });
      return Response.json(this.serialize(result));
    } catch (error: any) {
      return Response.json({ error: getValidationErrorMessage(error) }, { status: 400 });
    }
  }

  async getRelatorioDiferenca(req: Request) {
    try {
      const url = new URL(req.url);
      const { sessaoId } = parseSearchParams<RelatorioDiferencaQuery>(url, relatorioDiferencaQuerySchema);
      
      const result = await this.relatorioDiferencaCaixaUseCase.execute(sessaoId);
      return Response.json(this.serialize(result));
    } catch (error: any) {
      return Response.json({ error: error.message }, { status: 400 });
    }
  }

  async listTaxRules() {
    try {
      const result = await this.listTaxRulesUseCase.execute();
      return Response.json(this.serialize(result));
    } catch (error: any) {
      return Response.json({ error: error.message }, { status: 500 });
    }
  }

  private serialize(data: any) {
    return JSON.parse(JSON.stringify(data, (_key, value) =>
      typeof value === 'bigint' ? value.toString() : value
    ));
  }
}
