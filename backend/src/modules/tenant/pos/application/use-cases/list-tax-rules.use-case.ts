import { getPrisma } from "../../../../../infrastructure/prisma/tenant-prisma.factory";

export class ListTaxRulesUseCase {
  async execute() {
    const prisma = getPrisma();
    const rules = await prisma.taxRule.findMany({
      where: { ativo: true },
      orderBy: { codigo: "asc" },
    });
    return rules;
  }
}
