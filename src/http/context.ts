// src/http/context.ts

import { Request } from 'express';
import { TenantContext, JurisdictionProfile } from '../core/tenancy/tenancy.types';

/**
 * Build a TenantContext from HTTP request headers.
 *
 * This is a dev-mode helper. In production, you'd replace this with
 * real auth/tenant mapping from JWT, session, or API key.
 *
 * Headers:
 *   x-tenant-id: Tenant identifier (default: 'test-tenant')
 *   x-user-id: User identifier (default: 'system')
 */
export function buildTenantContext(req: Request): TenantContext {
  const tenantId = (req.header('x-tenant-id') ?? 'test-tenant') as string;
  const userId = (req.header('x-user-id') ?? 'system') as string;

  const jurisdiction: JurisdictionProfile = {
    tenantId,
    state: 'IN',
    kind: 'town',
    name: 'Test Town',
    authorityTags: ['zoningAuthority', 'utilityOperator'],
  };

  return { tenantId, userId, jurisdiction };
}
