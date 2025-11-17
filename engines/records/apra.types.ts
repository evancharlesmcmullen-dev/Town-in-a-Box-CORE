// Domain types for APRA (Indiana Access to Public Records Act) requests.
// These types are engine-agnostic and do not depend on storage or transport.

export type ApraRequestStatus =
  | 'received'
  | 'clarificationRequested'
  | 'searchInProgress'
  | 'readyForResponse'
  | 'closed';

export interface ApraRequester {
  name: string;
  email?: string;
  phone?: string;
  mailingAddressLine1?: string;
  mailingAddressLine2?: string;
  city?: string;
  state?: string;
  postalCode?: string;
}

export interface ApraRequest {
  id: string;
  tenantId: string;

  receivedAt: Date;
  requester: ApraRequester;
  requestText: string;

  status: ApraRequestStatus;

  // Optional workflow timestamps – we will start filling these in later.
  clarificationRequestedAt?: Date;
  clarifiedAt?: Date;
  dueDate?: Date;             // calculated using LegalEngine.getApraRules
  closedAt?: Date;
}

export interface ApraRequestSummary {
  id: string;
  receivedAt: Date;
  requesterName: string;
  status: ApraRequestStatus;
  dueDate?: Date;
}
