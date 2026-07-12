import {
  addManualPurchaseSuggestionSchema,
  createSupplierSchema,
  purchaseSuggestionsQuerySchema,
  searchSuppliersQuerySchema,
  updateSupplierSchema,
} from "../../application/dto/suppliers.dto";
import { AddManualPurchaseSuggestionUseCase } from "../../application/use-cases/purchases/add-manual-purchase-suggestion.use-case";
import { ClearPurchaseSuggestionsUseCase } from "../../application/use-cases/purchases/clear-purchase-suggestions.use-case";
import { PurchaseSuggestionsUseCase } from "../../application/use-cases/purchases/purchase-suggestions.use-case";
import { RemovePurchaseSuggestionUseCase } from "../../application/use-cases/purchases/remove-purchase-suggestion.use-case";
import { SupplierService } from "../../application/use-cases/purchases/supplier.service";
import {
  parseJsonBody,
  parseSearchParams,
} from "../../../../../shared/http/request-validation";
import { controllerErrorResponse } from "../../../../../shared/http/controller-error";

export class SuppliersController {
  private service = new SupplierService();
  private suggestionsUseCase = new PurchaseSuggestionsUseCase();
  private addManualSuggestionUseCase = new AddManualPurchaseSuggestionUseCase();
  private removeSuggestionUseCase = new RemovePurchaseSuggestionUseCase();
  private clearSuggestionsUseCase = new ClearPurchaseSuggestionsUseCase();

  private serialize(data: unknown) {
    return JSON.parse(
      JSON.stringify(data, (_key, value) =>
        typeof value === "bigint" ? value.toString() : value,
      ),
    );
  }

  async search(req: Request) {
    try {
      const url = new URL(req.url);
      const params = parseSearchParams(url, searchSuppliersQuerySchema);
      const result = await this.service.search({
        query: params.q,
        page: params.page,
        pageSize: params.pageSize,
        includeInactive: params.includeInactive,
      });
      return Response.json(this.serialize(result));
    } catch (error: unknown) {
      return controllerErrorResponse(error, 500);
    }
  }

  async get(req: Request) {
    try {
      const parts = new URL(req.url).pathname.split("/");
      const id = parts[parts.length - 1];
      const result = await this.service.get(id);
      return Response.json(this.serialize(result));
    } catch (error: unknown) {
      return controllerErrorResponse(error, 404);
    }
  }

  async create(req: Request) {
    try {
      const body = await parseJsonBody(req, createSupplierSchema);
      const result = await this.service.create(body);
      return Response.json(this.serialize(result), { status: 201 });
    } catch (error: unknown) {
      return controllerErrorResponse(error);
    }
  }

  async update(req: Request) {
    try {
      const parts = new URL(req.url).pathname.split("/");
      const id = parts[parts.length - 1];
      const body = await parseJsonBody(req, updateSupplierSchema);
      const result = await this.service.update(id, body);
      return Response.json(this.serialize(result));
    } catch (error: unknown) {
      return controllerErrorResponse(error);
    }
  }

  async delete(req: Request) {
    try {
      const parts = new URL(req.url).pathname.split("/");
      const id = parts[parts.length - 1];
      const result = await this.service.delete(id);
      return Response.json(this.serialize(result));
    } catch (error: unknown) {
      return controllerErrorResponse(error);
    }
  }

  async purchaseSuggestions(req: Request) {
    try {
      const url = new URL(req.url);
      const params = parseSearchParams(url, purchaseSuggestionsQuerySchema);
      const result = await this.suggestionsUseCase.execute(params);
      return Response.json(this.serialize(result));
    } catch (error: unknown) {
      return controllerErrorResponse(error, 500);
    }
  }

  async addManualPurchaseSuggestion(req: Request) {
    try {
      const body = await parseJsonBody(req, addManualPurchaseSuggestionSchema);
      const result = await this.addManualSuggestionUseCase.execute(body);
      return Response.json(this.serialize(result), { status: 201 });
    } catch (error: unknown) {
      return controllerErrorResponse(error);
    }
  }

  async removePurchaseSuggestion(req: Request) {
    try {
      const parts = new URL(req.url).pathname.split("/");
      const produtoId = parts[parts.length - 1];
      const result = await this.removeSuggestionUseCase.execute(produtoId);
      return Response.json(this.serialize(result));
    } catch (error: unknown) {
      return controllerErrorResponse(error, 404);
    }
  }

  async clearPurchaseSuggestions() {
    try {
      const result = await this.clearSuggestionsUseCase.execute();
      return Response.json(this.serialize(result));
    } catch (error: unknown) {
      return controllerErrorResponse(error, 500);
    }
  }
}
