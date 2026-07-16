import { z } from "zod";
import { CreateSaleUseCase } from "../../modules/tenant/sales/application/use-cases/create-sale.use-case";
import { serializeForJson } from "../../shared/http/serialize-json";
import {
  tenantAuthMiddleware,
  tenantBranchContextMiddleware,
  getTenantAuth,
  requirePermission,
} from "../../shared/http/auth-middlewares";
import { auditMiddleware } from "../../shared/http/middlewares";
import { parseJsonBody } from "../../shared/http/request-validation";
import type { Router } from "../../shared/http/router";

const createSaleSchema = z.object({
  clienteId: z.string().trim().min(1).optional().nullable(),
  items: z
    .array(
      z.object({
        produtoId: z.string().trim().min(1),
        quantidade: z.coerce.number().positive(),
        receita: z
          .object({
            numero: z.string().trim().min(1).optional(),
            medicoNome: z.string().trim().min(1).optional(),
            dataReceita: z.string().trim().min(1).optional(),
          })
          .optional(),
      }),
    )
    .min(1),
});

export function registerSalesRoutes(router: Router, prefix: string): void {
  router.post(
    `${prefix}/tenant/sales`,
    tenantAuthMiddleware(),
    tenantBranchContextMiddleware(),
    requirePermission("POS", "CREATE"),
    auditMiddleware,
    async (context) => {
      const auth = getTenantAuth(context);
      const body = await parseJsonBody(context.req, createSaleSchema);
      const createSale = new CreateSaleUseCase();
      const result = await createSale.execute({
        clienteId: body.clienteId,
        userId: auth.userId,
        items: body.items,
      });

      return Response.json(serializeForJson(result), { status: 201 });
    },
  );
}
