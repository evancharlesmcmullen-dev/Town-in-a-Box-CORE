// src/core/identity/identity.types.ts

/**
 * Core user identity.
 */
export interface User {
  id: string;
  tenantId: string;

  email: string;
  displayName: string;

  isActive: boolean;
}

/**
 * A named role, like TRUSTEE, BOARD_MEMBER, CLERK, ASSISTANCE_STAFF.
 */
export interface Role {
  id: string;
  tenantId: string;

  code: string;          // e.g. "TRUSTEE"
  name: string;
  description?: string;
}

/**
 * Atomic permission strings (capabilities).
 */
export type Permission =
  | 'records.read'
  | 'records.write'
  | 'apra.manage'
  | 'meetings.manage'
  | 'finance.read'
  | 'finance.write'
  | 'assistance.manage'
  | 'utilities.manage'
  | 'code.manage'
  | 'permits.manage'
  | 'cemeteries.manage'
  | 'fire.manage'
  | 'compliance.manage'
  | 'admin.tenant'
  | string;

/**
 * Mapping of roles → permissions (per tenant).
 */
export interface RolePermission {
  tenantId: string;
  roleId: string;
  permission: Permission;
}

/**
 * Assignment of roles to users (per tenant).
 */
export interface UserRole {
  tenantId: string;
  userId: string;
  roleId: string;
}