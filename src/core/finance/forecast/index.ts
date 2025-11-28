// src/core/finance/forecast/index.ts

/**
 * Town-in-a-Box Finance Engine - Forecasting Module
 *
 * Provides baseline forecasting capabilities including:
 * - Revenue models (static, % growth, LIT-linked, grant-linked, property tax)
 * - Expense models (baseline + inflation, step changes, personnel, debt service)
 * - Multi-period forecast generation (monthly, quarterly, annual)
 * - Scenario comparison and sensitivity analysis
 */

export * from './forecast.types';
export * from './forecast.engine';
