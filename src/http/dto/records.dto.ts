// src/http/dto/records.dto.ts
//
// HTTP Data Transfer Objects for the Records/APRA API.
// These types are safe to expose externally and map cleanly to domain types.

import { ApraRequestStatus } from '../../engines/records/apra.types';

// ===========================================================================
// CORE REQUEST DTOs
// ===========================================================================

/**
 * Body for creating a new APRA request.
 */
export interface CreateApraRequestBody {
  requesterName: string;
  requesterEmail?: string;
  description: string;
  scopes?: {
    recordType?: string;
    dateRangeStart?: string;
    dateRangeEnd?: string;
    custodians?: string[];
    keywords?: string[];
  }[];
}

/**
 * Query parameters for listing APRA requests.
 */
export interface ListApraRequestsQuery {
  /** Comma-separated list of ApraRequestStatus values */
  status?: string;
  /** Filter by received date start (ISO 8601) */
  from?: string;
  /** Filter by received date end (ISO 8601) */
  to?: string;
  /** Free text search */
  search?: string;
}

/**
 * Body for updating an APRA request status.
 */
export interface UpdateApraStatusBody {
  newStatus: ApraRequestStatus;
  note?: string;
}

/**
 * Body for adding a clarification request.
 */
export interface AddApraClarificationBody {
  messageToRequester: string;
}

/**
 * Body for recording a clarification response.
 */
export interface RecordClarificationResponseBody {
  requesterResponse: string;
}

/**
 * Body for adding an exemption citation.
 */
export interface AddApraExemptionBody {
  /** Legal citation (e.g., "IC 5-14-3-4(b)(6)") */
  citation: string;
  /** Plain English explanation */
  description: string;
  /** If exemption applies to a specific scope */
  appliesToScopeId?: string;
}

/**
 * Body for recording fulfillment/delivery.
 */
export interface RecordApraFulfillmentBody {
  deliveryMethod: 'EMAIL' | 'PORTAL' | 'MAIL' | 'IN_PERSON';
  notes?: string;
  totalFeesCents?: number;
}

// ===========================================================================
// AI DTOs
// ===========================================================================

/**
 * Response from AI particularity analysis.
 */
export interface AnalyzeParticularityResponse {
  isParticular: boolean;
  confidence: number;
  reasoning: string;
  suggestedClarifications?: string[];
}

/**
 * A suggested exemption from AI analysis.
 */
export interface SuggestedExemptionDto {
  citation: string;
  description: string;
  confidence?: number;
  reasoning?: string;
}

/**
 * Response from AI scope analysis.
 */
export interface AnalyzeScopeResponse {
  recordTypes?: string[];
  suggestedCustodians?: string[];
  keywords?: string[];
  dateRange?: {
    start?: string;
    end?: string;
  };
  confidence?: number;
}

/**
 * Response from AI response letter drafting.
 */
export interface DraftResponseLetterResponse {
  requestId: string;
  letter: string;
}

/**
 * Body for reviewing AI particularity analysis.
 */
export interface ReviewParticularityBody {
  isParticular: boolean;
  reason?: string;
}

// ===========================================================================
// FEE DTOs
// ===========================================================================

/**
 * Body for calculating APRA copying fees.
 *
 * Per IC 5-14-3-8, agencies may charge reasonable copying fees.
 * Indiana Administrative Code (25 IAC 1-1-1) sets maximum rates.
 */
export interface ApraFeeQuoteBody {
  /** Number of black & white pages */
  bwPages?: number;
  /** Number of color pages */
  colorPages?: number;
  /** Number of large format pages (11x17 or larger) */
  largeFormatPages?: number;
  /** Number of CD/DVD media */
  cdDvdMedia?: number;
  /** Number of USB drives */
  usbMedia?: number;
  /** Whether mailing is required */
  requiresMailing?: boolean;
  /** Labor hours for extensive requests (over 2 hours allowed) */
  laborHours?: number;
  /** Number of certified copies */
  certifications?: number;
}

/**
 * Response from fee quote calculation.
 */
export interface ApraFeeQuoteResponse {
  /** Total amount in cents */
  totalCents: number;
  /** Formatted total (e.g., "$15.50") */
  formattedTotal: string;
  /** Total page count */
  totalPages: number;
  /** Whether this qualifies as an "extensive" request */
  isExtensive: boolean;
  /** Line-item breakdown */
  lines: ApraFeeLineDto[];
}

/**
 * A single fee line item.
 */
export interface ApraFeeLineDto {
  code: string;
  name: string;
  quantity: number;
  unitAmountCents: number;
  lineTotalCents: number;
}

// ===========================================================================
// NOTIFICATION / DEADLINE DTOs
// ===========================================================================

/**
 * Result from checking deadlines.
 */
export interface DeadlineCheckResponse {
  /** Number of requests checked */
  requestsChecked: number;
  /** Requests approaching deadline (within warning window) */
  approachingDeadline: DeadlineAlertDto[];
  /** Requests past deadline */
  pastDeadline: DeadlineAlertDto[];
  /** Number of notifications sent */
  notificationsSent: number;
  /** Timestamp of this check */
  checkedAt: string;
}

/**
 * A deadline alert for a single request.
 */
export interface DeadlineAlertDto {
  requestId: string;
  requesterName: string;
  statutoryDeadlineAt: string;
  status: ApraRequestStatus;
  daysRemaining: number;
}
