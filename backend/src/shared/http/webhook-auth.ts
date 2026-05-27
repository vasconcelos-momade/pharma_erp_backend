import { createHmac, timingSafeEqual } from "node:crypto";

export class WebhookAuthError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "WebhookAuthError";
  }
}

function readProviderSecret(provider: string): string | undefined {
  const key = provider.toUpperCase();
  return (
    process.env[`${key}_WEBHOOK_SECRET`] ??
    process.env.WEBHOOK_SECRET ??
    undefined
  );
}

export function assertWebhookSignature(
  provider: string,
  req: Request,
  rawBody: string,
): void {
  const secret = readProviderSecret(provider);
  if (!secret) {
    return;
  }

  const signature =
    req.headers.get("x-webhook-signature") ??
    req.headers.get("x-signature") ??
    req.headers.get("authorization");

  if (!signature) {
    throw new WebhookAuthError("Webhook signature is required", 401);
  }

  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  const provided = signature.replace(/^sha256=/i, "").trim();

  const expectedBuf = Buffer.from(expected, "utf8");
  const providedBuf = Buffer.from(provided, "utf8");

  if (
    expectedBuf.length !== providedBuf.length ||
    !timingSafeEqual(expectedBuf, providedBuf)
  ) {
    throw new WebhookAuthError("Invalid webhook signature", 401);
  }
}
