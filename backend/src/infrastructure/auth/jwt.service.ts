import jwt from 'jsonwebtoken';

const JWT_SECRET_CENTRAL = process.env.JWT_SECRET_CENTRAL || 'fallback-secret-central';
const JWT_SECRET_TENANT = process.env.JWT_SECRET_TENANT || 'fallback-secret-tenant';

export interface CentralPayload {
  sub: string;
  type: 'central';
  email: string;
  tenants: {
    id: string;
    branches: {
      id: string;
      code: string;
      name: string;
    }[];
  }[];
}

export interface TenantPayload {
  sub: string;
  tenantId: string;
  branchId: string;
  role: string;
  type: 'tenant';
}

export class JwtService {
  static signCentral(payload: Omit<CentralPayload, 'type'>): string {
    return jwt.sign({ ...payload, type: 'central' }, JWT_SECRET_CENTRAL, { expiresIn: '1d' });
  }

  static signTenant(payload: Omit<TenantPayload, 'type'>): string {
    return jwt.sign({ ...payload, type: 'tenant' }, JWT_SECRET_TENANT, { expiresIn: '1d' });
  }

  static verifyCentral(token: string): CentralPayload {
    return jwt.verify(token, JWT_SECRET_CENTRAL) as CentralPayload;
  }

  static verifyTenant(token: string): TenantPayload {
    return jwt.verify(token, JWT_SECRET_TENANT) as TenantPayload;
  }
}
