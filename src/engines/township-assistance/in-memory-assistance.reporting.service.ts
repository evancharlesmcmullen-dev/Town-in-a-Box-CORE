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
    // Define bucket structure with ranges
    const bucketDefs: Array<{
      label: string;
      minSize: number;
      maxSize: number | null;
    }> = [
      { label: '1', minSize: 1, maxSize: 1 },
      { label: '2-3', minSize: 2, maxSize: 3 },
      { label: '4-5', minSize: 4, maxSize: 5 },
      { label: '6+', minSize: 6, maxSize: null },
    ];

    const bucketStats: Record<
      string,
      { caseCount: number; approvedCount: number; deniedCount: number }
    > = {};

    for (const def of bucketDefs) {
      bucketStats[def.label] = { caseCount: 0, approvedCount: 0, deniedCount: 0 };
    }

    for (const caseItem of tenantCases) {
      const application = this.applications.find(
        (a) => a.id === caseItem.applicationId && a.tenantId === ctx.tenantId
      );

      const size = application?.household?.length ?? 1;

      // Find matching bucket
      const bucket = bucketDefs.find(
        (b) => size >= b.minSize && (b.maxSize === null || size <= b.maxSize)
      );
      const bucketLabel = bucket?.label ?? '1';

      bucketStats[bucketLabel].caseCount += 1;
      if (caseItem.status === 'approved' || caseItem.status === 'paid') {
        bucketStats[bucketLabel].approvedCount += 1;
      } else if (caseItem.status === 'denied') {
        bucketStats[bucketLabel].deniedCount += 1;
      }
    }

    return bucketDefs.map((def) => ({
      bucketLabel: def.label,
      minSize: def.minSize,
      maxSize: def.maxSize,
      caseCount: bucketStats[def.label].caseCount,
      approvedCount: bucketStats[def.label].approvedCount,
      deniedCount: bucketStats[def.label].deniedCount,
    }));
  }
}