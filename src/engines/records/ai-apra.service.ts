// src/engines/records/ai-apra.service.ts
//
// AI-enhanced APRA service interface.
// Extends the base ApraService with AI capabilities for analysis and drafting.

import { TenantContext } from '../../core/tenancy/tenancy.types';
import { ApraService } from './apra.service';
import { ApraRequest } from './apra.types';

// ===========================================================================
// AI ANALYSIS RESULTS
// ===========================================================================

/**
 * Result of analyzing whether a request meets the "reasonably particular"
 * requirement under IC 5-14-3-3(a).
 */
export interface ParticularityAnalysis {
  /** Whether the request is reasonably particular */
  isParticular: boolean;
  /** Model's confidence in this assessment (0-1) */
  confidence: number;
  /** Explanation of the assessment */
  reasoning: string;
  /** Suggested clarifying questions if not particular */
  suggestedClarifications?: string[];
}

/**
 * A suggested exemption from AI analysis.
 */
export interface SuggestedExemption {
  /** Legal citation (e.g., "IC 5-14-3-4(b)(6)") */
  citation: string;
  /** Plain English explanation */
  description: string;
  /** Model's confidence in this suggestion (0-1) */
  confidence?: number;
  /** Why the model thinks this exemption may apply */
  reasoning?: string;
}

/**
 * Result of analyzing the scope of a records request.
 */
export interface ScopeAnalysis {
  /** Identified record types (e.g., "email", "contract") */
  recordTypes?: string[];
  /** Suggested custodians/departments to search */
  suggestedCustodians?: string[];
  /** Extracted keywords for searching */
  keywords?: string[];
  /** Identified date range */
  dateRange?: {
    start?: string;
    end?: string;
  };
  /** Model's confidence in this analysis (0-1) */
  confidence?: number;
}

// ===========================================================================
// AI APRA SERVICE INTERFACE
// ===========================================================================

/**
 * AI-enhanced APRA service interface.
 *
 * Extends the base ApraService with AI capabilities:
 * - Particularity analysis (IC 5-14-3-3 compliance)
 * - Exemption suggestions (IC 5-14-3-4)
 * - Scope analysis for record searches
 * - Response letter drafting
 *
 * All AI outputs are assistive and require human review before use.
 */
export interface AiApraService extends ApraService {
  /**
   * Analyze whether a request meets the "reasonably particular" requirement.
   *
   * Per IC 5-14-3-3(a), a request must identify with "reasonable particularity"
   * the record being requested. This helps staff assess borderline cases.
   *
   * @param ctx - Tenant context
   * @param requestId - ID of the APRA request
   * @returns Analysis result with confidence and reasoning
   */
  analyzeParticularity(
    ctx: TenantContext,
    requestId: string
  ): Promise<ParticularityAnalysis>;

  /**
   * Suggest potentially applicable exemptions based on request content.
   *
   * Analyzes the request description and any scopes to suggest which
   * exemptions under IC 5-14-3-4 might apply.
   *
   * @param ctx - Tenant context
   * @param requestId - ID of the APRA request
   * @returns List of suggested exemptions with reasoning
   */
  suggestExemptions(
    ctx: TenantContext,
    requestId: string
  ): Promise<SuggestedExemption[]>;

  /**
   * Analyze the scope of a records request.
   *
   * Extracts structured scope information from free-text descriptions:
   * - Record types (emails, contracts, videos, etc.)
   * - Relevant custodians/departments
   * - Keywords for searching
   * - Date ranges
   *
   * @param ctx - Tenant context
   * @param requestId - ID of the APRA request
   * @returns Structured scope analysis
   */
  analyzeScope(
    ctx: TenantContext,
    requestId: string
  ): Promise<ScopeAnalysis>;

  /**
   * Draft a response letter for the request.
   *
   * Generates a professional response letter based on the request's current
   * state (status, exemptions, clarifications, fulfillments).
   *
   * @param ctx - Tenant context
   * @param requestId - ID of the APRA request
   * @returns Draft letter text
   */
  draftResponseLetter(
    ctx: TenantContext,
    requestId: string
  ): Promise<string>;

  /**
   * Review and confirm/reject an AI particularity assessment.
   *
   * Updates the request with the human-reviewed particularity determination.
   *
   * @param ctx - Tenant context
   * @param requestId - ID of the APRA request
   * @param isParticular - Human-confirmed particularity
   * @param reason - Optional explanation for the determination
   * @returns Updated request
   */
  reviewParticularity(
    ctx: TenantContext,
    requestId: string,
    isParticular: boolean,
    reason?: string
  ): Promise<ApraRequest>;
}
