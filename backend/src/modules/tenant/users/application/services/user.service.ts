import { UserRepository } from "../../infrastructure/repositories/user.repository";
import { RolePermissionRepository } from "../../infrastructure/repositories/role-permission.repository";
import type { CreateUserDTO, UpdateUserDTO } from "../dto/user.dto";

export class UserService {
  private repo = new UserRepository();
  private permissions = new RolePermissionRepository();

  create(data: CreateUserDTO, actorId: string) {
    return this.repo.create(data, BigInt(actorId));
  }

  update(id: string, data: UpdateUserDTO, actorId: string) {
    return this.repo.update(BigInt(id), data, BigInt(actorId));
  }

  delete(id: string, actorId: string) {
    return this.repo.softDelete(BigInt(id), BigInt(actorId));
  }

  search(filters: Parameters<UserRepository["search"]>[0]) {
    return this.repo.search(filters);
  }

  get(id: string) {
    return this.repo.getById(BigInt(id));
  }

  getDashboard() {
    return this.repo.getDashboard();
  }

  listAudit(userId: string, page?: number, pageSize?: number) {
    return this.repo.listAuditLogs(BigInt(userId), page, pageSize);
  }

  listEvents(userId: string, page?: number, pageSize?: number) {
    return this.repo.listBusinessEvents(BigInt(userId), page, pageSize);
  }

  listRoles() {
    return this.permissions.listRoles();
  }

  getRoleDetail(role: string) {
    return this.permissions.getRoleDetail(role);
  }

  getPermissionMatrix(role?: string) {
    return this.permissions.getPermissionMatrix(role);
  }

  updateRolePermissions(
    role: string,
    grants: Array<{ module: string; action: string; enabled: boolean }>,
    actorId: string,
  ) {
    return this.permissions.updateRolePermissions(role, grants, BigInt(actorId));
  }

  updateUserPermissions(
    userId: string,
    permissions: Array<{
      module: string;
      action: string;
      allowed?: boolean;
      clear?: boolean;
    }>,
    actorId: string,
  ) {
    return this.permissions.updateUserPermissions(
      BigInt(userId),
      permissions,
      BigInt(actorId),
    );
  }

  getUserEffectivePermissions(userId: string) {
    return this.permissions.getUserEffectivePermissions(BigInt(userId));
  }

  getPermissionsDashboard() {
    return this.permissions.getDashboard();
  }
}
