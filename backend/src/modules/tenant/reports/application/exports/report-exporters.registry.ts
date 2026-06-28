import { CsvExporter } from "./csv.exporter";
import { ExcelExporter } from "./excel.exporter";
import { PdfExporter } from "./pdf.exporter";
import { type ReportExporter } from "../types/report.types";

export const reportExporters: ReportExporter[] = [
  new PdfExporter(),
  new CsvExporter(),
  new ExcelExporter(),
];
