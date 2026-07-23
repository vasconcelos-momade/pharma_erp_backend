import { PrinterRepository } from "../../infrastructure/repositories/printer.repository";

export class GetPrinterUseCase {
  constructor(private readonly printers = new PrinterRepository()) {}

  async execute(input: { tenantId: string; printerId: string }) {
    const printer = await this.printers.findById(
      BigInt(input.printerId),
      BigInt(input.tenantId),
    );
    if (!printer) throw new Error("Impressora não encontrada");
    return printer;
  }
}
