import { ProdutoService } from "../../application/services/produto.service";
import { z } from "zod";
import {
  getValidationErrorMessage,
  parseJsonBody,
  parseSearchParams,
} from "../../../../../shared/http/request-validation";

const produtoBaseSchema = z.looseObject({
  nome: z.string().trim().min(1),
  barcode: z.string().trim().min(1).optional(),
  tipoDispensacao: z.string().trim().min(1).optional(),
  requiresManualReview: z.coerce.boolean().optional(),
  precoVenda: z.coerce.number().nonnegative().optional(),
});

const createProdutoSchema = produtoBaseSchema;

const updateProdutoSchema = produtoBaseSchema.partial().refine(
  (data) => Object.keys(data).length > 0,
  { message: "Informe ao menos um campo para atualizar" },
);

const listProdutosQuerySchema = z.object({
  requiresManualReview: z
    .enum(["true", "false"])
    .transform((value) => value === "true")
    .optional(),
});

export class ProdutoController {
  private service = new ProdutoService();

  async create(req: Request, userId: string) {
    try {
      const body = await parseJsonBody(req, createProdutoSchema);
      const result = await this.service.create(body, userId);
      return Response.json(this.serialize(result), { status: 201 });
    } catch (error: any) {
      return Response.json({ error: getValidationErrorMessage(error) }, { status: 400 });
    }
  }

  async list(req: Request) {
    try {
      const url = new URL(req.url);
      const { requiresManualReview } = parseSearchParams(url, listProdutosQuerySchema);

      const result = await this.service.list({ requiresManualReview });
      return Response.json(result.map((p: any) => this.serialize(p)));
    } catch (error: any) {
      return Response.json({ error: error.message }, { status: 500 });
    }
  }

  async get(id: string) {
    try {
      const result = await this.service.get(BigInt(id));
      return Response.json(this.serialize(result));
    } catch (error: any) {
      return Response.json({ error: error.message }, { status: 404 });
    }
  }

  async update(id: string, req: Request, userId: string) {
    try {
      const body = await parseJsonBody(req, updateProdutoSchema);
      const result = await this.service.update(BigInt(id), body, userId);
      return Response.json(this.serialize(result));
    } catch (error: any) {
      return Response.json({ error: getValidationErrorMessage(error) }, { status: 400 });
    }
  }

  async delete(id: string, userId: string) {
    try {
      await this.service.delete(BigInt(id), userId);
      return Response.json({ message: "Produto desativado com sucesso" });
    } catch (error: any) {
      return Response.json({ error: error.message }, { status: 400 });
    }
  }

  /**
   * Helper to convert BigInt to String for JSON serialization
   */
  private serialize(data: any) {
    return JSON.parse(JSON.stringify(data, (_key, value) =>
      typeof value === 'bigint' ? value.toString() : value
    ));
  }
}
