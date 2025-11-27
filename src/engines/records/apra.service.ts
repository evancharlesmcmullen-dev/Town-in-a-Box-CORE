// src/engines/records/apra.service.ts
//
// Service interface for Indiana APRA (Access to Public Records Act) requests.
// Follows the pattern established by MeetingsService.

import { TenantContext } from '../../core/tenancy/tenancy.types';
import {
  ApraRequest,
  ApraRequestSummary,
  ApraRequestStatus,
  ApraRequestScope,
  ApraClarification,
  ApraExemptionCitation,
  ApraFulfillment,
  ApraStatusHistoryEntry,
} from './apra.types';

/**
 * Input for creating a new APRA request.
 */
export interface CreateApraRequestInput {
  requesterName: string;
  requesterEmail?: string;
  description: string;
  /** Optional scopes to help narrow down the records search */
  scopes?: Omit<ApraRequestScope, 'id' | 'requestId'>[];
}

/**
 * Filter options for listing APRA requests.
 */
export interface ApraRequestFilter {
  /** Filter by one or more statuses */
  status?: ApraRequestStatus[];
  /** Filter by received date range start */
  fromDate?: Date;
  /** Filter by received date range end */
  toDate?: Date;
  /** Free text search in description and requester name */
  searchText?: string;
}

/**
 * Input for adding an exemption citation.
 */
export interface AddExemptionInput {
  /** Legal citation (e.g., "IC 5-14-3-4(b)(6)") */
  citation: string;
  /** Plain English explanation of why exemption applies */
  description: string;
  /** If exemption applies only to a specific scope */
  appliesToScopeId?: string;
}

/**
 * Input for recording fulfillment of a request.
 */
export interface RecordFulfillmentInput {
  /** How records were delivered */
  deliveryMethod: 'EMAIL' | 'PORTAL' | 'MAIL' | 'IN_PERSON';
  /** Additional notes about the delivery */
  notes?: string;
  /** Total fees charged in cents */
  totalFeesCents?: number;
}

/**
 * Public service interface for the Records/APRA engine.
 *
 * Implementations will:
 * - Compute the 7 business day statutory deadline per IC 5-14-3-9
 * - Track status history for compliance audits
 * - Manage clarifications, exemptions, and fulfillments
 *
 * For now, this is an interface. Storage is pluggable via implementations
 * like InMemoryApraService or a future PostgresApraService.
 */
export interface ApraService {
  /**
   * Create a new APRA request.
   *
   * Automatically:
   * - Sets initial status to RECEIVED
   * - Computes statutoryDeadlineAt as 7 business days from receivedAt
   * - Creates initial status history entry
   *
   * @param ctx - Tenant context for multi-tenancy
   * @param input - Request details from requester
   * @returns The created ApraRequest with computed deadline
   */
  createRequest(
    ctx: TenantContext,
    input: CreateApraRequestInput
  ): Promise<ApraRequest>;

  /**
   * Fetch a single APRA request by ID.
   *
   * @param ctx - Tenant context
   * @param id - Request ID
   * @returns The request or null if not found
   */
  getRequest(
    ctx: TenantContext,
    id: string
  ): Promise<ApraRequest | null>;

  /**
   * List APRA requests with optional filtering.
   *
   * @param ctx - Tenant context
   * @param filter - Optional filters
   * @returns List of request summaries
   */
  listRequests(
    ctx: TenantContext,
    filter?: ApraRequestFilter
  ): Promise<ApraRequestSummary[]>;

  /**
   * Add a clarification request.
   *
   * Per IC 5-14-3-9(b), if a request does not reasonably identify
   * the record, the agency should ask for clarification.
   *
   * This method:
   * - Creates an ApraClarification record
   * - Sets request status to NEEDS_CLARIFICATION
   * - Pauses the 7-day deadline clock until response received
   *
   * @param ctx - Tenant context
   * @param requestId - ID of the APRA request
   * @param messageToRequester - The clarification question to send
   * @returns The created clarification record
   */
  addClarification(
    ctx: TenantContext,
    requestId: string,
    messageToRequester: string
  ): Promise<ApraClarification>;

  /**
   * Record a response to a clarification request.
   *
   * This method:
   * - Updates the ApraClarification with the response
   * - Optionally moves status back to IN_REVIEW
   * - Recomputes the statutory deadline from the response date
   *
   * @param ctx - Tenant context
   * @param clarificationId - ID of the clarification record
   * @param requesterResponse - The requester's response text
   * @returns The updated clarification record
   */
  recordClarificationResponse(
    ctx: TenantContext,
    clarificationId: string,
    requesterResponse: string
  ): Promise<ApraClarification>;

  /**
   * Update the status of an APRA request.
   *
   * Creates a status history entry for audit trail.
   *
   * @param ctx - Tenant context
   * @param requestId - ID of the request
   * @param newStatus - The new status to set
   * @param note - Optional note explaining the change
   * @returns The updated request
   */
  updateStatus(
    ctx: TenantContext,
    requestId: string,
    newStatus: ApraRequestStatus,
    note?: string
  ): Promise<ApraRequest>;

  /**
   * Add an exemption citation for withholding records.
   *
   * Per IC 5-14-3-4, when records are withheld, the agency must
   * cite the specific exemption from disclosure.
   *
   * @param ctx - Tenant context
   * @param requestId - ID of the request
   * @param input - Exemption details
   * @returns The created exemption record
   */
  addExemption(
    ctx: TenantContext,
    requestId: string,
    input: AddExemptionInput
  ): Promise<ApraExemptionCitation>;

  /**
   * Record fulfillment/delivery of records.
   *
   * @param ctx - Tenant context
   * @param requestId - ID of the request
   * @param input - Fulfillment details
   * @returns The created fulfillment record
   */
  recordFulfillment(
    ctx: TenantContext,
    requestId: string,
    input: RecordFulfillmentInput
  ): Promise<ApraFulfillment>;

  /**
   * Get the status history for a request.
   *
   * @param ctx - Tenant context
   * @param requestId - ID of the request
   * @returns List of status history entries, oldest first
   */
  getStatusHistory(
    ctx: TenantContext,
    requestId: string
  ): Promise<ApraStatusHistoryEntry[]>;

  /**
   * Get scopes associated with a request.
   *
   * @param ctx - Tenant context
   * @param requestId - ID of the request
   * @returns List of scope definitions
   */
  getScopes(
    ctx: TenantContext,
    requestId: string
  ): Promise<ApraRequestScope[]>;

  /**
   * Get clarifications for a request.
   *
   * @param ctx - Tenant context
   * @param requestId - ID of the request
   * @returns List of clarification records
   */
  getClarifications(
    ctx: TenantContext,
    requestId: string
  ): Promise<ApraClarification[]>;

  /**
   * Get exemptions cited for a request.
   *
   * @param ctx - Tenant context
   * @param requestId - ID of the request
   * @returns List of exemption records
   */
  getExemptions(
    ctx: TenantContext,
    requestId: string
  ): Promise<ApraExemptionCitation[]>;

  /**
   * Get fulfillments for a request.
   *
   * @param ctx - Tenant context
   * @param requestId - ID of the request
   * @returns List of fulfillment records
   */
  getFulfillments(
    ctx: TenantContext,
    requestId: string
  ): Promise<ApraFulfillment[]>;
}
