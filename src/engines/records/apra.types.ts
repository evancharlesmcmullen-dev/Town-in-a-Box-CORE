// Domain types for APRA (Indiana Access to Public Records Act) requests.
// These types are engine-agnostic and do not depend on storage or transport.

/**
 * Status of an APRA request through its lifecycle.
 *
 * - RECEIVED: Initial state when request is logged
 * - NEEDS_CLARIFICATION: Waiting for requester to clarify their request
 * - IN_REVIEW: Staff is searching for and reviewing responsive records
 * - PARTIALLY_FULFILLED: Some records delivered, more may follow
 * - FULFILLED: All responsive records have been delivered
 * - DENIED: Request denied (must cite specific exemption)
 * - CLOSED: Request administratively closed (withdrawn, abandoned, etc.)
 */
export type ApraRequestStatus =
  | 'RECEIVED'
  | 'NEEDS_CLARIFICATION'
  | 'IN_REVIEW'
  | 'PARTIALLY_FULFILLED'
  | 'FULFILLED'
  | 'DENIED'
  | 'CLOSED';

/**
 * Requester contact information.
 */
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

/**
 * Core APRA request entity.
 *
 * Per IC 5-14-3-3, a public records request must be in writing but
 * does not require any specific format.
 */
export interface ApraRequest {
  id: string;
  tenantId: string;

  /** Requester's name (required for tracking) */
  requesterName: string;
  /** Requester's email (optional but preferred for response delivery) */
  requesterEmail?: string;

  /** The text of the records request */
  description: string;

  /**
   * Whether the request is "reasonably particular" as required by IC 5-14-3-3(a).
   * A request must identify with "reasonable particularity" the record being requested.
   */
  reasonablyParticular: boolean;

  /** Explanation of why the request is or isn't reasonably particular */
  particularityReason?: string;

  /** When the request was received (ISO 8601) */
  receivedAt: string;

  /**
   * Statutory deadline for response (ISO 8601).
   * Per IC 5-14-3-9(a), agencies must respond within 7 business days.
   * For requests requiring clarification, the clock restarts after clarification.
   */
  statutoryDeadlineAt?: string;

  /** Current status of the request */
  status: ApraRequestStatus;

  /** When the request was created in the system (ISO 8601) */
  createdAt: string;

  /** When the request was last updated (ISO 8601) */
  updatedAt: string;
}

/**
 * Defines the scope of records being requested.
 * Used to narrow down searches and track what's been fulfilled.
 */
export interface ApraRequestScope {
  id: string;
  requestId: string;

  /** Type of record (e.g., "email", "contract", "video", "meeting minutes") */
  recordType?: string;

  /** Start of date range for records (ISO 8601) */
  dateRangeStart?: string;

  /** End of date range for records (ISO 8601) */
  dateRangeEnd?: string;

  /** People or departments who may have custody of records */
  custodians?: string[];

  /** Search terms or keywords to identify relevant records */
  keywords?: string[];
}

/**
 * Tracks status changes for audit trail and compliance.
 */
export interface ApraStatusHistoryEntry {
  id: string;
  requestId: string;

  /** Previous status (undefined for initial entry) */
  oldStatus?: ApraRequestStatus;

  /** New status */
  newStatus: ApraRequestStatus;

  /** When the status changed (ISO 8601) */
  changedAt: string;

  /** User who made the change (for audit) */
  changedByUserId?: string;

  /** Optional note explaining the status change */
  note?: string;
}

/**
 * Represents a clarification request sent to the requester.
 *
 * Per IC 5-14-3-9(b), if a request does not reasonably identify
 * the record, the agency must ask for clarification before the
 * 7-day clock starts.
 */
export interface ApraClarification {
  id: string;
  requestId: string;

  /** When the clarification request was sent (ISO 8601) */
  sentAt: string;

  /** When the requester responded (ISO 8601, if applicable) */
  respondedAt?: string;

  /** Message sent to the requester asking for clarification */
  messageToRequester: string;

  /** Requester's response to the clarification request */
  requesterResponse?: string;
}

/**
 * Documents an exemption citation applied to a specific records request.
 *
 * IC 5-14-3-4 lists the exemptions from disclosure.
 * When records are withheld, the specific exemption must be cited.
 *
 * Note: This is distinct from ApraExemption in core/legal/types.ts,
 * which defines the catalog of available exemptions. This type
 * represents an instance of an exemption being applied to a request.
 */
export interface ApraExemptionCitation {
  id: string;
  requestId: string;

  /** Legal citation (e.g., "IC 5-14-3-4(b)(6)") */
  citation: string;

  /** Plain English explanation of why exemption applies */
  description: string;

  /** If the exemption applies only to specific scope, reference it */
  appliesToScopeId?: string;

  /** When the exemption was recorded (ISO 8601) */
  createdAt: string;
}

/**
 * Records the fulfillment/delivery of records to the requester.
 */
export interface ApraFulfillment {
  id: string;
  requestId: string;

  /** When records were delivered (ISO 8601) */
  fulfilledAt: string;

  /** How the records were delivered */
  deliveryMethod: 'EMAIL' | 'PORTAL' | 'MAIL' | 'IN_PERSON';

  /** Additional notes about the fulfillment */
  notes?: string;

  /**
   * Total fees charged in cents.
   * Per IC 5-14-3-8, agencies may charge reasonable copying fees.
   */
  totalFeesCents?: number;
}

/**
 * Summary view of an APRA request for list views.
 */
export interface ApraRequestSummary {
  id: string;
  tenantId: string;
  receivedAt: string;
  requesterName: string;
  status: ApraRequestStatus;
  statutoryDeadlineAt?: string;
}
