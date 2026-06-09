import { getPrisma } from "../../../../infrastructure/prisma/tenant-prisma.factory";
import { ForbiddenApiError } from "../../../../shared/http/api-error";

const TRANSFER_MANAGER_ROLES = new Set([
  "ADMIN",
  "GERENTE",
  "DIRETOR_TECNICO",
  "FARMACEUTICO",
]);

export async function assertTransferManagerRole(userId: string): Promise<void> {
  const prisma = getPrisma() as any;
  const user = await prisma.user.findUnique({
    where: { id: BigInt(userId) },
    select: { id: true, role: true, active: true },
  });

  if (!user?.active) {
    throw new ForbiddenApiError("Utilizador inactivo");
  }

  if (!TRANSFER_MANAGER_ROLES.has(user.role)) {
    throw new ForbiddenApiError(
      "Apenas gestores ou farmacêuticos podem confirmar ou cancelar transferências",
    );
  }
}
