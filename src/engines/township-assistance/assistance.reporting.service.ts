// src/engines/township-assistance/assistance.reporting.service.ts

import { TenantContext } from '../../core/tenancy/tenancy.types';
import { AssistanceStatsRange, AssistanceStatsSummary } from './assistance.reporting.types';

/**
 * Separate reporting interface for Township Assistance so we don't
 * clutter the main TownshipAssistanceService with stats concerns.
 *
 * Implementations will typically use TownshipAssistanceService under
 * the hood to fetch applications/cases/benefits and aggregate stats.
 */
export interface TownshipAssistanceReportingService {
  /**
   * Compute assistance stats for the given period (e.g., a calendar year or quarter).
   * Intended as the basis for annual Township Assistance statistical reports (TA-7).
   */
  getStatsForRange(
    ctx: TenantContext,
    range: AssistanceStatsRange
  ): Promise<AssistanceStatsSummary>;
}