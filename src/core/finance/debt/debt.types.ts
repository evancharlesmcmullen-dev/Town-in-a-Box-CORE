// src/core/finance/debt/debt.types.ts

/**
 * Town-in-a-Box Finance Engine - Debt Scenario Modeling Types
 *
 * Types for debt scenario modeling including:
 * - New bond issuance scenarios
 * - Early payoff analysis
 * - Refunding/refinancing scenarios
 * - Debt capacity analysis
 */

import {
  DebtInstrument,
  DebtServiceSchedule,
  DebtType,
  AmortizationType,
} from '../finance.types';

// ============================================================================
// DEBT SERVICE CALCULATION
// ============================================================================

/**
 * Debt service summary for a period.
 */
export interface DebtServiceSummary {
  /** Period start date */
  periodStart: Date;

  /** Period end date */
  periodEnd: Date;

  /** Total principal due */
  principalDue: number;

  /** Total interest due */
  interestDue: number;

  /** Total debt service */
  totalDebtService: number;

  /** Breakdown by instrument */
  byInstrument: DebtServiceByInstrument[];
}

/**
 * Debt service for a single instrument.
 */
export interface DebtServiceByInstrument {
  instrumentId: string;
  instrumentName: string;
  type: DebtType;
  principal: number;
  interest: number;
  total: number;
  remainingPrincipal: number;
  percentComplete: number;
}

/**
 * Annual debt service projection.
 */
export interface AnnualDebtProjection {
  fiscalYear: number;
  totalPrincipal: number;
  totalInterest: number;
  totalDebtService: number;
  maturing: DebtInstrument[];
  newIssues: DebtInstrument[];
}

// ============================================================================
// DEBT SCENARIO TYPES
// ============================================================================

/**
 * Scenario type for debt modeling.
 */
export type DebtScenarioType =
  | 'NEW_ISSUANCE'      // Issue new debt
  | 'EARLY_PAYOFF'      // Pay off existing debt early
  | 'REFUNDING'         // Refund/refinance existing debt
  | 'RESTRUCTURE'       // Restructure existing debt
  | 'COMBINED';         // Multiple actions

/**
 * Base debt scenario interface.
 */
export interface BaseDebtScenario {
  /** Unique scenario ID */
  id: string;

  /** Tenant ID */
  tenantId: string;

  /** Scenario name */
  name: string;

  /** Description */
  description?: string;

  /** Scenario type */
  type: DebtScenarioType;

  /** Analysis date */
  analysisDate: Date;

  /** Created date */
  createdAt: Date;

  /** Created by */
  createdBy?: string;

  /** Notes/assumptions */
  notes?: string;
}

// ============================================================================
// NEW ISSUANCE SCENARIO
// ============================================================================

/**
 * Parameters for a new bond issuance.
 */
export interface NewIssuanceParams {
  /** Project/purpose name */
  projectName: string;

  /** Principal amount needed */
  principalAmount: number;

  /** Expected issue date */
  issueDate: Date;

  /** Debt type */
  type: DebtType;

  /** Assumed interest rate */
  assumedInterestRate: number;

  /** Term in years */
  termYears: number;

  /** Amortization type */
  amortizationType: AmortizationType;

  /** Payment frequency */
  paymentFrequency: 'MONTHLY' | 'QUARTERLY' | 'SEMI_ANNUAL' | 'ANNUAL';

  /** Is callable? */
  isCallable?: boolean;

  /** Call date (if callable) */
  callDate?: Date;

  /** Issuance costs (percentage or absolute) */
  issuanceCosts?: {
    type: 'PERCENTAGE' | 'ABSOLUTE';
    value: number;
  };

  /** Reserve fund requirement */
  reserveFundRequirement?: {
    type: 'PERCENTAGE' | 'MAX_ANNUAL_DS' | 'AVERAGE_ANNUAL_DS';
    value?: number;
  };

  /** Fund to be credited with proceeds */
  proceedsFundId?: string;

  /** Fund for debt service */
  debtServiceFundId?: string;
}

/**
 * New issuance scenario.
 */
export interface NewIssuanceScenario extends BaseDebtScenario {
  type: 'NEW_ISSUANCE';

  /** Issuance parameters */
  params: NewIssuanceParams;
}

// ============================================================================
// EARLY PAYOFF SCENARIO
// ============================================================================

/**
 * Parameters for early payoff analysis.
 */
export interface EarlyPayoffParams {
  /** Instrument to pay off */
  instrumentId: string;

  /** Proposed payoff date */
  payoffDate: Date;

  /** Source of funds */
  fundingSource: 'RESERVES' | 'NEW_ISSUANCE' | 'GRANT' | 'OTHER';

  /** If new issuance, parameters */
  newIssuanceParams?: NewIssuanceParams;

  /** Call premium if applicable */
  callPremium?: number;

  /** Additional costs */
  additionalCosts?: number;
}

/**
 * Early payoff scenario.
 */
export interface EarlyPayoffScenario extends BaseDebtScenario {
  type: 'EARLY_PAYOFF';

  /** Payoff parameters */
  params: EarlyPayoffParams;
}

// ============================================================================
// REFUNDING SCENARIO
// ============================================================================

/**
 * Refunding type.
 */
export type RefundingType =
  | 'CURRENT'           // Within 90 days of call date
  | 'ADVANCE'           // More than 90 days before call date
  | 'CROSSOVER';        // Escrowed to crossover date

/**
 * Escrow type for refunding.
 */
export type EscrowType =
  | 'CASH'              // Cash escrow
  | 'DEFEASANCE'        // Defeased with securities
  | 'NONE';             // No escrow (current refunding)

/**
 * Parameters for refunding analysis.
 */
export interface RefundingParams {
  /** Instruments to refund */
  instrumentIds: string[];

  /** Refunding type */
  refundingType: RefundingType;

  /** Proposed refunding date */
  refundingDate: Date;

  /** New debt parameters */
  newDebtParams: {
    assumedInterestRate: number;
    termYears: number;
    amortizationType: AmortizationType;
    paymentFrequency: 'MONTHLY' | 'QUARTERLY' | 'SEMI_ANNUAL' | 'ANNUAL';
  };

  /** Escrow type */
  escrowType?: EscrowType;

  /** Assumed escrow yield (for advance refunding) */
  escrowYield?: number;

  /** Issuance costs */
  issuanceCosts?: {
    type: 'PERCENTAGE' | 'ABSOLUTE';
    value: number;
  };

  /** Target savings - minimum NPV savings to proceed */
  targetSavingsPercent?: number;
}

/**
 * Refunding scenario.
 */
export interface RefundingScenario extends BaseDebtScenario {
  type: 'REFUNDING';

  /** Refunding parameters */
  params: RefundingParams;
}

// ============================================================================
// COMBINED SCENARIO
// ============================================================================

/**
 * Combined scenario with multiple actions.
 */
export interface CombinedDebtScenario extends BaseDebtScenario {
  type: 'COMBINED';

  /** Scenarios to combine */
  scenarios: (NewIssuanceScenario | EarlyPayoffScenario | RefundingScenario)[];
}

/**
 * Union type for all debt scenarios.
 */
export type DebtScenario =
  | NewIssuanceScenario
  | EarlyPayoffScenario
  | RefundingScenario
  | CombinedDebtScenario;

// ============================================================================
// SCENARIO ANALYSIS RESULTS
// ============================================================================

/**
 * Generated amortization schedule entry.
 */
export interface AmortizationEntry {
  paymentNumber: number;
  paymentDate: Date;
  fiscalYear: number;
  beginningBalance: number;
  principal: number;
  interest: number;
  totalPayment: number;
  endingBalance: number;
}

/**
 * Result of new issuance analysis.
 */
export interface NewIssuanceResult {
  /** Scenario ID */
  scenarioId: string;

  /** True Interest Cost (TIC) */
  trueInterestCost: number;

  /** Net Interest Cost (NIC) */
  netInterestCost: number;

  /** All-in cost including fees */
  allInCost: number;

  /** Total interest over life */
  totalInterest: number;

  /** Total debt service */
  totalDebtService: number;

  /** Average annual debt service */
  averageAnnualDS: number;

  /** Maximum annual debt service */
  maxAnnualDS: number;

  /** Proceeds available for project (after costs/reserves) */
  netProceeds: number;

  /** Issuance costs */
  issuanceCosts: number;

  /** Reserve fund amount */
  reserveFund: number;

  /** Generated amortization schedule */
  schedule: AmortizationEntry[];

  /** Projected debt instrument */
  projectedInstrument: Omit<DebtInstrument, 'id'>;

  /** Annual projections */
  annualProjections: AnnualDebtProjection[];

  /** Warnings */
  warnings: string[];
}

/**
 * Result of early payoff analysis.
 */
export interface EarlyPayoffResult {
  /** Scenario ID */
  scenarioId: string;

  /** Instrument being paid off */
  instrument: DebtInstrument;

  /** Outstanding principal at payoff date */
  outstandingPrincipal: number;

  /** Accrued interest to payoff date */
  accruedInterest: number;

  /** Call premium amount */
  callPremium: number;

  /** Additional costs */
  additionalCosts: number;

  /** Total payoff amount */
  totalPayoffAmount: number;

  /** Remaining scheduled debt service (avoided) */
  remainingScheduledDS: number;

  /** Gross savings (avoided DS - payoff amount) */
  grossSavings: number;

  /** NPV of savings (discounted) */
  npvSavings: number;

  /** NPV savings as percent of refunded debt */
  npvSavingsPercent: number;

  /** Annual savings by year */
  annualSavings: { year: number; amount: number }[];

  /** Payoff date */
  payoffDate: Date;

  /** Is economically advantageous? */
  isAdvised: boolean;

  /** Warnings */
  warnings: string[];
}

/**
 * Result of refunding analysis.
 */
export interface RefundingResult {
  /** Scenario ID */
  scenarioId: string;

  /** Instruments being refunded */
  refundedInstruments: DebtInstrument[];

  /** Total refunded principal */
  refundedPrincipal: number;

  /** New issue size (including costs, escrow, etc.) */
  newIssueSize: number;

  /** Escrow deposit required */
  escrowDeposit: number;

  /** Issuance costs */
  issuanceCosts: number;

  /** Old debt service (remaining) */
  oldDebtService: number;

  /** New debt service (total) */
  newDebtService: number;

  /** Gross savings */
  grossSavings: number;

  /** NPV of savings */
  npvSavings: number;

  /** NPV savings as percent of refunded debt */
  npvSavingsPercent: number;

  /** Is arbitrage-positive? (advance refunding check) */
  isArbitragePositive: boolean;

  /** Negative arbitrage amount (if applicable) */
  negativeArbitrage?: number;

  /** Generated amortization schedule for new debt */
  newSchedule: AmortizationEntry[];

  /** Projected new instrument */
  projectedInstrument: Omit<DebtInstrument, 'id'>;

  /** Annual comparison */
  annualComparison: {
    year: number;
    oldDS: number;
    newDS: number;
    savings: number;
  }[];

  /** Is economically advantageous? */
  isAdvised: boolean;

  /** Recommendation */
  recommendation: string;

  /** Warnings */
  warnings: string[];
}

// ============================================================================
// DEBT CAPACITY ANALYSIS
// ============================================================================

/**
 * Debt capacity metrics.
 */
export interface DebtCapacityMetrics {
  /** Analysis date */
  asOfDate: Date;

  /** Total outstanding debt */
  totalOutstandingDebt: number;

  /** Annual debt service (current year) */
  currentAnnualDebtService: number;

  /** Debt service coverage ratios by fund */
  coverageRatios: DebtCoverageRatio[];

  /** Debt per capita (if population provided) */
  debtPerCapita?: number;

  /** Debt as percent of assessed value */
  debtToAssessedValue?: number;

  /** Legal debt limit (if applicable) */
  legalDebtLimit?: number;

  /** Remaining debt capacity under limit */
  remainingCapacity?: number;

  /** Projected debt service by year */
  projectedDebtService: {
    year: number;
    debtService: number;
    maturingDebt: number;
  }[];

  /** Fiscal stress indicators */
  stressIndicators: {
    indicator: string;
    value: number;
    threshold: number;
    status: 'GOOD' | 'CAUTION' | 'WARNING';
  }[];
}

/**
 * Debt service coverage ratio for a revenue source.
 */
export interface DebtCoverageRatio {
  /** Revenue source or fund */
  source: string;

  /** Net available revenue */
  netRevenue: number;

  /** Annual debt service */
  debtService: number;

  /** Coverage ratio */
  coverageRatio: number;

  /** Required minimum coverage */
  requiredCoverage?: number;

  /** Status */
  status: 'ADEQUATE' | 'MARGINAL' | 'INSUFFICIENT';
}

// ============================================================================
// DEBT SCENARIO ENGINE INTERFACE
// ============================================================================

/**
 * Debt scenario modeling engine interface.
 */
export interface DebtScenarioEngine {
  /**
   * Generate amortization schedule for an instrument.
   */
  generateAmortizationSchedule(
    params: NewIssuanceParams
  ): AmortizationEntry[];

  /**
   * Analyze a new issuance scenario.
   */
  analyzeNewIssuance(
    scenario: NewIssuanceScenario
  ): NewIssuanceResult;

  /**
   * Analyze an early payoff scenario.
   */
  analyzeEarlyPayoff(
    scenario: EarlyPayoffScenario,
    instrument: DebtInstrument,
    schedule: DebtServiceSchedule[]
  ): EarlyPayoffResult;

  /**
   * Analyze a refunding scenario.
   */
  analyzeRefunding(
    scenario: RefundingScenario,
    instruments: DebtInstrument[],
    schedules: Map<string, DebtServiceSchedule[]>
  ): RefundingResult;

  /**
   * Calculate debt capacity metrics.
   */
  calculateDebtCapacity(
    instruments: DebtInstrument[],
    schedules: Map<string, DebtServiceSchedule[]>,
    options?: {
      population?: number;
      assessedValue?: number;
      legalDebtLimit?: number;
      revenues?: { source: string; amount: number }[];
    }
  ): DebtCapacityMetrics;

  /**
   * Project debt service forward.
   */
  projectDebtService(
    instruments: DebtInstrument[],
    schedules: Map<string, DebtServiceSchedule[]>,
    years: number
  ): AnnualDebtProjection[];

  /**
   * Validate a debt scenario.
   */
  validateScenario(scenario: DebtScenario): {
    isValid: boolean;
    errors: string[];
    warnings: string[];
  };
}
