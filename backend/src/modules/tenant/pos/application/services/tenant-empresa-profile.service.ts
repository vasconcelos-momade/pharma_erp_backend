import { prismaCentralUnscoped } from "../../../../../infrastructure/prisma/prisma-central.service";
import { getBranchStore } from "../../../../../shared/context/branch-context";

export type TenantEmpresaProfile = {
  nome: string | null;
  nuit: string | null;
  endereco: string | null;
  email: string | null;
  telefone: string | null;
};

function toNullableText(value: unknown): string | null {
  const normalized = String(value ?? "").trim();
  return normalized.length > 0 ? normalized : null;
}

export async function resolveTenantEmpresaProfile(): Promise<TenantEmpresaProfile> {
  const { tenantId } = getBranchStore();
  const tenant = await (prismaCentralUnscoped as any).tenant.findUnique({
    where: { id: BigInt(tenantId) },
    select: {
      companyName: true,
      nuit: true,
      email: true,
      endereco: true,
    },
  });

  return {
    nome: toNullableText(tenant?.companyName),
    nuit: toNullableText(tenant?.nuit),
    endereco: toNullableText(tenant?.endereco),
    email: toNullableText(tenant?.email),
    telefone: null,
  };
}
