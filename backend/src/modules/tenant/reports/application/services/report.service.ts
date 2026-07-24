import { prismaCentralUnscoped } from "../../../../../infrastructure/prisma/prisma-central.service";
import { getPrisma } from "../../../../../infrastructure/prisma/tenant-prisma.factory";
import { getBranchStore } from "../../../../../shared/context/branch-context";
import { ValidationApiError } from "../../../../../shared/http/api-error";
import { type ReportKey } from "../constants/report-keys";
import { reportExporters } from "../exports/report-exporters.registry";
import { toText } from "../helpers/report-export.helper";
import { reportDataProviders } from "../providers/report-providers.registry";
import {
  type ReportArtifact,
  type ReportDefinition,
  type ReportDisposition,
  type ReportFormat,
  type ReportProviderContext,
} from "../types/report.types";

export type GenerateReportInput = {
  reportKey: ReportKey;
  userId: string;
  routeParams: Record<string, string>;
  url: URL;
  format: ReportFormat;
  disposition: ReportDisposition;
};

export class ReportService {
  private readonly providers = new Map<ReportKey, (typeof reportDataProviders)[number]>(
    reportDataProviders.map((provider) => [provider.reportKey, provider]),
  );

  private readonly exporters = new Map(
    reportExporters.map((exporter) => [exporter.format, exporter]),
  );

  async generate(input: GenerateReportInput): Promise<ReportArtifact> {
    const provider = this.providers.get(input.reportKey);
    if (!provider) {
      throw new ValidationApiError(`Relatorio '${input.reportKey}' nao suportado`);
    }

    const exporter = this.exporters.get(input.format) ?? this.exporters.get("pdf");
    if (!exporter) {
      throw new ValidationApiError(`Formato '${input.format}' nao suportado`);
    }

    const context: ReportProviderContext = {
      userId: input.userId,
      routeParams: input.routeParams,
      url: input.url,
    };

    const [institution, moduleDefinition] = await Promise.all([
      this.buildInstitution(input.userId),
      provider.build(context),
    ]);

    const definition: ReportDefinition = {
      ...moduleDefinition,
      generatedAt: new Date(),
      generatedBy: institution.generatedBy,
      institution: {
        pharmacyName: institution.pharmacyName,
        branchName: institution.branchName,
        address: institution.address,
        nuit: institution.nuit,
        contacts: institution.contacts,
      },
    };

    return await exporter.export(definition, input.disposition);
  }

  async buildInstitution(
    userId: string,
  ): Promise<ReportDefinition["institution"] & { generatedBy: string }> {
    const store = getBranchStore();
    const [branch, user] = await Promise.all([
      (prismaCentralUnscoped as any).branch.findUnique({
        where: { id: BigInt(store.branchId) },
        include: {
          tenant: {
            select: {
              companyName: true,
              nuit: true,
              email: true,
              endereco: true,
            },
          },
        },
      }),
      (getPrisma() as any).user.findUnique({
        where: { id: BigInt(userId) },
        select: { name: true },
      }),
    ]);

    const tenant = branch?.tenant;
    const contacts = [tenant?.email]
      .map((value: unknown) => String(value ?? "").trim())
      .filter((value: string) => value.length > 0)
      .join(" | ");

    return {
      pharmacyName: toText(tenant?.companyName, "Farmacia"),
      branchName: toText(branch?.name),
      address: toText(tenant?.endereco),
      nuit: toText(tenant?.nuit),
      contacts: toText(contacts),
      generatedBy: toText(user?.name, "Sistema"),
    };
  }
}