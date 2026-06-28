import { z } from "zod";
import { UserService } from "../../application/services/user.service";
import {
  createUserSchema,
  searchUsersQuerySchema,
  updateUserSchema,
  updateUserPermissionsSchema,
} from "../../application/dto/user.dto";
import { listRelatedQuerySchema } from "../../../clients/application/dto/cliente.dto";
import {
  parseJsonBody,
  parseSearchParams,
} from "../../../../../shared/http/request-validation";
import { controllerErrorResponse } from "../../../../../shared/http/controller-error";
import { success } from "../../../../../shared/http/api-response";
import { TENANT_PERMISSION_ROLES } from "../../../shared/permission.constants";

const updateRolePermissionsSchema = z.object({
  grants: z.array(
    z.object({
      module: z.string().trim().min(1),
      action: z.string().trim().min(1),
      enabled: z.boolean(),
    }),
  ),
});

export class UserController {
  private service = new UserService();

  private serialize(data: unknown) {
    return JSON.parse(
      JSON.stringify(data, (_key, value) =>
        typeof value === "bigint" ? value.toString() : value,
      ),
    );
  }

  async create(req: Request, actorId: string) {
    try {
      const body = await parseJsonBody(req, createUserSchema);
      const result = await this.service.create(body, actorId);
      return success(this.serialize(result), 201);
    } catch (error: any) {
      return controllerErrorResponse(error);
    }
  }

  async search(req: Request) {
    try {
      const url = new URL(req.url);
      const params = parseSearchParams(url, searchUsersQuerySchema);
      const result = await this.service.search({
        query: params.q ?? params.search,
        role: params.role,
        active: params.active,
        sortBy: params.sortBy,
        sortOrder: params.sortOrder,
        page: params.page,
        pageSize: params.pageSize,
      });
      return success(this.serialize(result.items), 200, {
        page: result.page,
        pageSize: result.pageSize,
        hasMore: result.hasMore,
        totalCount: result.totalCount,
      });
    } catch (error: any) {
      return controllerErrorResponse(error, 500);
    }
  }

  async get(id: string) {
    try {
      const result = await this.service.get(id);
      return success(this.serialize(result));
    } catch (error: any) {
      return controllerErrorResponse(error, 404);
    }
  }

  async dashboard() {
    try {
      return success(this.serialize(await this.service.getDashboard()));
    } catch (error: any) {
      return controllerErrorResponse(error, 500);
    }
  }

  async update(id: string, req: Request, actorId: string) {
    try {
      const body = await parseJsonBody(req, updateUserSchema);
      const result = await this.service.update(id, body, actorId);
      return success(this.serialize(result));
    } catch (error: any) {
      return controllerErrorResponse(error);
    }
  }

  async delete(id: string, actorId: string) {
    try {
      await this.service.delete(id, actorId);
      return success({ deleted: true });
    } catch (error: any) {
      return controllerErrorResponse(error, 404);
    }
  }

  async listAudit(req: Request, id: string) {
    try {
      const url = new URL(req.url);
      const { page, pageSize } = parseSearchParams(url, listRelatedQuerySchema);
      const result = await this.service.listAudit(id, page, pageSize);
      return success(this.serialize(result.items), 200, {
        page: result.page,
        pageSize: result.pageSize,
        hasMore: result.hasMore,
        totalCount: result.totalCount,
      });
    } catch (error: any) {
      return controllerErrorResponse(error, 404);
    }
  }

  async listEvents(req: Request, id: string) {
    try {
      const url = new URL(req.url);
      const { page, pageSize } = parseSearchParams(url, listRelatedQuerySchema);
      const result = await this.service.listEvents(id, page, pageSize);
      return success(this.serialize(result.items), 200, {
        page: result.page,
        pageSize: result.pageSize,
        hasMore: result.hasMore,
        totalCount: result.totalCount,
      });
    } catch (error: any) {
      return controllerErrorResponse(error, 404);
    }
  }

  async listRoles() {
    try {
      return success(this.serialize(await this.service.listRoles()));
    } catch (error: any) {
      return controllerErrorResponse(error, 500);
    }
  }

  async getRoleDetail(role: string) {
    try {
      if (!TENANT_PERMISSION_ROLES.includes(role as any)) {
        throw new Error("Perfil inválido");
      }
      return success(this.serialize(await this.service.getRoleDetail(role)));
    } catch (error: any) {
      return controllerErrorResponse(error, 404);
    }
  }

  async getPermissionMatrix(req: Request) {
    try {
      const url = new URL(req.url);
      const role = url.searchParams.get("role") ?? undefined;
      return success(this.serialize(await this.service.getPermissionMatrix(role ?? undefined)));
    } catch (error: any) {
      return controllerErrorResponse(error, 500);
    }
  }

  async updateRolePermissions(role: string, req: Request, actorId: string) {
    try {
      const body = await parseJsonBody(req, updateRolePermissionsSchema);
      await this.service.updateRolePermissions(role, body.grants, actorId);
      return success({ updated: true });
    } catch (error: any) {
      return controllerErrorResponse(error);
    }
  }

  async updateUserPermissions(id: string, req: Request, actorId: string) {
    try {
      const body = await parseJsonBody(req, updateUserPermissionsSchema);
      await this.service.updateUserPermissions(id, body.permissions, actorId);
      return success({ updated: true });
    } catch (error: any) {
      return controllerErrorResponse(error);
    }
  }

  async getUserEffectivePermissions(id: string) {
    try {
      return success(this.serialize(await this.service.getUserEffectivePermissions(id)));
    } catch (error: any) {
      return controllerErrorResponse(error, 404);
    }
  }

  async permissionsDashboard() {
    try {
      return success(this.serialize(await this.service.getPermissionsDashboard()));
    } catch (error: any) {
      return controllerErrorResponse(error, 500);
    }
  }
}
