import { GetInvoicePrintArtifactUseCase } from "../../../../documents/application/use-cases/get-invoice-print-artifact.use-case";

export class GetFaturaPrintUseCase {
  constructor(private readonly artifactUseCase = new GetInvoicePrintArtifactUseCase()) {}

  async execute(faturaId: string, viewerUserId: string) {
    return this.artifactUseCase.execute(faturaId, viewerUserId);
  }
}
