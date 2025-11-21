// src/core/identity/identity.service.ts

import { TenantContext } from '../tenancy/types';
import { User, Role, RolePermission, UserRole } from './identity.types';

export interface IdentityService {
  listUsers(ctx: TenantContext): Promise<User[]>;
  getUser(ctx: TenantContext, id: string): Promise<User | null>;

  listRoles(ctx: TenantContext): Promise<Role[]>;
  getRole(ctx: TenantContext, id: string): Promise<Role | null>;

  listPermissionsForRole(ctx: TenantContext, roleId: string): Promise<RolePermission[]>;
  listRolesForUser(ctx: TenantContext, userId: string): Promise<UserRole[]>;
}