// src/http/context.ts
//
// Request context extraction for HTTP layer.
// In dev mode, reads from headers; in production, replace with real auth.

import { Request } from 'express';
import { TenantContext, JurisdictionProfile } from '../index';

/**
 * Build TenantContext from an HTTP request.
 *
 * For development/demo, reads tenant and user from headers:
 * - x-tenant-id: Tenant identifier (default: 'lapel-in')
 * - x-user-id: User identifier (default: 'system')
 *
 * In production, replace this with JWT/SAML token validation
 * and real tenant/user lookup.
 */
export function buildTenantContext(req: Request): TenantContext {
  const tenantId = req.header('x-tenant-id') ?? 'lapel-in';
  const userId = req.header('x-user-id') ?? 'system';

  // For now, hardcode a default jurisdiction profile.
  // In production, look up from tenant config database.
  const jurisdiction: JurisdictionProfile = {
    tenantId,
    state: 'IN',
    kind: 'town',
    name: 'Town of Lapel',
    authorityTags: ['zoningAuthority', 'utilityOperator'],
  };

  return { tenantId, userId, jurisdiction };
}

/**
 * Express middleware to attach TenantContext to request.
 * Access via req.ctx in route handlers.
 */
export function tenantContextMiddleware(
  req: Request & { ctx?: TenantContext },
  _res: unknown,
  next: () => void
): void {
  req.ctx = buildTenantContext(req);
  next();
}
