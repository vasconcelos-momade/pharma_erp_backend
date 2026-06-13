import { addPurchaseItemSchema, createPendingPurchaseSchema } from "../../application/dto/purchases.dto";
import { addRequisitionCompraItemSchema } from "../../application/dto/requisitions.dto";
import { AddRequisitionCompraItemUseCase } from "../../application/use-cases/requisitions/add-requisition-compra-item.use-case";
import { ApproveRequisitionUseCase } from "../../application/use-cases/requisitions/approve-requisition.use-case";
import { CreateRequisitionUseCase } from "../../application/use-cases/requisitions/create-requisition.use-case";
import { GetRequisitionDetailUseCase } from "../../application/use-cases/requisitions/get-requisition-detail.use-case";
import { ListRequisitionsUseCase } from "../../application/use-cases/requisitions/list-requisitions.use-case";
import { ListSuppliersUseCase } from "../../application/use-cases/purchases/list-suppliers.use-case";
import { RemoveRequisitionItemUseCase } from "../../application/use-cases/requisitions/remove-requisition-item.use-case";
import { parseJsonBody } from "../../../../../shared/http/request-validation";
import { controllerErrorResponse } from "../../../../../shared/http/controller-error";

/** @deprecated Usar RequisitionsController (/tenant/requisicoes?tipo=COMPRA) */
export class PurchasesController {
  private createUseCase = new CreateRequisitionUseCase();
  private listUseCase = new ListRequisitionsUseCase();
  private detailUseCase = new GetRequisitionDetailUseCase();
  private addCompraItemUseCase = new AddRequisitionCompraItemUseCase();
  private approveUseCase = new ApproveRequisitionUseCase();
  private listSuppliersUseCase = new ListSuppliersUseCase();
  private removeItemUseCase = new RemoveRequisitionItemUseCase();

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
      const data = await this.createUseCase.execute({
        numeroDocumento: body.numeroDocumento,
        fornecedorId: body.fornecedorId,
        tipo: "COMPRA",
        userId,
      });
      const detail = await this.detailUseCase.execute(data.requisicaoId);
      return Response.json(
        this.serialize({
          id: detail.id,
          numeroDocumento: detail.numeroDocumento,
          fornecedorId: detail.fornecedorId,
          fornecedorNome: detail.fornecedorNome,
          status: detail.status,
          total: detail.total ?? 0,
          data: detail.createdAt,
          createdAt: detail.createdAt,
          itemCount: detail.itens.length,
        }),
        { status: 201 },
      );
    } catch (error: unknown) {
      return controllerErrorResponse(error);
    }
  }

  async listPurchases(req: Request) {
    const url = new URL(req.url);
    const status = url.searchParams.get("status");
    const mappedStatus =
      status === "RECEBIDA"
        ? "CONCLUIDA"
        : (status as "PENDENTE" | "CANCELADA" | "CONCLUIDA" | undefined);
    const data = await this.listUseCase.execute({
      tipo: "COMPRA",
      status: mappedStatus,
    });
    return Response.json(
      this.serialize(
        data.map((item: any) => ({
          ...item,
          status: item.status === "CONCLUIDA" ? "RECEBIDA" : item.status,
        })),
      ),
    );
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
    return Response.json(
      this.serialize({
        ...data,
        status: data.status === "CONCLUIDA" ? "RECEBIDA" : data.status,
        items: data.itens,
      }),
    );
  }

  async addPurchaseItem(req: Request) {
    try {
      const url = new URL(req.url);
      const parts = url.pathname.split("/");
      const compraId = parts[parts.length - 2];
      const body = await parseJsonBody(req, addPurchaseItemSchema);
      const data = await this.addCompraItemUseCase.execute(compraId, {
        produtoId: body.produtoId,
        numeroLote: body.numeroLote,
        dataValidade: body.dataValidade,
        quantidadeSolicitada: body.quantidade,
        precoCompra: body.precoCompra,
        precoVenda: body.precoVenda,
      });
      return Response.json(
        this.serialize({ ...data, items: data.itens }),
        { status: 201 },
      );
    } catch (error: unknown) {
      return controllerErrorResponse(error);
    }
  }

  async updatePurchaseItem(req: Request) {
    return this.addPurchaseItem(req);
  }

  async removePurchaseItem(req: Request) {
    const url = new URL(req.url);
    const parts = url.pathname.split("/");
    const compraId = parts[parts.length - 3];
    const itemId = parts[parts.length - 1];
    const data = await this.removeItemUseCase.execute(compraId, itemId);
    return Response.json(this.serialize({ ...data, items: data.itens }));
  }

  async confirmPurchase(req: Request, userId: string) {
    try {
      const url = new URL(req.url);
      const parts = url.pathname.split("/");
      const compraId = parts[parts.length - 2];
      const data = await this.approveUseCase.execute(compraId, userId);
      return Response.json(
        this.serialize({
          message: data.message,
          compraId: data.requisicaoId,
          numeroDocumento: data.numeroDocumento,
          status: "RECEBIDA",
        }),
      );
    } catch (error: unknown) {
      return controllerErrorResponse(error);
    }
  }
}
