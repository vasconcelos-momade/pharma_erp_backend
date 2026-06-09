import {
  addTransferItemSchema,
  createTransferSchema,
  listTransfersQuerySchema,
  updateTransferItemSchema,
} from "../../application/dto/transfers.dto";
import { AddTransferItemUseCase } from "../../application/use-cases/transfers/add-transfer-item.use-case";
import { CancelTransferUseCase } from "../../application/use-cases/transfers/cancel-transfer.use-case";
import { ConfirmTransferUseCase } from "../../application/use-cases/transfers/confirm-transfer.use-case";
import { CreateTransferUseCase } from "../../application/use-cases/transfers/create-transfer.use-case";
import { GetTransferDetailUseCase } from "../../application/use-cases/transfers/get-transfer-detail.use-case";
import { ListProductLotsUseCase } from "../../application/use-cases/transfers/list-product-lots.use-case";
import { ListTransfersUseCase } from "../../application/use-cases/transfers/list-transfers.use-case";
import { RemoveTransferItemUseCase } from "../../application/use-cases/transfers/remove-transfer-item.use-case";
import { UpdateTransferItemUseCase } from "../../application/use-cases/transfers/update-transfer-item.use-case";
import { ApiError } from "../../../../../shared/http/api-error";
import {
  getValidationErrorMessage,
  parseJsonBody,
  parseSearchParams,
} from "../../../../../shared/http/request-validation";

export class TransfersController {
  private createUseCase = new CreateTransferUseCase();
  private listUseCase = new ListTransfersUseCase();
  private detailUseCase = new GetTransferDetailUseCase();
  private addItemUseCase = new AddTransferItemUseCase();
  private updateItemUseCase = new UpdateTransferItemUseCase();
  private removeItemUseCase = new RemoveTransferItemUseCase();
  private listProductLotsUseCase = new ListProductLotsUseCase();
  private confirmUseCase = new ConfirmTransferUseCase();
  private cancelUseCase = new CancelTransferUseCase();

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

  async createTransfer(req: Request, userId: string) {
    try {
      const body = await parseJsonBody(req, createTransferSchema);
      const data = await this.createUseCase.execute({ ...body, userId });
      return Response.json(this.serialize(data), { status: 201 });
    } catch (error: unknown) {
      return this.errorResponse(error);
    }
  }

  async listTransfers(req: Request) {
    try {
      const url = new URL(req.url);
      const filters = parseSearchParams(url, listTransfersQuerySchema);
      const data = await this.listUseCase.execute(filters);
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

  async getTransferDetail(req: Request) {
    try {
      const url = new URL(req.url);
      const parts = url.pathname.split("/");
      const transferenciaId = parts[parts.length - 1];
      const data = await this.detailUseCase.execute(transferenciaId);
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

  async addTransferItem(req: Request) {
    try {
      const url = new URL(req.url);
      const parts = url.pathname.split("/");
      const transferenciaId = parts[parts.length - 2];
      const body = await parseJsonBody(req, addTransferItemSchema);
      const data = await this.addItemUseCase.execute(transferenciaId, body);
      return Response.json(this.serialize(data), { status: 201 });
    } catch (error: unknown) {
      return this.errorResponse(error);
    }
  }

  async updateTransferItem(req: Request) {
    try {
      const url = new URL(req.url);
      const parts = url.pathname.split("/");
      const transferenciaId = parts[parts.length - 3];
      const itemId = parts[parts.length - 1];
      const body = await parseJsonBody(req, updateTransferItemSchema);
      const data = await this.updateItemUseCase.execute(
        transferenciaId,
        itemId,
        body,
      );
      return Response.json(this.serialize(data));
    } catch (error: unknown) {
      return this.errorResponse(error);
    }
  }

  async removeTransferItem(req: Request) {
    try {
      const url = new URL(req.url);
      const parts = url.pathname.split("/");
      const transferenciaId = parts[parts.length - 3];
      const itemId = parts[parts.length - 1];
      const data = await this.removeItemUseCase.execute(transferenciaId, itemId);
      return Response.json(this.serialize(data));
    } catch (error: unknown) {
      return this.errorResponse(error);
    }
  }

  async confirmTransfer(req: Request, userId: string) {
    try {
      const url = new URL(req.url);
      const parts = url.pathname.split("/");
      const transferenciaId = parts[parts.length - 2];
      const data = await this.confirmUseCase.execute(transferenciaId, userId);
      return Response.json(this.serialize(data));
    } catch (error: unknown) {
      return this.errorResponse(error);
    }
  }

  async cancelTransfer(req: Request, userId: string) {
    try {
      const url = new URL(req.url);
      const parts = url.pathname.split("/");
      const transferenciaId = parts[parts.length - 2];
      const data = await this.cancelUseCase.execute(transferenciaId, userId);
      return Response.json(this.serialize(data));
    } catch (error: unknown) {
      return this.errorResponse(error);
    }
  }
}
