// src/engines/township-assistance/assistance.export.helper.ts

import { AssistanceStatsSummary } from './assistance.reporting.types';
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

  return {
    range: stats.range,
    rows,
    totalBenefitsCents: stats.totalBenefitsCents,
    householdBuckets: stats.householdBuckets,
  };
}
