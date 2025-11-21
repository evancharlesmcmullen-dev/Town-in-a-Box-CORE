// src/engines/township-assistance/assistance.actions.types.ts

export type AssistanceActionType =
  | 'INTAKE'
  | 'DOCUMENTS_REQUESTED'
  | 'DOCUMENTS_RECEIVED'
  | 'INTERVIEW'
  | 'HOME_VISIT'
  | 'VERIFICATION'
  | 'REFERRED_TO_OTHER_AGENCY'
  | 'APPROVED'
  | 'DENIED'
  | 'BENEFIT_ISSUED'
  | 'APPEAL_FILED'
  | 'APPEAL_DECIDED';

export interface AssistanceCaseAction {
  id: string;
  tenantId: string;
  caseId: string;

  type: AssistanceActionType;
  timestamp: Date;
  performedByUserId?: string;
  notes?: string;
}