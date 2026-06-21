import { ReceivePurchaseUseCase } from "../../application/use-cases/receive-purchase.use-case";
import { AdjustStockUseCase } from "../../application/use-cases/adjust-stock.use-case";
import { ListStockMovementsUseCase } from "../../application/use-cases/list-stock-movements.use-case";
import { listStockMovementsQuerySchema } from "../../application/dto/stock.dto";
import { z } from "zod";
import {
  parseJsonBody,
  parseSearchParams,
} from "../../../../../shared/http/request-validation";
import { controllerErrorResponse } from "../../../../../shared/http/controller-error";

const receivePurchaseSchema = z.object({
  fornecedorId: z.string().trim().min(1),
  numeroDocumento: z.string().trim().min(1, "Número do documento é obrigatório"),
  items: z.array(z.object({
    produtoId: z.string().trim().min(1),
    numeroLote: z.string().trim().min(1),
    dataValidade: z.string().trim().min(1),
    quantidade: z.coerce.number().positive(),
    precoCompra: z.coerce.number().nonnegative(),
    precoVenda: z.coerce.number().nonnegative().optional(),
  })).min(1),
});

const adjustStockSchema = z.object({
  produtoId: z.string().trim().min(1),
  loteId: z.string().trim().min(1).optional(),
  quantidade: z.coerce.number().refine((value: number) => value !== 0, {
    message: "A quantidade deve ser diferente de zero",
  }),
  motivo: z.string().trim().min(1),
});

export class StockController {
  private receivePurchaseUseCase = new ReceivePurchaseUseCase();
  private adjustStockUseCase = new AdjustStockUseCase();
  private listStockMovementsUseCase = new ListStockMovementsUseCase();

  async receivePurchase(req: Request, userId: string) {
    try {
      const body = await parseJsonBody(req, receivePurchaseSchema);
      const result = await this.receivePurchaseUseCase.execute({ ...body, userId });
      return Response.json(this.serialize(result), { status: 201 });
    } catch (error: any) {
      return controllerErrorResponse(error);
    }
  }

  async adjustStock(req: Request, userId: string) {
    try {
      const body = await parseJsonBody(req, adjustStockSchema);
      const result = await this.adjustStockUseCase.execute({
        produtoId: body.produtoId,
        loteId: body.loteId,
        quantidade: body.quantidade,
        motivo: body.motivo,
        userId,
      });
      return Response.json(this.serialize(result));
    } catch (error: any) {
      return controllerErrorResponse(error);
    }
  }

  async listStockMovements(req: Request) {
    try {
      const url = new URL(req.url);
      const query = parseSearchParams(url, listStockMovementsQuerySchema);
      const result = await this.listStockMovementsUseCase.execute(query);
      return Response.json(this.serialize(result));
    } catch (error: any) {
      return controllerErrorResponse(error);
    }
  }

  private serialize(data: any) {
    return JSON.parse(JSON.stringify(data, (_key, value) =>
      typeof value === 'bigint' ? value.toString() : value
    ));
  }
}
