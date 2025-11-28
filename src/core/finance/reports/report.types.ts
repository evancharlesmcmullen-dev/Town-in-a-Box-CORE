// src/core/finance/reports/report.types.ts

/**
 * Town-in-a-Box Finance Engine - Report Types
 *
 * Types for financial reporting including trial balance,
 * budget vs actual, fund summaries, and more.
 */

import { Fund, Account, Transaction, BudgetLine, FundType } from '../finance.types';

// ============================================================================
// REPORT METADATA
// ============================================================================

/**
 * Report period specification.
 */
export interface ReportPeriod {
  startDate: Date;
  endDate: Date;
  fiscalYear: number;
  periodType: 'MONTHLY' | 'QUARTERLY' | 'ANNUAL' | 'CUSTOM' | 'YTD';
  periodNumber?: number;     // 1-12 for monthly, 1-4 for quarterly
}

/**
 * Report metadata.
 */
export interface ReportMetadata {
  reportId: string;
  reportType: ReportType;
  title: string;
  description?: string;
  tenantId: string;
  tenantName: string;
  period: ReportPeriod;
  generatedAt: Date;
  generatedBy?: string;
  parameters?: Record<string, unknown>;
}

/**
 * Available report types.
 */
export type ReportType =
  | 'TRIAL_BALANCE'
  | 'FUND_SUMMARY'
  | 'BUDGET_VS_ACTUAL'
  | 'REVENUE_SUMMARY'
  | 'EXPENDITURE_SUMMARY'
  | 'CASH_FLOW'
  | 'TRANSACTION_REGISTER'
  | 'VENDOR_SUMMARY'
  | 'DEBT_SCHEDULE'
  | 'FUND_BALANCE_STATEMENT'
  | 'AFR_FUND_REPORT'
  | 'GATEWAY_EXPORT';

/**
 * Report output format.
 */
export type ReportFormat = 'JSON' | 'CSV' | 'XLSX' | 'PDF' | 'HTML';

// ============================================================================
// TRIAL BALANCE REPORT
// ============================================================================

/**
 * Trial balance line item.
 */
export interface TrialBalanceLine {
  account: {
    id: string;
    code: string;
    name: string;
    type: Account['type'];
    level?: number;
  };
  fund: {
    id: string;
    code: string;
    name: string;
  };
  debit: number;
  credit: number;
  balance: number;
}

/**
 * Trial balance report.
 */
export interface TrialBalanceReport {
  metadata: ReportMetadata;
  lines: TrialBalanceLine[];
  totals: {
    totalDebits: number;
    totalCredits: number;
    difference: number;
    isBalanced: boolean;
  };
}

// ============================================================================
// FUND SUMMARY REPORT
// ============================================================================

/**
 * Fund summary line item.
 */
export interface FundSummaryLine {
  fund: {
    id: string;
    code: string;
    name: string;
    type: FundType;
    category?: string;
    isRestricted: boolean;
  };
  beginningBalance: number;
  receipts: {
    propertyTax: number;
    intergovernmental: number;
    chargesForServices: number;
    other: number;
    total: number;
  };
  disbursements: {
    personalServices: number;
    supplies: number;
    services: number;
    capital: number;
    debtService: number;
    other: number;
    total: number;
  };
  transfersIn: number;
  transfersOut: number;
  netChange: number;
  endingBalance: number;
}

/**
 * Fund summary report.
 */
export interface FundSummaryReport {
  metadata: ReportMetadata;
  funds: FundSummaryLine[];
  totals: {
    totalBeginningBalance: number;
    totalReceipts: number;
    totalDisbursements: number;
    totalTransfersIn: number;
    totalTransfersOut: number;
    totalNetChange: number;
    totalEndingBalance: number;
  };
  /** Funds grouped by type */
  byType?: {
    governmental: FundSummaryLine[];
    proprietary: FundSummaryLine[];
    fiduciary: FundSummaryLine[];
  };
}

// ============================================================================
// BUDGET VS ACTUAL REPORT
// ============================================================================

/**
 * Budget vs actual line item.
 */
export interface BudgetVsActualLine {
  fund: {
    id: string;
    code: string;
    name: string;
  };
  account?: {
    id: string;
    code: string;
    name: string;
    type: Account['type'];
  };
  category?: string;
  lineType: 'REVENUE' | 'APPROPRIATION';
  adopted: number;
  amended: number;
  actual: number;
  encumbered: number;
  available: number;
  percentUsed: number;
  variance: number;
  variancePercent: number;
}

/**
 * Budget vs actual report.
 */
export interface BudgetVsActualReport {
  metadata: ReportMetadata;
  fiscalYear: number;
  lines: BudgetVsActualLine[];
  summary: {
    revenue: {
      budgeted: number;
      actual: number;
      variance: number;
      percentCollected: number;
    };
    expenditure: {
      budgeted: number;
      actual: number;
      encumbered: number;
      available: number;
      percentUsed: number;
    };
    netPosition: {
      budgeted: number;
      actual: number;
      variance: number;
    };
  };
  fundBreakdown?: {
    fundId: string;
    fundCode: string;
    fundName: string;
    revenue: BudgetVsActualLine[];
    expenditure: BudgetVsActualLine[];
  }[];
}

// ============================================================================
// REVENUE/EXPENDITURE SUMMARY
// ============================================================================

/**
 * Revenue summary by category.
 */
export interface RevenueSummaryLine {
  category: string;
  categoryName: string;
  budgeted: number;
  received: number;
  variance: number;
  percentCollected: number;
  breakdown?: {
    accountCode: string;
    accountName: string;
    amount: number;
  }[];
}

/**
 * Revenue summary report.
 */
export interface RevenueSummaryReport {
  metadata: ReportMetadata;
  fundId?: string;
  fundName?: string;
  lines: RevenueSummaryLine[];
  total: {
    budgeted: number;
    received: number;
    variance: number;
    percentCollected: number;
  };
}

/**
 * Expenditure summary by category.
 */
export interface ExpenditureSummaryLine {
  category: string;
  categoryName: string;
  budgeted: number;
  expended: number;
  encumbered: number;
  available: number;
  percentUsed: number;
  breakdown?: {
    accountCode: string;
    accountName: string;
    amount: number;
  }[];
}

/**
 * Expenditure summary report.
 */
export interface ExpenditureSummaryReport {
  metadata: ReportMetadata;
  fundId?: string;
  fundName?: string;
  lines: ExpenditureSummaryLine[];
  total: {
    budgeted: number;
    expended: number;
    encumbered: number;
    available: number;
    percentUsed: number;
  };
}

// ============================================================================
// TRANSACTION REGISTER
// ============================================================================

/**
 * Transaction register line.
 */
export interface TransactionRegisterLine {
  transaction: {
    id: string;
    date: Date;
    type: Transaction['type'];
    status: Transaction['status'];
    checkNumber?: string;
    receiptNumber?: string;
    externalRef?: string;
  };
  fund: {
    code: string;
    name: string;
  };
  account?: {
    code: string;
    name: string;
  };
  vendor?: {
    id: string;
    name: string;
  };
  description: string;
  amount: number;
  runningBalance?: number;
}

/**
 * Transaction register report.
 */
export interface TransactionRegisterReport {
  metadata: ReportMetadata;
  fundId?: string;
  fundName?: string;
  transactions: TransactionRegisterLine[];
  summary: {
    transactionCount: number;
    totalReceipts: number;
    totalDisbursements: number;
    totalTransfers: number;
    totalAdjustments: number;
    netChange: number;
  };
}

// ============================================================================
// DEBT SCHEDULE REPORT
// ============================================================================

/**
 * Debt schedule line.
 */
export interface DebtScheduleLine {
  instrument: {
    id: string;
    name: string;
    type: string;
    issueDate: Date;
    maturityDate: Date;
    originalAmount: number;
    interestRate: number;
  };
  fiscalYear: number;
  principalDue: number;
  interestDue: number;
  totalDue: number;
  principalPaid: number;
  interestPaid: number;
  totalPaid: number;
  outstandingPrincipal: number;
}

/**
 * Debt schedule report.
 */
export interface DebtScheduleReport {
  metadata: ReportMetadata;
  instruments: {
    id: string;
    name: string;
    type: string;
    issueDate: Date;
    maturityDate: Date;
    originalAmount: number;
    outstandingPrincipal: number;
    interestRate: number;
    schedule: DebtScheduleLine[];
  }[];
  summary: {
    totalOutstandingPrincipal: number;
    currentYearPrincipal: number;
    currentYearInterest: number;
    currentYearTotal: number;
    totalFutureDebtService: number;
  };
}

// ============================================================================
// FUND BALANCE STATEMENT (GASB 54)
// ============================================================================

/**
 * Fund balance classification line.
 */
export interface FundBalanceClassificationLine {
  fund: {
    id: string;
    code: string;
    name: string;
    type: FundType;
  };
  nonspendable: number;
  restricted: number;
  committed: number;
  assigned: number;
  unassigned: number;
  totalFundBalance: number;
}

/**
 * Fund balance statement report.
 */
export interface FundBalanceStatementReport {
  metadata: ReportMetadata;
  classifications: FundBalanceClassificationLine[];
  totals: {
    nonspendable: number;
    restricted: number;
    committed: number;
    assigned: number;
    unassigned: number;
    totalFundBalance: number;
  };
}

// ============================================================================
// REPORT OPTIONS
// ============================================================================

/**
 * Common report generation options.
 */
export interface ReportOptions {
  tenantId: string;
  period: ReportPeriod;
  fundIds?: string[];
  accountIds?: string[];
  includeInactiveFunds?: boolean;
  includeZeroBalances?: boolean;
  groupBy?: 'fund' | 'category' | 'department';
  sortBy?: string;
  sortOrder?: 'ASC' | 'DESC';
  format?: ReportFormat;
}

/**
 * Trial balance options.
 */
export interface TrialBalanceOptions extends ReportOptions {
  asOfDate: Date;
  includeSubAccounts?: boolean;
}

/**
 * Budget vs actual options.
 */
export interface BudgetVsActualOptions extends ReportOptions {
  fiscalYear: number;
  includeEncumbrances?: boolean;
  showVariancePercent?: boolean;
}

/**
 * Transaction register options.
 */
export interface TransactionRegisterOptions extends ReportOptions {
  transactionTypes?: Transaction['type'][];
  statuses?: Transaction['status'][];
  vendorId?: string;
  searchTerm?: string;
  showRunningBalance?: boolean;
}

// ============================================================================
// REPORT GENERATOR INTERFACE
// ============================================================================

/**
 * Report generator interface.
 */
export interface ReportGenerator {
  /**
   * Generate a trial balance report.
   */
  generateTrialBalance(options: TrialBalanceOptions): Promise<TrialBalanceReport>;

  /**
   * Generate a fund summary report.
   */
  generateFundSummary(options: ReportOptions): Promise<FundSummaryReport>;

  /**
   * Generate a budget vs actual report.
   */
  generateBudgetVsActual(options: BudgetVsActualOptions): Promise<BudgetVsActualReport>;

  /**
   * Generate a revenue summary report.
   */
  generateRevenueSummary(options: ReportOptions): Promise<RevenueSummaryReport>;

  /**
   * Generate an expenditure summary report.
   */
  generateExpenditureSummary(options: ReportOptions): Promise<ExpenditureSummaryReport>;

  /**
   * Generate a transaction register report.
   */
  generateTransactionRegister(options: TransactionRegisterOptions): Promise<TransactionRegisterReport>;

  /**
   * Generate a debt schedule report.
   */
  generateDebtSchedule(options: ReportOptions): Promise<DebtScheduleReport>;

  /**
   * Generate a fund balance statement.
   */
  generateFundBalanceStatement(options: ReportOptions): Promise<FundBalanceStatementReport>;

  /**
   * Export report to specified format.
   */
  exportReport<T>(report: T, format: ReportFormat): Promise<Buffer | string>;
}
