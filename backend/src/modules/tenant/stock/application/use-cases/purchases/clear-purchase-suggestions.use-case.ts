import { getPrisma } from "../../../../../../infrastructure/prisma/tenant-prisma.factory";

export class ClearPurchaseSuggestionsUseCase {
  async execute() {
    const prisma = getPrisma() as any;
    const result = await prisma.purchaseSuggestion.deleteMany({});
    return {
      message: "Lista de sugestões limpa com sucesso",
      removedCount: result.count,
    };
  }
}
