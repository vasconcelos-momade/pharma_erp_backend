import { GetInvoicePdfArtifactUseCase } from "../../../../documents/application/use-cases/get-invoice-pdf-artifact.use-case";

export class GetFaturaPdfUseCase {
  constructor(private readonly artifactUseCase = new GetInvoicePdfArtifactUseCase()) {}

  async execute(faturaId: string, viewerUserId: string) {
    return this.artifactUseCase.execute(faturaId, viewerUserId);
  }
}
