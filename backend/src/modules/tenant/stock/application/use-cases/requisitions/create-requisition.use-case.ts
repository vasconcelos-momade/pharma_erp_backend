import { getPrisma } from "../../../../../../infrastructure/prisma/tenant-prisma.factory";
import {
  NotFoundApiError,
  ValidationApiError,
} from "../../../../../../shared/http/api-error";

function normalizeLocation(value?: string | null): string | null {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

function validateLocations(
  tipo: "COMPRA" | "SAIDA" | "ENTRADA",
  origem: string | null,
  destino: string | null,
  fornecedorId: bigint | null,
): void {
  if (tipo === "COMPRA") {
    if (!fornecedorId) {
      throw new ValidationApiError(
        "Requisicoes do tipo COMPRA exigem o fornecedor",
      );
    }
    if (origem || destino) {
      throw new ValidationApiError(
        "Origem e destino devem ser nulos para requisicoes do tipo COMPRA",
      );
    }
    return;
  }

  if (tipo === "SAIDA") {
    if (!destino) {
      throw new ValidationApiError(
        "Requisicoes do tipo SAIDA exigem o destino",
      );
    }
    if (origem) {
      throw new ValidationApiError(
        "Origem deve ser nula para requisicoes do tipo SAIDA",
      );
    }
  }

  if (tipo === "ENTRADA") {
    if (!origem) {
      throw new ValidationApiError(
        "Requisicoes do tipo ENTRADA exigem a origem",
      );
    }
    if (destino) {
      throw new ValidationApiError(
        "Destino deve ser nulo para requisicoes do tipo ENTRADA",
      );
    }
  }
}

export interface CreateRequisitionInput {
  numeroDocumento: string;
  fornecedorId?: string | null;
  origem?: string | null;
  destino?: string | null;
  tipo: "COMPRA" | "SAIDA" | "ENTRADA";
  observacao?: string;
  userId: string;
}

export class CreateRequisitionUseCase {
  async execute(data: CreateRequisitionInput) {
    const prisma = getPrisma() as any;
    const origem = normalizeLocation(data.origem);
    const destino = normalizeLocation(data.destino);
    const tipo = data.tipo;
    const fornecedorId = data.fornecedorId
      ? BigInt(data.fornecedorId)
      : null;

    validateLocations(tipo, origem, destino, fornecedorId);

    if (fornecedorId != null) {
      const fornecedor = await prisma.fornecedor.findUnique({
        where: { id: fornecedorId },
      });
      if (!fornecedor) {
        throw new NotFoundApiError(
          `Fornecedor ${data.fornecedorId} nao encontrado`,
        );
      }
    }

    const requisicao = await prisma.requisicao.create({
      data: {
        numeroDocumento: data.numeroDocumento.trim(),
        origem: tipo === "ENTRADA" ? origem : null,
        destino: tipo === "SAIDA" ? destino : null,
        tipo,
        status: "PENDENTE",
        observacao: data.observacao?.trim() || null,
        fornecedorId,
        total: tipo === "COMPRA" ? 0 : null,
        userId: BigInt(data.userId),
      },
    });

    return {
      message: "Requisicao criada com sucesso",
      requisicaoId: requisicao.id.toString(),
      numeroDocumento: requisicao.numeroDocumento,
      status: requisicao.status,
      tipo: requisicao.tipo,
    };
  }
}
