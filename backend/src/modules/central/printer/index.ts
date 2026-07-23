export type {
  ClaimPrintJobInput,
  CreatePrintJobInput,
  CreatePrinterInput,
  ListPrintJobsFilters,
  ListPrintersFilters,
  PrinterConnectionValue,
  PrinterTypeValue,
  PrintStatusValue,
  UpdatePrinterInput,
} from "./domain/printer.types";

export { serializePrintJob, serializePrinter } from "./domain/printer.mapper";
export { writeCentralAuditLog } from "./infrastructure/central-audit.helper";
export { PrinterRepository } from "./infrastructure/repositories/printer.repository";
export { PrintJobRepository } from "./infrastructure/repositories/print-job.repository";

export {
  createPrinterSchema,
  updatePrinterSchema,
  listPrintersQuerySchema,
  createPrintJobSchema,
  listPrintJobsQuerySchema,
  testPrinterSchema,
  printerIdParamSchema,
  printJobIdParamSchema,
  printerTypeSchema,
  printerConnectionSchema,
  printStatusSchema,
  type CreatePrinterDTO,
  type UpdatePrinterDTO,
  type ListPrintersQueryDTO,
  type CreatePrintJobDTO,
  type ListPrintJobsQueryDTO,
  type TestPrinterDTO,
} from "./application/dto/printer.dto";

export { CreatePrinterUseCase } from "./application/use-cases/create-printer.use-case";
export { UpdatePrinterUseCase } from "./application/use-cases/update-printer.use-case";
export { DeletePrinterUseCase } from "./application/use-cases/delete-printer.use-case";
export { GetPrinterUseCase } from "./application/use-cases/get-printer.use-case";
export { ListPrintersUseCase } from "./application/use-cases/list-printers.use-case";
export { TestPrinterUseCase } from "./application/use-cases/test-printer.use-case";
export { CreatePrintJobUseCase } from "./application/use-cases/create-print-job.use-case";
export { GetPrintJobUseCase } from "./application/use-cases/get-print-job.use-case";
export { ListPrintJobsUseCase } from "./application/use-cases/list-print-jobs.use-case";
export { CancelPrintJobUseCase } from "./application/use-cases/cancel-print-job.use-case";
export { ProcessPrintJobUseCase } from "./application/use-cases/process-print-job.use-case";
export { GetPrintJobPdfUseCase } from "./application/use-cases/get-print-job-pdf.use-case";
export {
  DrainPrintJobsUseCase,
  enqueuePrintProcessJob,
} from "./application/use-cases/drain-print-jobs.use-case";
export { PrinterDriverRegistry } from "./application/services/printer-driver.registry";
export { EscPosNetworkDriver } from "./infrastructure/drivers/escpos-network.driver";
export { PdfDriver } from "./infrastructure/drivers/pdf.driver";
export { EscPosEncoder, buildEscPosBytes } from "./infrastructure/drivers/escpos-encoder";
export {
  buildPrintPdfBytes,
  buildPrintPdfLines,
  toBase64,
} from "./infrastructure/drivers/pdf-document.builder";
export type {
  PrinterDriver,
  PrintDriverResult,
  PrintDriverTarget,
  PrintDriverJob,
} from "./domain/drivers/printer-driver";
