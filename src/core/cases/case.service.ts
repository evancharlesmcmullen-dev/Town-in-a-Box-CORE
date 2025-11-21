// src/core/cases/case.service.ts

import { TenantContext } from '../tenancy/tenancy.types';
import { CaseSummary } from './case.types';

export interface CaseService {
  listCases(
    ctx: TenantContext,
    filter?: { caseType?: string; status?: string }
  ): Promise<CaseSummary[]>;
}