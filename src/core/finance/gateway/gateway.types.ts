// src/core/finance/gateway/gateway.types.ts

/**
 * Town-in-a-Box Finance Engine - Gateway Export Types
 *
 * Types for Gateway-style exports, modeled after Indiana's Gateway AFR
 * (Annual Financial Report) structure but designed to be adaptable for
 * other states' reporting requirements.
 *
 * These types represent the output format for state compliance reporting,
 * not the internal data model.
 */

import { TenantIdentity } from '../../state/state.types';

// ============================================================================
// EXPORT CONTEXT
// ============================================================================

/**
 * Context for Gateway exports.
 *
 * Provides the tenant identity and reporting parameters needed to
 * generate state-compliant export data.
 */
export interface GatewayExportContext {
  /** The tenant's identity (includes state, entity class, etc.) */
  tenantIdentity: TenantIdentity;
  /** The "as of" date for the export (typically fiscal year end) */
  asOf: Date;
  /** Optional fiscal year (derived from asOf if not provided) */
  fiscalYear?: number;
  /** Optional report title for display purposes */
  title?: string;
  /** Optional notes or comments */
  notes?: string;
}

// ============================================================================
// FUND SUMMARY EXPORT
// ============================================================================

/**
 * A single fund row in a Gateway Fund Summary export.
 *
 * This simplified structure matches the high-level fund summary view
 * used in Gateway AFR submissions.
 */
export interface GatewayFundSummaryRow {
  /** SBOA-style fund code (e.g., "101", "601") */
  fundCode: string;
  /** Display name of the fund */
  fundName: string;
  /** Balance at start of period (typically Jan 1 for calendar year) */
  beginningBalance: number;
  /** Total receipts during the period */
  totalReceipts: number;
  /** Total disbursements during the period */
  totalDisbursements: number;
  /** Balance at end of period (beginningBalance + receipts - disbursements) */
  endingBalance: number;
}

/**
 * Gateway Fund Summary Export
 *
 * A complete fund summary export suitable for Gateway AFR submission.
 * This is the primary output format for the fund summary section of
 * Indiana's Annual Financial Report.
 */
export interface GatewayFundSummaryExport {
  /** Export context including tenant and date information */
  context: GatewayExportContext;
  /** Individual fund rows */
  rows: GatewayFundSummaryRow[];
  /** Grand total: sum of all funds' beginning balances */
  totalBeginningBalance: number;
  /** Grand total: sum of all funds' receipts */
  totalReceipts: number;
  /** Grand total: sum of all funds' disbursements */
  totalDisbursements: number;
  /** Grand total: sum of all funds' ending balances */
  totalEndingBalance: number;
}

// ============================================================================
// EXPORT METADATA
// ============================================================================

/**
 * Metadata for a Gateway export file.
 *
 * Used for tracking and auditing export generation.
 */
export interface GatewayExportMetadata {
  /** Unique export ID for tracking */
  exportId: string;
  /** Type of export */
  exportType: GatewayExportType;
  /** When the export was generated */
  generatedAt: Date;
  /** Who/what generated the export (user ID or system) */
  generatedBy?: string;
  /** Tenant ID this export is for */
  tenantId: string;
  /** State code (e.g., "IN" for Indiana) */
  stateCode: string;
  /** Fiscal year covered */
  fiscalYear: number;
  /** Export format */
  format: GatewayExportFormat;
  /** Validation status */
  validationStatus?: 'PENDING' | 'VALID' | 'WARNINGS' | 'ERRORS';
  /** Validation messages if any */
  validationMessages?: string[];
}

/**
 * Types of Gateway exports.
 */
export type GatewayExportType =
  | 'FUND_SUMMARY'           // High-level fund activity summary
  | 'RECEIPTS_DETAIL'        // Detailed receipts by account
  | 'DISBURSEMENTS_DETAIL'   // Detailed disbursements by account
  | 'DEBT_SCHEDULE'          // Outstanding debt summary
  | 'BUDGET_SUMMARY'         // Budget vs actual summary
  | 'COMPLETE_AFR';          // Complete Annual Financial Report

/**
 * Export output formats.
 */
export type GatewayExportFormat =
  | 'JSON'    // Structured data format
  | 'CSV'     // Comma-separated values
  | 'XML'     // Gateway XML format (state-specific)
  | 'XLSX';   // Excel spreadsheet

// ============================================================================
// VALIDATION TYPES
// ============================================================================

/**
 * Validation result for Gateway exports.
 */
export interface GatewayValidationResult {
  /** Whether the export is valid for submission */
  isValid: boolean;
  /** Errors that must be fixed before submission */
  errors: GatewayValidationMessage[];
  /** Warnings that should be reviewed but don't block submission */
  warnings: GatewayValidationMessage[];
  /** Informational messages */
  info: GatewayValidationMessage[];
}

/**
 * A single validation message.
 */
export interface GatewayValidationMessage {
  /** Message code for programmatic handling */
  code: string;
  /** Human-readable message */
  message: string;
  /** Which field or section this applies to */
  field?: string;
  /** Which fund this applies to (if fund-specific) */
  fundCode?: string;
  /** Statutory citation for the requirement (if applicable) */
  citation?: string;
}
