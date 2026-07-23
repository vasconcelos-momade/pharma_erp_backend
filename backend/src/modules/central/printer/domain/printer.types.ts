export type PrinterTypeValue = "ESC_POS" | "A4" | "LABEL";
export type PrinterConnectionValue = "NETWORK" | "USB" | "BLUETOOTH" | "PDF";
export type PrintStatusValue =
  | "PENDING"
  | "PROCESSING"
  | "PRINTED"
  | "FAILED"
  | "CANCELLED";

export type CreatePrinterInput = {
  tenantId: bigint;
  branchId: bigint;
  deviceId?: bigint | null;
  name: string;
  type: PrinterTypeValue;
  connection: PrinterConnectionValue;
  ip?: string | null;
  port?: number | null;
  model?: string | null;
  manufacturer?: string | null;
  active?: boolean;
};

export type UpdatePrinterInput = {
  deviceId?: bigint | null;
  name?: string;
  type?: PrinterTypeValue;
  connection?: PrinterConnectionValue;
  ip?: string | null;
  port?: number | null;
  model?: string | null;
  manufacturer?: string | null;
  active?: boolean;
  version: number;
};

export type ListPrintersFilters = {
  tenantId: bigint;
  branchId?: bigint;
  deviceId?: bigint;
  active?: boolean;
  type?: PrinterTypeValue;
  connection?: PrinterConnectionValue;
  search?: string;
  page?: number;
  pageSize?: number;
};

export type CreatePrintJobInput = {
  tenantId: bigint;
  branchId: bigint;
  printerId: bigint;
  document: string;
  payload: unknown;
  maxAttempts?: number;
};

export type ListPrintJobsFilters = {
  tenantId: bigint;
  branchId?: bigint;
  printerId?: bigint;
  status?: PrintStatusValue;
  document?: string;
  page?: number;
  pageSize?: number;
};

export type ClaimPrintJobInput = {
  workerId: string;
  maxJobs?: number;
};
