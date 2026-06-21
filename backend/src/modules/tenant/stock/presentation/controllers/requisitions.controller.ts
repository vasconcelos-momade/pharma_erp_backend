import {
  addRequisitionCompraItemSchema,
  addRequisitionItemSchema,
  createRequisitionSchema,
  createLoteSchema,
  listRequisitionsQuerySchema,
  searchRequisitionProdutosQuerySchema,
  updateRequisitionItemSchema,
  updateRequisitionSchema,
} from "../../application/dto/requisitions.dto";
import { AddRequisitionCompraItemUseCase } from "../../application/use-cases/requisitions/add-requisition-compra-item.use-case";
import { AddRequisitionItemUseCase } from "../../application/use-cases/requisitions/add-requisition-item.use-case";
import { getPrisma } from "../../../../../infrastructure/prisma/tenant-prisma.factory";
import { ApproveRequisitionUseCase } from "../../application/use-cases/requisitions/approve-requisition.use-case";
import { CancelRequisitionUseCase } from "../../application/use-cases/requisitions/cancel-requisition.use-case";
import { CreateRequisitionUseCase } from "../../application/use-cases/requisitions/create-requisition.use-case";
import { CreateLoteUseCase } from "../../application/use-cases/requisitions/create-lote.use-case";
import { GetRequisitionDetailUseCase } from "../../application/use-cases/requisitions/get-requisition-detail.use-case";
import { ListProductLotsUseCase } from "../../application/use-cases/requisitions/list-product-lots.use-case";
import { ListRequisitionsUseCase } from "../../application/use-cases/requisitions/list-requisitions.use-case";
import { SearchRequisitionProdutosUseCase } from "../../application/use-cases/requisitions/search-requisition-produtos.use-case";
import { RejectRequisitionUseCase } from "../../application/use-cases/requisitions/reject-requisition.use-case";
import { RemoveRequisitionItemUseCase } from "../../application/use-cases/requisitions/remove-requisition-item.use-case";
import { UpdateRequisitionCompraItemUseCase } from "../../application/use-cases/requisitions/update-requisition-compra-item.use-case";
import { UpdateRequisitionItemUseCase } from "../../application/use-cases/requisitions/update-requisition-item.use-case";
import { UpdateRequisitionUseCase } from "../../application/use-cases/requisitions/update-requisition.use-case";
import { ApiError } from "../../../../../shared/http/api-error";
import {
  getValidationErrorMessage,
  parseJsonBody,
  parseSearchParams,
} from "../../../../../shared/http/request-validation";

export class RequisitionsController {
  private createUseCase = new CreateRequisitionUseCase();
  private updateUseCase = new UpdateRequisitionUseCase();
  private createLoteUseCase = new CreateLoteUseCase();
  private listUseCase = new ListRequisitionsUseCase();
  private detailUseCase = new GetRequisitionDetailUseCase();
  private addItemUseCase = new AddRequisitionItemUseCase();
  private addCompraItemUseCase = new AddRequisitionCompraItemUseCase();
  private updateItemUseCase = new UpdateRequisitionItemUseCase();
  private updateCompraItemUseCase = new UpdateRequisitionCompraItemUseCase();
  private removeItemUseCase = new RemoveRequisitionItemUseCase();
  private listProductLotsUseCase = new ListProductLotsUseCase();
  private searchProdutosUseCase = new SearchRequisitionProdutosUseCase();
  private approveUseCase = new ApproveRequisitionUseCase();
  private rejectUseCase = new RejectRequisitionUseCase();
  private cancelUseCase = new CancelRequisitionUseCase();

  private serialize(data: unknown) {
    return JSON.parse(
      JSON.stringify(data, (_key, value) =>
        typeof value === "bigint" ? value.toString() : value,
      ),
    );
  }

  private errorResponse(error: unknown): Response {
    if (error instanceof ApiError) {
      return Response.json(
        { error: error.message, code: error.code },
        { status: error.status },
      );
    }
    return Response.json(
      { error: getValidationErrorMessage(error) },
      { status: 400 },
    );
  }

  async createRequisition(req: Request, userId: string) {
    try {
      const body = await parseJsonBody(req, createRequisitionSchema);
      const data = await this.createUseCase.execute({ ...body, userId });
      return Response.json(this.serialize(data), { status: 201 });
    } catch (error: unknown) {
      return this.errorResponse(error);
    }
  }

  async listRequisitions(req: Request) {
    try {
      const url = new URL(req.url);
      const filters = parseSearchParams(url, listRequisitionsQuerySchema);
      const data = await this.listUseCase.execute(filters);
      return Response.json(this.serialize(data));
    } catch (error: unknown) {
      return this.errorResponse(error);
    }
  }

  async searchProdutos(req: Request) {
    try {
      const url = new URL(req.url);
      const { q, barcode, page = 1, pageSize = 20 } = parseSearchParams(
        url,
        searchRequisitionProdutosQuerySchema,
      );
      const data = await this.searchProdutosUseCase.execute({
        q: q ?? barcode,
        page,
        pageSize,
      });
      return Response.json(this.serialize(data));
    } catch (error: unknown) {
      return this.errorResponse(error);
    }
  }

  async listProductLots(req: Request) {
    try {
      const url = new URL(req.url);
      const parts = url.pathname.split("/");
      const produtoId = parts[parts.length - 2];
      const data = await this.listProductLotsUseCase.execute(produtoId);
      return Response.json(this.serialize(data));
    } catch (error: unknown) {
      if (error instanceof ApiError && error.status === 404) {
        return Response.json(
          { error: error.message, code: error.code },
          { status: 404 },
        );
      }
      return this.errorResponse(error);
    }
  }

  async getRequisitionDetail(req: Request) {
    try {
      const url = new URL(req.url);
      const parts = url.pathname.split("/");
      const requisicaoId = parts[parts.length - 1];
      const data = await this.detailUseCase.execute(requisicaoId);
      return Response.json(this.serialize(data));
    } catch (error: unknown) {
      if (error instanceof ApiError && error.status === 404) {
        return Response.json(
          { error: error.message, code: error.code },
          { status: 404 },
        );
      }
      return this.errorResponse(error);
    }
  }

  async updateRequisition(req: Request) {
    try {
      const url = new URL(req.url);
      const parts = url.pathname.split("/");
      const requisicaoId = parts[parts.length - 1];
      const body = await parseJsonBody(req, updateRequisitionSchema);
      const data = await this.updateUseCase.execute(requisicaoId, body);
      return Response.json(this.serialize(data));
    } catch (error: unknown) {
      if (error instanceof ApiError && error.status === 404) {
        return Response.json(
          { error: error.message, code: error.code },
          { status: 404 },
        );
      }
      return this.errorResponse(error);
    }
  }

  async addRequisitionItem(req: Request) {
    try {
      const url = new URL(req.url);
      const parts = url.pathname.split("/");
      const requisicaoId = parts[parts.length - 2];
      const prisma = getPrisma() as any;
      const requisicao = await prisma.requisicao.findUnique({
        where: { id: BigInt(requisicaoId) },
        select: { tipo: true },
      });

      if (requisicao?.tipo === "COMPRA") {
        const body = await parseJsonBody(req, addRequisitionCompraItemSchema);
        const data = await this.addCompraItemUseCase.execute(requisicaoId, body);
        return Response.json(this.serialize(data), { status: 201 });
      }

      const body = await parseJsonBody(req, addRequisitionItemSchema);
      const data = await this.addItemUseCase.execute(requisicaoId, body);
      return Response.json(this.serialize(data), { status: 201 });
    } catch (error: unknown) {
      return this.errorResponse(error);
    }
  }

  async updateRequisitionItem(req: Request) {
    try {
      const url = new URL(req.url);
      const parts = url.pathname.split("/");
      const requisicaoId = parts[parts.length - 3];
      const itemId = parts[parts.length - 1];
      const prisma = getPrisma() as any;
      const requisicao = await prisma.requisicao.findUnique({
        where: { id: BigInt(requisicaoId) },
        select: { tipo: true },
      });

      if (requisicao?.tipo === "COMPRA") {
        const body = await parseJsonBody(req, addRequisitionCompraItemSchema);
        const data = await this.updateCompraItemUseCase.execute(
          requisicaoId,
          itemId,
          body,
        );
        return Response.json(this.serialize(data));
      }

      const body = await parseJsonBody(req, updateRequisitionItemSchema);
      const data = await this.updateItemUseCase.execute(
        requisicaoId,
        itemId,
        body,
      );
      return Response.json(this.serialize(data));
    } catch (error: unknown) {
      return this.errorResponse(error);
    }
  }

  async removeRequisitionItem(req: Request) {
    try {
      const url = new URL(req.url);
      const parts = url.pathname.split("/");
      const requisicaoId = parts[parts.length - 3];
      const itemId = parts[parts.length - 1];
      const data = await this.removeItemUseCase.execute(requisicaoId, itemId);
      return Response.json(this.serialize(data));
    } catch (error: unknown) {
      return this.errorResponse(error);
    }
  }

  async approveRequisition(req: Request, userId: string) {
    try {
      const url = new URL(req.url);
      const parts = url.pathname.split("/");
      const requisicaoId = parts[parts.length - 2];
      const data = await this.approveUseCase.execute(requisicaoId, userId);
      return Response.json(this.serialize(data));
    } catch (error: unknown) {
      return this.errorResponse(error);
    }
  }

  async confirmRequisition(req: Request, userId: string) {
    return this.approveRequisition(req, userId);
  }

  async rejectRequisition(req: Request, userId: string) {
    try {
      const url = new URL(req.url);
      const parts = url.pathname.split("/");
      const requisicaoId = parts[parts.length - 2];
      const data = await this.rejectUseCase.execute(requisicaoId, userId);
      return Response.json(this.serialize(data));
    } catch (error: unknown) {
      return this.errorResponse(error);
    }
  }

  async cancelRequisition(req: Request, userId: string) {
    try {
      const url = new URL(req.url);
      const parts = url.pathname.split("/");
      const requisicaoId = parts[parts.length - 2];
      const data = await this.cancelUseCase.execute(requisicaoId, userId);
      return Response.json(this.serialize(data));
    } catch (error: unknown) {
      return this.errorResponse(error);
    }
  }

  async createLote(req: Request) {
    try {
      const body = await parseJsonBody(req, createLoteSchema);
      const data = await this.createLoteUseCase.execute(body);
      return Response.json(this.serialize(data), { status: 201 });
    } catch (error: unknown) {
      return this.errorResponse(error);
    }
  }
}

export const TransfersController = RequisitionsController;
