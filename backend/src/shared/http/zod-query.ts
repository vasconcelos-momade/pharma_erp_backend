import { z } from "zod";

/** Query-string boolean (`true`/`false`/`1`/`0`) — evita `z.coerce.boolean()` que trata `"false"` como true. */
export const queryBooleanSchema = z
  .union([z.boolean(), z.string(), z.number()])
  .optional()
  .transform((value) => {
    if (value === undefined) {
      return undefined;
    }
    if (typeof value === "boolean") {
      return value;
    }
    if (typeof value === "number") {
      return value !== 0;
    }
    const normalized = value.trim().toLowerCase();
    if (normalized === "true" || normalized === "1") {
      return true;
    }
    if (normalized === "false" || normalized === "0") {
      return false;
    }
    return undefined;
  });
