import { GetCashflowContextUseCase } from "../../application/use-cases/get-cashflow-context.use-case";
import { RegisterCashflowOperationUseCase } from "../../application/use-cases/register-cashflow-operation.use-case";
import { cashflowOperationBodySchema } from "../../application/dto/cashflow.dto";
import { parseJsonBody } from "../../../../../shared/http/request-validation";
import { controllerErrorResponse } from "../../../../../shared/http/controller-error";

export class FinanceController {
  private getCashflowContextUseCase = new GetCashflowContextUseCase();
  private registerCashflowOperationUseCase = new RegisterCashflowOperationUseCase();

  async cashflowContext(userId: string) {
    try {
      const result = await this.getCashflowContextUseCase.execute(userId);
      return Response.json(this.serialize(result));
    } catch (error: unknown) {
      return controllerErrorResponse(error);
    }
  }

  async registerSaida(req: Request, userId: string) {
    return this.register(req, userId, "SAIDA");
  }

  async registerSuprimento(req: Request, userId: string) {
    return this.register(req, userId, "SUPRIMENTO");
  }

  async registerSangria(req: Request, userId: string) {
    return this.register(req, userId, "SANGRIA");
  }

  async registerEstorno(req: Request, userId: string) {
    return this.register(req, userId, "ESTORNO");
  }

  private async register(
    req: Request,
    userId: string,
    kind: "SAIDA" | "SUPRIMENTO" | "SANGRIA" | "ESTORNO",
  ) {
    try {
      const body = await parseJsonBody(req, cashflowOperationBodySchema);
      const result = await this.registerCashflowOperationUseCase.execute({
        ...body,
        userId,
        kind,
      });
      return Response.json(this.serialize(result), { status: 201 });
    } catch (error: unknown) {
      return controllerErrorResponse(error);
    }
  }

  private serialize(data: unknown) {
    return JSON.parse(
      JSON.stringify(data, (_key, value) =>
        typeof value === "bigint" ? value.toString() : value,
      ),
    );
  }
}
