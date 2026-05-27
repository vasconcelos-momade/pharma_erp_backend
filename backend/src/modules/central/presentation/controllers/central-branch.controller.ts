import { z } from "zod";
import { CreateBranchUseCase } from "../../tenants/application/use-cases/create-branch.use-case";
import { ListBranchesUseCase } from "../../tenants/application/use-cases/list-branches.use-case";
import { serializeForJson } from "../../../../shared/http/serialize-json";
import { parseJsonBody } from "../../../../shared/http/request-validation";

const createBranchSchema = z.object({
  code: z.string().trim().min(1),
  name: z.string().trim().min(1),
});

const listBranchesQuerySchema = z.object({
  includeInactive: z
    .enum(["true", "false"])
    .transform((value) => value === "true")
    .optional(),
});

export class CentralBranchController {
  async list(tenantId: string, url: URL): Promise<Response> {
    const { includeInactive = false } = listBranchesQuerySchema.parse(
      Object.fromEntries(url.searchParams.entries()),
    );
    const useCase = new ListBranchesUseCase();
    const branches = await useCase.execute({ tenantId, includeInactive });
    return Response.json(serializeForJson(branches));
  }

  async create(tenantId: string, req: Request): Promise<Response> {
    const body = await parseJsonBody(req, createBranchSchema);

    const useCase = new CreateBranchUseCase();
    const branch = await useCase.execute({
      tenantId,
      code: body.code,
      name: body.name,
    });

    return Response.json(serializeForJson(branch), { status: 201 });
  }
}
