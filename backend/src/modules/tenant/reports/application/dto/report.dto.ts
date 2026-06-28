import {
  type ReportDisposition,
  type ReportFormat,
} from "../types/report.types";

type ReportQuery = {
  format?: ReportFormat;
  disposition?: ReportDisposition;
};

export type ExpiryReportQuery = ReportQuery & {
  q?: string;
  bucket?: "expirado" | "30" | "60" | "todos";
};

function normalizeOptionalString(value: string | null): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

function parseFormat(value: string | null): ReportFormat | undefined {
  if (value === "pdf" || value === "csv" || value === "excel") {
    return value;
  }
  return undefined;
}

function parseDisposition(value: string | null): ReportDisposition | undefined {
  if (value === "inline" || value === "attachment") {
    return value;
  }
  return undefined;
}

export function parseReportQuery(url: URL): ReportQuery {
  return {
    format: parseFormat(url.searchParams.get("format")),
    disposition: parseDisposition(url.searchParams.get("disposition")),
  };
}

export function resolveReportDisposition(
  format: ReportFormat,
  disposition?: ReportDisposition,
): ReportDisposition {
  if (disposition) {
    return disposition;
  }
  return format === "pdf" ? "inline" : "attachment";
}

export function parseExpiryReportQuery(url: URL): ExpiryReportQuery {
  const bucket = url.searchParams.get("bucket");
  return {
    ...parseReportQuery(url),
    q: normalizeOptionalString(url.searchParams.get("q")),
    bucket:
      bucket === "expirado" ||
      bucket === "30" ||
      bucket === "60" ||
      bucket === "todos"
        ? bucket
        : undefined,
  };
}
