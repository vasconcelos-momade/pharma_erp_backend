/// <reference types="bun-types" />
import process from "node:process";
import { CreateBranchUseCase } from "../src/modules/central/tenants/application/use-cases/create-branch.use-case";

function getArg(name: string): string | undefined {
  const prefix = `--${name}=`;
  const entry = process.argv.find((arg: string) => arg.startsWith(prefix));
  return entry ? entry.slice(prefix.length) : undefined;
}

async function main() {
  const tenantId = getArg("tenant-id");
  const code = getArg("code");
  const name = getArg("name");

  if (!tenantId || !code || !name) {
    console.error(
      "Uso: bun scripts/test-create-branch.ts --tenant-id=<id> --code=<code> --name=<nome>",
    );
    process.exit(1);
  }

  const useCase = new CreateBranchUseCase();
  const result = await useCase.execute({ tenantId, code, name });
  console.log(JSON.stringify(result, null, 2));
}

main().catch((error) => {
  console.error("[branch] erro ao criar filial:", error);
  process.exit(1);
});
