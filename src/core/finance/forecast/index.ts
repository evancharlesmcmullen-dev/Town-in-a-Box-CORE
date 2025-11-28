// src/core/finance/forecast/index.ts

/**
 * Town-in-a-Box Finance Engine - Forecasting Module
 *
 * Provides baseline forecasting capabilities including:
 * - Revenue models (static, % growth, LIT-linked, grant-linked, property tax)
 * - Expense models (baseline + inflation, step changes, personnel, debt service)
 * - Multi-period forecast generation (monthly, quarterly, annual)
 * - Scenario comparison and sensitivity analysis
 *
 * Two forecasting approaches are available:
 * 1. Complex engine (ForecastEngine) - Full-featured with multiple model types
 * 2. Simple baseline (buildForecast) - Pure function with growth-rate models
 */

// Types for both complex and simple forecasting
export * from './forecast.types';

// Complex forecast engine (class-based, full-featured)
export * from './forecast.engine';

// Simple baseline forecast service (pure functions)
export {
  buildForecast,
  createBaselineScenario,
  getForecastSummary,
  findFundsGoingNegative,
  exportForecastToCSV,
} from './forecast.service';
