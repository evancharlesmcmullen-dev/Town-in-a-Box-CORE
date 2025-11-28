// src/core/finance/forecast/forecast.types.ts

/**
 * Town-in-a-Box Finance Engine - Forecasting Types
 *
 * Types for baseline forecasting including:
 * - Revenue models (static, % growth, LIT-linked, grant-linked)
 * - Expense models (baseline + inflation, step changes)
 * - Fund forecast scenarios with configurable horizons
 */

// ============================================================================
// REVENUE MODEL TYPES
// ============================================================================

/**
 * Revenue model type determines how future revenue is projected.
 */
export type RevenueModelType =
  | 'STATIC'           // Fixed amount each period
  | 'PERCENT_GROWTH'   // Grows by fixed percentage annually
  | 'LIT_LINKED'       // Tied to Local Income Tax (Indiana-specific)
  | 'PROPERTY_TAX'     // Property tax levy with growth limits
  | 'GRANT_LINKED'     // Grant-based with defined periods
  | 'FEE_BASED'        // User fees with volume projections
  | 'SEASONAL'         // Seasonal pattern
  | 'CUSTOM';          // Custom formula

/**
 * Base revenue model interface.
 */
export interface BaseRevenueModel {
  /** Unique model ID */
  id: string;

  /** Human-readable name */
  name: string;

  /** Revenue source account code or category */
  sourceCode: string;

  /** Model type */
  type: RevenueModelType;

  /** Start date for projections */
  startDate: Date;

  /** End date (optional, for grants) */
  endDate?: Date;

  /** Whether model is active */
  isActive: boolean;

  /** Notes/assumptions */
  notes?: string;
}

/**
 * Static revenue model - same amount each period.
 */
export interface StaticRevenueModel extends BaseRevenueModel {
  type: 'STATIC';
  /** Fixed annual amount */
  annualAmount: number;
  /** Monthly distribution (optional, defaults to even) */
  monthlyDistribution?: number[];
}

/**
 * Percent growth revenue model.
 */
export interface PercentGrowthRevenueModel extends BaseRevenueModel {
  type: 'PERCENT_GROWTH';
  /** Base year amount */
  baseAmount: number;
  /** Annual growth rate (0.03 = 3%) */
  growthRate: number;
  /** Compounding frequency */
  compoundingFrequency?: 'ANNUAL' | 'MONTHLY';
}

/**
 * Local Income Tax linked revenue model (Indiana-specific).
 */
export interface LITLinkedRevenueModel extends BaseRevenueModel {
  type: 'LIT_LINKED';
  /** LIT rate (e.g., 0.015 = 1.5%) */
  litRate: number;
  /** Projected taxable income base */
  taxableIncomeBase: number;
  /** Annual income growth assumption */
  incomeGrowthRate: number;
  /** Collection efficiency factor (typically 0.95-0.98) */
  collectionEfficiency: number;
  /** Distribution lag in months */
  distributionLagMonths: number;
}

/**
 * Property tax revenue model with levy limits.
 */
export interface PropertyTaxRevenueModel extends BaseRevenueModel {
  type: 'PROPERTY_TAX';
  /** Certified levy amount */
  certifiedLevy: number;
  /** Maximum levy growth rate (Indiana = circuit breaker) */
  maxGrowthRate: number;
  /** Assessed value growth assumption */
  assessedValueGrowth: number;
  /** Collection rate (typically 0.95-0.98) */
  collectionRate: number;
  /** Circuit breaker loss percentage */
  circuitBreakerLoss?: number;
}

/**
 * Grant-linked revenue model.
 */
export interface GrantLinkedRevenueModel extends BaseRevenueModel {
  type: 'GRANT_LINKED';
  /** Grant amount per period */
  grantAmount: number;
  /** Grant period (annual, multi-year) */
  grantPeriod: 'ANNUAL' | 'MULTI_YEAR' | 'ONE_TIME';
  /** Grant years if multi-year */
  grantYears?: number;
  /** Match requirement (0.2 = 20% local match) */
  matchRequirement?: number;
  /** Probability of renewal (0-1) */
  renewalProbability?: number;
}

/**
 * Fee-based revenue model.
 */
export interface FeeBasedRevenueModel extends BaseRevenueModel {
  type: 'FEE_BASED';
  /** Base fee amount */
  feeAmount: number;
  /** Projected volume (number of fees) */
  baseVolume: number;
  /** Volume growth rate */
  volumeGrowthRate: number;
  /** Fee increase rate */
  feeIncreaseRate: number;
}

/**
 * Seasonal revenue model with monthly weights.
 */
export interface SeasonalRevenueModel extends BaseRevenueModel {
  type: 'SEASONAL';
  /** Total annual amount */
  annualAmount: number;
  /** Monthly weights (must sum to 1.0) */
  monthlyWeights: [number, number, number, number, number, number, number, number, number, number, number, number];
  /** Annual growth rate */
  growthRate: number;
}

/**
 * Custom revenue model with formula.
 */
export interface CustomRevenueModel extends BaseRevenueModel {
  type: 'CUSTOM';
  /** Formula expression */
  formula: string;
  /** Variables for formula */
  variables: Record<string, number>;
}

/**
 * Union type for all revenue models.
 */
export type RevenueModel =
  | StaticRevenueModel
  | PercentGrowthRevenueModel
  | LITLinkedRevenueModel
  | PropertyTaxRevenueModel
  | GrantLinkedRevenueModel
  | FeeBasedRevenueModel
  | SeasonalRevenueModel
  | CustomRevenueModel;

// ============================================================================
// EXPENSE MODEL TYPES
// ============================================================================

/**
 * Expense model type determines how future expenses are projected.
 */
export type ExpenseModelType =
  | 'BASELINE_INFLATION'   // Base + inflation adjustment
  | 'STEP_CHANGE'          // Discrete increases/decreases
  | 'PERSONNEL'            // Salary + benefits projection
  | 'DEBT_SERVICE'         // Fixed debt payments
  | 'CAPITAL_PLAN'         // Capital project schedule
  | 'CONTRACT'             // Contracted services
  | 'UTILITY'              // Utility costs with usage
  | 'CUSTOM';              // Custom formula

/**
 * Base expense model interface.
 */
export interface BaseExpenseModel {
  /** Unique model ID */
  id: string;

  /** Human-readable name */
  name: string;

  /** Expense account code or category */
  targetCode: string;

  /** Model type */
  type: ExpenseModelType;

  /** Start date for projections */
  startDate: Date;

  /** End date (optional) */
  endDate?: Date;

  /** Whether model is active */
  isActive: boolean;

  /** Notes/assumptions */
  notes?: string;
}

/**
 * Baseline + inflation expense model.
 */
export interface BaselineInflationExpenseModel extends BaseExpenseModel {
  type: 'BASELINE_INFLATION';
  /** Base year amount */
  baseAmount: number;
  /** Annual inflation rate (0.03 = 3%) */
  inflationRate: number;
  /** Inflation index to use */
  inflationIndex?: 'CPI' | 'PPI' | 'CUSTOM';
}

/**
 * Step change expense model for discrete changes.
 */
export interface StepChangeExpenseModel extends BaseExpenseModel {
  type: 'STEP_CHANGE';
  /** Base amount before changes */
  baseAmount: number;
  /** Scheduled step changes */
  stepChanges: StepChange[];
  /** Inflation rate between steps */
  inflationRate?: number;
}

/**
 * A scheduled step change.
 */
export interface StepChange {
  /** Effective date */
  effectiveDate: Date;
  /** Change type */
  changeType: 'ABSOLUTE' | 'PERCENTAGE' | 'REPLACEMENT';
  /** Change amount (absolute or percentage) */
  amount: number;
  /** Reason for change */
  reason: string;
}

/**
 * Personnel expense model.
 */
export interface PersonnelExpenseModel extends BaseExpenseModel {
  type: 'PERSONNEL';
  /** Number of FTEs */
  fteCount: number;
  /** Average salary per FTE */
  averageSalary: number;
  /** Annual salary increase rate */
  salaryIncreaseRate: number;
  /** Benefits as percentage of salary */
  benefitsRate: number;
  /** Benefits inflation rate (typically higher than salary) */
  benefitsInflationRate: number;
  /** FICA rate */
  ficaRate: number;
  /** PERF rate (Indiana retirement) */
  perfRate?: number;
  /** Planned FTE changes */
  fteChanges?: FTEChange[];
}

/**
 * Planned FTE changes.
 */
export interface FTEChange {
  effectiveDate: Date;
  changeType: 'ADD' | 'REMOVE' | 'SET';
  count: number;
  reason: string;
}

/**
 * Debt service expense model.
 */
export interface DebtServiceExpenseModel extends BaseExpenseModel {
  type: 'DEBT_SERVICE';
  /** Link to debt instrument ID */
  debtInstrumentId: string;
  /** Or manually specify schedule */
  paymentSchedule?: DebtPayment[];
}

/**
 * Debt payment entry.
 */
export interface DebtPayment {
  paymentDate: Date;
  principal: number;
  interest: number;
  totalPayment: number;
}

/**
 * Capital plan expense model.
 */
export interface CapitalPlanExpenseModel extends BaseExpenseModel {
  type: 'CAPITAL_PLAN';
  /** Scheduled capital projects */
  projects: CapitalProject[];
}

/**
 * Capital project definition.
 */
export interface CapitalProject {
  id: string;
  name: string;
  startDate: Date;
  endDate: Date;
  totalCost: number;
  /** Monthly spending schedule (optional, defaults to even) */
  spendingSchedule?: ForecastMonthlyAmount[];
  fundingSource?: string;
}

/**
 * Monthly amount entry for forecasts.
 */
export interface ForecastMonthlyAmount {
  month: Date;
  amount: number;
}

/**
 * Contract expense model.
 */
export interface ContractExpenseModel extends BaseExpenseModel {
  type: 'CONTRACT';
  /** Annual contract amount */
  annualAmount: number;
  /** Contract term end date */
  contractEndDate: Date;
  /** Annual escalation rate */
  escalationRate: number;
  /** Renewal assumption */
  renewalAmount?: number;
}

/**
 * Utility expense model.
 */
export interface UtilityExpenseModel extends BaseExpenseModel {
  type: 'UTILITY';
  /** Utility type */
  utilityType: 'ELECTRIC' | 'GAS' | 'WATER' | 'SEWER' | 'OTHER';
  /** Base monthly usage */
  baseUsage: number;
  /** Current rate per unit */
  currentRate: number;
  /** Rate increase assumption */
  rateIncreaseRate: number;
  /** Usage growth rate */
  usageGrowthRate: number;
  /** Monthly usage pattern (seasonal) */
  monthlyPattern?: number[];
}

/**
 * Custom expense model.
 */
export interface CustomExpenseModel extends BaseExpenseModel {
  type: 'CUSTOM';
  /** Formula expression */
  formula: string;
  /** Variables for formula */
  variables: Record<string, number>;
}

/**
 * Union type for all expense models.
 */
export type ExpenseModel =
  | BaselineInflationExpenseModel
  | StepChangeExpenseModel
  | PersonnelExpenseModel
  | DebtServiceExpenseModel
  | CapitalPlanExpenseModel
  | ContractExpenseModel
  | UtilityExpenseModel
  | CustomExpenseModel;

// ============================================================================
// FORECAST SCENARIO
// ============================================================================

/**
 * Forecast granularity.
 */
export type ForecastGranularity = 'MONTHLY' | 'QUARTERLY' | 'ANNUAL';

/**
 * Scenario type for categorization.
 */
export type ScenarioType = 'BASELINE' | 'OPTIMISTIC' | 'PESSIMISTIC' | 'WHAT_IF' | 'CUSTOM';

/**
 * Global economic assumptions for the forecast.
 */
export interface EconomicAssumptions {
  /** General inflation rate */
  generalInflation: number;
  /** Wage growth rate */
  wageGrowth: number;
  /** Property value growth */
  propertyValueGrowth: number;
  /** Population growth */
  populationGrowth: number;
  /** Interest rate assumption */
  interestRate: number;
  /** Custom assumptions */
  custom?: Record<string, number>;
}

/**
 * Fund forecast scenario configuration.
 */
export interface FundForecastScenario {
  /** Unique scenario ID */
  id: string;

  /** Tenant ID */
  tenantId: string;

  /** Scenario name */
  name: string;

  /** Description */
  description?: string;

  /** Scenario type */
  type: ScenarioType;

  /** Fund ID to forecast */
  fundId: string;

  /** Forecast start date */
  startDate: Date;

  /** Forecast horizon in months */
  horizonMonths: number;

  /** Granularity of projections */
  granularity: ForecastGranularity;

  /** Revenue models to apply */
  revenueModels: RevenueModel[];

  /** Expense models to apply */
  expenseModels: ExpenseModel[];

  /** Economic assumptions */
  assumptions: EconomicAssumptions;

  /** Minimum fund balance target (absolute or percentage) */
  minimumBalance?: {
    type: 'ABSOLUTE' | 'PERCENTAGE_OF_EXPENSES';
    value: number;
  };

  /** Created date */
  createdAt: Date;

  /** Last modified date */
  updatedAt: Date;

  /** Created by user ID */
  createdBy?: string;

  /** Whether this is the active/primary scenario */
  isPrimary: boolean;
}

// ============================================================================
// FORECAST RESULTS
// ============================================================================

/**
 * A single period in the forecast.
 */
export interface ForecastPeriod {
  /** Period start date */
  periodStart: Date;

  /** Period end date */
  periodEnd: Date;

  /** Period label (e.g., "2024-01", "Q1 2024", "2024") */
  label: string;

  /** Beginning balance for the period */
  beginningBalance: number;

  /** Revenue breakdown by model */
  revenues: ForecastLineItem[];

  /** Total revenues */
  totalRevenues: number;

  /** Expense breakdown by model */
  expenses: ForecastLineItem[];

  /** Total expenses */
  totalExpenses: number;

  /** Net change (revenues - expenses) */
  netChange: number;

  /** Ending balance */
  endingBalance: number;

  /** Cumulative net change from start */
  cumulativeNetChange: number;

  /** Warnings for this period */
  warnings: ForecastWarning[];
}

/**
 * A line item in the forecast.
 */
export interface ForecastLineItem {
  /** Model ID that generated this */
  modelId: string;

  /** Model name */
  modelName: string;

  /** Account/source code */
  code: string;

  /** Projected amount */
  amount: number;

  /** Assumptions used */
  assumptions?: string;
}

/**
 * Forecast warning.
 */
export interface ForecastWarning {
  /** Warning type */
  type: 'NEGATIVE_BALANCE' | 'BELOW_MINIMUM' | 'HIGH_VARIANCE' | 'ASSUMPTION_RISK' | 'DATA_QUALITY';

  /** Warning message */
  message: string;

  /** Severity */
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

  /** Suggested action */
  suggestedAction?: string;
}

/**
 * Summary statistics for the forecast.
 */
export interface ForecastSummary {
  /** Total periods in forecast */
  totalPeriods: number;

  /** Total projected revenues */
  totalRevenues: number;

  /** Total projected expenses */
  totalExpenses: number;

  /** Net change over horizon */
  netChange: number;

  /** Final projected balance */
  finalBalance: number;

  /** Lowest balance point */
  lowestBalance: {
    amount: number;
    period: string;
  };

  /** Highest balance point */
  highestBalance: {
    amount: number;
    period: string;
  };

  /** Average monthly net change */
  averageMonthlyNetChange: number;

  /** Periods with negative balance */
  periodsWithNegativeBalance: number;

  /** Periods below minimum balance */
  periodsBelowMinimum: number;

  /** Overall risk assessment */
  riskAssessment: 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL';
}

/**
 * Complete forecast result.
 */
export interface ForecastResult {
  /** Scenario that generated this forecast */
  scenarioId: string;

  /** Scenario name */
  scenarioName: string;

  /** Fund ID */
  fundId: string;

  /** Fund name */
  fundName: string;

  /** Generation timestamp */
  generatedAt: Date;

  /** Starting balance (actual from ledger) */
  startingBalance: number;

  /** Period-by-period projections */
  periods: ForecastPeriod[];

  /** Summary statistics */
  summary: ForecastSummary;

  /** All warnings */
  warnings: ForecastWarning[];

  /** Assumptions summary */
  assumptionsSummary: string[];
}

// ============================================================================
// COMPARISON & SENSITIVITY
// ============================================================================

/**
 * Comparison between two scenarios.
 */
export interface ScenarioComparison {
  /** Base scenario ID */
  baseScenarioId: string;

  /** Comparison scenario ID */
  compareScenarioId: string;

  /** Period-by-period variance */
  periodVariances: PeriodVariance[];

  /** Summary of differences */
  summary: {
    revenueVariance: number;
    revenueVariancePercent: number;
    expenseVariance: number;
    expenseVariancePercent: number;
    finalBalanceVariance: number;
    riskDifference: string;
  };
}

/**
 * Variance for a single period.
 */
export interface PeriodVariance {
  period: string;
  baseRevenue: number;
  compareRevenue: number;
  revenueVariance: number;
  baseExpense: number;
  compareExpense: number;
  expenseVariance: number;
  baseBalance: number;
  compareBalance: number;
  balanceVariance: number;
}

/**
 * Sensitivity analysis result.
 */
export interface SensitivityAnalysis {
  /** Variable being tested */
  variable: string;

  /** Base value */
  baseValue: number;

  /** Test values and results */
  results: SensitivityPoint[];

  /** Impact assessment */
  impact: 'LOW' | 'MODERATE' | 'HIGH';
}

/**
 * A point in sensitivity analysis.
 */
export interface SensitivityPoint {
  value: number;
  finalBalance: number;
  balanceChange: number;
  percentChange: number;
}

// ============================================================================
// FORECAST ENGINE INTERFACE
// ============================================================================

/**
 * Current ledger state for forecasting.
 */
export interface CurrentLedgerState {
  /** Fund information */
  fund: {
    id: string;
    code: string;
    name: string;
    currentBalance: number;
  };

  /** As-of date for balance */
  asOfDate: Date;

  /** Historical revenue by category (for trending) */
  historicalRevenue?: HistoricalDataPoint[];

  /** Historical expenses by category (for trending) */
  historicalExpenses?: HistoricalDataPoint[];
}

/**
 * Historical data point for trending.
 */
export interface HistoricalDataPoint {
  period: Date;
  category: string;
  amount: number;
}

/**
 * Forecast engine interface.
 */
export interface ForecastEngine {
  /**
   * Generate a forecast from current ledger state and scenario.
   * Pure function: (currentLedger, scenario) → time-series of balances
   */
  generateForecast(
    currentLedger: CurrentLedgerState,
    scenario: FundForecastScenario
  ): ForecastResult;

  /**
   * Compare two scenarios.
   */
  compareScenarios(
    baseResult: ForecastResult,
    compareResult: ForecastResult
  ): ScenarioComparison;

  /**
   * Run sensitivity analysis on a variable.
   */
  runSensitivityAnalysis(
    currentLedger: CurrentLedgerState,
    scenario: FundForecastScenario,
    variable: string,
    testValues: number[]
  ): SensitivityAnalysis;

  /**
   * Validate a scenario configuration.
   */
  validateScenario(scenario: FundForecastScenario): ScenarioValidationResult;
}

/**
 * Validation result for scenario.
 */
export interface ScenarioValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

// ============================================================================
// SIMPLE BASELINE FORECAST TYPES (v1)
// ============================================================================
// These simpler types are designed for the baseline buildForecast() function
// that takes Fund[] and Transaction[] directly. They complement the more
// complex models above for simple "Town CFO" projections.

/**
 * Time granularity for simple forecasts.
 * - annual: One data point per year
 * - quarterly: Four data points per year (Q1-Q4)
 */
export type SimpleTimeGranularity = 'annual' | 'quarterly';

/**
 * Simple revenue projection model.
 *
 * For v1, uses basic growth rate modeling. Future versions may
 * link to the more complex RevenueModel types above.
 */
export interface SimpleRevenueModel {
  /**
   * Fund ID this model applies to.
   * If omitted, applies as a global default.
   */
  fundId?: string;

  /**
   * Optional baseline annual revenue amount.
   * If provided, used as starting point for projections.
   * If omitted, derived from historical transactions.
   */
  baseAmount?: number;

  /**
   * Annual growth rate as a decimal (e.g., 0.02 for 2%).
   * Applied compounding each period.
   */
  growthRate?: number;

  /**
   * Optional description.
   */
  description?: string;
}

/**
 * Simple expense projection model.
 *
 * For v1, uses basic growth rate modeling. Future versions may
 * link to the more complex ExpenseModel types above.
 */
export interface SimpleExpenseModel {
  /**
   * Fund ID this model applies to.
   * If omitted, applies as a global default.
   */
  fundId?: string;

  /**
   * Optional baseline annual expense amount.
   * If provided, used as starting point for projections.
   * If omitted, derived from historical transactions.
   */
  baseAmount?: number;

  /**
   * Annual growth rate as a decimal (e.g., 0.02 for 2%).
   * Applied compounding each period.
   */
  growthRate?: number;

  /**
   * Optional description.
   */
  description?: string;
}

/**
 * Simple forecast scenario definition.
 *
 * A lightweight scenario for baseline "what-if" projections.
 * Use FundForecastScenario above for more complex modeling.
 */
export interface SimpleForecastScenario {
  /**
   * Unique identifier for this scenario.
   */
  id: string;

  /**
   * Human-readable name.
   */
  name: string;

  /**
   * Optional description.
   */
  description?: string;

  /**
   * Number of years to project.
   */
  horizonYears: number;

  /**
   * Time granularity.
   */
  granularity: SimpleTimeGranularity;

  /**
   * Default revenue growth rate for all funds.
   * E.g., 0.02 for 2% per year.
   */
  defaultRevenueGrowthRate?: number;

  /**
   * Default expense growth rate for all funds.
   * E.g., 0.02 for 2% per year.
   */
  defaultExpenseGrowthRate?: number;

  /**
   * Per-fund revenue model overrides.
   */
  revenueModels?: SimpleRevenueModel[];

  /**
   * Per-fund expense model overrides.
   */
  expenseModels?: SimpleExpenseModel[];

  /** Extensibility for future fields (projects, debt, etc.) */
  [key: string]: unknown;
}

/**
 * A single point in a fund's simple forecast time series.
 */
export interface SimpleFundForecastPoint {
  /**
   * Zero-based period index.
   */
  periodIndex: number;

  /**
   * Calendar year of this period.
   */
  year: number;

  /**
   * Human-readable label (e.g., "2026", "2026 Q1").
   */
  label: string;

  /**
   * Beginning balance for this period.
   */
  beginningBalance: number;

  /**
   * Projected revenue for this period.
   */
  projectedRevenue: number;

  /**
   * Projected expenses for this period.
   */
  projectedExpense: number;

  /**
   * Ending balance (beginningBalance + projectedRevenue - projectedExpense).
   */
  endingBalance: number;
}

/**
 * Simple forecast series for a single fund.
 */
export interface SimpleFundForecastSeries {
  /**
   * Fund ID.
   */
  fundId: string;

  /**
   * Fund code (e.g., "101").
   */
  fundCode: string;

  /**
   * Fund name.
   */
  fundName: string;

  /**
   * Forecast points for each period.
   */
  points: SimpleFundForecastPoint[];
}

/**
 * Complete simple forecast result.
 */
export interface SimpleForecastResult {
  /**
   * Scenario ID that generated this forecast.
   */
  scenarioId: string;

  /**
   * Scenario name.
   */
  scenarioName?: string;

  /**
   * Horizon in years.
   */
  horizonYears: number;

  /**
   * Granularity used.
   */
  granularity: SimpleTimeGranularity;

  /**
   * As-of date when forecast was computed.
   */
  asOf: Date;

  /**
   * Per-fund forecast series.
   */
  fundSeries: SimpleFundForecastSeries[];

  /**
   * Total beginning balance across all funds (first period).
   */
  totalBeginningBalance?: number;

  /**
   * Total ending balance across all funds (last period).
   */
  totalEndingBalance?: number;

  /**
   * Fund IDs projected to go negative at any point.
   */
  fundsWithNegativeBalance?: string[];

  /** Extensibility */
  [key: string]: unknown;
}

/**
 * Options for the simple buildForecast function.
 */
export interface SimpleForecastBuildOptions {
  /**
   * Include funds with zero balances.
   * Default: true.
   */
  includeZeroBalanceFunds?: boolean;

  /**
   * Include inactive funds.
   * Default: false.
   */
  includeInactiveFunds?: boolean;

  /**
   * Specific fund IDs to include.
   */
  fundIds?: string[];

  /**
   * Calculate aggregate totals.
   * Default: true.
   */
  calculateAggregates?: boolean;
}
