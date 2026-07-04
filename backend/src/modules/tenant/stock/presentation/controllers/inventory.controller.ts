import {
  listInventoryItemsQuerySchema,
  openInventorySchema,
  recordInventoryCountSchema,
} from "../../application/dto/inventory.dto";
import { CancelInventoryUseCase } from "../../application/use-cases/inventory/cancel-inventory.use-case";
import { GetInventoryDetailUseCase } from "../../application/use-cases/inventory/get-inventory-detail.use-case";
import { ListInventoryItemsUseCase } from "../../application/use-cases/inventory/list-inventory-items.use-case";
import { ListInventoriesUseCase } from "../../application/use-cases/inventory/list-inventories.use-case";
import { OpenInventoryUseCase } from "../../application/use-cases/inventory/open-inventory.use-case";
import { ReconcileInventoryUseCase } from "../../application/use-cases/inventory/reconcile-inventory.use-case";
import { RecordInventoryCountUseCase } from "../../application/use-cases/inventory/record-inventory-count.use-case";
import { StartInventoryCountingUseCase } from "../../application/use-cases/inventory/start-inventory-counting.use-case";
import {
  parseJsonBody,
  parseSearchParams,
} from "../../../../../shared/http/request-validation";
import { controllerErrorResponse } from "../../../../../shared/http/controller-error";

export class InventoryController {
  private openUseCase = new OpenInventoryUseCase();
  private listUseCase = new ListInventoriesUseCase();
  private getDetailUseCase = new GetInventoryDetailUseCase();
  private listItemsUseCase = new ListInventoryItemsUseCase();
  private startCountingUseCase = new StartInventoryCountingUseCase();
  private recordCountUseCase = new RecordInventoryCountUseCase();
  private reconcileUseCase = new ReconcileInventoryUseCase();
  private cancelUseCase = new CancelInventoryUseCase();

  private serialize(data: unknown) {
    return JSON.parse(
      JSON.stringify(data, (_key, value) =>
        typeof value === "bigint" ? value.toString() : value,
      ),
    );
  }

  async openInventory(req: Request, userId: string) {
    try {
      const body = await parseJsonBody(req, openInventorySchema);
      const data = await this.openUseCase.execute({ ...body, userId });
      return Response.json(this.serialize(data), { status: 201 });
    } catch (error: unknown) {
      return controllerErrorResponse(error);
    }
  }

  async listInventories(req: Request) {
    const url = new URL(req.url);
    const status = url.searchParams.get("status") as
      | "ABERTO"
      | "EM_CONTAGEM"
      | "RECONCILIADO"
      | "CANCELADO"
      | undefined;
    const data = await this.listUseCase.execute({ status });
    return Response.json(this.serialize(data));
  }

  async getInventoryDetail(req: Request) {
    try {
      const url = new URL(req.url);
      const parts = url.pathname.split("/");
      const inventarioId = parts[parts.length - 1];
      const data = await this.getDetailUseCase.execute(inventarioId);
      return Response.json(this.serialize(data));
    } catch (error: unknown) {
      return controllerErrorResponse(error, 404);
    }
  }

  async listInventoryItems(req: Request) {
    try {
      const url = new URL(req.url);
      const parts = url.pathname.split("/");
      const inventarioId = parts[parts.length - 2];
      const {
        q,
        page = 1,
        pageSize = 20,
        nomeGenerico,
        forma,
        fornecedorNome,
      } = parseSearchParams(url, listInventoryItemsQuerySchema);
      const data = await this.listItemsUseCase.execute({
        inventarioId,
        query: q,
        page,
        pageSize,
        nomeGenerico,
        forma,
        fornecedorNome,
      });
      return Response.json(this.serialize(data));
    } catch (error: unknown) {
      return controllerErrorResponse(error);
    }
  }

  async startCounting(req: Request) {
    try {
      const url = new URL(req.url);
      const parts = url.pathname.split("/");
      const inventarioId = parts[parts.length - 2];
      const data = await this.startCountingUseCase.execute(inventarioId);
      return Response.json(this.serialize(data));
    } catch (error: unknown) {
      return controllerErrorResponse(error);
    }
  }

  async recordCount(req: Request) {
    try {
      const url = new URL(req.url);
      const parts = url.pathname.split("/");
      const inventarioId = parts[parts.length - 3];
      const itemId = parts[parts.length - 1];
      const body = await parseJsonBody(req, recordInventoryCountSchema);
      const data = await this.recordCountUseCase.execute(
        inventarioId,
        itemId,
        body,
      );
      return Response.json(this.serialize(data));
    } catch (error: unknown) {
      return controllerErrorResponse(error);
    }
  }

  async reconcile(req: Request, userId: string) {
    try {
      const url = new URL(req.url);
      const parts = url.pathname.split("/");
      const inventarioId = parts[parts.length - 2];
      const data = await this.reconcileUseCase.execute(inventarioId, userId);
      return Response.json(this.serialize(data));
    } catch (error: unknown) {
      return controllerErrorResponse(error);
    }
  }

  async cancel(req: Request) {
    try {
      const url = new URL(req.url);
      const parts = url.pathname.split("/");
      const inventarioId = parts[parts.length - 2];
      const data = await this.cancelUseCase.execute(inventarioId);
      return Response.json(this.serialize(data));
    } catch (error: unknown) {
      return controllerErrorResponse(error);
    }
  }
}
