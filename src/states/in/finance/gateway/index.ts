// src/states/in/finance/gateway/index.ts

/**
 * Indiana Gateway Export Module
 *
 * Provides Gateway-ready exports for SBOA and DLGF reporting including:
 * - AFR Fund Report
 * - AFR 100R (Payroll)
 * - Budget Estimate (Form 1)
 * - Adopted Budget (Form 4)
 * - Debt Report
 * - Line item explanations for audit support
 *
 * Also includes simplified fund summary exports using the core
 * finance reporting infrastructure.
 */

export * from './gateway.types';
export * from './gateway.engine';

// Fund summary export using core finance reports
export {
  buildInGatewayFundSummaryExport,
  quickInGatewayFundSummaryExport,
  validateInGatewayFundSummary,
  InGatewayFundSummaryOptions,
  InGatewayFundSummaryResult,
} from './in-fund-summary.gateway';
