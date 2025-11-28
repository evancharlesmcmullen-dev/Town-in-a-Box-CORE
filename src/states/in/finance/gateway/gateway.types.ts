// src/states/in/finance/gateway/gateway.types.ts

/**
 * Indiana Gateway Export Types
 *
 * Types for generating Gateway-ready exports for SBOA and DLGF reporting.
 * Gateway is Indiana's online portal for local government financial reporting.
 */

import { Fund } from '../../../../core/finance/finance.types';
import { INFinanceConfig } from '../in-finance.config';

// ============================================================================
// GATEWAY EXPORT TYPES
// ============================================================================

/**
 * Gateway report types.
 */
export type GatewayReportType =
  | 'AFR_FUND'           // Annual Financial Report - Fund Report
  | 'AFR_100R'           // Annual Financial Report - 100R (Payroll)
  | 'BUDGET_ESTIMATE'    // Budget Estimate (Form 1)
  | 'BUDGET_ADOPTED'     // Adopted Budget (Form 4)
  | 'DEBT_REPORT'        // Debt Outstanding Report
  | 'INVESTMENT_REPORT'  // Investment Report
  | 'PENSION_REPORT';    // Pension Obligations Report

/**
 * Gateway export status.
 */
export type GatewayExportStatus =
  | 'DRAFT'
  | 'VALIDATED'
  | 'READY'
  | 'SUBMITTED'
  | 'ACCEPTED'
  | 'REJECTED';

/**
 * Gateway export metadata.
 */
export interface GatewayExportMetadata {
  exportId: string;
  reportType: GatewayReportType;
  tenantId: string;
  unitName: string;
  unitId: string;             // DLGF Unit ID
  fiscalYear: number;
  status: GatewayExportStatus;
  createdAt: Date;
  createdBy: string;
  validatedAt?: Date;
  submittedAt?: Date;
  gatewayConfirmation?: string;
}

// ============================================================================
// AFR FUND REPORT
// ============================================================================

/**
 * AFR Fund Report line item.
 * Maps to Gateway AFR Fund Report structure.
 */
export interface AFRFundLine {
  fundNumber: string;
  fundName: string;
  fundType: 'GOVERNMENTAL' | 'PROPRIETARY' | 'FIDUCIARY';
  sboacCode?: string;

  // Beginning balance (as of Jan 1)
  beginningBalance: number;

  // Receipts (categorized)
  receipts: {
    propertyTaxes: number;
    localIncomeTax: number;
    licensesPermits: number;
    intergovernmental: number;
    chargesForServices: number;
    finesForfeitures: number;
    otherReceipts: number;
    transfersIn: number;
    totalReceipts: number;
  };

  // Disbursements (categorized)
  disbursements: {
    personalServices: number;
    supplies: number;
    otherServicesCharges: number;
    capitalOutlay: number;
    debtServicePrincipal: number;
    debtServiceInterest: number;
    otherDisbursements: number;
    transfersOut: number;
    totalDisbursements: number;
  };

  // Ending balance (as of Dec 31)
  endingBalance: number;

  // Calculated checks
  calculated: {
    netChange: number;
    isBalanced: boolean;  // Beginning + NetChange = Ending
  };

  // Traceability
  sourceTransactionIds?: string[];
  notes?: string;
}

/**
 * AFR Fund Report export.
 */
export interface AFRFundReport {
  metadata: GatewayExportMetadata;
  reportPeriod: {
    startDate: Date;
    endDate: Date;
    fiscalYear: number;
  };
  funds: AFRFundLine[];
  totals: {
    totalBeginningBalance: number;
    totalReceipts: number;
    totalDisbursements: number;
    totalEndingBalance: number;
    netChange: number;
  };
  validation: {
    isValid: boolean;
    errors: GatewayValidationError[];
    warnings: GatewayValidationWarning[];
  };
}

// ============================================================================
// AFR 100R (PAYROLL REPORT)
// ============================================================================

/**
 * 100R line item (employee/position).
 */
export interface AFR100RLine {
  fundNumber: string;
  departmentCode?: string;
  positionTitle: string;
  employeeName?: string;
  salaryWages: number;
  longevity: number;
  overtime: number;
  otherCompensation: number;
  totalCompensation: number;
  fica: number;
  retirement: number;
  healthInsurance: number;
  otherBenefits: number;
  totalBenefits: number;
  totalCost: number;
}

/**
 * 100R Report export.
 */
export interface AFR100RReport {
  metadata: GatewayExportMetadata;
  employees: AFR100RLine[];
  summary: {
    totalPositions: number;
    totalSalaryWages: number;
    totalBenefits: number;
    totalCost: number;
    byFund: {
      fundNumber: string;
      fundName: string;
      total: number;
    }[];
  };
  validation: {
    isValid: boolean;
    errors: GatewayValidationError[];
    warnings: GatewayValidationWarning[];
  };
}

// ============================================================================
// BUDGET REPORTS
// ============================================================================

/**
 * Budget estimate line.
 */
export interface BudgetEstimateLine {
  fundNumber: string;
  fundName: string;
  lineNumber: number;
  accountCode?: string;
  description: string;
  lineType: 'REVENUE' | 'APPROPRIATION';
  priorYearActual: number;
  currentYearEstimate: number;
  proposedBudget: number;
}

/**
 * Budget estimate report (Form 1).
 */
export interface BudgetEstimateReport {
  metadata: GatewayExportMetadata;
  fiscalYearBudgeting: number;  // Year being budgeted
  advertisedDate?: Date;
  hearingDate?: Date;
  lines: BudgetEstimateLine[];
  summary: {
    totalRevenueEstimate: number;
    totalAppropriationProposed: number;
  };
  validation: {
    isValid: boolean;
    errors: GatewayValidationError[];
    warnings: GatewayValidationWarning[];
  };
}

/**
 * Adopted budget line.
 */
export interface BudgetAdoptedLine {
  fundNumber: string;
  fundName: string;
  accountCode?: string;
  description: string;
  lineType: 'REVENUE' | 'APPROPRIATION';
  advertisedAmount: number;
  adoptedAmount: number;
}

/**
 * Adopted budget report (Form 4).
 */
export interface BudgetAdoptedReport {
  metadata: GatewayExportMetadata;
  fiscalYear: number;
  adoptedDate: Date;
  ordinanceNumber?: string;
  lines: BudgetAdoptedLine[];
  summary: {
    totalRevenueAdopted: number;
    totalAppropriationAdopted: number;
    taxLevy: number;
  };
  validation: {
    isValid: boolean;
    errors: GatewayValidationError[];
    warnings: GatewayValidationWarning[];
  };
}

// ============================================================================
// DEBT REPORT
// ============================================================================

/**
 * Debt report line.
 */
export interface DebtReportLine {
  debtType: string;
  purpose: string;
  issueDate: Date;
  maturityDate: Date;
  originalAmount: number;
  interestRate: number;
  beginningPrincipal: number;
  principalPaid: number;
  interestPaid: number;
  endingPrincipal: number;
  pledgedFunds?: string[];
}

/**
 * Debt report export.
 */
export interface DebtReport {
  metadata: GatewayExportMetadata;
  debts: DebtReportLine[];
  summary: {
    totalOutstanding: number;
    totalPrincipalPaid: number;
    totalInterestPaid: number;
    debtByType: {
      type: string;
      outstanding: number;
    }[];
  };
  validation: {
    isValid: boolean;
    errors: GatewayValidationError[];
    warnings: GatewayValidationWarning[];
  };
}

// ============================================================================
// VALIDATION
// ============================================================================

/**
 * Gateway validation error.
 */
export interface GatewayValidationError {
  code: string;
  field?: string;
  fundNumber?: string;
  message: string;
  citation?: string;
  severity: 'ERROR' | 'CRITICAL';
}

/**
 * Gateway validation warning.
 */
export interface GatewayValidationWarning {
  code: string;
  field?: string;
  fundNumber?: string;
  message: string;
  suggestion?: string;
  severity: 'WARNING' | 'INFO';
}

// ============================================================================
// EXPORT OPTIONS
// ============================================================================

/**
 * Gateway export options.
 */
export interface GatewayExportOptions {
  tenantId: string;
  fiscalYear: number;
  reportType: GatewayReportType;
  financeConfig: INFinanceConfig;

  /** Include only specific funds */
  fundIds?: string[];

  /** Include inactive funds */
  includeInactive?: boolean;

  /** User performing export */
  userId?: string;

  /** Perform validation */
  validate?: boolean;

  /** Format for output */
  format?: 'JSON' | 'CSV' | 'XML';
}

// ============================================================================
// EXPORT RESULT
// ============================================================================

/**
 * Gateway export result.
 */
export interface GatewayExportResult<T> {
  success: boolean;
  exportId: string;
  report: T;
  format: 'JSON' | 'CSV' | 'XML';
  data: string | Buffer;
  validation: {
    isValid: boolean;
    errors: GatewayValidationError[];
    warnings: GatewayValidationWarning[];
  };
  lineage: {
    /** Transaction IDs included in this export */
    transactionIds: string[];
    /** Fund IDs included */
    fundIds: string[];
    /** Generation timestamp */
    generatedAt: Date;
  };
}

// ============================================================================
// LINE ITEM EXPLANATION
// ============================================================================

/**
 * Explanation for a Gateway line item.
 * Supports "Explain this line" feature with full traceability.
 */
export interface GatewayLineExplanation {
  /** Unique line identifier */
  lineId: string;

  /** Fund code */
  fundNumber: string;

  /** Fund name */
  fundName: string;

  /** Field being explained */
  fieldName: string;

  /** Human-readable field name */
  fieldDisplayName: string;

  /** Reported value on Gateway */
  reportedValue: number;

  /** Fiscal year */
  fiscalYear: number;

  /** How the value was calculated */
  calculation: {
    /** Mathematical formula */
    formula: string;
    /** Plain English explanation */
    plainEnglish: string;
    /** Components that make up the value */
    components: {
      name: string;
      value: number;
      source: string;
      /** Percentage of total */
      percentage?: number;
    }[];
  };

  /** Underlying transactions with full traceability */
  transactions: {
    id: string;
    date: Date;
    description: string;
    amount: number;
    type: string;
    /** Link to import batch */
    importBatchId?: string;
    importBatchName?: string;
    checkNumber?: string;
    vendorName?: string;
  }[];

  /** Import batches that contributed to this line */
  importBatches: {
    batchId: string;
    batchName: string;
    importDate: Date;
    transactionCount: number;
    totalAmount: number;
    sourceSystem?: string;
  }[];

  /** Applicable rules and validation */
  rules: {
    ruleId: string;
    ruleName: string;
    description: string;
    /** Indiana Code citation */
    citation?: string;
    /** URL to official code */
    citationUrl?: string;
    /** Issuing authority */
    authority?: string;
    applied: boolean;
    result?: 'PASSED' | 'WARNING' | 'VIOLATED';
  }[];

  /** Legal citations relevant to this line */
  legalCitations: {
    code: string;
    title: string;
    description: string;
    url?: string;
    source: string;
  }[];

  /** Notes and adjustments */
  notes?: string;
  adjustments?: {
    id: string;
    reason: string;
    amount: number;
    date: Date;
    approvedBy?: string;
    approverTitle?: string;
  }[];

  /** Link to full audit trail */
  auditTrailUrl?: string;

  /** Generation metadata */
  generatedAt: Date;
  generatedBy?: string;
}

/**
 * Extended explanation with complete audit context.
 */
export interface GatewayLineExplanationFull extends GatewayLineExplanation {
  /** Complete transaction details for audit */
  fullTransactionDetails?: {
    id: string;
    transactionDate: Date;
    postDate?: Date;
    type: string;
    status: string;
    amount: number;
    description: string;
    fundCode: string;
    accountCode?: string;
    vendorId?: string;
    vendorName?: string;
    checkNumber?: string;
    referenceNumber?: string;
    approvedBy?: string;
    approvalDate?: Date;
    importBatchId?: string;
    editHistory?: {
      timestamp: Date;
      userId: string;
      changes: string;
    }[];
  }[];

  /** Supporting documents attached */
  supportingDocuments?: {
    id: string;
    name: string;
    type: string;
    uploadDate: Date;
    url?: string;
  }[];

  /** Related lines (e.g., matching transfers) */
  relatedLines?: {
    lineId: string;
    fundNumber: string;
    fieldName: string;
    relationship: string;
    amount: number;
  }[];
}
