// src/core/compliance/compliance.proof.helper.ts

import { TenantContext } from '../tenancy/tenancy.types';
import { ComplianceService } from './compliance.service';

export async function attachProofToOccurrence(
  ctx: TenantContext,
  compliance: ComplianceService,
  occurrenceId: string,
  proofRecordId: string,
  completionNotes?: string
): Promise<void> {
  await compliance.markOccurrenceCompleted(
    ctx,
    occurrenceId,
    completionNotes,
    proofRecordId
  );
}
