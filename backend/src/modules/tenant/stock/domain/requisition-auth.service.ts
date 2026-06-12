import { getPrisma } from "../../../../infrastructure/prisma/tenant-prisma.factory";
import { ForbiddenApiError } from "../../../../shared/http/api-error";

const REQUISITION_MANAGER_ROLES = new Set([
  "ADMIN",
  "GERENTE",
  "DIRETOR_TECNICO",
  "FARMACEUTICO",
]);

export async function assertRequisitionManagerRole(userId: string): Promise<void> {
  const prisma = getPrisma() as any;
  const user = await prisma.user.findUnique({
    where: { id: BigInt(userId) },
    select: { id: true, role: true, active: true },
  });

  if (!user?.active) {
    throw new ForbiddenApiError("Utilizador inactivo");
  }

  if (!REQUISITION_MANAGER_ROLES.has(user.role)) {
    throw new ForbiddenApiError(
      "Apenas gestores ou farmaceuticos podem aprovar, rejeitar ou cancelar requisicoes",
    );
  }
}

export const assertTransferManagerRole = assertRequisitionManagerRole;
