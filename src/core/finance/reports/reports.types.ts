// src/core/finance/reports/reports.types.ts

/**
 * Town-in-a-Box Finance Engine - Report Types
 *
 * This module defines the core report output types for municipal finance reporting.
 * These types represent the structure of generated reports, not the inputs.
 *
 * Design Principles:
 * - Reports are pure data structures (no methods)
 * - All monetary values are in cents-compatible numbers (use 2 decimal precision)
 * - Reports include totals for convenience and validation
 * - State-specific report variations can extend these base types
 */

// ============================================================================
// TRIAL BALANCE REPORT
// ============================================================================

/**
 * A single fund row in a Trial Balance report.
 *
 * Represents the financial position of one fund as of a specific date.
 */
export interface TrialBalanceFundRow {
  /** Unique identifier for the fund */
  fundId: string;
  /** SBOA-style fund code (e.g., "101", "601") */
  fundCode: string;
  /** Display name of the fund */
  fundName: string;
  /** Balance at the start of the period (or assumed 0 if not tracked) */
  beginningBalance: number;
  /** Sum of all receipts/revenue transactions */
  totalReceipts: number;
  /** Sum of all disbursements/expenditure transactions */
  totalDisbursements: number;
  /** Calculated: beginningBalance + totalReceipts - totalDisbursements */
  endingBalance: number;
}

/**
 * Trial Balance Report
 *
 * Shows the fund balances as of a specific date, with receipts and
 * disbursements summarized. This is a foundational report for
 * Gateway AFR (Annual Financial Report) submissions.
 */
export interface TrialBalanceReport {
  /** The "as of" date for balance calculation */
  asOf: Date;
  /** Individual fund rows */
  rows: TrialBalanceFundRow[];
  /** Grand total: sum of all funds' beginning balances */
  totalBeginningBalance: number;
  /** Grand total: sum of all funds' receipts */
  totalReceipts: number;
  /** Grand total: sum of all funds' disbursements */
  totalDisbursements: number;
  /** Grand total: sum of all funds' ending balances */
  totalEndingBalance: number;
}

// ============================================================================
// REVENUE/EXPENSE REPORT
// ============================================================================

/**
 * A single fund row in a Revenue/Expense report.
 *
 * Represents the revenue and expense activity for one fund over a period.
 */
export interface RevenueExpenseFundRow {
  /** Unique identifier for the fund */
  fundId: string;
  /** SBOA-style fund code */
  fundCode: string;
  /** Display name of the fund */
  fundName: string;
  /** Sum of all revenue (receipts) for the period */
  totalRevenue: number;
  /** Sum of all expenses (disbursements) for the period */
  totalExpense: number;
  /** Calculated: totalRevenue - totalExpense */
  netChange: number;
}

/**
 * Revenue/Expense Report
 *
 * Shows revenue and expense activity over a date range.
 * Useful for understanding fund activity within a fiscal period.
 */
export interface RevenueExpenseReport {
  /** Start of the reporting period */
  startDate: Date;
  /** End of the reporting period */
  endDate: Date;
  /** Individual fund rows */
  rows: RevenueExpenseFundRow[];
  /** Grand total: sum of all funds' revenue */
  totalRevenue: number;
  /** Grand total: sum of all funds' expenses */
  totalExpense: number;
  /** Grand total: sum of all funds' net change */
  totalNetChange: number;
}

// ============================================================================
// BUDGET VS ACTUAL REPORT
// ============================================================================

/**
 * A single fund row in a Budget vs Actual report.
 *
 * Compares budgeted appropriations to actual spending for a fund.
 */
export interface BudgetVsActualFundRow {
  /** Unique identifier for the fund */
  fundId: string;
  /** SBOA-style fund code */
  fundCode: string;
  /** Display name of the fund */
  fundName: string;
  /** Sum of adopted/amended budget for the fund */
  budgetedAmount: number;
  /** Sum of actual disbursements for the fund */
  actualAmount: number;
  /** Calculated: budgetedAmount - actualAmount (positive = under budget) */
  variance: number;
  /** Percentage of budget used: (actualAmount / budgetedAmount) * 100 */
  percentUsed?: number;
}

/**
 * Budget vs Actual Report
 *
 * Compares adopted budget to actual expenditures for a fiscal year.
 * Essential for budget monitoring and compliance reporting.
 */
export interface BudgetVsActualReport {
  /** The fiscal year being reported */
  year: number;
  /** Individual fund rows */
  rows: BudgetVsActualFundRow[];
  /** Grand total: sum of all funds' budgeted amounts */
  totalBudgetedAmount: number;
  /** Grand total: sum of all funds' actual amounts */
  totalActualAmount: number;
  /** Grand total: sum of all variances */
  totalVariance: number;
}

// ============================================================================
// REPORT METADATA
// ============================================================================

/**
 * Common metadata that can be attached to any report.
 */
export interface ReportMetadata {
  /** When the report was generated */
  generatedAt: Date;
  /** Who/what generated the report */
  generatedBy?: string;
  /** Tenant ID this report belongs to */
  tenantId: string;
  /** Report title for display */
  title?: string;
  /** Report description or notes */
  description?: string;
}
