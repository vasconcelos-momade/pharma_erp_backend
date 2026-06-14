import { getPrisma } from "../../../../../../infrastructure/prisma/tenant-prisma.factory";
import {
  NotFoundApiError,
  ValidationApiError,
} from "../../../../../../shared/http/api-error";
import type { UpdateRequisitionDTO } from "../../dto/requisitions.dto";

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

export class UpdateRequisitionUseCase {
  async execute(requisicaoId: string, input: UpdateRequisitionDTO) {
    const prisma = getPrisma() as any;

    return prisma.$transaction(async (tx: any) => {
      const requisicao = await tx.requisicao.findUnique({
        where: { id: BigInt(requisicaoId) },
      });

      if (!requisicao) {
        throw new NotFoundApiError(`Requisicao ${requisicaoId} nao encontrada`);
      }

      if (requisicao.status !== "PENDENTE") {
        throw new ValidationApiError(
          "So e possivel editar requisicoes pendentes",
        );
      }

      const numeroDocumento =
        input.numeroDocumento?.trim() ?? requisicao.numeroDocumento;
      const fornecedorId =
        input.fornecedorId !== undefined
          ? input.fornecedorId
            ? BigInt(input.fornecedorId)
            : null
          : requisicao.fornecedorId;
      const origem =
        input.origem !== undefined
          ? normalizeLocation(input.origem)
          : requisicao.origem;
      const destino =
        input.destino !== undefined
          ? normalizeLocation(input.destino)
          : requisicao.destino;
      const observacao =
        input.observacao !== undefined
          ? normalizeLocation(input.observacao)
          : requisicao.observacao;

      validateLocations(
        requisicao.tipo,
        requisicao.tipo === "ENTRADA" ? origem : null,
        requisicao.tipo === "SAIDA" ? destino : null,
        fornecedorId,
      );

      if (fornecedorId != null) {
        const fornecedor = await tx.fornecedor.findUnique({
          where: { id: fornecedorId },
        });
        if (!fornecedor) {
          throw new NotFoundApiError(
            `Fornecedor ${fornecedorId.toString()} nao encontrado`,
          );
        }
      }

      if (numeroDocumento !== requisicao.numeroDocumento) {
        const duplicate = await tx.requisicao.findFirst({
          where: {
            numeroDocumento,
            id: { not: requisicao.id },
          },
        });
        if (duplicate) {
          throw new ValidationApiError(
            "Ja existe uma requisicao com este numero de documento",
          );
        }
      }

      await tx.requisicao.update({
        where: { id: requisicao.id },
        data: {
          numeroDocumento,
          fornecedorId,
          origem: requisicao.tipo === "ENTRADA" ? origem : null,
          destino: requisicao.tipo === "SAIDA" ? destino : null,
          observacao,
        },
      });

      const { GetRequisitionDetailUseCase } = await import(
        "./get-requisition-detail.use-case"
      );
      return new GetRequisitionDetailUseCase().execute(requisicaoId);
    });
  }
}
