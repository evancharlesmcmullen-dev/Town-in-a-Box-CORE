// src/core/cases/in-memory-case.service.ts

import { TenantContext } from '../tenancy/tenancy.types';
import { CaseSummary } from './case.types';
import { CaseService } from './case.service';

export interface InMemoryCaseSeedData {
  cases?: CaseSummary[];
}

/**
 * In-memory implementation of CaseService for listing generic case summaries.
 * Data is scoped per tenant and seeded externally.
 */
export class InMemoryCaseService implements CaseService {
  private cases: CaseSummary[];

  constructor(seed: InMemoryCaseSeedData = {}) {
    this.cases = seed.cases ? [...seed.cases] : [];
  }

  async listCases(
    ctx: TenantContext,
    filter: { caseType?: string; status?: string } = {}
  ): Promise<CaseSummary[]> {
    let results = this.cases.filter((c) => c.tenantId === ctx.tenantId);

    if (filter.caseType) {
      results = results.filter((c) => c.caseType === filter.caseType);
    }

    if (filter.status) {
      results = results.filter((c) => c.status === filter.status);
    }

    return results;
  }
}
