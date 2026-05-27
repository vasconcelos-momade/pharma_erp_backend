import { getBranchStore } from "../../../../shared/context/branch-context";
import { DocumentArtifactRepository } from "../../infrastructure/repositories/document-artifact.repository";
import { EscPosEngineService } from "../../infrastructure/escpos/escpos-engine.service";
import { PdfEngineService } from "../../infrastructure/pdf/pdf-engine.service";
import { DocumentStorageService } from "../../infrastructure/storage/document-storage.service";

export class GenerateInvoiceArtifactsUseCase {
  constructor(
    private readonly repository = new DocumentArtifactRepository(),
    private readonly pdfEngine = new PdfEngineService(),
    private readonly escPosEngine = new EscPosEngineService(),
    private readonly storage = new DocumentStorageService(),
  ) {}

  async execute(faturaId: string, snapshotId?: string) {
    const snapshot =
      snapshotId != null
        ? await this.repository.findSnapshotById(snapshotId)
        : await this.repository.findLatestSnapshotByInvoiceId(faturaId);

    if (!snapshot) {
      throw new Error("Snapshot fiscal nao encontrado para a fatura.");
    }

    const payload = snapshot.payload as any;
    const branch = getBranchStore();

    const pdf = await this.pdfEngine.generateInvoicePdf(payload);
    const escPos = this.escPosEngine.generateReceipt(payload, 80);

    const pdfKey = `${branch.dbName}/faturas/${faturaId}/v${snapshot.version}/${pdf.fileName}`;
    const escPosKey = `${branch.dbName}/faturas/${faturaId}/v${snapshot.version}/${escPos.fileName}`;

    const [storedPdf, storedEscPos] = await Promise.all([
      this.storage.putObject(pdfKey, pdf.bytes, pdf.contentType),
      this.storage.putObject(escPosKey, escPos.bytes, escPos.contentType),
    ]);

    await Promise.all([
      this.repository.upsertArtifact({
        snapshotId: snapshot.id.toString(),
        faturaId,
        kind: pdf.kind,
        format: pdf.format,
        version: snapshot.version,
        provider: process.env.DOCUMENT_STORAGE_DRIVER ?? "local",
        fileName: pdf.fileName,
        contentType: pdf.contentType,
        status: "READY",
        byteSize: storedPdf.size,
        storageBucket: storedPdf.bucket,
        storageKey: storedPdf.key,
        storageUrl: storedPdf.url,
        checksumSha256: storedPdf.checksumSha256,
        cacheKey: pdf.cacheKey,
        metadata: pdf.metadata ?? null,
        engine: pdf.engine,
        engineVersion: pdf.engineVersion,
        generatedAt: new Date(),
      }),
      this.repository.upsertArtifact({
        snapshotId: snapshot.id.toString(),
        faturaId,
        kind: escPos.kind,
        format: escPos.format,
        version: snapshot.version,
        provider: process.env.DOCUMENT_STORAGE_DRIVER ?? "local",
        fileName: escPos.fileName,
        contentType: escPos.contentType,
        status: "READY",
        byteSize: storedEscPos.size,
        storageBucket: storedEscPos.bucket,
        storageKey: storedEscPos.key,
        storageUrl: storedEscPos.url,
        checksumSha256: storedEscPos.checksumSha256,
        cacheKey: escPos.cacheKey,
        metadata: escPos.metadata ?? null,
        engine: escPos.engine,
        engineVersion: escPos.engineVersion,
        generatedAt: new Date(),
      }),
    ]);

    return {
      snapshotId: snapshot.id.toString(),
      pdf: storedPdf,
      escPos: storedEscPos,
    };
  }
}
