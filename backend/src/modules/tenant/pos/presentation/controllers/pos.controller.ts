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
import { ListFaturasUseCase } from "../../application/use-cases/list-faturas.use-case";
import { GetFaturaDetalheUseCase } from "../../application/use-cases/get-fatura-detalhe.use-case";
import { FaturaDocumentService, isThermalReceiptTipo } from "../../application/services/fatura-document.service";
import { z } from "zod";
import { searchProdutosQuerySchema } from "../../../products/application/dto/produto.dto";
import { POS_DEFAULT_PAGE_SIZE } from "../../domain/pos-catalog.constants";
import {
  parseJsonBody,
  parseSearchParams,
} from "../../../../../shared/http/request-validation";
import { success } from "../../../../../shared/http/api-response";
import { controllerErrorResponse } from "../../../../../shared/http/controller-error";
import { ReportsController } from "../../../reports";
import { REPORT_KEYS } from "../../../reports/application/constants/report-keys";
import { resolveTenantEmpresaProfile } from "../../application/services/tenant-empresa-profile.service";

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
  nome: z.string().trim().min(1).optional(),
  idade: z.coerce.number().int().positive().optional(),
  nid: z.string().trim().min(1).optional(),
});

const finalizarVendaSchema = z
  .object({
    clienteId: z.string().trim().min(1).optional(),
    terminalId: z.string().trim().min(1),
    idempotencyKey: z.string().trim().min(1).optional(),
    validatorUserId: z.string().trim().min(1).optional(),
    metodoPagamento: z.enum(["DINHEIRO", "CARTAO", "TRANSFERENCIA", "CARTEIRA_MOVEL", "EMOLA", "MPESA"]),
    valorRecebido: z.coerce.number().nonnegative().optional(),
    paciente: pacienteSchema.optional(),
    receita: receitaSchema.optional(),
    items: z
      .array(
        z.object({
          tipo: z.enum(["produto", "servico"]),
          produtoId: z.string().trim().min(1).optional(),
          servicoId: z.string().trim().min(1).optional(),
          quantidade: z.coerce.number().positive(),
          precoUnit: z.coerce.number().nonnegative().optional(),
          receita: receitaSchema.optional(),
        }),
      )
      .optional(),
  })
  .refine(
    (data: any) => (data.items?.length ?? 0) > 0 || Boolean(data.idempotencyKey),
    { message: "Informe idempotencyKey do carrinho ou a lista de items." },
  );

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
    precoUnit: z.coerce.number().nonnegative().optional(),
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
    precoUnit: z.coerce.number().nonnegative().optional(),
    clienteId: z.string().trim().min(1).optional(),
    terminalId: z.string().trim().min(1).optional(),
  })
  .refine((data: any) => Boolean(data.produtoId) !== Boolean(data.servicoId), {
    message: "Informe produtoId ou servicoId (apenas um).",
  });

const draftCartQuerySchema = z.object({
  idempotencyKey: z.string().trim().min(1),
  valorRecebido: z.coerce.number().nonnegative().optional(),
});

const draftCartItemIdParamSchema = z.object({
  itemId: z.string().regex(/^\d+$/, "itemId inválido"),
});

const liquidarConvenioSchema = z.object({
  empresaId: z.string().trim().min(1),
  caixaId: z.string().trim().min(1),
  valorPagamento: z.coerce.number().positive(),
  metodoPagamento: z.enum(["TRANSFERENCIA", "DINHEIRO", "CARTAO"]),
  referencia: z.string().trim().min(1).optional(),
});

const searchServicosQuerySchema = z.object({
  q: z.string().trim().min(1).optional(),
  page: z.coerce.number().int().positive().optional(),
  pageSize: z.coerce.number().int().positive().max(100).optional(),
});

const relatorioDiferencaQuerySchema = z.object({
  sessaoId: z.string().trim().min(1),
});

const listFaturasQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  pageSize: z.coerce.number().int().positive().max(100).optional(),
  search: z.string().trim().min(1).optional(),
  clienteId: z.string().regex(/^\d+$/).optional(),
  status: z.string().trim().min(1).optional(),
  dateFrom: z.string().trim().min(1).optional(),
  dateTo: z.string().trim().min(1).optional(),
  terminalId: z.string().regex(/^\d+$/).optional(),
  userId: z.string().regex(/^\d+$/).optional(),
});

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
  private listFaturasUseCase = new ListFaturasUseCase();
  private getFaturaDetalheUseCase = new GetFaturaDetalheUseCase();
  private reportsController = new ReportsController();

  async searchProdutos(req: Request) {
    const url = new URL(req.url);
    const { q, barcode, categoriaId, page = 1, pageSize = POS_DEFAULT_PAGE_SIZE } = parseSearchParams(
      url,
      searchProdutosQuerySchema,
    );

    const result = await this.searchProdutosUseCase.execute({
      query: q,
      barcode,
      categoriaId: categoriaId ? BigInt(categoriaId) : undefined,
      page,
      pageSize,
    });
    return Response.json(this.serialize(result));
  }

  async searchServicos(req: Request) {
    const url = new URL(req.url);
    const { q, page = 1, pageSize = POS_DEFAULT_PAGE_SIZE } = parseSearchParams(
      url,
      searchServicosQuerySchema,
    );

    const result = await this.searchServicosUseCase.execute({
      query: q,
      page,
      pageSize,
    });
    return Response.json(this.serialize(result));
  }

  async validarDispensacao(req: Request) {
    try {
      const body = await parseJsonBody(req, validarDispensacaoSchema);
      const result = await this.validarDispensacaoUseCase.execute(body);
      return Response.json(this.serialize(result));
    } catch (error: any) {
      return controllerErrorResponse(error);
    }
  }

  async finalizarVenda(req: Request, userId: string) {
    try {
      const body = await parseJsonBody(req, finalizarVendaSchema);
      const result = await this.finalizarVendaUseCase.execute({
        ...body,
        userId
      });
      return Response.json(this.serialize(result), { status: 201 });
    } catch (error: any) {
      console.error("Erro ao finalizar venda:", error);
      return controllerErrorResponse(error);
    }
  }

  async anularFatura(req: Request, userId: string, faturaId: string) {
    try {
      const body = await parseJsonBody(req, anularFaturaSchema);
      const result = await this.anularFaturaUseCase.execute({
        faturaId,
        userId,
        motivo: body.motivo,
        observacoes: body.observacoes
      });
      return Response.json(this.serialize(result));
    } catch (error: any) {
      console.error("Erro ao anular fatura:", error);
      return controllerErrorResponse(error);
    }
  }

  async abrirSessao(req: Request, userId: string) {
    try {
      const body = await parseJsonBody(req, abrirSessaoSchema);
      const result = await this.abrirSessaoUseCase.execute({
        ...body,
        userId
      });
      return Response.json(this.serialize(result), { status: 201 });
    } catch (error: any) {
      return controllerErrorResponse(error);
    }
  }

  async fecharSessao(req: Request, userId: string) {
    try {
      const body = await parseJsonBody(req, fecharSessaoSchema);
      const result = await this.fecharSessaoUseCase.execute({
        ...body,
        userId
      });
      return Response.json(this.serialize(result));
    } catch (error: any) {
      return controllerErrorResponse(error);
    }
  }

  async getSessaoAtual(userId: string) {
    try {
      const result = await this.getCurrentCaixaSessaoUseCase.execute(userId);
      return Response.json(this.serialize(result));
    } catch (error: any) {
      return controllerErrorResponse(error);
    }
  }

  async listAvailableCaixas() {
    try {
      const result = await this.listAvailableCaixasUseCase.execute();
      return Response.json(this.serialize(result));
    } catch (error: any) {
      return controllerErrorResponse(error);
    }
  }

  async createDraftSale(req: Request, userId: string) {
    try {
      const body = await parseJsonBody(req, createDraftSaleSchema);
      const result = await this.createDraftSaleUseCase.execute({
        ...body,
        userId,
      });
      return Response.json(this.serialize(result), { status: 201 });
    } catch (error: any) {
      return controllerErrorResponse(error);
    }
  }

  async getDraftCart(req: Request, userId: string) {
    try {
      const url = new URL(req.url);
      const { idempotencyKey, valorRecebido } = parseSearchParams(url, draftCartQuerySchema);
      const result = await this.getDraftCartUseCase.execute({
        userId,
        idempotencyKey,
        valorRecebido,
      });
      return Response.json(this.serialize(result));
    } catch (error: any) {
      return controllerErrorResponse(error);
    }
  }

  async addDraftCartItem(req: Request, userId: string) {
    try {
      const body = await parseJsonBody(req, draftCartItemSchema);
      const { idempotencyKey, produtoId, servicoId, loteId, quantidade, precoUnit, clienteId, terminalId } =
        body;
      const item = servicoId
        ? { servicoId, quantidade: quantidade ?? 1, precoUnit }
        : { produtoId: produtoId!, loteId, quantidade: quantidade ?? 1, precoUnit };
      const result = await this.addDraftCartItemUseCase.execute(
        { userId, idempotencyKey, clienteId, terminalId },
        item,
      );
      return Response.json(this.serialize(result), { status: 201 });
    } catch (error: any) {
      return controllerErrorResponse(error);
    }
  }

  async incrementDraftCartItem(itemId: string, req: Request, userId: string) {
    try {
      const body = await parseJsonBody(req, draftCartContextSchema);
      const result = await this.incrementDraftCartItemUseCase.execute(
        { userId, idempotencyKey: body.idempotencyKey },
        itemId,
      );
      return Response.json(this.serialize(result));
    } catch (error: any) {
      return controllerErrorResponse(error);
    }
  }

  async decrementDraftCartItem(itemId: string, req: Request, userId: string) {
    try {
      const body = await parseJsonBody(req, draftCartContextSchema);
      const result = await this.decrementDraftCartItemUseCase.execute(
        { userId, idempotencyKey: body.idempotencyKey },
        itemId,
      );
      return Response.json(this.serialize(result));
    } catch (error: any) {
      return controllerErrorResponse(error);
    }
  }

  async removeDraftCartItem(itemId: string, req: Request, userId: string) {
    try {
      const body = await parseJsonBody(req, draftCartContextSchema);
      const result = await this.removeDraftCartItemUseCase.execute(
        { userId, idempotencyKey: body.idempotencyKey },
        itemId,
      );
      return Response.json(this.serialize(result));
    } catch (error: any) {
      return controllerErrorResponse(error);
    }
  }

  async liquidarConvenio(req: Request, userId: string) {
    try {
      const body = await parseJsonBody(req, liquidarConvenioSchema);
      const result = await this.liquidarConvenioUseCase.execute({
        ...body,
        userId
      });
      return Response.json(this.serialize(result));
    } catch (error: any) {
      return controllerErrorResponse(error);
    }
  }

  async getRelatorioDiferenca(req: Request) {
    try {
      const url = new URL(req.url);
      const { sessaoId } = parseSearchParams(url, relatorioDiferencaQuerySchema);
      
      const result = await this.relatorioDiferencaCaixaUseCase.execute(sessaoId);
      return Response.json(this.serialize(result));
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

  async listFaturas(req: Request) {
    try {
      const url = new URL(req.url);
      const query = parseSearchParams(url, listFaturasQuerySchema);
      const result = await this.listFaturasUseCase.execute(query);
      return success(this.serialize(result.items), 200, {
        page: result.page,
        pageSize: result.pageSize,
        hasMore: result.hasMore,
        summary: result.summary,
      });
    } catch (error: any) {
      return controllerErrorResponse(error);
    }
  }

  async getFaturaDetalhe(faturaId: string) {
    const result = await this.getFaturaDetalheUseCase.execute(faturaId);
    return success(this.serialize(result));
  }

  async downloadFaturaPdf(faturaId: string, userId: string, req: Request) {
    try {
      const fatura = await this.getFaturaDetalheUseCase.execute(faturaId);
      const empresa = (fatura as any).empresa ?? await this.resolveEmpresaHeader();

      // FR → PDF preview com largura de papel térmico 80mm
      if (isThermalReceiptTipo((fatura as any).tipo)) {
        const { bytes, fileName, contentType } =
          FaturaDocumentService.buildThermal80mmPdf({
            ...(fatura as any),
            empresa,
          });
        const body = new Blob([bytes as BlobPart], { type: contentType });
        return new Response(body, {
          headers: {
            "Content-Type": contentType,
            "Content-Disposition": `inline; filename="${fileName}"`,
            "X-Document-Mode": "thermal_80mm",
          },
        });
      }

      const artifact = await this.reportsController.generateArtifact({
        reportKey: REPORT_KEYS.INVOICE,
        userId,
        routeParams: { faturaId },
        url: new URL(req.url),
        format: "pdf",
        disposition: "inline",
      });
      const body = new Blob([artifact.bytes as BlobPart], {
        type: artifact.contentType,
      });
      return new Response(body, {
        headers: {
          "Content-Type": artifact.contentType,
          "Content-Disposition": `inline; filename="${artifact.fileName}"`,
          "X-Document-Mode": "pdf_a4",
        },
      });
    } catch (error: any) {
      return controllerErrorResponse(error);
    }
  }

  async getFaturaPrintArtifact(faturaId: string, userId: string, req: Request) {
    try {
      const fatura = await this.getFaturaDetalheUseCase.execute(faturaId);
      const empresa = (fatura as any).empresa ?? await this.resolveEmpresaHeader();

      // FT → A4 PDF (abrir/imprimir no sistema)
      if (!isThermalReceiptTipo((fatura as any).tipo)) {
        const artifact = await this.reportsController.generateArtifact({
          reportKey: REPORT_KEYS.INVOICE,
          userId,
          routeParams: { faturaId },
          url: new URL(req.url),
          format: "pdf",
          disposition: "inline",
        });
        return Response.json(
          this.serialize({
            mode: "pdf_a4",
            tipo: (fatura as any).tipo ?? "FT",
            payloadBase64: Buffer.from(artifact.bytes).toString("base64"),
            fileName: artifact.fileName,
            contentType: artifact.contentType,
          }),
        );
      }

      // FR → ESC/POS 80mm
      const result = FaturaDocumentService.buildPrintArtifact({
        ...(fatura as any),
        empresa,
      });

      return Response.json(
        this.serialize({
          mode: "thermal_80mm",
          tipo: "FR",
          ...result,
        }),
      );
    } catch (error: any) {
      return controllerErrorResponse(error);
    }
  }

  /** Dados da farmácia (central Tenant) para cabeçalho do recibo 80mm. */
  private async resolveEmpresaHeader(): Promise<{
    nome: string;
    nuit: string | null;
    endereco: string | null;
    email: string | null;
    telefone: string | null;
  }> {
    try {
      const tenant = await resolveTenantEmpresaProfile();
      if (tenant.nome || tenant.nuit || tenant.endereco || tenant.email) {
        return {
          nome: tenant.nome ?? "Empresa nao configurada",
          nuit: tenant.nuit,
          endereco: tenant.endereco,
          email: tenant.email,
          telefone: tenant.telefone,
        };
      }
    } catch {
      // fallback abaixo
    }
    return {
      nome: "Empresa nao configurada",
      nuit: null,
      endereco: null,
      email: null,
      telefone: null,
    };
  }

  private serialize(data: any) {
    return JSON.parse(JSON.stringify(data, (_key, value) =>
      typeof value === 'bigint' ? value.toString() : value
    ));
  }
}
