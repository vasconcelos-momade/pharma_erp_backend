import { getPrisma } from "../../../../../../infrastructure/prisma/tenant-prisma.factory";
import { NotFoundApiError } from "../../../../../../shared/http/api-error";

export class RemovePurchaseSuggestionUseCase {
  async execute(produtoId: string) {
    const prisma = getPrisma() as any;

    const existing = await prisma.purchaseSuggestion.findUnique({
      where: { produtoId: BigInt(produtoId) },
    });

    if (!existing) {
      throw new NotFoundApiError("Sugestão não encontrada para este produto");
    }

    await prisma.purchaseSuggestion.delete({
      where: { produtoId: BigInt(produtoId) },
    });

    return { message: "Sugestão removida com sucesso" };
  }
}
