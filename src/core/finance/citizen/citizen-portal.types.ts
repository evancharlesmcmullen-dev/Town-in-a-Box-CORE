// src/core/finance/citizen/citizen-portal.types.ts

/**
 * Town-in-a-Box Finance Engine - Citizen Finance Portal Types
 *
 * Public-facing data models for citizen transparency including:
 * - Dashboard summaries
 * - "Where my taxes go" visualization data
 * - Budget explorer with drill-down
 * - Sanitized transaction records
 */

// ============================================================================
// CITIZEN DASHBOARD
// ============================================================================

/**
 * Summary data for citizen finance dashboard.
 */
export interface CitizenDashboard {
  /** Unit name (e.g., "Town of Lapel") */
  unitName: string;

  /** Unit type for display */
  unitType: string;

  /** Fiscal year being displayed */
  fiscalYear: number;

  /** Last updated timestamp */
  lastUpdated: Date;

  /** Overall financial health indicator */
  healthIndicator: 'HEALTHY' | 'STABLE' | 'CAUTION' | 'CONCERN';

  /** Fund balance summary */
  fundSummary: CitizenFundSummary[];

  /** Revenue sources breakdown */
  revenueBySource: RevenueCategorySummary[];

  /** Spending by category */
  spendingByCategory: SpendingCategorySummary[];

  /** Quick facts for citizens */
  quickFacts: QuickFact[];

  /** Tax information */
  taxInfo?: TaxInformation;

  /** Featured announcements */
  announcements?: Announcement[];
}

/**
 * Summarized fund information for citizens.
 */
export interface CitizenFundSummary {
  /** Fund name (simplified) */
  name: string;

  /** Fund description */
  description: string;

  /** Fund category for grouping */
  category: 'GENERAL' | 'ROADS' | 'SAFETY' | 'PARKS' | 'UTILITIES' | 'DEBT' | 'OTHER';

  /** Current balance */
  balance: number;

  /** Year-to-date receipts */
  ytdReceipts: number;

  /** Year-to-date spending */
  ytdSpending: number;

  /** Budget for the year */
  budget: number;

  /** Percent of budget spent */
  percentSpent: number;

  /** Trend indicator */
  trend: 'UP' | 'DOWN' | 'STABLE';

  /** Icon name for UI */
  icon?: string;

  /** Color for charts */
  color?: string;
}

/**
 * Revenue category summary.
 */
export interface RevenueCategorySummary {
  /** Category name */
  category: string;

  /** Display label */
  label: string;

  /** Amount received YTD */
  amount: number;

  /** Percentage of total revenue */
  percentOfTotal: number;

  /** Budgeted amount */
  budgeted?: number;

  /** Description for citizens */
  description: string;

  /** Color for visualization */
  color: string;

  /** Sort order */
  sortOrder: number;
}

/**
 * Spending category summary.
 */
export interface SpendingCategorySummary {
  /** Category name */
  category: string;

  /** Display label */
  label: string;

  /** Amount spent YTD */
  amount: number;

  /** Percentage of total spending */
  percentOfTotal: number;

  /** Budgeted amount */
  budgeted: number;

  /** Percent of budget used */
  percentOfBudget: number;

  /** Description for citizens */
  description: string;

  /** Color for visualization */
  color: string;

  /** Icon for UI */
  icon?: string;

  /** Sort order */
  sortOrder: number;
}

/**
 * Quick fact for dashboard.
 */
export interface QuickFact {
  /** Fact label */
  label: string;

  /** Value to display */
  value: string;

  /** Optional numeric value for formatting */
  numericValue?: number;

  /** Format type */
  format?: 'currency' | 'number' | 'percent' | 'date';

  /** Icon */
  icon?: string;

  /** Trend from prior period */
  trend?: 'UP' | 'DOWN' | 'STABLE';

  /** Change amount */
  changeAmount?: number;

  /** Change percent */
  changePercent?: number;
}

/**
 * Tax information for citizens.
 */
export interface TaxInformation {
  /** Property tax rate (per $100 of assessed value) */
  propertyTaxRate?: number;

  /** Local income tax rate */
  localIncomeTaxRate?: number;

  /** Example tax calculation */
  exampleCalculation?: {
    homeValue: number;
    estimatedTax: number;
    breakdown: { recipient: string; amount: number }[];
  };

  /** "Where my taxes go" breakdown */
  taxBreakdown: TaxBreakdownItem[];
}

/**
 * Tax breakdown item showing where taxes go.
 */
export interface TaxBreakdownItem {
  /** Recipient/category name */
  name: string;

  /** Percentage of tax dollar */
  percentage: number;

  /** Dollar amount per $1 of tax */
  perDollar: number;

  /** Description of what it funds */
  description: string;

  /** Color for visualization */
  color: string;

  /** Icon */
  icon?: string;
}

/**
 * Announcement for citizen portal.
 */
export interface Announcement {
  id: string;
  title: string;
  summary: string;
  date: Date;
  type: 'BUDGET' | 'MEETING' | 'REPORT' | 'GENERAL';
  link?: string;
}

// ============================================================================
// BUDGET EXPLORER
// ============================================================================

/**
 * Budget explorer data for drill-down visualization.
 */
export interface BudgetExplorer {
  /** Fiscal year */
  fiscalYear: number;

  /** Unit name */
  unitName: string;

  /** Total budget */
  totalBudget: number;

  /** Total spent YTD */
  totalSpent: number;

  /** Total remaining */
  totalRemaining: number;

  /** Overall percent spent */
  percentSpent: number;

  /** Top-level categories */
  categories: BudgetCategory[];

  /** Comparison to prior year */
  priorYearComparison?: {
    priorYearTotal: number;
    changeAmount: number;
    changePercent: number;
  };
}

/**
 * Budget category with drill-down support.
 */
export interface BudgetCategory {
  /** Category ID */
  id: string;

  /** Category name */
  name: string;

  /** Description */
  description: string;

  /** Budgeted amount */
  budgeted: number;

  /** Spent YTD */
  spent: number;

  /** Remaining */
  remaining: number;

  /** Percent spent */
  percentSpent: number;

  /** Percent of total budget */
  percentOfTotal: number;

  /** Status indicator */
  status: 'ON_TRACK' | 'OVER_BUDGET' | 'UNDER_BUDGET' | 'COMPLETE';

  /** Color for visualization */
  color: string;

  /** Icon */
  icon?: string;

  /** Sub-categories for drill-down */
  subcategories?: BudgetSubcategory[];

  /** Monthly spending for trend chart */
  monthlySpending?: CitizenMonthlyAmount[];
}

/**
 * Budget subcategory.
 */
export interface BudgetSubcategory {
  /** Subcategory ID */
  id: string;

  /** Name */
  name: string;

  /** Description */
  description?: string;

  /** Budgeted amount */
  budgeted: number;

  /** Spent */
  spent: number;

  /** Remaining */
  remaining: number;

  /** Percent spent */
  percentSpent: number;

  /** Line items (if further drill-down) */
  lineItems?: BudgetLineItem[];
}

/**
 * Individual budget line item.
 */
export interface BudgetLineItem {
  /** Account code */
  accountCode?: string;

  /** Description */
  description: string;

  /** Budgeted */
  budgeted: number;

  /** Spent */
  spent: number;

  /** Number of transactions */
  transactionCount: number;
}

/**
 * Monthly spending amount for citizen portal.
 */
export interface CitizenMonthlyAmount {
  /** Month (1-12) */
  month: number;

  /** Month name */
  monthName: string;

  /** Amount */
  amount: number;

  /** Cumulative YTD */
  cumulativeYTD: number;
}

// ============================================================================
// SPENDING TRANSACTIONS (PUBLIC VIEW)
// ============================================================================

/**
 * Public-facing sanitized transaction record.
 * Sensitive information is removed or generalized.
 */
export interface SpendingTransaction {
  /** Transaction reference (not internal ID) */
  reference: string;

  /** Transaction date */
  date: Date;

  /** Vendor/payee (sanitized - no personal addresses) */
  payee: string;

  /** Vendor type for categorization */
  payeeType?: 'VENDOR' | 'GOVERNMENT' | 'UTILITY' | 'EMPLOYEE' | 'OTHER';

  /** Amount */
  amount: number;

  /** Description (sanitized) */
  description: string;

  /** Category for filtering */
  category: string;

  /** Subcategory */
  subcategory?: string;

  /** Fund name */
  fundName: string;

  /** Department (if applicable) */
  department?: string;

  /** Payment method */
  paymentMethod?: 'CHECK' | 'ACH' | 'WIRE' | 'CARD' | 'OTHER';

  /** Check number (if check) */
  checkNumber?: string;
}

/**
 * Query parameters for spending search.
 */
export interface SpendingSearchQuery {
  /** Fiscal year */
  fiscalYear?: number;

  /** Start date */
  startDate?: Date;

  /** End date */
  endDate?: Date;

  /** Search text */
  searchText?: string;

  /** Filter by category */
  category?: string;

  /** Filter by fund */
  fundName?: string;

  /** Filter by payee */
  payee?: string;

  /** Minimum amount */
  minAmount?: number;

  /** Maximum amount */
  maxAmount?: number;

  /** Sort field */
  sortBy?: 'date' | 'amount' | 'payee' | 'category';

  /** Sort direction */
  sortDirection?: 'ASC' | 'DESC';

  /** Page number */
  page?: number;

  /** Page size */
  pageSize?: number;
}

/**
 * Result of spending search.
 */
export interface SpendingSearchResult {
  /** Matching transactions */
  transactions: SpendingTransaction[];

  /** Total count */
  totalCount: number;

  /** Page info */
  page: number;
  pageSize: number;
  totalPages: number;

  /** Summary of results */
  summary: {
    totalAmount: number;
    transactionCount: number;
    uniquePayees: number;
    byCategory: { category: string; amount: number; count: number }[];
  };
}

// ============================================================================
// CHECKBOOK REGISTER (PUBLIC)
// ============================================================================

/**
 * Public checkbook register entry.
 */
export interface CheckbookEntry {
  /** Date */
  date: Date;

  /** Check number or reference */
  reference: string;

  /** Payee name */
  payee: string;

  /** Description */
  description: string;

  /** Amount (negative for payments, positive for deposits) */
  amount: number;

  /** Transaction type */
  type: 'PAYMENT' | 'DEPOSIT' | 'TRANSFER';

  /** Fund */
  fund: string;

  /** Running balance (optional) */
  runningBalance?: number;
}

/**
 * Public checkbook register.
 */
export interface CheckbookRegister {
  /** Fund or account name */
  accountName: string;

  /** Period covered */
  periodStart: Date;
  periodEnd: Date;

  /** Beginning balance */
  beginningBalance: number;

  /** Ending balance */
  endingBalance: number;

  /** Total deposits */
  totalDeposits: number;

  /** Total payments */
  totalPayments: number;

  /** Entries */
  entries: CheckbookEntry[];
}

// ============================================================================
// FISCAL CALENDAR & DEADLINES
// ============================================================================

/**
 * Public fiscal calendar event.
 */
export interface FiscalCalendarEvent {
  /** Event title */
  title: string;

  /** Event date */
  date: Date;

  /** Event type */
  type: 'DEADLINE' | 'MEETING' | 'REPORT_DUE' | 'PUBLIC_HEARING' | 'TAX_DATE';

  /** Description */
  description: string;

  /** Is this a public meeting? */
  isPublicMeeting?: boolean;

  /** Location (if meeting) */
  location?: string;

  /** Link for more info */
  link?: string;

  /** Related document */
  document?: {
    name: string;
    url: string;
  };
}

/**
 * Fiscal calendar for citizen portal.
 */
export interface FiscalCalendar {
  /** Calendar year */
  year: number;

  /** Unit name */
  unitName: string;

  /** Events */
  events: FiscalCalendarEvent[];

  /** Upcoming events (next 30 days) */
  upcoming: FiscalCalendarEvent[];
}

// ============================================================================
// CHART DATA TYPES
// ============================================================================

/**
 * Data point for line/area charts.
 */
export interface ChartDataPoint {
  label: string;
  value: number;
  date?: Date;
}

/**
 * Series for multi-line charts.
 */
export interface ChartSeries {
  name: string;
  data: ChartDataPoint[];
  color?: string;
}

/**
 * Pie/donut chart slice.
 */
export interface PieSlice {
  label: string;
  value: number;
  percentage: number;
  color: string;
}

/**
 * Chart data package for visualization.
 */
export interface ChartData {
  /** Chart type */
  type: 'PIE' | 'DONUT' | 'BAR' | 'LINE' | 'AREA' | 'STACKED_BAR';

  /** Chart title */
  title: string;

  /** Subtitle */
  subtitle?: string;

  /** Data points or series */
  data: ChartDataPoint[] | ChartSeries[] | PieSlice[];

  /** X-axis label */
  xAxisLabel?: string;

  /** Y-axis label */
  yAxisLabel?: string;

  /** Currency format */
  isCurrency?: boolean;

  /** Show legend */
  showLegend?: boolean;

  /** Show data labels */
  showDataLabels?: boolean;
}

// ============================================================================
// CITIZEN PORTAL SERVICE INTERFACE
// ============================================================================

/**
 * Citizen portal service interface.
 */
export interface CitizenPortalService {
  /**
   * Get citizen dashboard data.
   */
  getDashboard(tenantId: string, fiscalYear: number): Promise<CitizenDashboard>;

  /**
   * Get budget explorer data.
   */
  getBudgetExplorer(tenantId: string, fiscalYear: number): Promise<BudgetExplorer>;

  /**
   * Get budget category details.
   */
  getBudgetCategoryDetails(
    tenantId: string,
    fiscalYear: number,
    categoryId: string
  ): Promise<BudgetCategory>;

  /**
   * Search spending transactions.
   */
  searchSpending(
    tenantId: string,
    query: SpendingSearchQuery
  ): Promise<SpendingSearchResult>;

  /**
   * Get checkbook register.
   */
  getCheckbookRegister(
    tenantId: string,
    fundName: string,
    startDate: Date,
    endDate: Date
  ): Promise<CheckbookRegister>;

  /**
   * Get fiscal calendar.
   */
  getFiscalCalendar(tenantId: string, year: number): Promise<FiscalCalendar>;

  /**
   * Get "where my taxes go" breakdown.
   */
  getTaxBreakdown(tenantId: string, fiscalYear: number): Promise<TaxInformation>;

  /**
   * Get chart data for specific visualization.
   */
  getChartData(
    tenantId: string,
    chartType: string,
    fiscalYear: number,
    options?: Record<string, unknown>
  ): Promise<ChartData>;
}
