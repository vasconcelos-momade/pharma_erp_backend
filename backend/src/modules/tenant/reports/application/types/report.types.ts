import { type ReportKey } from "./../constants/report-keys";

export type ReportFormat = "pdf" | "csv" | "excel";
export type ReportDisposition = "inline" | "attachment";
export type ReportPageOrientation = "portrait" | "landscape";
export type ReportPageSize = "A4" | "LETTER";

export type ReportArtifact = {
  bytes: Uint8Array;
  fileName: string;
  contentType: string;
  disposition: ReportDisposition;
};

export type ReportSectionTable = {
  title?: string;
  columns: string[];
  rows: Array<Array<unknown>>;
};

export type ReportInstitution = {
  pharmacyName: string;
  branchName?: string;
  address?: string;
  nuit?: string;
  contacts?: string;
};

export type ReportSignature = {
  label?: string;
  name?: string;
  role?: string;
  date?: string;
};

export type ReportFooterConfig = {
  left?: string;
  center?: string;
  right?: string;
};

export type ReportPresentation = {
  logoAsset?: string;
  showLogo?: boolean;
  watermarkText?: string;
  showWatermark?: boolean;
  signature?: ReportSignature;
  showSignature?: boolean;
  footer?: ReportFooterConfig;
  emptyStateMessage?: string;
};

export type ReportPdfConfig = {
  template?: string;
  orientation?: ReportPageOrientation;
  pageSize?: ReportPageSize;
};

export type ReportCsvConfig = {
  delimiter?: string;
};

export type ReportExcelConfig = {
  sheetName?: string;
};

export type ReportPrintOptions = {
  showLogo?: boolean;
};

export type ReportDefinition = {
  fileBaseName: string;
  reportName: string;
  title?: string;
  subtitle?: string;
  orientation?: ReportPageOrientation;
  pageSize?: ReportPageSize;
  generatedAt: Date;
  generatedBy: string;
  institution: ReportInstitution;
  filters?: Record<string, unknown>;
  kpis?: Record<string, unknown>;
  tables: ReportSectionTable[];
  totals?: Record<string, unknown>;
  observations?: string[];
  permissions?: string[];
  presentation?: ReportPresentation;
  pdf?: ReportPdfConfig;
  csv?: ReportCsvConfig;
  excel?: ReportExcelConfig;
  print?: ReportPrintOptions;
};

export type ModuleReportDefinition = Omit<
  ReportDefinition,
  "generatedAt" | "generatedBy" | "institution"
>;

export type ReportProviderContext = {
  userId: string;
  routeParams: Record<string, string>;
  url: URL;
};

export interface ReportDataProvider {
  readonly reportKey: ReportKey;
  build(context: ReportProviderContext): Promise<ModuleReportDefinition>;
}

export interface ReportExporter {
  readonly format: ReportFormat;
  export(
    definition: ReportDefinition,
    disposition: ReportDisposition,
  ): ReportArtifact | Promise<ReportArtifact>;
}

export type ReportHtmlSection = {
  partial:
    | "institutional-info"
    | "kpis"
    | "filters"
    | "table"
    | "summary"
    | "observations"
    | "signature"
    | "empty-state";
  title?: string;
  items?: Array<{ label: string; value: string }>;
  columns?: string[];
  rows?: string[][];
  observations?: string[];
  message?: string;
  signature?: ReportSignature;
  institution?: Record<string, string>;
  titleText?: string;
  subtitle?: string;
  logoSrc?: string;
  generatedBy?: string;
  generatedDate?: string;
  generatedTime?: string;
};
