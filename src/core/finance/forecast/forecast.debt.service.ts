// src/core/finance/forecast/forecast.debt.service.ts

/**
 * Town-in-a-Box Finance Engine - Debt Service Schedule Generator
 *
 * Pure functions for generating debt service schedules from debt instruments.
 *
 * Design Principles:
 * - Pure functions: no side effects, no database calls
 * - Takes DebtInstrument definitions, returns payment schedules
 * - Supports common amortization types (level debt service, level principal, interest only)
 * - Simple annual modeling for v1 (can be extended to quarterly later)
 */

import {
  SimpleDebtInstrument,
  SimpleDebtServiceSchedule,
  DebtServicePayment,
  DebtAmortizationType,
} from './forecast.types';

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Round to 2 decimal places for currency.
 */
function roundCurrency(value: number): number {
  return Math.round(value * 100) / 100;
}

// ============================================================================
// DEBT SERVICE SCHEDULE GENERATION
// ============================================================================

/**
 * Build debt service schedules for multiple instruments within a forecast horizon.
 *
 * For v1, assumes ANNUAL payments regardless of scenario granularity.
 * Future versions can expand to quarterly if needed.
 *
 * @param instruments - Array of debt instruments to generate schedules for
 * @param horizonYears - Number of years in the forecast horizon
 * @param startYear - First year of the forecast (e.g., 2025)
 * @returns Array of debt service schedules, one per instrument
 *
 * @example
 * ```typescript
 * const instruments: SimpleDebtInstrument[] = [{
 *   id: 'bond-2020',
 *   name: '2020 Water Revenue Bonds',
 *   type: 'REVENUE',
 *   tenantId: 'town-1',
 *   fundId: 'fund-601',
 *   principal: 5000000,
 *   annualInterestRate: 0.04,
 *   termYears: 20,
 *   issueYear: 2020,
 *   firstPaymentYear: 2021,
 *   amortizationType: 'LEVEL_DEBT_SERVICE',
 * }];
 *
 * const schedules = buildDebtServiceSchedules(instruments, 5, 2025);
 * // Returns schedules for 2025-2029
 * ```
 */
export function buildDebtServiceSchedules(
  instruments: SimpleDebtInstrument[],
  horizonYears: number,
  startYear: number
): SimpleDebtServiceSchedule[] {
  return instruments.map((instrument) =>
    buildDebtServiceScheduleForInstrument(instrument, horizonYears, startYear)
  );
}

/**
 * Build a debt service schedule for a single instrument.
 *
 * Generates payment schedule based on the instrument's amortization type:
 * - LEVEL_DEBT_SERVICE: Equal total payments (standard mortgage-style)
 * - LEVEL_PRINCIPAL: Equal principal payments + declining interest
 * - INTEREST_ONLY: Interest only with balloon principal at maturity
 * - CUSTOM: Not yet implemented (returns empty schedule)
 *
 * @param instrument - The debt instrument
 * @param horizonYears - Number of years in the forecast horizon
 * @param startYear - First year of the forecast
 * @returns Debt service schedule with payments within the horizon
 */
export function buildDebtServiceScheduleForInstrument(
  instrument: SimpleDebtInstrument,
  horizonYears: number,
  startYear: number
): SimpleDebtServiceSchedule {
  const payments: DebtServicePayment[] = [];

  // Determine payment period
  const paymentStartYear = instrument.firstPaymentYear;
  const paymentEndYear = Math.min(
    paymentStartYear + instrument.termYears - 1,
    startYear + horizonYears - 1
  );

  // Skip if debt doesn't overlap with forecast horizon
  if (paymentEndYear < startYear || paymentStartYear >= startYear + horizonYears) {
    return {
      instrumentId: instrument.id,
      payments: [],
    };
  }

  const rate = instrument.annualInterestRate;
  const principal = instrument.principal;
  const termYears = instrument.termYears;

  // Track remaining principal for amortization calculations
  let remainingPrincipal = principal;

  // If we're starting mid-schedule, we need to calculate principal already paid
  if (startYear > paymentStartYear) {
    remainingPrincipal = calculateRemainingPrincipal(
      instrument,
      startYear - paymentStartYear
    );
  }

  // Generate payments for each year in the term
  for (let year = Math.max(paymentStartYear, startYear); year <= paymentEndYear; year++) {
    // Calculate years elapsed since first payment (for amortization)
    const yearsElapsed = year - paymentStartYear;

    const payment = calculatePayment(
      instrument,
      remainingPrincipal,
      yearsElapsed,
      year === paymentStartYear + termYears - 1 // Is this the final payment?
    );

    payments.push({
      year,
      periodIndex: year - startYear,
      label: String(year),
      principal: roundCurrency(payment.principal),
      interest: roundCurrency(payment.interest),
      total: roundCurrency(payment.principal + payment.interest),
    });

    // Update remaining principal
    remainingPrincipal = Math.max(0, remainingPrincipal - payment.principal);
  }

  return {
    instrumentId: instrument.id,
    payments,
  };
}

/**
 * Calculate remaining principal at a point in the amortization schedule.
 *
 * @param instrument - The debt instrument
 * @param yearsElapsed - Number of years since first payment
 * @returns Remaining principal balance
 */
function calculateRemainingPrincipal(
  instrument: SimpleDebtInstrument,
  yearsElapsed: number
): number {
  const { principal, annualInterestRate, termYears, amortizationType } = instrument;
  const rate = annualInterestRate;

  if (yearsElapsed <= 0) {
    return principal;
  }

  if (yearsElapsed >= termYears) {
    return 0;
  }

  switch (amortizationType) {
    case 'LEVEL_PRINCIPAL': {
      const annualPrincipal = principal / termYears;
      return Math.max(0, principal - annualPrincipal * yearsElapsed);
    }

    case 'INTEREST_ONLY': {
      // Full principal remains until final year
      return yearsElapsed < termYears - 1 ? principal : 0;
    }

    case 'LEVEL_DEBT_SERVICE':
    default: {
      // For level debt service, calculate remaining balance using annuity formula
      // Remaining balance = P * [(1+r)^n - (1+r)^t] / [(1+r)^n - 1]
      // where n = total periods, t = periods elapsed
      if (rate === 0) {
        return Math.max(0, principal - (principal / termYears) * yearsElapsed);
      }

      const n = termYears;
      const t = yearsElapsed;
      const compoundN = Math.pow(1 + rate, n);
      const compoundT = Math.pow(1 + rate, t);

      const remaining = principal * (compoundN - compoundT) / (compoundN - 1);
      return Math.max(0, remaining);
    }
  }
}

/**
 * Calculate a single payment based on amortization type.
 *
 * @param instrument - The debt instrument
 * @param remainingPrincipal - Current remaining principal
 * @param yearsElapsed - Years since first payment
 * @param isFinalPayment - Whether this is the final payment
 * @returns Payment breakdown with principal and interest
 */
function calculatePayment(
  instrument: SimpleDebtInstrument,
  remainingPrincipal: number,
  yearsElapsed: number,
  isFinalPayment: boolean
): { principal: number; interest: number } {
  const { principal, annualInterestRate, termYears, amortizationType } = instrument;
  const rate = annualInterestRate;

  if (remainingPrincipal <= 0) {
    return { principal: 0, interest: 0 };
  }

  let principalPayment = 0;
  let interestPayment = remainingPrincipal * rate;

  switch (amortizationType) {
    case 'LEVEL_PRINCIPAL': {
      principalPayment = principal / termYears;
      break;
    }

    case 'INTEREST_ONLY': {
      // Pay interest only until final year, then pay all principal
      principalPayment = isFinalPayment ? remainingPrincipal : 0;
      break;
    }

    case 'LEVEL_DEBT_SERVICE':
    default: {
      // Calculate level debt service payment using annuity formula
      // PMT = P * [r(1+r)^n] / [(1+r)^n - 1]
      if (rate === 0) {
        // No interest - simple equal payments
        const annualPayment = principal / termYears;
        principalPayment = annualPayment;
        interestPayment = 0;
      } else {
        const n = termYears;
        const compoundN = Math.pow(1 + rate, n);
        const annuityFactor = (rate * compoundN) / (compoundN - 1);
        const annualPayment = principal * annuityFactor;

        interestPayment = remainingPrincipal * rate;
        principalPayment = annualPayment - interestPayment;
      }
      break;
    }
  }

  // Ensure we don't pay more principal than remaining
  principalPayment = Math.min(principalPayment, remainingPrincipal);

  // On final payment, pay off any remaining principal
  if (isFinalPayment) {
    principalPayment = remainingPrincipal;
  }

  return {
    principal: principalPayment,
    interest: interestPayment,
  };
}

// ============================================================================
// DEBT SERVICE AGGREGATION HELPERS
// ============================================================================

/**
 * Get total annual debt service for a specific fund and year.
 *
 * @param fundId - Fund ID to filter by
 * @param year - Year to get debt service for
 * @param instruments - All debt instruments
 * @param schedules - Pre-computed debt service schedules
 * @returns Total debt service payment for the fund/year
 */
export function getAnnualDebtServiceForFund(
  fundId: string,
  year: number,
  instruments: SimpleDebtInstrument[],
  schedules: SimpleDebtServiceSchedule[]
): number {
  // Find instrument IDs that belong to this fund
  const instrumentIds = new Set(
    instruments
      .filter((i) => i.fundId === fundId)
      .map((i) => i.id)
  );

  // Sum payments for those instruments in the specified year
  let total = 0;
  for (const schedule of schedules) {
    if (!instrumentIds.has(schedule.instrumentId)) continue;

    for (const payment of schedule.payments) {
      if (payment.year === year) {
        total += payment.total;
      }
    }
  }

  return roundCurrency(total);
}

/**
 * Get total debt service by year for all instruments.
 *
 * @param schedules - Debt service schedules
 * @param startYear - First year of forecast
 * @param horizonYears - Number of years
 * @returns Map of year -> total debt service
 */
export function getTotalDebtServiceByYear(
  schedules: SimpleDebtServiceSchedule[],
  startYear: number,
  horizonYears: number
): Map<number, number> {
  const result = new Map<number, number>();

  // Initialize all years to 0
  for (let i = 0; i < horizonYears; i++) {
    result.set(startYear + i, 0);
  }

  // Sum all payments
  for (const schedule of schedules) {
    for (const payment of schedule.payments) {
      const current = result.get(payment.year) ?? 0;
      result.set(payment.year, current + payment.total);
    }
  }

  return result;
}

/**
 * Get debt service by fund by year.
 *
 * @param instruments - Debt instruments
 * @param schedules - Debt service schedules
 * @param startYear - First year of forecast
 * @param horizonYears - Number of years
 * @returns Map of fundId -> Map of year -> debt service
 */
export function getDebtServiceByFundByYear(
  instruments: SimpleDebtInstrument[],
  schedules: SimpleDebtServiceSchedule[],
  startYear: number,
  horizonYears: number
): Map<string, Map<number, number>> {
  const result = new Map<string, Map<number, number>>();

  // Build instrument -> fund mapping
  const instrumentToFund = new Map<string, string>();
  for (const instrument of instruments) {
    instrumentToFund.set(instrument.id, instrument.fundId);
  }

  // Aggregate by fund and year
  for (const schedule of schedules) {
    const fundId = instrumentToFund.get(schedule.instrumentId);
    if (!fundId) continue;

    if (!result.has(fundId)) {
      const yearMap = new Map<number, number>();
      for (let i = 0; i < horizonYears; i++) {
        yearMap.set(startYear + i, 0);
      }
      result.set(fundId, yearMap);
    }

    const fundYears = result.get(fundId)!;
    for (const payment of schedule.payments) {
      const current = fundYears.get(payment.year) ?? 0;
      fundYears.set(payment.year, current + payment.total);
    }
  }

  return result;
}

// ============================================================================
// SUMMARY GENERATION
// ============================================================================

/**
 * Generate a simple text summary of debt service schedules.
 *
 * Useful for debugging and quick inspection of generated schedules.
 *
 * @param instruments - Debt instruments
 * @param schedules - Debt service schedules
 * @returns Formatted summary string
 */
export function summarizeDebtSchedules(
  instruments: SimpleDebtInstrument[],
  schedules: SimpleDebtServiceSchedule[]
): string {
  const lines: string[] = [];
  lines.push('Debt Service Schedule Summary');
  lines.push('='.repeat(50));

  for (const schedule of schedules) {
    const instrument = instruments.find((i) => i.id === schedule.instrumentId);
    const name = instrument?.name ?? schedule.instrumentId;

    lines.push('');
    lines.push(`${name}`);
    lines.push('-'.repeat(name.length));

    if (schedule.payments.length === 0) {
      lines.push('  No payments in forecast horizon');
      continue;
    }

    let totalPrincipal = 0;
    let totalInterest = 0;

    for (const payment of schedule.payments) {
      lines.push(
        `  ${payment.year}: Principal $${payment.principal.toLocaleString()}, ` +
        `Interest $${payment.interest.toLocaleString()}, ` +
        `Total $${payment.total.toLocaleString()}`
      );
      totalPrincipal += payment.principal;
      totalInterest += payment.interest;
    }

    lines.push(`  ---`);
    lines.push(
      `  Total: Principal $${totalPrincipal.toLocaleString()}, ` +
      `Interest $${totalInterest.toLocaleString()}, ` +
      `Total $${(totalPrincipal + totalInterest).toLocaleString()}`
    );
  }

  return lines.join('\n');
}
