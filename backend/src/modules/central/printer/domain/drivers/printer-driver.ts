export type PrintDriverResult = {
  success: boolean;
  bytesSent?: number;
  output?: Uint8Array;
  mimeType?: string;
  errorMessage?: string;
};

export type PrintDriverTarget = {
  printerId: string;
  name: string;
  type: string;
  connection: string;
  ip?: string | null;
  port?: number | null;
};

export type PrintDriverJob = {
  jobId: string;
  document: string;
  payload: unknown;
};

/**
 * Strategy: cada meio de saída implementa PrinterDriver.
 * V1: EscPosNetworkDriver | PdfDriver (etapa 7)
 * Futuro: UsbDriver | BluetoothDriver | LabelDriver
 */
export interface PrinterDriver {
  readonly name: string;
  supports(target: PrintDriverTarget): boolean;
  print(target: PrintDriverTarget, job: PrintDriverJob): Promise<PrintDriverResult>;
}
