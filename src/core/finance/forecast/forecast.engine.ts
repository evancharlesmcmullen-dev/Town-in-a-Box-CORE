// src/core/finance/forecast/forecast.engine.ts

/**
 * Town-in-a-Box Finance Engine - Forecasting Engine
 *
 * Pure function implementation for generating multi-period financial forecasts.
 * Supports monthly or annual granularity with various revenue and expense models.
 */

import {
  ForecastEngine,
  FundForecastScenario,
  CurrentLedgerState,
  ForecastResult,
  ForecastPeriod,
  ForecastLineItem,
  ForecastWarning,
  ForecastSummary,
  RevenueModel,
  ExpenseModel,
  ScenarioComparison,
  PeriodVariance,
  SensitivityAnalysis,
  SensitivityPoint,
  ScenarioValidationResult,
  ForecastGranularity,
  StepChange,
  DebtPayment,
  ForecastMonthlyAmount,
} from './forecast.types';

// ============================================================================
// DEFAULT FORECAST ENGINE IMPLEMENTATION
// ============================================================================

export class DefaultForecastEngine implements ForecastEngine {
  /**
   * Generate a forecast from current ledger state and scenario.
   */
  generateForecast(
    currentLedger: CurrentLedgerState,
    scenario: FundForecastScenario
  ): ForecastResult {
    const validation = this.validateScenario(scenario);
    if (!validation.isValid) {
      throw new Error(`Invalid scenario: ${validation.errors.join(', ')}`);
    }

    const periods = this.generatePeriods(scenario);
    const allWarnings: ForecastWarning[] = [];
    const assumptionsSummary: string[] = this.buildAssumptionsSummary(scenario);

    let currentBalance = currentLedger.fund.currentBalance;
    let cumulativeNetChange = 0;
    let lowestBalance = currentBalance;
    let lowestPeriod = 'Starting';
    let highestBalance = currentBalance;
    let highestPeriod = 'Starting';
    let totalRevenues = 0;
    let totalExpenses = 0;
    let periodsWithNegativeBalance = 0;
    let periodsBelowMinimum = 0;

    const forecastPeriods: ForecastPeriod[] = periods.map((period, index) => {
      const beginningBalance = currentBalance;

      // Calculate revenues for this period
      const revenues = this.calculatePeriodRevenues(
        scenario.revenueModels,
        period.start,
        period.end,
        scenario.assumptions,
        index
      );
      const periodRevenue = revenues.reduce((sum, r) => sum + r.amount, 0);

      // Calculate expenses for this period
      const expenses = this.calculatePeriodExpenses(
        scenario.expenseModels,
        period.start,
        period.end,
        scenario.assumptions,
        index
      );
      const periodExpense = expenses.reduce((sum, e) => sum + e.amount, 0);

      // Calculate balances
      const netChange = periodRevenue - periodExpense;
      currentBalance = beginningBalance + netChange;
      cumulativeNetChange += netChange;

      // Track totals
      totalRevenues += periodRevenue;
      totalExpenses += periodExpense;

      // Track highs/lows
      if (currentBalance < lowestBalance) {
        lowestBalance = currentBalance;
        lowestPeriod = period.label;
      }
      if (currentBalance > highestBalance) {
        highestBalance = currentBalance;
        highestPeriod = period.label;
      }

      // Generate warnings
      const periodWarnings: ForecastWarning[] = [];

      if (currentBalance < 0) {
        periodsWithNegativeBalance++;
        periodWarnings.push({
          type: 'NEGATIVE_BALANCE',
          message: `Fund balance goes negative in ${period.label}: ${this.formatCurrency(currentBalance)}`,
          severity: 'CRITICAL',
          suggestedAction: 'Review revenue projections or reduce planned expenses',
        });
      }

      if (scenario.minimumBalance) {
        const minRequired =
          scenario.minimumBalance.type === 'ABSOLUTE'
            ? scenario.minimumBalance.value
            : periodExpense * scenario.minimumBalance.value;

        if (currentBalance < minRequired) {
          periodsBelowMinimum++;
          periodWarnings.push({
            type: 'BELOW_MINIMUM',
            message: `Balance ${this.formatCurrency(currentBalance)} falls below minimum ${this.formatCurrency(minRequired)} in ${period.label}`,
            severity: 'HIGH',
            suggestedAction: 'Consider building reserves or adjusting expenditure timing',
          });
        }
      }

      allWarnings.push(...periodWarnings);

      return {
        periodStart: period.start,
        periodEnd: period.end,
        label: period.label,
        beginningBalance,
        revenues,
        totalRevenues: periodRevenue,
        expenses,
        totalExpenses: periodExpense,
        netChange,
        endingBalance: currentBalance,
        cumulativeNetChange,
        warnings: periodWarnings,
      };
    });

    // Calculate summary
    const summary: ForecastSummary = {
      totalPeriods: forecastPeriods.length,
      totalRevenues,
      totalExpenses,
      netChange: cumulativeNetChange,
      finalBalance: currentBalance,
      lowestBalance: { amount: lowestBalance, period: lowestPeriod },
      highestBalance: { amount: highestBalance, period: highestPeriod },
      averageMonthlyNetChange: cumulativeNetChange / scenario.horizonMonths,
      periodsWithNegativeBalance,
      periodsBelowMinimum,
      riskAssessment: this.assessRisk(
        periodsWithNegativeBalance,
        periodsBelowMinimum,
        currentBalance,
        currentLedger.fund.currentBalance
      ),
    };

    return {
      scenarioId: scenario.id,
      scenarioName: scenario.name,
      fundId: currentLedger.fund.id,
      fundName: currentLedger.fund.name,
      generatedAt: new Date(),
      startingBalance: currentLedger.fund.currentBalance,
      periods: forecastPeriods,
      summary,
      warnings: allWarnings,
      assumptionsSummary,
    };
  }

  /**
   * Compare two forecast scenarios.
   */
  compareScenarios(
    baseResult: ForecastResult,
    compareResult: ForecastResult
  ): ScenarioComparison {
    const periodVariances: PeriodVariance[] = [];

    const maxPeriods = Math.max(
      baseResult.periods.length,
      compareResult.periods.length
    );

    for (let i = 0; i < maxPeriods; i++) {
      const basePeriod = baseResult.periods[i];
      const comparePeriod = compareResult.periods[i];

      if (basePeriod && comparePeriod) {
        periodVariances.push({
          period: basePeriod.label,
          baseRevenue: basePeriod.totalRevenues,
          compareRevenue: comparePeriod.totalRevenues,
          revenueVariance: comparePeriod.totalRevenues - basePeriod.totalRevenues,
          baseExpense: basePeriod.totalExpenses,
          compareExpense: comparePeriod.totalExpenses,
          expenseVariance: comparePeriod.totalExpenses - basePeriod.totalExpenses,
          baseBalance: basePeriod.endingBalance,
          compareBalance: comparePeriod.endingBalance,
          balanceVariance: comparePeriod.endingBalance - basePeriod.endingBalance,
        });
      }
    }

    const revenueVariance =
      compareResult.summary.totalRevenues - baseResult.summary.totalRevenues;
    const expenseVariance =
      compareResult.summary.totalExpenses - baseResult.summary.totalExpenses;

    return {
      baseScenarioId: baseResult.scenarioId,
      compareScenarioId: compareResult.scenarioId,
      periodVariances,
      summary: {
        revenueVariance,
        revenueVariancePercent:
          baseResult.summary.totalRevenues > 0
            ? (revenueVariance / baseResult.summary.totalRevenues) * 100
            : 0,
        expenseVariance,
        expenseVariancePercent:
          baseResult.summary.totalExpenses > 0
            ? (expenseVariance / baseResult.summary.totalExpenses) * 100
            : 0,
        finalBalanceVariance:
          compareResult.summary.finalBalance - baseResult.summary.finalBalance,
        riskDifference: `${baseResult.summary.riskAssessment} → ${compareResult.summary.riskAssessment}`,
      },
    };
  }

  /**
   * Run sensitivity analysis on a variable.
   */
  runSensitivityAnalysis(
    currentLedger: CurrentLedgerState,
    scenario: FundForecastScenario,
    variable: string,
    testValues: number[]
  ): SensitivityAnalysis {
    const baseResult = this.generateForecast(currentLedger, scenario);
    const baseValue = this.getVariableValue(scenario, variable);
    const results: SensitivityPoint[] = [];

    for (const testValue of testValues) {
      const modifiedScenario = this.modifyScenarioVariable(
        scenario,
        variable,
        testValue
      );
      const testResult = this.generateForecast(currentLedger, modifiedScenario);

      results.push({
        value: testValue,
        finalBalance: testResult.summary.finalBalance,
        balanceChange:
          testResult.summary.finalBalance - baseResult.summary.finalBalance,
        percentChange:
          baseResult.summary.finalBalance !== 0
            ? ((testResult.summary.finalBalance - baseResult.summary.finalBalance) /
                Math.abs(baseResult.summary.finalBalance)) *
              100
            : 0,
      });
    }

    // Assess impact based on variance
    const maxChange = Math.max(...results.map((r) => Math.abs(r.percentChange)));
    const impact: 'LOW' | 'MODERATE' | 'HIGH' =
      maxChange < 5 ? 'LOW' : maxChange < 15 ? 'MODERATE' : 'HIGH';

    return {
      variable,
      baseValue,
      results,
      impact,
    };
  }

  /**
   * Validate a scenario configuration.
   */
  validateScenario(scenario: FundForecastScenario): ScenarioValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Required fields
    if (!scenario.id) errors.push('Scenario ID is required');
    if (!scenario.tenantId) errors.push('Tenant ID is required');
    if (!scenario.name) errors.push('Scenario name is required');
    if (!scenario.fundId) errors.push('Fund ID is required');
    if (!scenario.startDate) errors.push('Start date is required');
    if (!scenario.horizonMonths || scenario.horizonMonths < 1) {
      errors.push('Horizon must be at least 1 month');
    }
    if (scenario.horizonMonths > 120) {
      warnings.push('Forecasts beyond 10 years have high uncertainty');
    }

    // Revenue models
    if (!scenario.revenueModels || scenario.revenueModels.length === 0) {
      warnings.push('No revenue models defined - forecast will show zero revenue');
    }

    // Expense models
    if (!scenario.expenseModels || scenario.expenseModels.length === 0) {
      warnings.push('No expense models defined - forecast will show zero expenses');
    }

    // Assumptions
    if (!scenario.assumptions) {
      errors.push('Economic assumptions are required');
    } else {
      if (scenario.assumptions.generalInflation < 0) {
        warnings.push('Negative inflation assumption may be unrealistic');
      }
      if (scenario.assumptions.generalInflation > 0.15) {
        warnings.push('Very high inflation assumption (>15%)');
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  // ============================================================================
  // PRIVATE HELPER METHODS
  // ============================================================================

  private generatePeriods(
    scenario: FundForecastScenario
  ): { start: Date; end: Date; label: string }[] {
    const periods: { start: Date; end: Date; label: string }[] = [];
    const startDate = new Date(scenario.startDate);
    let currentDate = new Date(
      startDate.getFullYear(),
      startDate.getMonth(),
      1
    );

    const periodsCount = this.getPeriodCount(
      scenario.horizonMonths,
      scenario.granularity
    );

    for (let i = 0; i < periodsCount; i++) {
      const periodStart = new Date(currentDate);
      let periodEnd: Date;
      let label: string;

      switch (scenario.granularity) {
        case 'MONTHLY':
          periodEnd = new Date(
            currentDate.getFullYear(),
            currentDate.getMonth() + 1,
            0
          );
          label = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;
          currentDate.setMonth(currentDate.getMonth() + 1);
          break;

        case 'QUARTERLY':
          periodEnd = new Date(
            currentDate.getFullYear(),
            currentDate.getMonth() + 3,
            0
          );
          const quarter = Math.floor(currentDate.getMonth() / 3) + 1;
          label = `Q${quarter} ${currentDate.getFullYear()}`;
          currentDate.setMonth(currentDate.getMonth() + 3);
          break;

        case 'ANNUAL':
          periodEnd = new Date(currentDate.getFullYear(), 11, 31);
          label = `${currentDate.getFullYear()}`;
          currentDate.setFullYear(currentDate.getFullYear() + 1);
          break;

        default:
          throw new Error(`Unknown granularity: ${scenario.granularity}`);
      }

      periods.push({ start: periodStart, end: periodEnd, label });
    }

    return periods;
  }

  private getPeriodCount(
    horizonMonths: number,
    granularity: ForecastGranularity
  ): number {
    switch (granularity) {
      case 'MONTHLY':
        return horizonMonths;
      case 'QUARTERLY':
        return Math.ceil(horizonMonths / 3);
      case 'ANNUAL':
        return Math.ceil(horizonMonths / 12);
      default:
        return horizonMonths;
    }
  }

  private calculatePeriodRevenues(
    models: RevenueModel[],
    periodStart: Date,
    periodEnd: Date,
    assumptions: FundForecastScenario['assumptions'],
    periodIndex: number
  ): ForecastLineItem[] {
    return models
      .filter((m) => m.isActive)
      .filter((m) => !m.endDate || m.endDate >= periodStart)
      .filter((m) => m.startDate <= periodEnd)
      .map((model) => {
        const amount = this.calculateRevenueModelAmount(
          model,
          periodStart,
          periodEnd,
          assumptions,
          periodIndex
        );
        return {
          modelId: model.id,
          modelName: model.name,
          code: model.sourceCode,
          amount,
          assumptions: this.getModelAssumptions(model),
        };
      });
  }

  private calculateRevenueModelAmount(
    model: RevenueModel,
    periodStart: Date,
    periodEnd: Date,
    assumptions: FundForecastScenario['assumptions'],
    periodIndex: number
  ): number {
    const monthsInPeriod = this.getMonthsBetween(periodStart, periodEnd);

    switch (model.type) {
      case 'STATIC': {
        const monthlyAmount = model.annualAmount / 12;
        if (model.monthlyDistribution) {
          // Use custom distribution
          let total = 0;
          for (let m = periodStart.getMonth(); m <= periodEnd.getMonth(); m++) {
            total += model.annualAmount * (model.monthlyDistribution[m] || 1 / 12);
          }
          return total;
        }
        return monthlyAmount * monthsInPeriod;
      }

      case 'PERCENT_GROWTH': {
        const yearsElapsed = periodIndex / 12;
        const growthFactor = Math.pow(1 + model.growthRate, yearsElapsed);
        const annualAmount = model.baseAmount * growthFactor;
        return (annualAmount / 12) * monthsInPeriod;
      }

      case 'LIT_LINKED': {
        const yearsElapsed = periodIndex / 12;
        const incomeGrowth = Math.pow(1 + model.incomeGrowthRate, yearsElapsed);
        const taxableIncome = model.taxableIncomeBase * incomeGrowth;
        const annualLIT = taxableIncome * model.litRate * model.collectionEfficiency;
        return (annualLIT / 12) * monthsInPeriod;
      }

      case 'PROPERTY_TAX': {
        const yearsElapsed = Math.floor(periodIndex / 12);
        const growthRate = Math.min(model.maxGrowthRate, model.assessedValueGrowth);
        const growthFactor = Math.pow(1 + growthRate, yearsElapsed);
        const projectedLevy = model.certifiedLevy * growthFactor;
        const afterCircuitBreaker =
          projectedLevy * (1 - (model.circuitBreakerLoss || 0));
        const collected = afterCircuitBreaker * model.collectionRate;
        return (collected / 12) * monthsInPeriod;
      }

      case 'GRANT_LINKED': {
        // Check if grant is still active
        if (model.grantPeriod === 'ONE_TIME' && periodIndex > 0) {
          return 0;
        }
        if (
          model.grantPeriod === 'MULTI_YEAR' &&
          model.grantYears &&
          periodIndex >= model.grantYears * 12
        ) {
          // Apply renewal probability
          if (Math.random() > (model.renewalProbability || 0)) {
            return 0;
          }
        }
        return (model.grantAmount / 12) * monthsInPeriod;
      }

      case 'FEE_BASED': {
        const yearsElapsed = periodIndex / 12;
        const volumeGrowth = Math.pow(1 + model.volumeGrowthRate, yearsElapsed);
        const feeGrowth = Math.pow(1 + model.feeIncreaseRate, yearsElapsed);
        const annualVolume = model.baseVolume * volumeGrowth;
        const currentFee = model.feeAmount * feeGrowth;
        return ((annualVolume * currentFee) / 12) * monthsInPeriod;
      }

      case 'SEASONAL': {
        let total = 0;
        const yearsElapsed = Math.floor(periodIndex / 12);
        const growthFactor = Math.pow(1 + model.growthRate, yearsElapsed);
        const adjustedAnnual = model.annualAmount * growthFactor;

        for (let m = periodStart.getMonth(); m <= periodEnd.getMonth(); m++) {
          total += adjustedAnnual * model.monthlyWeights[m];
        }
        return total;
      }

      case 'CUSTOM': {
        // Simple formula evaluation (in production, use a proper expression parser)
        return this.evaluateFormula(model.formula, model.variables, periodIndex);
      }

      default:
        return 0;
    }
  }

  private calculatePeriodExpenses(
    models: ExpenseModel[],
    periodStart: Date,
    periodEnd: Date,
    assumptions: FundForecastScenario['assumptions'],
    periodIndex: number
  ): ForecastLineItem[] {
    return models
      .filter((m) => m.isActive)
      .filter((m) => !m.endDate || m.endDate >= periodStart)
      .filter((m) => m.startDate <= periodEnd)
      .map((model) => {
        const amount = this.calculateExpenseModelAmount(
          model,
          periodStart,
          periodEnd,
          assumptions,
          periodIndex
        );
        return {
          modelId: model.id,
          modelName: model.name,
          code: model.targetCode,
          amount,
          assumptions: this.getModelAssumptions(model),
        };
      });
  }

  private calculateExpenseModelAmount(
    model: ExpenseModel,
    periodStart: Date,
    periodEnd: Date,
    assumptions: FundForecastScenario['assumptions'],
    periodIndex: number
  ): number {
    const monthsInPeriod = this.getMonthsBetween(periodStart, periodEnd);

    switch (model.type) {
      case 'BASELINE_INFLATION': {
        const yearsElapsed = periodIndex / 12;
        const inflationRate = model.inflationRate || assumptions.generalInflation;
        const growthFactor = Math.pow(1 + inflationRate, yearsElapsed);
        const annualAmount = model.baseAmount * growthFactor;
        return (annualAmount / 12) * monthsInPeriod;
      }

      case 'STEP_CHANGE': {
        let currentAmount = model.baseAmount;

        // Apply step changes up to this period
        for (const change of model.stepChanges || []) {
          if (change.effectiveDate <= periodEnd) {
            currentAmount = this.applyStepChange(currentAmount, change);
          }
        }

        // Apply inflation
        if (model.inflationRate) {
          const yearsElapsed = periodIndex / 12;
          currentAmount *= Math.pow(1 + model.inflationRate, yearsElapsed);
        }

        return (currentAmount / 12) * monthsInPeriod;
      }

      case 'PERSONNEL': {
        const yearsElapsed = periodIndex / 12;

        // Calculate FTE count with changes
        let fteCount = model.fteCount;
        for (const change of model.fteChanges || []) {
          if (change.effectiveDate <= periodEnd) {
            switch (change.changeType) {
              case 'ADD':
                fteCount += change.count;
                break;
              case 'REMOVE':
                fteCount -= change.count;
                break;
              case 'SET':
                fteCount = change.count;
                break;
            }
          }
        }

        // Salary with increases
        const salaryGrowth = Math.pow(1 + model.salaryIncreaseRate, yearsElapsed);
        const currentSalary = model.averageSalary * salaryGrowth;

        // Benefits with inflation
        const benefitsGrowth = Math.pow(
          1 + model.benefitsInflationRate,
          yearsElapsed
        );
        const benefitsCost =
          currentSalary * model.benefitsRate * benefitsGrowth;

        // FICA and PERF
        const ficaCost = currentSalary * model.ficaRate;
        const perfCost = currentSalary * (model.perfRate || 0);

        const totalPerFTE = currentSalary + benefitsCost + ficaCost + perfCost;
        return ((fteCount * totalPerFTE) / 12) * monthsInPeriod;
      }

      case 'DEBT_SERVICE': {
        if (model.paymentSchedule) {
          // Use explicit schedule
          return model.paymentSchedule
            .filter(
              (p: DebtPayment) => p.paymentDate >= periodStart && p.paymentDate <= periodEnd
            )
            .reduce((sum: number, p: DebtPayment) => sum + p.totalPayment, 0);
        }
        // TODO: Look up from debt instrument
        return 0;
      }

      case 'CAPITAL_PLAN': {
        let total = 0;
        for (const project of model.projects) {
          if (project.startDate <= periodEnd && project.endDate >= periodStart) {
            if (project.spendingSchedule) {
              // Use explicit schedule
              total += project.spendingSchedule
                .filter(
                  (s: ForecastMonthlyAmount) => s.month >= periodStart && s.month <= periodEnd
                )
                .reduce((sum: number, s: ForecastMonthlyAmount) => sum + s.amount, 0);
            } else {
              // Even distribution
              const projectMonths = this.getMonthsBetween(
                project.startDate,
                project.endDate
              );
              const overlapStart = new Date(
                Math.max(periodStart.getTime(), project.startDate.getTime())
              );
              const overlapEnd = new Date(
                Math.min(periodEnd.getTime(), project.endDate.getTime())
              );
              const overlapMonths = this.getMonthsBetween(overlapStart, overlapEnd);
              total += (project.totalCost / projectMonths) * overlapMonths;
            }
          }
        }
        return total;
      }

      case 'CONTRACT': {
        const yearsElapsed = periodIndex / 12;
        let currentAmount = model.annualAmount;

        // Apply escalation
        if (periodStart <= model.contractEndDate) {
          currentAmount *= Math.pow(1 + model.escalationRate, yearsElapsed);
        } else if (model.renewalAmount) {
          // Use renewal amount after contract ends
          currentAmount = model.renewalAmount;
        } else {
          return 0;
        }

        return (currentAmount / 12) * monthsInPeriod;
      }

      case 'UTILITY': {
        const yearsElapsed = periodIndex / 12;

        // Usage growth
        const usageGrowth = Math.pow(1 + model.usageGrowthRate, yearsElapsed);
        let currentUsage = model.baseUsage * usageGrowth;

        // Apply seasonal pattern if defined
        if (model.monthlyPattern) {
          // Weight by months in period
          let seasonalFactor = 0;
          for (let m = periodStart.getMonth(); m <= periodEnd.getMonth(); m++) {
            seasonalFactor += model.monthlyPattern[m] || 1;
          }
          currentUsage *= seasonalFactor / monthsInPeriod;
        }

        // Rate growth
        const rateGrowth = Math.pow(1 + model.rateIncreaseRate, yearsElapsed);
        const currentRate = model.currentRate * rateGrowth;

        return currentUsage * currentRate * monthsInPeriod;
      }

      case 'CUSTOM': {
        return this.evaluateFormula(model.formula, model.variables, periodIndex);
      }

      default:
        return 0;
    }
  }

  private applyStepChange(currentAmount: number, change: StepChange): number {
    switch (change.changeType) {
      case 'ABSOLUTE':
        return currentAmount + change.amount;
      case 'PERCENTAGE':
        return currentAmount * (1 + change.amount);
      case 'REPLACEMENT':
        return change.amount;
      default:
        return currentAmount;
    }
  }

  private getMonthsBetween(start: Date, end: Date): number {
    return (
      (end.getFullYear() - start.getFullYear()) * 12 +
      (end.getMonth() - start.getMonth()) +
      1
    );
  }

  private evaluateFormula(
    formula: string,
    variables: Record<string, number>,
    periodIndex: number
  ): number {
    // Simple placeholder - in production use a proper expression evaluator
    // For now, just return the first variable value or 0
    const values = Object.values(variables);
    return values.length > 0 ? values[0] * (1 + periodIndex * 0.01) : 0;
  }

  private getModelAssumptions(model: RevenueModel | ExpenseModel): string {
    switch (model.type) {
      case 'STATIC':
        return `Static: ${this.formatCurrency((model as any).annualAmount)}/year`;
      case 'PERCENT_GROWTH':
        return `${((model as any).growthRate * 100).toFixed(1)}% annual growth`;
      case 'BASELINE_INFLATION':
        return `${((model as any).inflationRate * 100).toFixed(1)}% inflation`;
      case 'PERSONNEL':
        return `${(model as any).fteCount} FTEs, ${((model as any).salaryIncreaseRate * 100).toFixed(1)}% raises`;
      case 'LIT_LINKED':
        return `LIT rate ${((model as any).litRate * 100).toFixed(2)}%`;
      case 'PROPERTY_TAX':
        return `Levy: ${this.formatCurrency((model as any).certifiedLevy)}`;
      default:
        return model.type;
    }
  }

  private buildAssumptionsSummary(
    scenario: FundForecastScenario
  ): string[] {
    const assumptions: string[] = [];

    assumptions.push(
      `General inflation: ${(scenario.assumptions.generalInflation * 100).toFixed(1)}%`
    );
    assumptions.push(
      `Wage growth: ${(scenario.assumptions.wageGrowth * 100).toFixed(1)}%`
    );
    assumptions.push(
      `Property value growth: ${(scenario.assumptions.propertyValueGrowth * 100).toFixed(1)}%`
    );
    assumptions.push(
      `Interest rate: ${(scenario.assumptions.interestRate * 100).toFixed(2)}%`
    );

    if (scenario.minimumBalance) {
      if (scenario.minimumBalance.type === 'ABSOLUTE') {
        assumptions.push(
          `Minimum balance target: ${this.formatCurrency(scenario.minimumBalance.value)}`
        );
      } else {
        assumptions.push(
          `Minimum balance target: ${(scenario.minimumBalance.value * 100).toFixed(0)}% of expenses`
        );
      }
    }

    assumptions.push(`Revenue models: ${scenario.revenueModels.length}`);
    assumptions.push(`Expense models: ${scenario.expenseModels.length}`);

    return assumptions;
  }

  private assessRisk(
    periodsWithNegativeBalance: number,
    periodsBelowMinimum: number,
    finalBalance: number,
    startingBalance: number
  ): 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL' {
    if (periodsWithNegativeBalance > 0) {
      return 'CRITICAL';
    }

    if (periodsBelowMinimum > 3) {
      return 'HIGH';
    }

    if (periodsBelowMinimum > 0) {
      return 'MODERATE';
    }

    const balanceChange = (finalBalance - startingBalance) / startingBalance;
    if (balanceChange < -0.2) {
      return 'MODERATE';
    }

    return 'LOW';
  }

  private formatCurrency(amount: number): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  }

  private getVariableValue(
    scenario: FundForecastScenario,
    variable: string
  ): number {
    // Map variable names to scenario values
    const variableMap: Record<string, number> = {
      generalInflation: scenario.assumptions.generalInflation,
      wageGrowth: scenario.assumptions.wageGrowth,
      propertyValueGrowth: scenario.assumptions.propertyValueGrowth,
      interestRate: scenario.assumptions.interestRate,
      ...scenario.assumptions.custom,
    };

    return variableMap[variable] || 0;
  }

  private modifyScenarioVariable(
    scenario: FundForecastScenario,
    variable: string,
    newValue: number
  ): FundForecastScenario {
    const modified = JSON.parse(JSON.stringify(scenario)) as FundForecastScenario;

    switch (variable) {
      case 'generalInflation':
        modified.assumptions.generalInflation = newValue;
        break;
      case 'wageGrowth':
        modified.assumptions.wageGrowth = newValue;
        break;
      case 'propertyValueGrowth':
        modified.assumptions.propertyValueGrowth = newValue;
        break;
      case 'interestRate':
        modified.assumptions.interestRate = newValue;
        break;
      default:
        if (modified.assumptions.custom) {
          modified.assumptions.custom[variable] = newValue;
        }
    }

    return modified;
  }
}

// ============================================================================
// FACTORY FUNCTION
// ============================================================================

/**
 * Create a new forecast engine instance.
 */
export function createForecastEngine(): ForecastEngine {
  return new DefaultForecastEngine();
}
