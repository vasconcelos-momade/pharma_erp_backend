import * as QRCode from "qrcode";
import { GetFaturaDetalheUseCase } from "../../../tenant/pos/application/use-cases/get-fatura-detalhe.use-case";
import { getBranchStore } from "../../../../shared/context/branch-context";
import { DocumentHashService } from "../../domain/document-hash.service";
import { InvoiceDocumentSnapshotFactory } from "../services/invoice-document-snapshot.factory";
import { DocumentArtifactRepository } from "../../infrastructure/repositories/document-artifact.repository";

export class EnsureInvoiceDocumentSnapshotUseCase {
  constructor(
    private readonly detailUseCase = new GetFaturaDetalheUseCase(),
    private readonly snapshotFactory = new InvoiceDocumentSnapshotFactory(),
    private readonly repository = new DocumentArtifactRepository(),
  ) {}

  async execute(faturaId: string, viewerUserId: string) {
    const existing = await this.repository.findLatestSnapshotByInvoiceId(faturaId);
    if (existing) {
      return existing;
    }

    const detail = await this.detailUseCase.execute(faturaId, viewerUserId);
    const qrCodeDataUrl =
      detail.qrCode?.trim()
        ? await QRCode.toDataURL(detail.qrCode, {
            margin: 1,
            width: 256,
          })
        : null;
    const payload = this.snapshotFactory.build(detail, qrCodeDataUrl);
    const sourceHash = DocumentHashService.computeSnapshotHash(payload);

    return this.repository.createSnapshot({
      faturaId,
      version: 1,
      documentNumber: payload.number,
      documentType: payload.type,
      documentStatus: payload.status,
      sourceHash,
      qrPayload: payload.fiscal.qrPayload,
      qrCodeDataUrl: payload.fiscal.qrCodeDataUrl,
      createdById: viewerUserId,
      payload,
    });
  }
}
