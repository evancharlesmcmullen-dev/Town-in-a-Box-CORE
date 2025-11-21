// src/engines/township-assistance/assistance.export.helper.ts

import {
  AssistanceStatsSummary,
  HouseholdSizeBucketStats,
} from './assistance.reporting.types';
import {
  AssistanceExportSummary,
  AssistanceExportRow,
} from './assistance.export.types';

export function toAssistanceExportSummary(
  stats: AssistanceStatsSummary
): AssistanceExportSummary {
    const rows: AssistanceExportRow[] = stats.benefitsByType.map((b) => ({
      benefitType: b.benefitType,
      totalAmountCents: b.totalAmountCents,
      caseCount: b.caseCount,
    }));

    const summary: AssistanceExportSummary = {
      range: stats.range,
      rows,
      totalBenefitsCents: stats.totalBenefitsCents,
    };

    if ((stats as any).householdBuckets) {
      summary.householdBuckets = (stats as any).householdBuckets as HouseholdSizeBucketStats[];
    }

    return summary;
}
