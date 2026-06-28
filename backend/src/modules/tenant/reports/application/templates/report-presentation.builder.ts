import { formatDate, formatTime, toText } from "../helpers/report-export.helper";
import { resolveLogoDataUri } from "../helpers/report-assets.helper";
import {
  type ReportDefinition,
  type ReportHtmlSection,
  type ReportPresentation,
} from "../types/report.types";

export type ReportLabelValueRow = {
  label: string;
  value: string;
};

function toRows(values?: Record<string, unknown>): ReportLabelValueRow[] {
  return Object.entries(values ?? {})
    .filter(([, value]) => value != null && `${value}`.trim() !== "")
    .map(([label, value]) => ({
      label,
      value: toText(value),
    }));
}

function resolvePresentation(definition: ReportDefinition): Required<
  Pick<
    ReportPresentation,
    "showLogo" | "showWatermark" | "showSignature" | "emptyStateMessage"
  >
> &
  ReportPresentation {
  const presentation = definition.presentation ?? {};
  const showLogo =
    presentation.showLogo ?? definition.print?.showLogo ?? true;

  return {
    ...presentation,
    showLogo,
    showWatermark: presentation.showWatermark ?? false,
    showSignature: presentation.showSignature ?? Boolean(presentation.signature),
    emptyStateMessage:
      presentation.emptyStateMessage ??
      "Sem registos para os filtros aplicados.",
    logoAsset: presentation.logoAsset ?? "logo.svg",
    watermarkText: presentation.showWatermark
      ? toText(presentation.watermarkText, "PHARMA ERP")
      : "",
    footer: {
      left: toText(
        presentation.footer?.left,
        "Pagina 1/1",
      ),
      center: toText(
        presentation.footer?.center,
        "Gerado automaticamente pelo Pharma ERP",
      ),
      right: toText(
        presentation.footer?.right,
        `${formatDate(definition.generatedAt)} ${formatTime(definition.generatedAt)}`,
      ),
    },
    signature: presentation.signature,
  };
}

export function buildReportHtmlSections(
  definition: ReportDefinition,
): ReportHtmlSection[] {
  const presentation = resolvePresentation(definition);
  const filters = toRows(definition.filters);
  const kpis = toRows(definition.kpis);
  const totals = toRows(definition.totals);
  const observations = (definition.observations ?? []).map((item) => toText(item));
  const tables = definition.tables.map((table) => ({
    title: table.title ?? "",
    columns: table.columns,
    rows: table.rows.map((row) => row.map((cell) => toText(cell))),
  }));

  const sections: ReportHtmlSection[] = [
    {
      partial: "institutional-info",
      titleText: definition.title ?? definition.reportName,
      subtitle: definition.subtitle ?? "",
      logoSrc: presentation.showLogo
        ? resolveLogoDataUri(presentation.logoAsset)
        : "",
      institution: {
        pharmacyName: toText(definition.institution.pharmacyName),
        branchName: toText(definition.institution.branchName),
        address: toText(definition.institution.address),
        nuit: toText(definition.institution.nuit),
        contacts: toText(definition.institution.contacts),
      },
      generatedBy: toText(definition.generatedBy),
      generatedDate: formatDate(definition.generatedAt),
      generatedTime: formatTime(definition.generatedAt),
    },
  ];

  if (kpis.length > 0) {
    sections.push({
      partial: "kpis",
      title: "KPIs",
      items: kpis,
    });
  }

  if (filters.length > 0) {
    sections.push({
      partial: "filters",
      title: "Filtros aplicados",
      items: filters,
    });
  }

  for (const table of tables) {
    sections.push({
      partial: "table",
      title: table.title,
      columns: table.columns,
      rows: table.rows,
    });
  }

  if (tables.length === 0 && kpis.length === 0) {
    sections.push({
      partial: "empty-state",
      message: presentation.emptyStateMessage,
    });
  }

  if (totals.length > 0) {
    sections.push({
      partial: "summary",
      title: "Totais",
      items: totals,
    });
  }

  if (observations.length > 0) {
    sections.push({
      partial: "observations",
      title: "Observacoes",
      observations,
    });
  }

  if (presentation.showSignature && presentation.signature) {
    sections.push({
      partial: "signature",
      signature: {
        label: toText(presentation.signature.label, "Assinatura"),
        name: toText(presentation.signature.name, definition.generatedBy),
        role: toText(presentation.signature.role, "Responsavel"),
        date: toText(
          presentation.signature.date,
          formatDate(definition.generatedAt),
        ),
      },
    });
  }

  return sections;
}

export function buildInstitutionalReportView(definition: ReportDefinition) {
  const presentation = resolvePresentation(definition);
  const filters = toRows(definition.filters);
  const kpis = toRows(definition.kpis);
  const totals = toRows(definition.totals);

  return {
    title: definition.title ?? definition.reportName,
    subtitle: definition.subtitle ?? "",
    watermarkText: presentation.watermarkText ?? "",
    logoSrc: presentation.showLogo
      ? resolveLogoDataUri(presentation.logoAsset)
      : "",
    pageOrientation:
      definition.pdf?.orientation ?? definition.orientation ?? "portrait",
    pageSize: definition.pdf?.pageSize ?? definition.pageSize ?? "A4",
    footer: presentation.footer,
    filters,
    kpis,
    totals,
    observations: (definition.observations ?? []).map((item) => toText(item)),
    tables: definition.tables.map((table) => ({
      title: table.title ?? "",
      columns: table.columns,
      rows: table.rows.map((row) => row.map((cell) => toText(cell))),
    })),
    sections: buildReportHtmlSections(definition),
    headerLines: [
      "PHARMA ERP",
      definition.institution.pharmacyName,
      definition.institution.branchName
        ? `Filial: ${definition.institution.branchName}`
        : "Filial: -",
      `Endereco: ${toText(definition.institution.address)}`,
      `NUIT: ${toText(definition.institution.nuit)}`,
      `Contactos: ${toText(definition.institution.contacts)}`,
      `Data: ${formatDate(definition.generatedAt)}`,
      `Hora: ${formatTime(definition.generatedAt)}`,
      `Utilizador: ${toText(definition.generatedBy)}`,
      `Relatorio: ${definition.reportName}`,
    ],
    footerLines: [
      presentation.footer?.left ?? "Pagina 1/1",
      presentation.footer?.center ?? "Gerado automaticamente pelo Pharma ERP",
      presentation.footer?.right ??
        `${formatDate(definition.generatedAt)} ${formatTime(definition.generatedAt)}`,
    ],
  };
}
