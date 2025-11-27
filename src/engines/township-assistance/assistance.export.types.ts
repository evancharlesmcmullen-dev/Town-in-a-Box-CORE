// src/engines/township-assistance/assistance.export.types.ts

import { AssistanceBenefitType } from './assistance.types';
import {
  AssistanceStatsRange,
  HouseholdSizeBucketStats,
} from './assistance.reporting.types';

export interface AssistanceExportRow {
  benefitType: AssistanceBenefitType;
  totalAmountCents: number;
  caseCount: number;
}

export interface AssistanceExportSummary {
  range: AssistanceStatsRange;
  rows: AssistanceExportRow[];
  totalBenefitsCents: number;
  householdBuckets: HouseholdSizeBucketStats[];
}
