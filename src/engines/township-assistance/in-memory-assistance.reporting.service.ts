// src/engines/township-assistance/in-memory-assistance.reporting.service.ts

import { TenantContext } from '../../core/tenancy/tenancy.types';
import {
  AssistanceApplication,
  AssistanceBenefit,
  AssistanceCase,
  AssistanceBenefitType,
} from './assistance.types';
import {
  AssistanceStatsRange,
  AssistanceStatsSummary,
  HouseholdSizeBucketStats,
} from './assistance.reporting.types';
import { TownshipAssistanceReportingService } from './assistance.reporting.service';
import { InMemoryAssistanceService } from './in-memory-assistance.service';

/**
 * Reporting implementation that reuses the in-memory assistance arrays.
 * Expects to be constructed with an InMemoryAssistanceService instance.
 */
export class InMemoryAssistanceReportingService
  implements TownshipAssistanceReportingService
{
  private cases: AssistanceCase[];
  private benefits: AssistanceBenefit[];
  private applications: AssistanceApplication[];

  constructor(assistanceService: InMemoryAssistanceService) {
    // Reach into the in-memory service to reuse its arrays.
    const anyService = assistanceService as any;
    this.cases = anyService.cases ?? [];
    this.benefits = anyService.benefits ?? [];
    this.applications = anyService.applications ?? [];
  }

  async getStatsForRange(
    ctx: TenantContext,
    range: AssistanceStatsRange
  ): Promise<AssistanceStatsSummary> {
    const inRange = (date: Date | undefined): boolean =>
      !!date && date >= range.fromDate && date <= range.toDate;

    const tenantCases = this.cases.filter(
      (c) => c.tenantId === ctx.tenantId && inRange(c.openedAt)
    );
    const tenantBenefits = this.benefits.filter(
      (b) => b.tenantId === ctx.tenantId && inRange(b.approvedAt)
    );

    const totalCases = tenantCases.length;
    const openCases = tenantCases.filter((c) => c.status === 'open').length;
    const approvedCases = tenantCases.filter(
      (c) => c.status === 'approved'
    ).length;
    const deniedCases = tenantCases.filter(
      (c) => c.status === 'denied'
    ).length;
    const paidCases = tenantCases.filter((c) => c.status === 'paid').length;

    const totalBenefitsCents = tenantBenefits.reduce(
      (sum, b) => sum + b.amountCents,
      0
    );

    const benefitsByTypeMap: Record<
      string,
      { totalAmountCents: number; caseIds: Set<string> }
    > = {};

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

    const householdBuckets = this.buildHouseholdBuckets(ctx, tenantCases);

    const summary: AssistanceStatsSummary = {
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
      householdBuckets,
    };

    return summary;
  }

  private buildHouseholdBuckets(
    ctx: TenantContext,
    tenantCases: AssistanceCase[]
  ): HouseholdSizeBucketStats[] {
    const counts: Record<string, number> = {
      '1': 0,
      '2-3': 0,
      '4-5': 0,
      '6+': 0,
    };

    for (const caseItem of tenantCases) {
      const application = this.applications.find(
        (a) => a.id === caseItem.applicationId && a.tenantId === ctx.tenantId
      );

      const size = application?.household?.length ?? 0;
      let bucketKey: string;

      if (size <= 1) {
        bucketKey = '1';
      } else if (size <= 3) {
        bucketKey = '2-3';
      } else if (size <= 5) {
        bucketKey = '4-5';
      } else {
        bucketKey = '6+';
      }

      counts[bucketKey] = (counts[bucketKey] ?? 0) + 1;
    }

    const buckets: HouseholdSizeBucketStats[] = Object.entries(counts).map(
      ([bucketLabel, caseCount]) => ({
        bucketLabel,
        caseCount,
      })
    );

    return buckets;
  }
}