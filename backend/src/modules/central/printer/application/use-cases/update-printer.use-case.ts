import { PrinterRepository } from "../../infrastructure/repositories/printer.repository";
import type { UpdatePrinterDTO } from "../dto/printer.dto";

export class UpdatePrinterUseCase {
  constructor(private readonly printers = new PrinterRepository()) {}

  async execute(input: {
    tenantId: string;
    printerId: string;
    userId?: string | null;
    data: UpdatePrinterDTO;
  }) {
    return this.printers.update(
      BigInt(input.printerId),
      BigInt(input.tenantId),
      {
        deviceId:
          input.data.deviceId === undefined
            ? undefined
            : input.data.deviceId === null
              ? null
              : BigInt(input.data.deviceId),
        name: input.data.name,
        type: input.data.type,
        connection: input.data.connection,
        ip: input.data.ip,
        port: input.data.port,
        model: input.data.model,
        manufacturer: input.data.manufacturer,
        active: input.data.active,
        version: input.data.version,
      },
      input.userId ? BigInt(input.userId) : null,
    );
  }
}
