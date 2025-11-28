// src/core/finance/reports/index.ts

/**
 * Town-in-a-Box Finance Engine - Reports Module
 *
 * Provides financial reporting capabilities including:
 * - Trial Balance
 * - Fund Summary
 * - Budget vs Actual
 * - Revenue/Expenditure Summary
 * - Transaction Register
 * - Debt Schedule
 * - Fund Balance Statement (GASB 54)
 *
 * This module provides two approaches:
 * 1. Repository-based: DefaultReportGenerator class that uses FinanceRepository
 * 2. Pure functions: Stateless functions that operate on arrays of data
 *
 * Use the pure functions for:
 * - Gateway exports and other data transformations
 * - Testing with mock data
 * - Composing reports from pre-fetched data
 */

// ============================================================================
// REPOSITORY-BASED REPORT GENERATOR (uses FinanceRepository)
// ============================================================================

export * from './report.types';
export * from './report.generator';

// ============================================================================
// PURE FUNCTION REPORTS (for Gateway exports, transformations, testing)
// ============================================================================

// Simplified report types for pure function approach
export {
  TrialBalanceFundRow as SimplifiedTrialBalanceFundRow,
  TrialBalanceReport as SimplifiedTrialBalanceReport,
  RevenueExpenseFundRow,
  RevenueExpenseReport,
  BudgetVsActualFundRow as SimplifiedBudgetVsActualFundRow,
  BudgetVsActualReport as SimplifiedBudgetVsActualReport,
  ReportMetadata as SimpleReportMetadata,
} from './reports.types';

// Pure report building functions
export {
  buildTrialBalanceReport,
  buildRevenueExpenseReport,
  buildBudgetVsActualReport,
  filterActiveFunds,
  sortFundsByCode,
  getCalendarYearBoundaries,
} from './reports.service';
