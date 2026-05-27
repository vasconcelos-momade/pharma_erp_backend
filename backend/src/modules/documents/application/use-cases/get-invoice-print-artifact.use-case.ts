import { EnsureInvoiceDocumentSnapshotUseCase } from "./ensure-invoice-document-snapshot.use-case";
import { GenerateInvoiceArtifactsUseCase } from "./generate-invoice-artifacts.use-case";
import { DocumentArtifactRepository } from "../../infrastructure/repositories/document-artifact.repository";
import { DocumentStorageService } from "../../infrastructure/storage/document-storage.service";

export class GetInvoicePrintArtifactUseCase {
  constructor(
    private readonly ensureSnapshot = new EnsureInvoiceDocumentSnapshotUseCase(),
    private readonly generateArtifacts = new GenerateInvoiceArtifactsUseCase(),
    private readonly repository = new DocumentArtifactRepository(),
    private readonly storage = new DocumentStorageService(),
  ) {}

  async execute(faturaId: string, viewerUserId: string) {
    const snapshot = await this.ensureSnapshot.execute(faturaId, viewerUserId);
    let artifact = await this.repository.findReadyArtifact(faturaId, "INVOICE_ESC_POS");

    if (!artifact) {
      await this.generateArtifacts.execute(faturaId, snapshot.id.toString());
      artifact = await this.repository.findReadyArtifact(faturaId, "INVOICE_ESC_POS");
    }

    if (!artifact?.storageKey) {
      throw new Error("Artefato ESC/POS nao encontrado.");
    }

    const bytes = await this.storage.getObjectBytes(artifact.storageKey);

    return {
      printer_format: "escpos",
      fileName: artifact.fileName,
      contentType: artifact.contentType,
      payloadBase64: Buffer.from(bytes).toString("base64"),
      cacheKey: artifact.cacheKey,
      metadata: artifact.metadata ?? {},
      storageUrl: artifact.storageUrl,
    };
  }
}
