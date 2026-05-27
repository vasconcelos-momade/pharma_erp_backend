import { z } from "zod";
import { ReceivePaymentWebhookUseCase } from "../../billing/application/use-cases/receive-payment-webhook.use-case";
import { ProcessPaymentWebhookUseCase } from "../../billing/application/use-cases/process-payment-webhook.use-case";
import { serializeForJson } from "../../../../shared/http/serialize-json";
import { parseSearchParams } from "../../../../shared/http/request-validation";

const webhookQuerySchema = z.object({
  tenantId: z.string().trim().min(1).optional(),
  queue: z
    .enum(["true", "false"])
    .transform((value) => value === "true")
    .optional(),
});

const webhookPayloadSchema = z
  .object({
    tenantId: z.union([z.string(), z.number()]).optional(),
    providerEventId: z.union([z.string(), z.number()]).optional(),
    eventId: z.union([z.string(), z.number()]).optional(),
    id: z.union([z.string(), z.number()]).optional(),
    eventType: z.string().trim().min(1).optional(),
    type: z.string().trim().min(1).optional(),
    reference: z.union([z.string(), z.number()]).optional(),
  })
  .catchall(z.unknown());

export class CentralWebhookController {
  async receive(provider: string, req: Request, rawBody: string): Promise<Response> {
    const payload = webhookPayloadSchema.parse(
      rawBody ? (JSON.parse(rawBody) as unknown) : {},
    );
    const url = new URL(req.url);
    const query = parseSearchParams(url, webhookQuerySchema);
    const tenantId = query.tenantId ?? (payload.tenantId != null ? String(payload.tenantId) : undefined);
    const processImmediately = query.queue !== true;

    const useCase = new ReceivePaymentWebhookUseCase();
    const result = await useCase.execute({
      provider,
      payload,
      tenantId,
      processImmediately,
    });

    return Response.json(serializeForJson(result), { status: 202 });
  }

  async processPending(webhookId: string): Promise<Response> {
    const useCase = new ProcessPaymentWebhookUseCase();
    const result = await useCase.execute({ webhookId });
    return Response.json(serializeForJson(result));
  }
}
