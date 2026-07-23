import { PrinterRepository } from "../../infrastructure/repositories/printer.repository";

export class DeletePrinterUseCase {
  constructor(private readonly printers = new PrinterRepository()) {}

  async execute(input: {
    tenantId: string;
    printerId: string;
    userId?: string | null;
  }) {
    return this.printers.softDelete(
      BigInt(input.printerId),
      BigInt(input.tenantId),
      input.userId ? BigInt(input.userId) : null,
    );
  }
}
