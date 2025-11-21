// src/engines/township-assistance/in-memory-assistance.reporting.service.ts

import { TenantContext } from '../../core/tenancy/types';
import {
  AssistanceBenefit,
  AssistanceCase,
  AssistanceBenefitType,
} from './assistance.types';
import {
  AssistanceStatsRange,
  AssistanceStatsSummary,
} from './assistance.reporting.types';
import { TownshipAssistanceReportingService } from './assistance.reporting.service';
import { InMemoryAssistanceService } from './in-memory-assistance.service';
import { TownshipAssistanceService } from './assistance.service';

/**
 * Reporting implementation that reuses the in-memory assistance arrays.
 * Expects to be constructed with an InMemoryAssistanceService instance
 * (or anything that exposes the same in-memory fields).
 */
export class InMemoryAssistanceReportingService implements TownshipAssistanceReportingService {
  private cases: AssistanceCase[];
  private benefits: AssistanceBenefit[];

  constructor(assistanceService: InMemoryAssistanceService | TownshipAssistanceService) {
    // Reach into the in-memory service to reuse its arrays.
    const anyService = assistanceService as any;
    this.cases = anyService.cases ?? [];
    this.benefits = anyService.benefits ?? [];
  }

  async getStatsForRange(
    ctx: TenantContext,
    range: AssistanceStatsRange
  ): Promise<AssistanceStatsSummary> {
    const inRange = (date: Date | undefined): boolean =>
      !!date && date >= range.fromDate && date <= range.toDate;

    const tenantCases = this.cases.filter((c) => c.tenantId === ctx.tenantId);
    const tenantBenefits = this.benefits.filter(
      (b) => b.tenantId === ctx.tenantId && inRange(b.approvedAt)
    );

    const totalCases = tenantCases.filter((c) => inRange(c.openedAt)).length;
    const openCases = tenantCases.filter(
      (c) => c.status === 'open' && inRange(c.openedAt)
    ).length;
    const approvedCases = tenantCases.filter(
      (c) => c.status === 'approved' && inRange(c.decidedAt)
    ).length;
    const deniedCases = tenantCases.filter(
      (c) => c.status === 'denied' && inRange(c.decidedAt)
    ).length;
    const paidCases = tenantCases.filter((c) => {
      if (c.status !== 'paid') return false;
      const paymentTimestamp = c.closedAt ?? c.decidedAt ?? c.openedAt;
      return inRange(paymentTimestamp);
    }).length;

    const totalBenefitsCents = tenantBenefits.reduce(
      (sum, b) => sum + b.amountCents,
      0
    );

    const benefitsByTypeMap: Record<string, { totalAmountCents: number; caseIds: Set<string> }> = {};

    for (const benefit of tenantBenefits) {
      const key = benefit.type;
      if (!benefitsByTypeMap[key]) {
        benefitsByTypeMap[key] = {
          totalAmountCents: 0,
          caseIds: new Set<string>(),
        };
      }
      benefitsByTypeMap[key].totalAmountCents += benefit.amountCents;
      benefitsByTypeMap[key].caseIds.add(benefit.caseId);
    }

    const benefitsByType = Object.entries(benefitsByTypeMap).map(
      ([benefitType, agg]) => ({
        benefitType: benefitType as AssistanceBenefitType,
        totalAmountCents: agg.totalAmountCents,
        caseCount: agg.caseIds.size,
      })
    );

    return {
      range,
      caseStats: {
        totalCases,
        openCases,
        approvedCases,
        deniedCases,
        paidCases,
      },
      totalBenefitsCents,
      benefitsByType,
    };
  }
}
