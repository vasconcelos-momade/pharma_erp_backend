import { getPrisma } from "../../../../../../infrastructure/prisma/tenant-prisma.factory";
import { ValidationApiError } from "../../../../../../shared/http/api-error";

export interface CreateTransferInput {
  numeroDocumento: string;
  origem: string;
  destino: string;
  tipo?: "SAIDA" | "ENTRADA";
  observacao?: string;
  userId: string;
}

export class CreateTransferUseCase {
  async execute(data: CreateTransferInput) {
    const prisma = getPrisma() as any;

    if (data.origem.trim() === data.destino.trim()) {
      throw new ValidationApiError(
        "Origem e destino da transferência devem ser diferentes",
      );
    }

    const transferencia = await prisma.transferencia.create({
      data: {
        numeroDocumento: data.numeroDocumento.trim(),
        origem: data.origem.trim(),
        destino: data.destino.trim(),
        tipo: data.tipo ?? "SAIDA",
        observacao: data.observacao?.trim() || null,
        userId: BigInt(data.userId),
      },
    });

    return {
      message: "Transferência criada com sucesso",
      transferenciaId: transferencia.id.toString(),
      numeroDocumento: transferencia.numeroDocumento,
      status: transferencia.status,
    };
  }
}
