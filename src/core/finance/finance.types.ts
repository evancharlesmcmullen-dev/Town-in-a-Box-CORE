// src/core/finance/finance.types.ts

/**
 * Town-in-a-Box Finance Engine - Canonical Data Model
 *
 * This module defines the core domain model for municipal finance operations.
 * All types are designed to be state-agnostic at the core level, with
 * state-specific extensions handled through state packs.
 *
 * Design Principles:
 * - Every number should be explainable (traceable to source transactions)
 * - Multi-tenant by default (tenantId on all entities)
 * - Fiscal entity aware (supports consolidated reporting)
 * - Extensible via [key: string] for state-specific fields
 */

// ============================================================================
// ENUMS & CONSTANTS
// ============================================================================

/**
 * Transaction types following standard municipal accounting.
 */
export type TransactionType =
  | 'RECEIPT'           // Money coming in (revenue, transfers in)
  | 'DISBURSEMENT'      // Money going out (expenditures, transfers out)
  | 'TRANSFER'          // Internal transfer between funds
  | 'ADJUSTMENT'        // Corrections, year-end adjustments
  | 'ENCUMBRANCE'       // Commitment of funds (purchase orders)
  | 'LIQUIDATION';      // Release of encumbrance

/**
 * Transaction status for workflow tracking.
 */
export type TransactionStatus =
  | 'DRAFT'             // Created but not posted
  | 'PENDING_APPROVAL'  // Awaiting approval
  | 'APPROVED'          // Approved, ready to post
  | 'POSTED'            // Posted to ledger
  | 'VOIDED'            // Canceled/reversed
  | 'RECONCILED';       // Matched to bank statement

/**
 * Fund type classifications.
 */
export type FundType =
  | 'GOVERNMENTAL'      // General, special revenue, debt service, capital
  | 'PROPRIETARY'       // Enterprise (utilities), internal service
  | 'FIDUCIARY';        // Trust, agency, pension

/**
 * Account type for chart of accounts.
 */
export type AccountType =
  | 'ASSET'
  | 'LIABILITY'
  | 'EQUITY'            // Fund balance/net position
  | 'REVENUE'
  | 'EXPENDITURE'       // Governmental funds
  | 'EXPENSE';          // Proprietary funds

/**
 * Budget status tracking.
 */
export type BudgetStatus =
  | 'DRAFT'
  | 'PROPOSED'
  | 'ADVERTISED'
  | 'ADOPTED'
  | 'AMENDED';

/**
 * Debt instrument types.
 */
export type DebtType =
  | 'GENERAL_OBLIGATION' // GO bonds backed by full faith and credit
  | 'REVENUE'            // Revenue bonds backed by specific revenue
  | 'LEASE_RENTAL'       // Lease rental agreements
  | 'TIF'                // Tax increment financing
  | 'BAN'                // Bond anticipation notes
  | 'NOTE'               // General notes payable
  | 'LOAN';              // Bank or state revolving fund loans

/**
 * Amortization schedule type.
 */
export type AmortizationType =
  | 'LEVEL_DEBT_SERVICE' // Equal total payments
  | 'LEVEL_PRINCIPAL'    // Equal principal payments
  | 'INTEREST_ONLY'      // Interest only, balloon principal
  | 'CUSTOM';            // Custom schedule

// ============================================================================
// CORE ENTITIES
// ============================================================================

/**
 * Fund - Primary organizational unit for municipal accounting.
 *
 * Funds are self-balancing sets of accounts used to track resources
 * for specific purposes or restrictions.
 */
export interface Fund {
  id: string;
  tenantId: string;
  fiscalEntityId?: string;  // For consolidated entities

  // Identification
  code: string;             // SBOA-style code (e.g., "101", "601")
  name: string;             // Display name (e.g., "General Fund")

  // Classification
  type: FundType;
  category?: string;        // State-specific category (e.g., "general", "utility")

  // Status
  isActive: boolean;
  isRestricted: boolean;    // Restricted use funds (utilities, grants, etc.)

  // Balances (computed from transactions)
  beginningBalance?: number;
  currentBalance?: number;

  // Metadata
  description?: string;
  allowedUseTags?: string[];
  statutoryCitation?: string;

  // State-specific extensions
  stateCode?: string;       // SBOA code for Indiana, etc.
  sboacCode?: string;       // Standard Board of Accounts Classification

  // Audit trail
  createdAt: Date;
  updatedAt: Date;
  createdBy?: string;

  // Extensibility
  [key: string]: unknown;
}

/**
 * Account - Line item within a fund's chart of accounts.
 *
 * Accounts are used to categorize revenues, expenditures, assets,
 * liabilities, and fund balance within a fund.
 */
export interface Account {
  id: string;
  tenantId: string;
  fundId: string;

  // Identification
  code: string;             // Account code (e.g., "4100", "5100")
  name: string;             // Display name (e.g., "Property Tax Revenue")

  // Classification
  type: AccountType;
  parentAccountId?: string; // For hierarchical chart of accounts
  level?: number;           // Hierarchy level (1 = top level)

  // Status
  isActive: boolean;
  isPostable: boolean;      // Can transactions post to this account?

  // State-specific
  sboacCode?: string;       // SBOA classification code
  gatewayCode?: string;     // Gateway reporting code

  // Balance (for balance sheet accounts)
  normalBalance?: 'DEBIT' | 'CREDIT';
  currentBalance?: number;

  // Metadata
  description?: string;

  // Audit trail
  createdAt: Date;
  updatedAt: Date;

  // Extensibility
  [key: string]: unknown;
}

/**
 * BudgetLine - Adopted budget appropriation for a fund/account.
 *
 * Represents the legally binding appropriation authority for
 * expenditures within a fiscal year.
 */
export interface BudgetLine {
  id: string;
  tenantId: string;
  fundId: string;
  accountId?: string;       // Optional - may be fund-level budget

  // Period
  fiscalYear: number;
  periodStart?: Date;       // For monthly/quarterly budgets
  periodEnd?: Date;

  // Amounts
  adoptedAmount: number;    // Original adopted budget
  amendedAmount?: number;   // Current amended amount
  encumberedAmount?: number;// Committed via encumbrances
  expendedAmount?: number;  // Actual expenditures

  // Computed
  availableAmount?: number; // Adopted/Amended - Encumbered - Expended

  // Status & Tracking
  status: BudgetStatus;
  adoptedDate?: Date;
  ordinanceNumber?: string;

  // Classification
  lineType?: 'REVENUE' | 'APPROPRIATION' | 'TRANSFER';
  category?: string;        // Department, program, object code, etc.

  // Audit trail
  createdAt: Date;
  updatedAt: Date;

  // Extensibility
  [key: string]: unknown;
}

/**
 * Transaction - Individual financial transaction record.
 *
 * The atomic unit of the finance engine. Every dollar movement
 * should be represented by one or more transactions.
 */
export interface Transaction {
  id: string;
  tenantId: string;
  fundId: string;
  accountId?: string;

  // Classification
  type: TransactionType;
  status: TransactionStatus;

  // Timing
  transactionDate: Date;    // When the transaction occurred
  postingDate?: Date;       // When posted to ledger
  effectiveDate?: Date;     // For accrual accounting

  // Amounts
  amount: number;           // Positive for debits, context determines meaning

  // Description & Reference
  description: string;
  memo?: string;

  // External references
  externalRef?: string;     // Vendor invoice #, check #, etc.
  vendorId?: string;
  payeeId?: string;
  checkNumber?: string;
  receiptNumber?: string;

  // Related entities
  budgetLineId?: string;    // Links to budget appropriation
  encumbranceId?: string;   // For encumbrance/liquidation tracking
  relatedTransactionId?: string; // For transfers, reversals

  // Approval workflow
  approvedBy?: string;
  approvedAt?: Date;

  // Document attachments
  attachments?: TransactionAttachment[];

  // For imports
  importBatchId?: string;
  importSource?: string;
  importRowNumber?: number;

  // Audit trail
  createdAt: Date;
  updatedAt: Date;
  createdBy?: string;

  // Extensibility
  [key: string]: unknown;
}

/**
 * Attachment reference for transactions.
 */
export interface TransactionAttachment {
  id: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  storagePath: string;
  description?: string;
  uploadedAt: Date;
  uploadedBy?: string;
}

/**
 * DebtInstrument - Bonds, notes, and other debt obligations.
 *
 * Tracks debt issuances and their amortization schedules for
 * debt management and reporting.
 */
export interface DebtInstrument {
  id: string;
  tenantId: string;

  // Identification
  name: string;
  instrumentNumber?: string; // Bond series, note number

  // Classification
  type: DebtType;
  issuingAuthority?: string;
  purpose?: string;

  // Financial terms
  parAmount: number;        // Original principal amount
  premiumDiscount?: number; // Premium (positive) or discount (negative)
  issueDate: Date;
  maturityDate: Date;

  // Interest terms
  interestRate: number;     // Annual rate (e.g., 0.0375 for 3.75%)
  isVariableRate: boolean;
  rateResetFrequency?: 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'QUARTERLY' | 'ANNUAL';

  // Amortization
  amortizationType: AmortizationType;
  paymentFrequency: 'MONTHLY' | 'QUARTERLY' | 'SEMI_ANNUAL' | 'ANNUAL';
  firstPaymentDate?: Date;

  // Call provisions
  isCallable: boolean;
  callDate?: Date;
  callPremium?: number;

  // Security & Pledges
  pledgedFundIds?: string[];      // Funds pledged for repayment
  pledgedRevenueTypes?: string[]; // Types of revenue pledged
  debtServiceFundId?: string;     // Fund for debt service payments

  // Current status (computed)
  outstandingPrincipal?: number;
  accruedInterest?: number;
  nextPaymentDate?: Date;
  nextPaymentAmount?: number;

  // Status
  isActive: boolean;
  isRefunded?: boolean;
  refundedByInstrumentId?: string;

  // Ratings
  rating?: string;
  ratingAgency?: string;

  // Compliance
  covenants?: DebtCovenant[];

  // Audit trail
  createdAt: Date;
  updatedAt: Date;

  // Extensibility
  [key: string]: unknown;
}

/**
 * DebtServiceSchedule - Payment schedule for debt instruments.
 */
export interface DebtServiceSchedule {
  id: string;
  instrumentId: string;

  // Payment period
  paymentNumber: number;
  paymentDate: Date;
  fiscalYear: number;

  // Amounts
  principalAmount: number;
  interestAmount: number;
  totalPayment: number;

  // Running totals
  cumulativePrincipal?: number;
  remainingPrincipal?: number;

  // Status
  isPaid: boolean;
  paidDate?: Date;
  paidTransactionId?: string;
}

/**
 * DebtCovenant - Compliance requirements for debt instruments.
 */
export interface DebtCovenant {
  type: 'COVERAGE_RATIO' | 'RESERVE_REQUIREMENT' | 'RATE_COVENANT' | 'OTHER';
  description: string;
  threshold?: number;
  currentValue?: number;
  isCompliant?: boolean;
  lastChecked?: Date;
}

// ============================================================================
// FISCAL ENTITY & HIERARCHY
// ============================================================================

/**
 * FiscalEntity - For municipalities with multiple reporting entities.
 *
 * Supports consolidated reporting for complex governmental structures
 * (e.g., town + redevelopment commission + utility authority).
 */
export interface FiscalEntity {
  id: string;
  tenantId: string;

  name: string;
  type: 'PRIMARY' | 'COMPONENT_UNIT' | 'BLENDED' | 'DISCRETE';

  // Hierarchy
  parentEntityId?: string;

  // SBOA/Gateway identification
  sboacUnitId?: string;
  gatewayUnitId?: string;

  // Status
  isActive: boolean;
  fiscalYearEnd: { month: number; day: number };

  createdAt: Date;
  updatedAt: Date;
}

// ============================================================================
// VENDOR & PAYEE
// ============================================================================

/**
 * Vendor - Entity that receives payments.
 */
export interface Vendor {
  id: string;
  tenantId: string;

  name: string;
  vendorNumber?: string;

  // Contact
  address?: Address;
  phone?: string;
  email?: string;

  // Tax information
  taxId?: string;
  requires1099: boolean;
  vendor1099Type?: '1099-MISC' | '1099-NEC' | '1099-INT';

  // Payment preferences
  paymentMethod?: 'CHECK' | 'ACH' | 'WIRE';
  achRoutingNumber?: string;
  achAccountNumber?: string;

  // Status
  isActive: boolean;

  createdAt: Date;
  updatedAt: Date;
}

/**
 * Address structure.
 */
export interface Address {
  line1: string;
  line2?: string;
  city: string;
  state: string;
  postalCode: string;
  country?: string;
}

// ============================================================================
// RECONCILIATION
// ============================================================================

/**
 * BankAccount - Bank account for cash management.
 */
export interface BankAccount {
  id: string;
  tenantId: string;

  name: string;
  accountNumber: string;
  routingNumber: string;
  bankName: string;
  accountType: 'CHECKING' | 'SAVINGS' | 'MONEY_MARKET' | 'INVESTMENT';

  // Linked funds
  linkedFundIds: string[];
  isPrimaryOperating: boolean;

  // Current status
  currentBalance?: number;
  lastReconciledDate?: Date;
  lastReconciledBalance?: number;

  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Reconciliation - Bank reconciliation record.
 */
export interface Reconciliation {
  id: string;
  tenantId: string;
  bankAccountId: string;

  // Period
  statementDate: Date;
  statementEndingBalance: number;

  // Calculated
  bookBalance: number;
  adjustedBookBalance: number;
  adjustedBankBalance: number;
  difference: number;

  // Outstanding items
  outstandingDeposits: number;
  outstandingChecks: number;

  // Status
  status: 'IN_PROGRESS' | 'COMPLETED' | 'APPROVED';
  completedAt?: Date;
  completedBy?: string;
  approvedAt?: Date;
  approvedBy?: string;

  createdAt: Date;
  updatedAt: Date;
}

// ============================================================================
// IMPORT / BATCH OPERATIONS
// ============================================================================

/**
 * ImportBatch - Tracks imported data batches.
 */
export interface ImportBatch {
  id: string;
  tenantId: string;

  // Source
  source: string;           // Vendor name, system name
  importType: 'TRANSACTIONS' | 'BUDGET' | 'CHART_OF_ACCOUNTS' | 'VENDORS';
  fileName?: string;
  fileHash?: string;

  // Timing
  importedAt: Date;
  importedBy: string;

  // Results
  status: 'PENDING' | 'VALIDATING' | 'VALIDATED' | 'IMPORTING' | 'COMPLETED' | 'FAILED';
  totalRows: number;
  successfulRows: number;
  failedRows: number;
  warningRows: number;

  // Errors and warnings
  errors?: ImportError[];
  warnings?: ImportWarning[];

  // Rollback support
  isReversible: boolean;
  reversedAt?: Date;
  reversedBy?: string;
}

/**
 * Import error detail.
 */
export interface ImportError {
  rowNumber: number;
  field?: string;
  value?: string;
  errorCode: string;
  message: string;
}

/**
 * Import warning detail.
 */
export interface ImportWarning {
  rowNumber: number;
  field?: string;
  warningCode: string;
  message: string;
  autoResolved?: boolean;
}

// ============================================================================
// VALIDATION RESULT
// ============================================================================

/**
 * ValidationResult - Standardized validation response.
 */
export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

export interface ValidationError {
  code: string;
  field?: string;
  message: string;
  severity: 'ERROR' | 'CRITICAL';
  citation?: string;        // Statutory citation
}

export interface ValidationWarning {
  code: string;
  field?: string;
  message: string;
  severity: 'WARNING' | 'INFO';
  suggestion?: string;
}

// ============================================================================
// PERIOD & DATE HELPERS
// ============================================================================

/**
 * FiscalPeriod - Represents a fiscal period for reporting.
 */
export interface FiscalPeriod {
  fiscalYear: number;
  period: number;           // 1-12 for monthly, 1-4 for quarterly, 1 for annual
  periodType: 'MONTHLY' | 'QUARTERLY' | 'ANNUAL';
  startDate: Date;
  endDate: Date;
  isClosed: boolean;
  closedAt?: Date;
  closedBy?: string;
}

// ============================================================================
// FUND BALANCE CLASSIFICATION (GASB 54)
// ============================================================================

/**
 * FundBalanceClassification - GASB 54 fund balance categories.
 */
export interface FundBalanceClassification {
  fundId: string;
  fiscalYear: number;

  // GASB 54 Classifications
  nonspendable: number;     // Inventory, prepaid, permanent fund principal
  restricted: number;       // External restrictions (grants, debt covenants)
  committed: number;        // Council resolution
  assigned: number;         // Intended use (management designation)
  unassigned: number;       // Residual (General Fund only)

  totalFundBalance: number;

  lastCalculated: Date;
}

// ============================================================================
// SUMMARY TYPES FOR REPORTING
// ============================================================================

/**
 * FundSummary - Aggregated fund information for reporting.
 */
export interface FundSummary {
  fund: Fund;

  // Balances
  beginningBalance: number;
  totalReceipts: number;
  totalDisbursements: number;
  netChange: number;
  endingBalance: number;

  // Budget comparison
  budgetedRevenue?: number;
  budgetedExpenditure?: number;
  revenueVariance?: number;
  expenditureVariance?: number;

  // Period
  periodStart: Date;
  periodEnd: Date;

  // For utilities
  coverageRatio?: number;
}

/**
 * TransactionSummary - Aggregated transaction totals.
 */
export interface TransactionSummary {
  fundId: string;
  accountId?: string;

  periodStart: Date;
  periodEnd: Date;

  receiptCount: number;
  receiptTotal: number;
  disbursementCount: number;
  disbursementTotal: number;
  transferInCount: number;
  transferInTotal: number;
  transferOutCount: number;
  transferOutTotal: number;
  adjustmentCount: number;
  adjustmentTotal: number;

  netChange: number;
}
