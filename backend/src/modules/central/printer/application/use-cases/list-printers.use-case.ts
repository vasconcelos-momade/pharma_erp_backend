import { PrinterRepository } from "../../infrastructure/repositories/printer.repository";
import type { ListPrintersQueryDTO } from "../dto/printer.dto";

export class ListPrintersUseCase {
  constructor(private readonly printers = new PrinterRepository()) {}

  async execute(input: {
    tenantId: string;
    branchId?: string | null;
    query: ListPrintersQueryDTO;
  }) {
    const branchId =
      input.query.branchId ?? input.branchId ?? undefined;

    return this.printers.list({
      tenantId: BigInt(input.tenantId),
      branchId: branchId ? BigInt(branchId) : undefined,
      deviceId: input.query.deviceId ? BigInt(input.query.deviceId) : undefined,
      active: input.query.active,
      type: input.query.type,
      connection: input.query.connection,
      search: input.query.q ?? input.query.search,
      page: input.query.page,
      pageSize: input.query.pageSize,
    });
  }
}
