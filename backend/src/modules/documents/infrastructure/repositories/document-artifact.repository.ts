import { getPrisma } from "../../../../infrastructure/prisma/tenant-prisma.factory";
import type {
  DocumentArtifactFormat,
  DocumentArtifactKind,
  DocumentArtifactStatus,
  InvoiceDocumentSnapshotPayload,
} from "../../domain/document.types";

export class DocumentArtifactRepository {
  private readonly prisma = getPrisma() as any;

  async findLatestSnapshotByInvoiceId(faturaId: string) {
    return this.prisma.invoiceDocumentSnapshot.findFirst({
      where: { faturaId: BigInt(faturaId) },
      orderBy: [{ version: "desc" }],
    });
  }

  async findSnapshotById(snapshotId: string) {
    return this.prisma.invoiceDocumentSnapshot.findUnique({
      where: { id: BigInt(snapshotId) },
    });
  }

  async createSnapshot(input: {
    faturaId: string;
    version: number;
    documentNumber: string;
    documentType: string;
    documentStatus: string;
    sourceHash: string;
    qrPayload?: string | null;
    qrCodeDataUrl?: string | null;
    createdById?: string | null;
    payload: InvoiceDocumentSnapshotPayload;
  }) {
    return this.prisma.invoiceDocumentSnapshot.create({
      data: {
        faturaId: BigInt(input.faturaId),
        version: input.version,
        documentNumber: input.documentNumber,
        documentType: input.documentType,
        documentStatus: input.documentStatus,
        sourceHash: input.sourceHash,
        payload: input.payload,
        qrPayload: input.qrPayload ?? null,
        qrCodeDataUrl: input.qrCodeDataUrl ?? null,
        createdById: input.createdById ? BigInt(input.createdById) : null,
      },
    });
  }

  async upsertArtifact(input: {
    snapshotId: string;
    faturaId: string;
    kind: DocumentArtifactKind;
    format: DocumentArtifactFormat;
    version: number;
    provider: string;
    fileName: string;
    contentType: string;
    status: DocumentArtifactStatus;
    byteSize?: number | null;
    storageBucket?: string | null;
    storageKey?: string | null;
    storageUrl?: string | null;
    checksumSha256?: string | null;
    cacheKey?: string | null;
    metadata?: Record<string, unknown> | null;
    engine?: string | null;
    engineVersion?: string | null;
    errorMessage?: string | null;
    generatedAt?: Date | null;
  }) {
    return this.prisma.documentArtifact.upsert({
      where: {
        snapshotId_artifactType_format_version: {
          snapshotId: BigInt(input.snapshotId),
          artifactType: input.kind,
          format: input.format,
          version: input.version,
        },
      },
      update: {
        provider: input.provider,
        fileName: input.fileName,
        contentType: input.contentType,
        status: input.status,
        byteSize: input.byteSize ?? null,
        storageBucket: input.storageBucket ?? null,
        storageKey: input.storageKey ?? null,
        storageUrl: input.storageUrl ?? null,
        checksumSha256: input.checksumSha256 ?? null,
        cacheKey: input.cacheKey ?? null,
        metadata: input.metadata ?? null,
        engine: input.engine ?? null,
        engineVersion: input.engineVersion ?? null,
        errorMessage: input.errorMessage ?? null,
        generatedAt: input.generatedAt ?? null,
      },
      create: {
        snapshotId: BigInt(input.snapshotId),
        faturaId: BigInt(input.faturaId),
        artifactType: input.kind,
        format: input.format,
        version: input.version,
        provider: input.provider,
        fileName: input.fileName,
        contentType: input.contentType,
        status: input.status,
        byteSize: input.byteSize ?? null,
        storageBucket: input.storageBucket ?? null,
        storageKey: input.storageKey ?? null,
        storageUrl: input.storageUrl ?? null,
        checksumSha256: input.checksumSha256 ?? null,
        cacheKey: input.cacheKey ?? null,
        metadata: input.metadata ?? null,
        engine: input.engine ?? null,
        engineVersion: input.engineVersion ?? null,
        errorMessage: input.errorMessage ?? null,
        generatedAt: input.generatedAt ?? null,
      },
    });
  }

  async findReadyArtifact(faturaId: string, kind: DocumentArtifactKind) {
    return this.prisma.documentArtifact.findFirst({
      where: {
        faturaId: BigInt(faturaId),
        artifactType: kind,
        status: "READY",
      },
      include: {
        snapshot: true,
      },
      orderBy: [{ version: "desc" }, { createdAt: "desc" }],
    });
  }

  async markArtifactProcessing(snapshotId: string, faturaId: string, kind: DocumentArtifactKind, format: DocumentArtifactFormat) {
    return this.upsertArtifact({
      snapshotId,
      faturaId,
      kind,
      format,
      version: 1,
      provider: "pending",
      fileName: `${kind.toLowerCase()}-${faturaId}`,
      contentType: format === "PDF" ? "application/pdf" : "application/octet-stream",
      status: "PROCESSING",
    });
  }
}
