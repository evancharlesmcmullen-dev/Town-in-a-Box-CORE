// src/core/tenancy/in-memory-tenancy.service.ts

import { TenancyService } from './tenancy.service';
import { Tenant, TenantConfig } from './tenancy.types';

export class InMemoryTenancyService implements TenancyService {
  private configs: TenantConfig[];

  constructor(seedConfigs: TenantConfig[] = []) {
    this.configs = [...seedConfigs];
  }

  async getTenantConfig(tenantId: string): Promise<TenantConfig | null> {
    return this.configs.find((c) => c.tenant.id === tenantId) ?? null;
  }

  async listTenants(): Promise<Tenant[]> {
    return this.configs.map((c) => c.tenant);
  }

  async findTenantByName(name: string): Promise<Tenant | null> {
    const lower = name.toLowerCase();
    const match = this.configs.find(
      (c) => c.tenant.name.toLowerCase() === lower
    );
    return match ? match.tenant : null;
  }
}
