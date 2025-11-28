// src/states/in/finance/gateway/in-fund-summary.gateway.ts

/**
 * Indiana Gateway Fund Summary Export
 *
 * This module provides Indiana-specific Gateway fund summary exports
 * using the core finance reporting infrastructure.
 *
 * The function:
 * 1. Loads fund and transaction data from the repository
 * 2. Builds a trial balance report using pure functions
 * 3. Transforms the report into Gateway-friendly format
 * 4. Optionally applies Indiana-specific rules (e.g., fund categorization)
 *
 * Future enhancements:
 * - Use INFinanceConfig for Indiana-specific fund classification
 * - Apply SBOA-specific validation rules
 * - Generate Gateway XML format for direct upload
 */

import { FinanceRepository } from '../../../../core/finance/finance.repository';
import { Fund, Transaction } from '../../../../core/finance/finance.types';
import {
  buildTrialBalanceReport,
  filterActiveFunds,
  sortFundsByCode,
} from '../../../../core/finance/reports/reports.service';
import {
  buildGatewayFundSummaryExport,
  validateGatewayFundSummaryExport,
  sortGatewayFundSummaryRows,
} from '../../../../core/finance/gateway/gateway.service';
import {
  GatewayExportContext,
  GatewayFundSummaryExport,
  GatewayValidationResult,
} from '../../../../core/finance/gateway/gateway.types';
import { TenantIdentity } from '../../../../core/state/state.types';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Options for building Indiana Gateway Fund Summary exports.
 */
export interface InGatewayFundSummaryOptions {
  /** Include inactive funds in the export */
  includeInactiveFunds?: boolean;
  /** Include funds with zero activity */
  includeZeroActivityFunds?: boolean;
  /** Apply Indiana-specific fund sorting (SBOA order) */
  sortByFundCode?: boolean;
  /** Run validation before returning */
  validate?: boolean;
}

/**
 * Result of building an Indiana Gateway Fund Summary export.
 */
export interface InGatewayFundSummaryResult {
  /** The export data */
  export: GatewayFundSummaryExport;
  /** Validation result (if validation was requested) */
  validation?: GatewayValidationResult;
}

// ============================================================================
// MAIN EXPORT FUNCTION
// ============================================================================

/**
 * Build an Indiana Gateway Fund Summary Export.
 *
 * This is the primary entry point for generating Gateway-style fund summaries
 * for Indiana municipalities. It:
 *
 * 1. Fetches fund and transaction data from the repository
 * 2. Filters and sorts funds appropriately
 * 3. Builds a trial balance report
 * 4. Transforms to Gateway export format
 * 5. Optionally validates the result
 *
 * @param repo - Finance repository for data access
 * @param identity - Tenant identity (must be state: 'IN')
 * @param asOf - The "as of" date for the report (typically Dec 31)
 * @param options - Optional configuration
 * @returns Promise resolving to the export result
 *
 * @example
 * ```typescript
 * const repo = new InMemoryFinanceRepository(seedData);
 * const identity: TenantIdentity = {
 *   tenantId: 'example-town',
 *   displayName: 'Example Town',
 *   state: 'IN',
 *   entityClass: 'TOWN',
 * };
 *
 * const result = await buildInGatewayFundSummaryExport(
 *   repo,
 *   identity,
 *   new Date('2024-12-31'),
 *   { validate: true }
 * );
 *
 * if (result.validation?.isValid) {
 *   console.log('Export is valid for Gateway submission');
 * }
 * ```
 */
export async function buildInGatewayFundSummaryExport(
  repo: FinanceRepository,
  identity: TenantIdentity,
  asOf: Date,
  options: InGatewayFundSummaryOptions = {}
): Promise<InGatewayFundSummaryResult> {
  const {
    includeInactiveFunds = false,
    includeZeroActivityFunds = false,
    sortByFundCode = true,
    validate = false,
  } = options;

  // TODO: In a later pass, we can:
  // - Use InFinancePack / INFinanceConfig for subtle Indiana-specific rules
  // - Apply fund categorization based on SBOA guidelines
  // - Handle fiscal entity consolidation for complex structures

  // 1. Load all funds for this tenant
  const fundsResult = await repo.listFunds({
    tenantId: identity.tenantId,
    activeOnly: !includeInactiveFunds,
  });
  let funds: Fund[] = Array.isArray(fundsResult)
    ? fundsResult
    : fundsResult.items;

  // 2. Load all transactions up to asOf date
  const transactionsResult = await repo.listTransactions({
    tenantId: identity.tenantId,
    toDate: asOf,
    includeVoided: false,
  });
  const transactions: Transaction[] = Array.isArray(transactionsResult)
    ? transactionsResult
    : transactionsResult.items;

  // 3. Apply filtering
  if (!includeInactiveFunds) {
    funds = filterActiveFunds(funds);
  }

  // 4. Sort funds by code (SBOA order)
  if (sortByFundCode) {
    funds = sortFundsByCode(funds);
  }

  // 5. Build trial balance report using pure functions
  const trialBalance = buildTrialBalanceReport(funds, transactions, asOf);

  // 6. Filter zero-activity funds if requested
  let reportRows = trialBalance.rows;
  if (!includeZeroActivityFunds) {
    reportRows = reportRows.filter(
      (row) =>
        row.beginningBalance !== 0 ||
        row.totalReceipts !== 0 ||
        row.totalDisbursements !== 0
    );
  }

  // Rebuild trial balance with filtered rows
  const filteredTrialBalance = {
    ...trialBalance,
    rows: reportRows,
    totalBeginningBalance: reportRows.reduce((sum, r) => sum + r.beginningBalance, 0),
    totalReceipts: reportRows.reduce((sum, r) => sum + r.totalReceipts, 0),
    totalDisbursements: reportRows.reduce((sum, r) => sum + r.totalDisbursements, 0),
    totalEndingBalance: reportRows.reduce((sum, r) => sum + r.endingBalance, 0),
  };

  // 7. Build Gateway context
  const context: GatewayExportContext = {
    tenantIdentity: identity,
    asOf,
    fiscalYear: asOf.getFullYear(),
    title: `${identity.displayName} - Gateway Fund Summary`,
  };

  // 8. Transform to Gateway export format
  const exportData = buildGatewayFundSummaryExport(context, filteredTrialBalance);

  // 9. Sort export rows by fund code
  if (sortByFundCode) {
    exportData.rows = sortGatewayFundSummaryRows(exportData.rows);
  }

  // 10. Validate if requested
  let validation: GatewayValidationResult | undefined;
  if (validate) {
    validation = validateGatewayFundSummaryExport(exportData);
  }

  return {
    export: exportData,
    validation,
  };
}

// ============================================================================
// CONVENIENCE FUNCTIONS
// ============================================================================

/**
 * Quick export with default options.
 *
 * Convenience wrapper for common use case: active funds only,
 * sorted by fund code, with validation.
 */
export async function quickInGatewayFundSummaryExport(
  repo: FinanceRepository,
  identity: TenantIdentity,
  asOf: Date
): Promise<GatewayFundSummaryExport> {
  const result = await buildInGatewayFundSummaryExport(repo, identity, asOf, {
    includeInactiveFunds: false,
    includeZeroActivityFunds: false,
    sortByFundCode: true,
    validate: false,
  });
  return result.export;
}

/**
 * Validate an existing Gateway Fund Summary export against Indiana rules.
 *
 * This runs the standard validation plus any Indiana-specific checks.
 *
 * @param exportData - The export data to validate
 * @returns Validation result with errors, warnings, and info
 */
export function validateInGatewayFundSummary(
  exportData: GatewayFundSummaryExport
): GatewayValidationResult {
  // Start with base validation
  const baseValidation = validateGatewayFundSummaryExport(exportData);

  // TODO: Add Indiana-specific validation rules:
  // - Verify required funds exist (e.g., Fund 101 General Fund)
  // - Check fund codes match SBOA standards
  // - Validate fund categories
  // - Check for common Gateway submission issues

  // Indiana-specific: Check that state is IN
  if (exportData.context.tenantIdentity.state !== 'IN') {
    baseValidation.warnings.push({
      code: 'NOT_INDIANA',
      message: `This export is for ${exportData.context.tenantIdentity.state}, not Indiana (IN)`,
      field: 'context.tenantIdentity.state',
    });
  }

  // Indiana-specific: Check for General Fund (101)
  const hasGeneralFund = exportData.rows.some(
    (row) => row.fundCode === '101'
  );
  if (!hasGeneralFund) {
    baseValidation.warnings.push({
      code: 'MISSING_GENERAL_FUND',
      message: 'General Fund (101) not found in export - this is typically required',
      citation: 'SBOA Uniform Chart of Accounts',
    });
  }

  return baseValidation;
}
