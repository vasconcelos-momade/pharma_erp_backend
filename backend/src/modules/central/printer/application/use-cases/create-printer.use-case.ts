import { PrinterRepository } from "../../infrastructure/repositories/printer.repository";
import type { CreatePrinterDTO } from "../dto/printer.dto";

export class CreatePrinterUseCase {
  constructor(private readonly printers = new PrinterRepository()) {}

  async execute(input: {
    tenantId: string;
    userId?: string | null;
    data: CreatePrinterDTO & { branchId: string };
  }) {
    return this.printers.create(
      {
        tenantId: BigInt(input.tenantId),
        branchId: BigInt(input.data.branchId),
        deviceId:
          input.data.deviceId === undefined || input.data.deviceId === null
            ? input.data.deviceId ?? null
            : BigInt(input.data.deviceId),
        name: input.data.name,
        type: input.data.type,
        connection: input.data.connection,
        ip: input.data.ip,
        port: input.data.port,
        model: input.data.model,
        manufacturer: input.data.manufacturer,
        active: input.data.active,
      },
      input.userId ? BigInt(input.userId) : null,
    );
  }
}
