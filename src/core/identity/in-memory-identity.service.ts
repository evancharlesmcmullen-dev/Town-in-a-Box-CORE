// src/core/identity/in-memory-identity.service.ts

import { TenantContext } from '../tenancy/tenancy.types';
import { IdentityService } from './identity.service';
import { User, Role, RolePermission, UserRole } from './identity.types';

export interface InMemoryIdentitySeedData {
  users?: User[];
  roles?: Role[];
  rolePermissions?: RolePermission[];
  userRoles?: UserRole[];
}

/**
 * In-memory implementation of IdentityService. Data is scoped per tenant and
 * only persists for the process lifetime.
 */
export class InMemoryIdentityService implements IdentityService {
  private users: User[];
  private roles: Role[];
  private rolePermissions: RolePermission[];
  private userRoles: UserRole[];

  constructor(seed: InMemoryIdentitySeedData = {}) {
    this.users = seed.users ? [...seed.users] : [];
    this.roles = seed.roles ? [...seed.roles] : [];
    this.rolePermissions = seed.rolePermissions ? [...seed.rolePermissions] : [];
    this.userRoles = seed.userRoles ? [...seed.userRoles] : [];
  }

  async listUsers(ctx: TenantContext): Promise<User[]> {
    return this.users.filter((u) => u.tenantId === ctx.tenantId);
  }

  async getUser(ctx: TenantContext, id: string): Promise<User | null> {
    return (
      this.users.find((u) => u.id === id && u.tenantId === ctx.tenantId) ?? null
    );
  }

  async listRoles(ctx: TenantContext): Promise<Role[]> {
    return this.roles.filter((r) => r.tenantId === ctx.tenantId);
  }

  async getRole(ctx: TenantContext, id: string): Promise<Role | null> {
    return (
      this.roles.find((r) => r.id === id && r.tenantId === ctx.tenantId) ?? null
    );
  }

  async listPermissionsForRole(
    ctx: TenantContext,
    roleId: string
  ): Promise<RolePermission[]> {
    return this.rolePermissions.filter(
      (rp) => rp.tenantId === ctx.tenantId && rp.roleId === roleId
    );
  }

  async listRolesForUser(
    ctx: TenantContext,
    userId: string
  ): Promise<UserRole[]> {
    return this.userRoles.filter(
      (ur) => ur.tenantId === ctx.tenantId && ur.userId === userId
    );
  }
}
