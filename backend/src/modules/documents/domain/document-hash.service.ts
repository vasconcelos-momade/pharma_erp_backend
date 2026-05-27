import { createHash } from "node:crypto";
import { serializeForJson } from "../../../shared/http/serialize-json";
import type { InvoiceDocumentSnapshotPayload } from "./document.types";

export class DocumentHashService {
  static computeSnapshotHash(payload: InvoiceDocumentSnapshotPayload): string {
    return createHash("sha256")
      .update(JSON.stringify(serializeForJson(payload)))
      .digest("hex");
  }

  static computeBinaryHash(bytes: Uint8Array): string {
    return createHash("sha256").update(bytes).digest("hex");
  }
}
