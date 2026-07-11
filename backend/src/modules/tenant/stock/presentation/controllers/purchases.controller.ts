import { addPurchaseItemSchema, createPendingPurchaseSchema, createPurchasesFromSuggestionsSchema } from "../../application/dto/purchases.dto";
import { AddPurchaseItemUseCase } from "../../application/use-cases/purchases/add-purchase-item.use-case";
import { ConfirmPurchaseUseCase } from "../../application/use-cases/purchases/confirm-purchase.use-case";
import { CreatePendingPurchaseUseCase } from "../../application/use-cases/purchases/create-pending-purchase.use-case";
import { CreatePurchasesFromSuggestionsUseCase } from "../../application/use-cases/purchases/create-purchases-from-suggestions.use-case";
import { GetPurchaseDetailUseCase } from "../../application/use-cases/purchases/get-purchase-detail.use-case";
import { ListPurchasesUseCase } from "../../application/use-cases/purchases/list-purchases.use-case";
import { ListSuppliersUseCase } from "../../application/use-cases/purchases/list-suppliers.use-case";
import { RemovePurchaseItemUseCase } from "../../application/use-cases/purchases/remove-purchase-item.use-case";
import { UpdatePurchaseItemUseCase } from "../../application/use-cases/purchases/update-purchase-item.use-case";
import { parseJsonBody } from "../../../../../shared/http/request-validation";
import { controllerErrorResponse } from "../../../../../shared/http/controller-error";

export class PurchasesController {
  private createUseCase = new CreatePendingPurchaseUseCase();
  private createFromSuggestionsUseCase = new CreatePurchasesFromSuggestionsUseCase();
  private listUseCase = new ListPurchasesUseCase();
  private detailUseCase = new GetPurchaseDetailUseCase();
  private addItemUseCase = new AddPurchaseItemUseCase();
  private updateItemUseCase = new UpdatePurchaseItemUseCase();
  private confirmUseCase = new ConfirmPurchaseUseCase();
  private listSuppliersUseCase = new ListSuppliersUseCase();
  private removeItemUseCase = new RemovePurchaseItemUseCase();

  private serialize(data: unknown) {
    return JSON.parse(
      JSON.stringify(data, (_key, value) =>
        typeof value === "bigint" ? value.toString() : value,
      ),
    );
  }

  async createPendingPurchase(req: Request, userId: string) {
    try {
      const body = await parseJsonBody(req, createPendingPurchaseSchema);
      const data = await this.createUseCase.execute({ ...body, userId });
      return Response.json(this.serialize(data), { status: 201 });
    } catch (error: unknown) {
      return controllerErrorResponse(error);
    }
  }

  async createFromSuggestions(req: Request, userId: string) {
    try {
      const body = await parseJsonBody(req, createPurchasesFromSuggestionsSchema);
      const data = await this.createFromSuggestionsUseCase.execute({ ...body, userId });
      return Response.json(this.serialize(data), { status: 201 });
    } catch (error: unknown) {
      return controllerErrorResponse(error);
    }
  }

  async listPurchases(req: Request) {
    const url = new URL(req.url);
    const status = url.searchParams.get("status");
    const data = await this.listUseCase.execute({
      status: status as "PENDENTE" | "RECEBIDA" | "CANCELADA" | undefined,
    });
    return Response.json(this.serialize(data));
  }

  async listSuppliers(req: Request) {
    const url = new URL(req.url);
    const search = url.searchParams.get("search") ?? undefined;
    const data = await this.listSuppliersUseCase.execute(search);
    return Response.json(this.serialize(data));
  }

  async getPurchaseDetail(req: Request) {
    const url = new URL(req.url);
    const parts = url.pathname.split("/");
    const compraId = parts[parts.length - 1];
    const data = await this.detailUseCase.execute(compraId);
    return Response.json(this.serialize(data));
  }

  async addPurchaseItem(req: Request) {
    try {
      const url = new URL(req.url);
      const parts = url.pathname.split("/");
      const compraId = parts[parts.length - 2];
      const body = await parseJsonBody(req, addPurchaseItemSchema);
      const data = await this.addItemUseCase.execute(compraId, body);
      return Response.json(this.serialize(data), { status: 201 });
    } catch (error: unknown) {
      return controllerErrorResponse(error);
    }
  }

  async updatePurchaseItem(req: Request) {
    try {
      const url = new URL(req.url);
      const parts = url.pathname.split("/");
      const compraId = parts[parts.length - 3];
      const itemId = parts[parts.length - 1];
      const body = await parseJsonBody(req, addPurchaseItemSchema);
      const data = await this.updateItemUseCase.execute(compraId, itemId, body);
      return Response.json(this.serialize(data));
    } catch (error: unknown) {
      return controllerErrorResponse(error);
    }
  }

  async removePurchaseItem(req: Request) {
    const url = new URL(req.url);
    const parts = url.pathname.split("/");
    const compraId = parts[parts.length - 3];
    const itemId = parts[parts.length - 1];
    const data = await this.removeItemUseCase.execute(compraId, itemId);
    return Response.json(this.serialize(data));
  }

  async confirmPurchase(req: Request, userId: string) {
    try {
      const url = new URL(req.url);
      const parts = url.pathname.split("/");
      const compraId = parts[parts.length - 2];
      const data = await this.confirmUseCase.execute(compraId, userId);
      return Response.json(this.serialize(data));
    } catch (error: unknown) {
      return controllerErrorResponse(error);
    }
  }
}
