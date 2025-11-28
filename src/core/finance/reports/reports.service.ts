// src/core/finance/reports/reports.service.ts

/**
 * Town-in-a-Box Finance Engine - Report Service
 *
 * Pure functions that transform finance data into report structures.
 *
 * Design Principles:
 * - Pure functions: no side effects, no database calls
 * - Takes arrays of domain objects, returns report structures
 * - Handles edge cases gracefully (empty arrays, missing data)
 * - All date comparisons use normalized Date objects
 */

import { Fund, Transaction, BudgetLine, TransactionType } from '../finance.types';
import {
  TrialBalanceReport,
  TrialBalanceFundRow,
  RevenueExpenseReport,
  RevenueExpenseFundRow,
  BudgetVsActualReport,
  BudgetVsActualFundRow,
} from './reports.types';

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Normalize a date value for comparison.
 */
function normalizeDate(date: Date | string | undefined): Date | undefined {
  if (!date) return undefined;
  return typeof date === 'string' ? new Date(date) : date;
}

/**
 * Check if a transaction date is on or before the target date.
 */
function isOnOrBefore(txDate: Date | string | undefined, targetDate: Date): boolean {
  const normalized = normalizeDate(txDate);
  if (!normalized) return false;
  // Compare at start of day to include transactions on the target date
  const txDay = new Date(normalized.getFullYear(), normalized.getMonth(), normalized.getDate());
  const targetDay = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate());
  return txDay <= targetDay;
}

/**
 * Check if a transaction date is within a date range (inclusive).
 */
function isInDateRange(
  txDate: Date | string | undefined,
  startDate: Date,
  endDate: Date
): boolean {
  const normalized = normalizeDate(txDate);
  if (!normalized) return false;
  const txDay = new Date(normalized.getFullYear(), normalized.getMonth(), normalized.getDate());
  const startDay = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
  const endDay = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate());
  return txDay >= startDay && txDay <= endDay;
}

/**
 * Check if a transaction date falls within a fiscal year.
 * Assumes calendar year fiscal year (Jan 1 - Dec 31).
 */
function isInFiscalYear(txDate: Date | string | undefined, year: number): boolean {
  const normalized = normalizeDate(txDate);
  if (!normalized) return false;
  return normalized.getFullYear() === year;
}

/**
 * Classify transaction as receipt or disbursement.
 * Returns positive for receipts, negative for disbursements, 0 for others.
 */
function classifyTransaction(type: TransactionType, amount: number): { receipt: number; disbursement: number } {
  switch (type) {
    case 'RECEIPT':
      return { receipt: Math.abs(amount), disbursement: 0 };
    case 'DISBURSEMENT':
      return { receipt: 0, disbursement: Math.abs(amount) };
    case 'TRANSFER':
      // Transfers: positive = transfer in (like receipt), negative = transfer out (like disbursement)
      if (amount >= 0) {
        return { receipt: amount, disbursement: 0 };
      } else {
        return { receipt: 0, disbursement: Math.abs(amount) };
      }
    case 'ADJUSTMENT':
      // Adjustments can be positive or negative, treat as receipts/disbursements accordingly
      if (amount >= 0) {
        return { receipt: amount, disbursement: 0 };
      } else {
        return { receipt: 0, disbursement: Math.abs(amount) };
      }
    case 'ENCUMBRANCE':
    case 'LIQUIDATION':
      // Encumbrances don't affect cash balances directly
      return { receipt: 0, disbursement: 0 };
    default:
      return { receipt: 0, disbursement: 0 };
  }
}

/**
 * Round to 2 decimal places for currency.
 */
function roundCurrency(value: number): number {
  return Math.round(value * 100) / 100;
}

// ============================================================================
// TRIAL BALANCE REPORT
// ============================================================================

/**
 * Build a Trial Balance Report from funds and transactions.
 *
 * This report shows:
 * - Beginning balance for each fund (from fund.beginningBalance or computed)
 * - Total receipts and disbursements through the "asOf" date
 * - Ending balance = beginning + receipts - disbursements
 *
 * Assumptions:
 * - Beginning balance is taken from fund.beginningBalance if available
 * - If not available, beginning balance is assumed to be 0
 * - Only non-voided transactions are included
 *
 * TODO: In a future version, support computing beginning balance from
 * prior year-end closing entries or a "beginning balance" transaction type.
 *
 * @param funds - Array of funds to include in the report
 * @param transactions - Array of all transactions (will be filtered by date)
 * @param asOf - The "as of" date for the report
 * @returns TrialBalanceReport structure
 */
export function buildTrialBalanceReport(
  funds: Fund[],
  transactions: Transaction[],
  asOf: Date
): TrialBalanceReport {
  // Filter transactions to only include those on or before asOf date
  // and exclude voided transactions
  const eligibleTx = transactions.filter(
    (tx) => isOnOrBefore(tx.transactionDate, asOf) && tx.status !== 'VOIDED'
  );

  // Build a map of fundId -> { receipts, disbursements }
  const fundTotals = new Map<string, { receipts: number; disbursements: number }>();

  for (const tx of eligibleTx) {
    const existing = fundTotals.get(tx.fundId) ?? { receipts: 0, disbursements: 0 };
    const classified = classifyTransaction(tx.type, tx.amount);
    existing.receipts += classified.receipt;
    existing.disbursements += classified.disbursement;
    fundTotals.set(tx.fundId, existing);
  }

  // Build rows for each fund
  const rows: TrialBalanceFundRow[] = funds.map((fund) => {
    const totals = fundTotals.get(fund.id) ?? { receipts: 0, disbursements: 0 };

    // TODO: Future enhancement - compute beginning balance from prior period
    // or from a "OPENING_BALANCE" transaction type
    const beginningBalance = roundCurrency(fund.beginningBalance ?? 0);
    const totalReceipts = roundCurrency(totals.receipts);
    const totalDisbursements = roundCurrency(totals.disbursements);
    const endingBalance = roundCurrency(beginningBalance + totalReceipts - totalDisbursements);

    return {
      fundId: fund.id,
      fundCode: fund.code,
      fundName: fund.name,
      beginningBalance,
      totalReceipts,
      totalDisbursements,
      endingBalance,
    };
  });

  // Calculate grand totals
  const totalBeginningBalance = roundCurrency(
    rows.reduce((sum, row) => sum + row.beginningBalance, 0)
  );
  const totalReceipts = roundCurrency(
    rows.reduce((sum, row) => sum + row.totalReceipts, 0)
  );
  const totalDisbursements = roundCurrency(
    rows.reduce((sum, row) => sum + row.totalDisbursements, 0)
  );
  const totalEndingBalance = roundCurrency(
    rows.reduce((sum, row) => sum + row.endingBalance, 0)
  );

  return {
    asOf,
    rows,
    totalBeginningBalance,
    totalReceipts,
    totalDisbursements,
    totalEndingBalance,
  };
}

// ============================================================================
// REVENUE/EXPENSE REPORT
// ============================================================================

/**
 * Build a Revenue/Expense Report from funds and transactions.
 *
 * This report shows:
 * - Total revenue (receipts) for each fund within the date range
 * - Total expense (disbursements) for each fund within the date range
 * - Net change = revenue - expense
 *
 * @param funds - Array of funds to include in the report
 * @param transactions - Array of all transactions (will be filtered by date range)
 * @param startDate - Start of the reporting period (inclusive)
 * @param endDate - End of the reporting period (inclusive)
 * @returns RevenueExpenseReport structure
 */
export function buildRevenueExpenseReport(
  funds: Fund[],
  transactions: Transaction[],
  startDate: Date,
  endDate: Date
): RevenueExpenseReport {
  // Filter transactions to only include those within the date range
  // and exclude voided transactions
  const eligibleTx = transactions.filter(
    (tx) => isInDateRange(tx.transactionDate, startDate, endDate) && tx.status !== 'VOIDED'
  );

  // Build a map of fundId -> { revenue, expense }
  const fundTotals = new Map<string, { revenue: number; expense: number }>();

  for (const tx of eligibleTx) {
    const existing = fundTotals.get(tx.fundId) ?? { revenue: 0, expense: 0 };
    const classified = classifyTransaction(tx.type, tx.amount);
    existing.revenue += classified.receipt;
    existing.expense += classified.disbursement;
    fundTotals.set(tx.fundId, existing);
  }

  // Build rows for each fund
  const rows: RevenueExpenseFundRow[] = funds.map((fund) => {
    const totals = fundTotals.get(fund.id) ?? { revenue: 0, expense: 0 };
    const totalRevenue = roundCurrency(totals.revenue);
    const totalExpense = roundCurrency(totals.expense);
    const netChange = roundCurrency(totalRevenue - totalExpense);

    return {
      fundId: fund.id,
      fundCode: fund.code,
      fundName: fund.name,
      totalRevenue,
      totalExpense,
      netChange,
    };
  });

  // Calculate grand totals
  const totalRevenue = roundCurrency(
    rows.reduce((sum, row) => sum + row.totalRevenue, 0)
  );
  const totalExpense = roundCurrency(
    rows.reduce((sum, row) => sum + row.totalExpense, 0)
  );
  const totalNetChange = roundCurrency(
    rows.reduce((sum, row) => sum + row.netChange, 0)
  );

  return {
    startDate,
    endDate,
    rows,
    totalRevenue,
    totalExpense,
    totalNetChange,
  };
}

// ============================================================================
// BUDGET VS ACTUAL REPORT
// ============================================================================

/**
 * Build a Budget vs Actual Report from funds, budget lines, and transactions.
 *
 * This report shows:
 * - Budgeted amount for each fund (sum of budget lines for the fiscal year)
 * - Actual disbursements for each fund within the fiscal year
 * - Variance = budgeted - actual (positive = under budget, negative = over budget)
 *
 * Note: This report focuses on expenditure budget vs actual disbursements.
 * Revenue budget comparison could be added as a separate report or option.
 *
 * @param funds - Array of funds to include in the report
 * @param budgetLines - Array of all budget lines (will be filtered by year)
 * @param transactions - Array of all transactions (will be filtered by year)
 * @param year - The fiscal year to report on
 * @returns BudgetVsActualReport structure
 */
export function buildBudgetVsActualReport(
  funds: Fund[],
  budgetLines: BudgetLine[],
  transactions: Transaction[],
  year: number
): BudgetVsActualReport {
  // Filter budget lines to the specified fiscal year
  // Use amendedAmount if available, otherwise adoptedAmount
  const yearBudgetLines = budgetLines.filter((bl) => bl.fiscalYear === year);

  // Filter transactions to the fiscal year (disbursements only for budget comparison)
  // and exclude voided transactions
  const yearTransactions = transactions.filter(
    (tx) =>
      isInFiscalYear(tx.transactionDate, year) &&
      tx.status !== 'VOIDED' &&
      (tx.type === 'DISBURSEMENT' || (tx.type === 'TRANSFER' && tx.amount < 0))
  );

  // Build a map of fundId -> total budgeted amount
  const fundBudgets = new Map<string, number>();
  for (const bl of yearBudgetLines) {
    // For expenditure budgets, use appropriation lines
    // amendedAmount takes precedence if available
    const amount = bl.amendedAmount ?? bl.adoptedAmount ?? bl.amount ?? 0;
    const existing = fundBudgets.get(bl.fundId) ?? 0;
    fundBudgets.set(bl.fundId, existing + amount);
  }

  // Build a map of fundId -> total actual disbursements
  const fundActuals = new Map<string, number>();
  for (const tx of yearTransactions) {
    const existing = fundActuals.get(tx.fundId) ?? 0;
    fundActuals.set(tx.fundId, existing + Math.abs(tx.amount));
  }

  // Build rows for each fund
  const rows: BudgetVsActualFundRow[] = funds.map((fund) => {
    const budgetedAmount = roundCurrency(fundBudgets.get(fund.id) ?? 0);
    const actualAmount = roundCurrency(fundActuals.get(fund.id) ?? 0);
    const variance = roundCurrency(budgetedAmount - actualAmount);
    const percentUsed = budgetedAmount > 0
      ? roundCurrency((actualAmount / budgetedAmount) * 100)
      : actualAmount > 0 ? 100 : 0;

    return {
      fundId: fund.id,
      fundCode: fund.code,
      fundName: fund.name,
      budgetedAmount,
      actualAmount,
      variance,
      percentUsed,
    };
  });

  // Calculate grand totals
  const totalBudgetedAmount = roundCurrency(
    rows.reduce((sum, row) => sum + row.budgetedAmount, 0)
  );
  const totalActualAmount = roundCurrency(
    rows.reduce((sum, row) => sum + row.actualAmount, 0)
  );
  const totalVariance = roundCurrency(
    rows.reduce((sum, row) => sum + row.variance, 0)
  );

  return {
    year,
    rows,
    totalBudgetedAmount,
    totalActualAmount,
    totalVariance,
  };
}

// ============================================================================
// ADDITIONAL HELPER EXPORTS
// ============================================================================

/**
 * Filter funds to only include active funds.
 * Useful as a preprocessing step before building reports.
 */
export function filterActiveFunds(funds: Fund[]): Fund[] {
  return funds.filter((f) => f.isActive);
}

/**
 * Sort funds by code for consistent report ordering.
 */
export function sortFundsByCode(funds: Fund[]): Fund[] {
  return [...funds].sort((a, b) => {
    const codeA = parseInt(a.code, 10);
    const codeB = parseInt(b.code, 10);
    if (isNaN(codeA) && isNaN(codeB)) return a.code.localeCompare(b.code);
    if (isNaN(codeA)) return 1;
    if (isNaN(codeB)) return -1;
    return codeA - codeB;
  });
}

/**
 * Get fiscal year boundaries for a calendar year fiscal year.
 * Indiana uses calendar year (Jan 1 - Dec 31).
 */
export function getCalendarYearBoundaries(year: number): { start: Date; end: Date } {
  return {
    start: new Date(year, 0, 1),  // January 1
    end: new Date(year, 11, 31), // December 31
  };
}
