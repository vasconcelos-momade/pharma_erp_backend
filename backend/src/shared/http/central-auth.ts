import { prismaCentralUnscoped } from "../../infrastructure/prisma/prisma-central.service";
import { JwtService, type CentralPayload } from "../../infrastructure/auth/jwt.service";
import { Role } from "../../infrastructure/prisma/central/generated/central";
import { isSuperAdminRole } from "./central-auth-roles";

export { isSuperAdminRole, normalizeCentralRole, requiresTenantContext } from "./central-auth-roles";
export type { NormalizedCentralRole } from "./central-auth-roles";

export class CentralAuthError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "CentralAuthError";
  }
}

export interface CentralAuthContext {
  payload: CentralPayload;
  userId: string;
  role: Role;
}

function extractBearerToken(req: Request): string {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    throw new CentralAuthError("Authorization header is required", 401);
  }
  const token = authHeader.slice("Bearer ".length).trim();
  if (!token) {
    throw new CentralAuthError("Authorization token is missing", 401);
  }
  return token;
}

export async function authenticateCentralRequest(req: Request): Promise<CentralAuthContext> {
  try {
    const token = extractBearerToken(req);
    const payload = JwtService.verifyCentral(token);

    const user = await prismaCentralUnscoped.user.findUnique({
      where: { id: BigInt(payload.sub) },
      select: { id: true, role: true, active: true },
    });

    if (!user || !user.active) {
      throw new CentralAuthError("User not found or inactive", 401);
    }

    return {
      payload,
      userId: user.id.toString(),
      role: user.role,
    };
  } catch (error) {
    if (error instanceof CentralAuthError) {
      throw error;
    }
    throw new CentralAuthError("Invalid or expired token", 401);
  }
}

export function assertTenantAccess(auth: CentralAuthContext, tenantId: string): void {
  if (isSuperAdminRole(auth.role)) {
    return;
  }

  const allowed = auth.payload.tenants.some((tenant) => tenant.id === tenantId);
  if (!allowed) {
    throw new CentralAuthError("Access denied to this tenant", 403);
  }
}

export function assertSuperadmin(auth: CentralAuthContext): void {
  if (!isSuperAdminRole(auth.role)) {
    throw new CentralAuthError("Superadmin role required", 403);
  }
}
