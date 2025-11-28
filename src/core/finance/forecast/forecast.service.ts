// src/core/finance/forecast/forecast.service.ts

/**
 * Town-in-a-Box Finance Engine - Simple Baseline Forecast Service
 *
 * Pure functions for building baseline financial forecasts from
 * current fund balances and simple growth assumptions.
 *
 * Design Principles:
 * - Pure functions: no side effects, no database calls, no HTTP
 * - Takes Fund[] and Transaction[] as inputs, returns ForecastResult
 * - Simple growth-based models (not complex econometric modeling)
 * - Foundation for future "Town CFO" features
 *
 * This service complements the more sophisticated ForecastEngine in
 * forecast.engine.ts for simple, quick projections.
 */

import { Fund, Transaction, TransactionType } from '../finance.types';
import {
  SimpleForecastScenario,
  SimpleForecastResult,
  SimpleFundForecastSeries,
  SimpleFundForecastPoint,
  SimpleRevenueModel,
  SimpleExpenseModel,
  SimpleTimeGranularity,
  SimpleForecastBuildOptions,
  SimpleDebtInstrument,
  SimpleDebtServiceSchedule,
  FundCoverageSummary,
  CoverageYearEntry,
} from './forecast.types';
import {
  buildDebtServiceSchedules,
  getDebtServiceByFundByYear,
} from './forecast.debt.service';

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Round to 2 decimal places for currency.
 */
function roundCurrency(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Normalize a date for comparison.
 */
function normalizeDate(date: Date | string): Date {
  return typeof date === 'string' ? new Date(date) : date;
}

/**
 * Check if a transaction date is on or before the target date.
 */
function isOnOrBefore(txDate: Date | string, targetDate: Date): boolean {
  const normalized = normalizeDate(txDate);
  const txDay = new Date(normalized.getFullYear(), normalized.getMonth(), normalized.getDate());
  const targetDay = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate());
  return txDay <= targetDay;
}

/**
 * Classify transaction for balance calculation.
 *
 * Assumptions (v1):
 * - RECEIPT = positive (money in)
 * - TRANSFER = positive if amount >= 0 (transfer in), else negative (transfer out)
 * - DISBURSEMENT = negative (money out)
 * - ADJUSTMENT = follows sign of amount
 * - ENCUMBRANCE/LIQUIDATION = no cash impact (skip for balance)
 */
function getTransactionImpact(
  type: TransactionType,
  amount: number
): { balanceChange: number; revenue: number; expense: number } {
  switch (type) {
    case 'RECEIPT':
      return { balanceChange: Math.abs(amount), revenue: Math.abs(amount), expense: 0 };

    case 'DISBURSEMENT':
      return { balanceChange: -Math.abs(amount), revenue: 0, expense: Math.abs(amount) };

    case 'TRANSFER':
      // Positive amount = transfer in, negative = transfer out
      if (amount >= 0) {
        return { balanceChange: amount, revenue: amount, expense: 0 };
      } else {
        return { balanceChange: amount, revenue: 0, expense: Math.abs(amount) };
      }

    case 'ADJUSTMENT':
      // Follows sign of amount
      if (amount >= 0) {
        return { balanceChange: amount, revenue: amount, expense: 0 };
      } else {
        return { balanceChange: amount, revenue: 0, expense: Math.abs(amount) };
      }

    case 'ENCUMBRANCE':
    case 'LIQUIDATION':
      // No cash impact for balance calculation
      return { balanceChange: 0, revenue: 0, expense: 0 };

    default:
      return { balanceChange: 0, revenue: 0, expense: 0 };
  }
}

// ============================================================================
// CORE BUILD FORECAST FUNCTION
// ============================================================================

/**
 * Build a baseline forecast from current fund balances + a simple scenario.
 *
 * This is the main entry point for simple forecasting. It's a pure function:
 * - Takes funds, transactions, an "as of" date, and a scenario
 * - Returns a forecast result with time-series projections per fund
 *
 * Assumptions for v1:
 * - Current balance is computed from all transactions <= asOf date
 * - For each period:
 *   - projectedRevenue = prior period's revenue * (1 + growthRate), or baseline if provided
 *   - projectedExpense = prior period's expense * (1 + growthRate), or baseline if provided
 *   - endingBalance = beginningBalance + projectedRevenue - projectedExpense
 * - Does NOT model bonds, projects, or grants (future enhancements)
 *
 * @param funds - Array of funds to include in forecast
 * @param transactions - Array of all transactions (filtered by date internally)
 * @param asOf - The "as of" date for computing current balances
 * @param scenario - The forecast scenario with growth assumptions
 * @param options - Optional configuration for the forecast
 * @returns SimpleForecastResult with projections for all funds
 *
 * @example
 * ```typescript
 * const scenario: SimpleForecastScenario = {
 *   id: 'baseline-2025',
 *   name: 'Baseline Forecast',
 *   horizonYears: 5,
 *   granularity: 'annual',
 *   defaultRevenueGrowthRate: 0.02,
 *   defaultExpenseGrowthRate: 0.025,
 * };
 *
 * const result = buildForecast(funds, transactions, new Date('2024-12-31'), scenario);
 * ```
 */
export function buildForecast(
  funds: Fund[],
  transactions: Transaction[],
  asOf: Date,
  scenario: SimpleForecastScenario,
  options?: SimpleForecastBuildOptions
): SimpleForecastResult {
  const opts = {
    includeZeroBalanceFunds: true,
    includeInactiveFunds: false,
    calculateAggregates: true,
    ...options,
  };

  // Step 1: Filter funds based on options
  let filteredFunds = funds;

  if (!opts.includeInactiveFunds) {
    filteredFunds = filteredFunds.filter((f) => f.isActive);
  }

  if (opts.fundIds && opts.fundIds.length > 0) {
    const fundIdSet = new Set(opts.fundIds);
    filteredFunds = filteredFunds.filter((f) => fundIdSet.has(f.id));
  }

  // Step 2: Compute current balance and historical revenue/expense per fund
  // Only include non-voided transactions <= asOf date
  const eligibleTx = transactions.filter(
    (tx) =>
      isOnOrBefore(tx.transactionDate, asOf) &&
      tx.status !== 'VOIDED'
  );

  // Aggregate by fund: current balance, historical annual revenue, historical annual expense
  const fundData = new Map<
    string,
    { currentBalance: number; annualRevenue: number; annualExpense: number; txCount: number }
  >();

  // Initialize all funds
  for (const fund of filteredFunds) {
    fundData.set(fund.id, {
      currentBalance: fund.beginningBalance ?? 0,
      annualRevenue: 0,
      annualExpense: 0,
      txCount: 0,
    });
  }

  // Process transactions
  const asOfYear = asOf.getFullYear();
  for (const tx of eligibleTx) {
    const data = fundData.get(tx.fundId);
    if (!data) continue; // Transaction for a fund not in our list

    const impact = getTransactionImpact(tx.type, tx.amount);
    data.currentBalance += impact.balanceChange;
    data.txCount++;

    // Track revenue/expense for current year only (for baseline estimation)
    const txDate = normalizeDate(tx.transactionDate);
    if (txDate.getFullYear() === asOfYear) {
      data.annualRevenue += impact.revenue;
      data.annualExpense += impact.expense;
    }
  }

  // Optionally filter out zero-balance funds
  if (!opts.includeZeroBalanceFunds) {
    filteredFunds = filteredFunds.filter((f) => {
      const data = fundData.get(f.id);
      return data && (data.currentBalance !== 0 || data.txCount > 0);
    });
  }

  // Step 3: Determine number of periods
  const periodsPerYear = scenario.granularity === 'annual' ? 1 : 4;
  const totalPeriods = scenario.horizonYears * periodsPerYear;
  const startYear = asOf.getFullYear() + 1;

  // Step 3.5: Generate debt service schedules if instruments are provided
  let debtSchedules: SimpleDebtServiceSchedule[] | undefined;
  let debtByFundByYear: Map<string, Map<number, number>> | undefined;

  if (scenario.debtInstruments && scenario.debtInstruments.length > 0) {
    debtSchedules = buildDebtServiceSchedules(
      scenario.debtInstruments,
      scenario.horizonYears,
      startYear
    );
    debtByFundByYear = getDebtServiceByFundByYear(
      scenario.debtInstruments,
      debtSchedules,
      startYear,
      scenario.horizonYears
    );
  }

  // Step 4: Build forecast series for each fund
  const fundSeries: SimpleFundForecastSeries[] = [];
  const fundsWithNegativeBalance: string[] = [];

  for (const fund of filteredFunds) {
    const data = fundData.get(fund.id)!;

    // Find fund-specific models or use defaults
    const revenueModel = findFundModel(scenario.revenueModels, fund.id);
    const expenseModel = findFundModel(scenario.expenseModels, fund.id);

    // Determine base revenue/expense for projections
    // Priority: model.baseAmount > historical data > 0
    const baseRevenue = revenueModel?.baseAmount ?? data.annualRevenue ?? 0;
    const baseExpense = expenseModel?.baseAmount ?? data.annualExpense ?? 0;

    // Determine growth rates
    const revenueGrowthRate = revenueModel?.growthRate ?? scenario.defaultRevenueGrowthRate ?? 0;
    const expenseGrowthRate = expenseModel?.growthRate ?? scenario.defaultExpenseGrowthRate ?? 0;

    // Build forecast points
    const points: SimpleFundForecastPoint[] = [];
    let currentBalance = roundCurrency(data.currentBalance);
    let hasNegativeBalance = false;

    for (let i = 0; i < totalPeriods; i++) {
      const { year, label } = getPeriodInfo(asOf, i, scenario.granularity);

      const beginningBalance = currentBalance;

      // Calculate projected revenue/expense for this period
      // Growth is compounded based on period index
      // For quarterly, we scale annual amounts by 1/4
      const yearsElapsed = i / periodsPerYear;
      const revenueGrowthFactor = Math.pow(1 + revenueGrowthRate, yearsElapsed);
      const expenseGrowthFactor = Math.pow(1 + expenseGrowthRate, yearsElapsed);

      const periodRevenue = roundCurrency((baseRevenue * revenueGrowthFactor) / periodsPerYear);
      const periodExpense = roundCurrency((baseExpense * expenseGrowthFactor) / periodsPerYear);

      // Calculate debt service for this period (annual, scaled for quarterly)
      let periodDebtService = 0;
      if (debtByFundByYear) {
        const fundDebt = debtByFundByYear.get(fund.id);
        if (fundDebt) {
          const annualDebt = fundDebt.get(year) ?? 0;
          // Scale debt service for quarterly periods (annual debt / periods per year)
          // But only apply once per year for quarterly - apply in Q1 only
          if (scenario.granularity === 'annual') {
            periodDebtService = annualDebt;
          } else {
            // For quarterly, distribute evenly across quarters
            periodDebtService = roundCurrency(annualDebt / periodsPerYear);
          }
        }
      }

      const endingBalance = roundCurrency(
        beginningBalance + periodRevenue - periodExpense - periodDebtService
      );

      if (endingBalance < 0) {
        hasNegativeBalance = true;
      }

      points.push({
        periodIndex: i,
        year,
        label,
        beginningBalance,
        projectedRevenue: periodRevenue,
        projectedExpense: periodExpense,
        debtService: periodDebtService > 0 ? periodDebtService : undefined,
        endingBalance,
      });

      // Next period's beginning balance is this period's ending balance
      currentBalance = endingBalance;
    }

    fundSeries.push({
      fundId: fund.id,
      fundCode: fund.code,
      fundName: fund.name,
      points,
    });

    if (hasNegativeBalance) {
      fundsWithNegativeBalance.push(fund.id);
    }
  }

  // Step 5: Calculate aggregates if requested
  let totalBeginningBalance: number | undefined;
  let totalEndingBalance: number | undefined;

  if (opts.calculateAggregates && fundSeries.length > 0) {
    totalBeginningBalance = roundCurrency(
      fundSeries.reduce((sum, series) => {
        const firstPoint = series.points[0];
        return sum + (firstPoint?.beginningBalance ?? 0);
      }, 0)
    );

    totalEndingBalance = roundCurrency(
      fundSeries.reduce((sum, series) => {
        const lastPoint = series.points[series.points.length - 1];
        return sum + (lastPoint?.endingBalance ?? 0);
      }, 0)
    );
  }

  // Step 6: Build coverage summaries for funds with pledged revenues
  let coverageSummaries: FundCoverageSummary[] | undefined;

  if (scenario.debtInstruments && scenario.debtInstruments.length > 0) {
    coverageSummaries = buildCoverageSummaries(
      scenario.debtInstruments,
      debtSchedules ?? [],
      fundSeries,
      filteredFunds,
      startYear,
      scenario.horizonYears
    );
  }

  // Step 7: Build and return result
  return {
    scenarioId: scenario.id,
    scenarioName: scenario.name,
    horizonYears: scenario.horizonYears,
    granularity: scenario.granularity,
    asOf,
    fundSeries,
    totalBeginningBalance,
    totalEndingBalance,
    fundsWithNegativeBalance: fundsWithNegativeBalance.length > 0 ? fundsWithNegativeBalance : undefined,
    debtSchedules,
    coverageSummaries: coverageSummaries && coverageSummaries.length > 0 ? coverageSummaries : undefined,
  };
}

// ============================================================================
// HELPER FUNCTIONS FOR BUILD FORECAST
// ============================================================================

/**
 * Find a model for a specific fund, or return undefined for global default.
 */
function findFundModel<T extends { fundId?: string }>(
  models: T[] | undefined,
  fundId: string
): T | undefined {
  if (!models || models.length === 0) {
    return undefined;
  }

  // First try to find fund-specific model
  const fundSpecific = models.find((m) => m.fundId === fundId);
  if (fundSpecific) {
    return fundSpecific;
  }

  // Fall back to global model (fundId undefined)
  return models.find((m) => !m.fundId);
}

/**
 * Get year and label for a forecast period.
 */
function getPeriodInfo(
  asOf: Date,
  periodIndex: number,
  granularity: SimpleTimeGranularity
): { year: number; label: string } {
  const baseYear = asOf.getFullYear();

  if (granularity === 'annual') {
    // Annual: each period is a full year starting from year after asOf
    const year = baseYear + 1 + periodIndex;
    return { year, label: String(year) };
  } else {
    // Quarterly: 4 periods per year, starting from Q1 of year after asOf
    const yearsToAdd = Math.floor(periodIndex / 4);
    const quarterIndex = periodIndex % 4; // 0-3
    const year = baseYear + 1 + yearsToAdd;
    const quarter = quarterIndex + 1; // 1-4
    return { year, label: `${year} Q${quarter}` };
  }
}

// ============================================================================
// COVERAGE SUMMARY HELPERS
// ============================================================================

/**
 * Build coverage summaries for debt instruments with pledged revenues.
 *
 * For each instrument that has a pledgedRevenueFundId and minCoverageRatio,
 * this function calculates annual coverage ratios by comparing pledged
 * fund revenue to debt service payments.
 *
 * Note: Coverage modeling is simple and annual-only for v1. It does not
 * account for:
 * - Reserve funds or additional bonds tests
 * - Intra-year cash flow timing
 * - Subordinate vs. senior debt
 *
 * @param instruments - Debt instruments (filtered to those with pledged revenue)
 * @param schedules - Pre-computed debt service schedules
 * @param fundSeries - Forecast series for all funds
 * @param funds - Fund definitions for lookups
 * @param startYear - First year of forecast
 * @param horizonYears - Number of years in forecast
 * @returns Array of coverage summaries, one per unique pledged fund
 */
function buildCoverageSummaries(
  instruments: SimpleDebtInstrument[],
  schedules: SimpleDebtServiceSchedule[],
  fundSeries: SimpleFundForecastSeries[],
  funds: Fund[],
  startYear: number,
  horizonYears: number
): FundCoverageSummary[] {
  // Filter to instruments with pledged revenue requirements
  const pledgedInstruments = instruments.filter(
    (i) => i.pledgedRevenueFundId && i.minCoverageRatio !== undefined
  );

  if (pledgedInstruments.length === 0) {
    return [];
  }

  // Group instruments by pledged revenue fund
  const instrumentsByPledgedFund = new Map<string, SimpleDebtInstrument[]>();
  for (const instrument of pledgedInstruments) {
    const pledgedFundId = instrument.pledgedRevenueFundId!;
    const group = instrumentsByPledgedFund.get(pledgedFundId) ?? [];
    group.push(instrument);
    instrumentsByPledgedFund.set(pledgedFundId, group);
  }

  // Build schedule lookup by instrument ID
  const scheduleByInstrument = new Map<string, SimpleDebtServiceSchedule>();
  for (const schedule of schedules) {
    scheduleByInstrument.set(schedule.instrumentId, schedule);
  }

  // Build fund series lookup by fund ID
  const seriesByFund = new Map<string, SimpleFundForecastSeries>();
  for (const series of fundSeries) {
    seriesByFund.set(series.fundId, series);
  }

  // Build fund lookup for names
  const fundById = new Map<string, Fund>();
  for (const fund of funds) {
    fundById.set(fund.id, fund);
  }

  const summaries: FundCoverageSummary[] = [];

  // For each pledged fund, build a coverage summary
  for (const [pledgedFundId, groupInstruments] of instrumentsByPledgedFund) {
    const pledgedFund = fundById.get(pledgedFundId);
    const pledgedSeries = seriesByFund.get(pledgedFundId);

    // Use the most restrictive (highest) coverage ratio from the group
    const minCoverageRatio = Math.max(
      ...groupInstruments.map((i) => i.minCoverageRatio ?? 0)
    );

    // The fund paying debt service (use first instrument's fundId)
    const debtServiceFundId = groupInstruments[0].fundId;
    const debtServiceFund = fundById.get(debtServiceFundId);

    const coverageByYear: CoverageYearEntry[] = [];

    for (let yearOffset = 0; yearOffset < horizonYears; yearOffset++) {
      const year = startYear + yearOffset;

      // Calculate total pledged revenue for this year
      let revenue = 0;
      if (pledgedSeries) {
        // Sum revenue across all periods in this year
        for (const point of pledgedSeries.points) {
          if (point.year === year) {
            revenue += point.projectedRevenue;
          }
        }
      }
      revenue = roundCurrency(revenue);

      // Calculate total debt service for this year (sum across all instruments in group)
      let debtService = 0;
      for (const instrument of groupInstruments) {
        const schedule = scheduleByInstrument.get(instrument.id);
        if (schedule) {
          for (const payment of schedule.payments) {
            if (payment.year === year) {
              debtService += payment.total;
            }
          }
        }
      }
      debtService = roundCurrency(debtService);

      // Calculate coverage ratio
      const coverageRatio = debtService > 0 ? roundCurrency(revenue / debtService) : null;
      const meetsRequirement =
        coverageRatio !== null && minCoverageRatio > 0
          ? coverageRatio >= minCoverageRatio
          : null;

      coverageByYear.push({
        year,
        revenue,
        debtService,
        coverageRatio,
        meetsRequirement,
      });
    }

    summaries.push({
      fundId: debtServiceFundId,
      fundCode: debtServiceFund?.code ?? '',
      fundName: debtServiceFund?.name ?? '',
      pledgedRevenueFundId: pledgedFundId,
      minCoverageRatio,
      coverageByYear,
    });
  }

  return summaries;
}

// ============================================================================
// CONVENIENCE HELPERS
// ============================================================================

/**
 * Create a simple baseline scenario with default growth rates.
 *
 * @param id - Scenario ID
 * @param name - Scenario name
 * @param horizonYears - Number of years to project
 * @param options - Optional overrides for growth rates and granularity
 * @returns SimpleForecastScenario
 *
 * @example
 * ```typescript
 * const scenario = createBaselineScenario('baseline-5yr', 'Five Year Baseline', 5, {
 *   defaultRevenueGrowthRate: 0.02,
 *   defaultExpenseGrowthRate: 0.025,
 * });
 * ```
 */
export function createBaselineScenario(
  id: string,
  name: string,
  horizonYears: number,
  options?: {
    description?: string;
    granularity?: SimpleTimeGranularity;
    defaultRevenueGrowthRate?: number;
    defaultExpenseGrowthRate?: number;
    revenueModels?: SimpleRevenueModel[];
    expenseModels?: SimpleExpenseModel[];
  }
): SimpleForecastScenario {
  return {
    id,
    name,
    description: options?.description ?? `${horizonYears}-year baseline forecast`,
    horizonYears,
    granularity: options?.granularity ?? 'annual',
    defaultRevenueGrowthRate: options?.defaultRevenueGrowthRate ?? 0.02,
    defaultExpenseGrowthRate: options?.defaultExpenseGrowthRate ?? 0.02,
    revenueModels: options?.revenueModels,
    expenseModels: options?.expenseModels,
  };
}

/**
 * Get a summary of the forecast result.
 *
 * @param result - The forecast result
 * @returns Summary object with key metrics
 */
export function getForecastSummary(result: SimpleForecastResult): {
  scenarioId: string;
  scenarioName: string | undefined;
  asOf: Date;
  horizonYears: number;
  granularity: SimpleTimeGranularity;
  totalFunds: number;
  totalBeginningBalance: number;
  totalEndingBalance: number;
  netChange: number;
  fundsWithNegativeBalance: number;
  healthStatus: 'healthy' | 'warning' | 'critical';
} {
  const totalBeginning = result.totalBeginningBalance ?? 0;
  const totalEnding = result.totalEndingBalance ?? 0;
  const negativeCount = result.fundsWithNegativeBalance?.length ?? 0;

  let healthStatus: 'healthy' | 'warning' | 'critical';
  if (negativeCount > 0) {
    healthStatus = 'critical';
  } else if (totalEnding < totalBeginning * 0.8) {
    // Balance declining by more than 20%
    healthStatus = 'warning';
  } else {
    healthStatus = 'healthy';
  }

  return {
    scenarioId: result.scenarioId,
    scenarioName: result.scenarioName,
    asOf: result.asOf,
    horizonYears: result.horizonYears,
    granularity: result.granularity,
    totalFunds: result.fundSeries.length,
    totalBeginningBalance: totalBeginning,
    totalEndingBalance: totalEnding,
    netChange: roundCurrency(totalEnding - totalBeginning),
    fundsWithNegativeBalance: negativeCount,
    healthStatus,
  };
}

/**
 * Find funds projected to go negative and when.
 *
 * @param result - The forecast result
 * @returns Array of { fundId, fundCode, fundName, firstNegativePeriod }
 */
export function findFundsGoingNegative(result: SimpleForecastResult): Array<{
  fundId: string;
  fundCode: string;
  fundName: string;
  firstNegativePeriod: string;
  lowestBalance: number;
}> {
  const negativeFunds: Array<{
    fundId: string;
    fundCode: string;
    fundName: string;
    firstNegativePeriod: string;
    lowestBalance: number;
  }> = [];

  for (const series of result.fundSeries) {
    let firstNegativePeriod: string | undefined;
    let lowestBalance = Infinity;

    for (const point of series.points) {
      if (point.endingBalance < lowestBalance) {
        lowestBalance = point.endingBalance;
      }
      if (point.endingBalance < 0 && !firstNegativePeriod) {
        firstNegativePeriod = point.label;
      }
    }

    if (firstNegativePeriod) {
      negativeFunds.push({
        fundId: series.fundId,
        fundCode: series.fundCode,
        fundName: series.fundName,
        firstNegativePeriod,
        lowestBalance: roundCurrency(lowestBalance),
      });
    }
  }

  return negativeFunds;
}

/**
 * Export forecast result to a simple CSV format.
 *
 * @param result - The forecast result
 * @returns CSV string
 */
export function exportForecastToCSV(result: SimpleForecastResult): string {
  const lines: string[] = [];

  // Header comment
  lines.push(`# Simple Baseline Forecast Export`);
  lines.push(`# Scenario: ${result.scenarioName ?? result.scenarioId}`);
  lines.push(`# As Of: ${result.asOf.toISOString().split('T')[0]}`);
  lines.push(`# Horizon: ${result.horizonYears} years (${result.granularity})`);
  lines.push(`# Generated: ${new Date().toISOString()}`);
  lines.push('');

  // Column headers
  const periods = result.fundSeries[0]?.points.map((p) => p.label) ?? [];
  lines.push(['Fund Code', 'Fund Name', 'Metric', ...periods].join(','));

  // Data rows for each fund
  for (const series of result.fundSeries) {
    // Beginning balance row
    lines.push(
      [
        `"${series.fundCode}"`,
        `"${series.fundName}"`,
        '"Beginning Balance"',
        ...series.points.map((p) => p.beginningBalance.toFixed(2)),
      ].join(',')
    );

    // Projected revenue row
    lines.push(
      [
        `"${series.fundCode}"`,
        `"${series.fundName}"`,
        '"Projected Revenue"',
        ...series.points.map((p) => p.projectedRevenue.toFixed(2)),
      ].join(',')
    );

    // Projected expense row
    lines.push(
      [
        `"${series.fundCode}"`,
        `"${series.fundName}"`,
        '"Projected Expense"',
        ...series.points.map((p) => p.projectedExpense.toFixed(2)),
      ].join(',')
    );

    // Ending balance row
    lines.push(
      [
        `"${series.fundCode}"`,
        `"${series.fundName}"`,
        '"Ending Balance"',
        ...series.points.map((p) => p.endingBalance.toFixed(2)),
      ].join(',')
    );
  }

  // Totals section
  if (result.totalBeginningBalance !== undefined && result.totalEndingBalance !== undefined) {
    lines.push('');
    lines.push(`# Total Beginning Balance: ${result.totalBeginningBalance.toFixed(2)}`);
    lines.push(`# Total Ending Balance: ${result.totalEndingBalance.toFixed(2)}`);
    lines.push(`# Net Change: ${(result.totalEndingBalance - result.totalBeginningBalance).toFixed(2)}`);
  }

  if (result.fundsWithNegativeBalance && result.fundsWithNegativeBalance.length > 0) {
    lines.push('');
    lines.push(`# WARNING: ${result.fundsWithNegativeBalance.length} fund(s) projected to go negative`);
  }

  return lines.join('\n');
}
