// src/core/finance/debt/debt.engine.ts

/**
 * Town-in-a-Box Finance Engine - Debt Scenario Engine
 *
 * Implementation for debt scenario modeling including:
 * - Amortization schedule generation
 * - New issuance analysis
 * - Early payoff analysis
 * - Refunding/refinancing analysis
 * - Debt capacity metrics
 */

import {
  DebtInstrument,
  DebtServiceSchedule,
} from '../finance.types';

import {
  DebtScenarioEngine,
  NewIssuanceParams,
  NewIssuanceScenario,
  NewIssuanceResult,
  EarlyPayoffScenario,
  EarlyPayoffResult,
  RefundingScenario,
  RefundingResult,
  DebtCapacityMetrics,
  DebtCoverageRatio,
  AnnualDebtProjection,
  AmortizationEntry,
  DebtScenario,
} from './debt.types';

// ============================================================================
// DEFAULT DEBT SCENARIO ENGINE
// ============================================================================

export class DefaultDebtScenarioEngine implements DebtScenarioEngine {
  /**
   * Generate amortization schedule for a debt instrument.
   */
  generateAmortizationSchedule(params: NewIssuanceParams): AmortizationEntry[] {
    const schedule: AmortizationEntry[] = [];

    // Determine periods per year
    const periodsPerYear = this.getPeriodsPerYear(params.paymentFrequency);
    const totalPeriods = params.termYears * periodsPerYear;
    const periodicRate = params.assumedInterestRate / periodsPerYear;

    let balance = params.principalAmount;
    let paymentDate = new Date(params.issueDate);

    // Advance to first payment date
    this.advancePaymentDate(paymentDate, params.paymentFrequency);

    for (let period = 1; period <= totalPeriods; period++) {
      const beginningBalance = balance;
      let principal: number;
      let interest: number;
      let totalPayment: number;

      switch (params.amortizationType) {
        case 'LEVEL_DEBT_SERVICE': {
          // PMT formula: P * r * (1+r)^n / ((1+r)^n - 1)
          totalPayment = this.calculateLevelPayment(
            params.principalAmount,
            periodicRate,
            totalPeriods
          );
          interest = beginningBalance * periodicRate;
          principal = totalPayment - interest;
          break;
        }

        case 'LEVEL_PRINCIPAL': {
          principal = params.principalAmount / totalPeriods;
          interest = beginningBalance * periodicRate;
          totalPayment = principal + interest;
          break;
        }

        case 'INTEREST_ONLY': {
          // Interest only until final payment
          if (period === totalPeriods) {
            principal = beginningBalance;
            interest = beginningBalance * periodicRate;
          } else {
            principal = 0;
            interest = beginningBalance * periodicRate;
          }
          totalPayment = principal + interest;
          break;
        }

        case 'CUSTOM':
        default: {
          // Default to level debt service
          totalPayment = this.calculateLevelPayment(
            params.principalAmount,
            periodicRate,
            totalPeriods
          );
          interest = beginningBalance * periodicRate;
          principal = totalPayment - interest;
          break;
        }
      }

      // Handle rounding on final payment
      if (period === totalPeriods) {
        principal = beginningBalance;
        totalPayment = principal + interest;
      }

      balance = beginningBalance - principal;

      schedule.push({
        paymentNumber: period,
        paymentDate: new Date(paymentDate),
        fiscalYear: this.getFiscalYear(paymentDate),
        beginningBalance: this.round(beginningBalance),
        principal: this.round(principal),
        interest: this.round(interest),
        totalPayment: this.round(totalPayment),
        endingBalance: this.round(Math.max(0, balance)),
      });

      // Advance to next payment date
      this.advancePaymentDate(paymentDate, params.paymentFrequency);
    }

    return schedule;
  }

  /**
   * Analyze a new issuance scenario.
   */
  analyzeNewIssuance(scenario: NewIssuanceScenario): NewIssuanceResult {
    const params = scenario.params;
    const warnings: string[] = [];

    // Validate
    const validation = this.validateNewIssuanceParams(params);
    if (!validation.isValid) {
      throw new Error(`Invalid scenario: ${validation.errors.join(', ')}`);
    }
    warnings.push(...validation.warnings);

    // Generate amortization schedule
    const schedule = this.generateAmortizationSchedule(params);

    // Calculate issuance costs
    let issuanceCosts = 0;
    if (params.issuanceCosts) {
      issuanceCosts =
        params.issuanceCosts.type === 'PERCENTAGE'
          ? params.principalAmount * params.issuanceCosts.value
          : params.issuanceCosts.value;
    }

    // Calculate reserve fund requirement
    let reserveFund = 0;
    if (params.reserveFundRequirement) {
      const annualDS = this.calculateAnnualDebtService(schedule);
      switch (params.reserveFundRequirement.type) {
        case 'MAX_ANNUAL_DS':
          reserveFund = Math.max(...annualDS.map((a) => a.total));
          break;
        case 'AVERAGE_ANNUAL_DS':
          reserveFund =
            annualDS.reduce((sum, a) => sum + a.total, 0) / annualDS.length;
          break;
        case 'PERCENTAGE':
          reserveFund =
            params.principalAmount *
            (params.reserveFundRequirement.value || 0.1);
          break;
      }
    }

    // Calculate metrics
    const totalInterest = schedule.reduce((sum, p) => sum + p.interest, 0);
    const totalDebtService = schedule.reduce((sum, p) => sum + p.totalPayment, 0);
    const annualDS = this.calculateAnnualDebtService(schedule);
    const averageAnnualDS = totalDebtService / params.termYears;
    const maxAnnualDS = Math.max(...annualDS.map((a) => a.total));
    const netProceeds = params.principalAmount - issuanceCosts - reserveFund;

    // True Interest Cost (TIC) - IRR of cash flows
    const tic = this.calculateTIC(
      params.principalAmount - issuanceCosts,
      schedule
    );

    // Net Interest Cost (NIC)
    const nic = (totalInterest + issuanceCosts) / params.principalAmount;

    // All-in cost
    const allInCost = (totalInterest + issuanceCosts) / params.principalAmount;

    // Create projected instrument
    const projectedInstrument: Omit<DebtInstrument, 'id'> = {
      tenantId: scenario.tenantId,
      name: params.projectName,
      type: params.type,
      purpose: params.projectName,
      parAmount: params.principalAmount,
      issueDate: params.issueDate,
      maturityDate: schedule[schedule.length - 1].paymentDate,
      interestRate: params.assumedInterestRate,
      isVariableRate: false,
      amortizationType: params.amortizationType,
      paymentFrequency: params.paymentFrequency,
      isCallable: params.isCallable || false,
      callDate: params.callDate,
      pledgedFundIds: params.proceedsFundId ? [params.proceedsFundId] : undefined,
      debtServiceFundId: params.debtServiceFundId,
      outstandingPrincipal: params.principalAmount,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // Generate annual projections
    const annualProjections = this.generateAnnualProjections(schedule, []);

    return {
      scenarioId: scenario.id,
      trueInterestCost: this.round(tic, 6),
      netInterestCost: this.round(nic, 6),
      allInCost: this.round(allInCost, 6),
      totalInterest: this.round(totalInterest),
      totalDebtService: this.round(totalDebtService),
      averageAnnualDS: this.round(averageAnnualDS),
      maxAnnualDS: this.round(maxAnnualDS),
      netProceeds: this.round(netProceeds),
      issuanceCosts: this.round(issuanceCosts),
      reserveFund: this.round(reserveFund),
      schedule,
      projectedInstrument,
      annualProjections,
      warnings,
    };
  }

  /**
   * Analyze an early payoff scenario.
   */
  analyzeEarlyPayoff(
    scenario: EarlyPayoffScenario,
    instrument: DebtInstrument,
    schedule: DebtServiceSchedule[]
  ): EarlyPayoffResult {
    const params = scenario.params;
    const warnings: string[] = [];

    // Find remaining payments after payoff date
    const remainingPayments = schedule.filter(
      (p) => new Date(p.paymentDate) > params.payoffDate && !p.isPaid
    );

    // Calculate outstanding principal
    const lastPayment = schedule
      .filter((p) => new Date(p.paymentDate) <= params.payoffDate)
      .sort((a, b) => new Date(b.paymentDate).getTime() - new Date(a.paymentDate).getTime())[0];

    const outstandingPrincipal = lastPayment?.remainingPrincipal || instrument.parAmount;

    // Calculate accrued interest
    const daysSinceLastPayment = lastPayment
      ? this.daysBetween(new Date(lastPayment.paymentDate), params.payoffDate)
      : this.daysBetween(instrument.issueDate, params.payoffDate);

    const accruedInterest =
      (outstandingPrincipal * instrument.interestRate * daysSinceLastPayment) / 365;

    // Call premium
    let callPremium = 0;
    if (instrument.isCallable && instrument.callPremium) {
      if (params.payoffDate >= (instrument.callDate || new Date(0))) {
        callPremium = outstandingPrincipal * instrument.callPremium;
      } else {
        warnings.push(
          'Payoff date is before call date - call premium may not apply or make-whole may be required'
        );
      }
    }

    const additionalCosts = params.additionalCosts || 0;

    // Total payoff amount
    const totalPayoffAmount =
      outstandingPrincipal + accruedInterest + callPremium + additionalCosts;

    // Remaining scheduled debt service
    const remainingScheduledDS = remainingPayments.reduce(
      (sum, p) => sum + p.totalPayment,
      0
    );

    // Gross savings
    const grossSavings = remainingScheduledDS - totalPayoffAmount;

    // NPV of savings (discount remaining payments to present value)
    const discountRate = instrument.interestRate;
    const npvRemaining = remainingPayments.reduce((npv, payment) => {
      const yearsToPayment =
        this.daysBetween(params.payoffDate, new Date(payment.paymentDate)) / 365;
      return npv + payment.totalPayment / Math.pow(1 + discountRate, yearsToPayment);
    }, 0);

    const npvSavings = npvRemaining - totalPayoffAmount;
    const npvSavingsPercent = (npvSavings / outstandingPrincipal) * 100;

    // Annual savings
    const annualSavings = this.calculateAnnualSavings(remainingPayments);

    // Determine if advised
    const isAdvised = npvSavingsPercent >= 3; // Generally 3% NPV threshold

    if (!isAdvised) {
      warnings.push(
        `NPV savings of ${npvSavingsPercent.toFixed(2)}% is below the recommended 3% threshold`
      );
    }

    return {
      scenarioId: scenario.id,
      instrument,
      outstandingPrincipal: this.round(outstandingPrincipal),
      accruedInterest: this.round(accruedInterest),
      callPremium: this.round(callPremium),
      additionalCosts: this.round(additionalCosts),
      totalPayoffAmount: this.round(totalPayoffAmount),
      remainingScheduledDS: this.round(remainingScheduledDS),
      grossSavings: this.round(grossSavings),
      npvSavings: this.round(npvSavings),
      npvSavingsPercent: this.round(npvSavingsPercent, 4),
      annualSavings,
      payoffDate: params.payoffDate,
      isAdvised,
      warnings,
    };
  }

  /**
   * Analyze a refunding scenario.
   */
  analyzeRefunding(
    scenario: RefundingScenario,
    instruments: DebtInstrument[],
    schedules: Map<string, DebtServiceSchedule[]>
  ): RefundingResult {
    const params = scenario.params;
    const warnings: string[] = [];

    // Calculate refunded principal
    const refundedPrincipal = instruments.reduce(
      (sum, inst) => sum + (inst.outstandingPrincipal || inst.parAmount),
      0
    );

    // Calculate remaining old debt service
    let oldDebtService = 0;
    for (const instrument of instruments) {
      const schedule = schedules.get(instrument.id) || [];
      const remainingPayments = schedule.filter(
        (p) => new Date(p.paymentDate) > params.refundingDate && !p.isPaid
      );
      oldDebtService += remainingPayments.reduce(
        (sum, p) => sum + p.totalPayment,
        0
      );
    }

    // Calculate escrow requirement for advance refunding
    let escrowDeposit = 0;
    if (params.refundingType === 'ADVANCE') {
      // Need to escrow enough to pay off old bonds at call date
      for (const instrument of instruments) {
        if (instrument.callDate) {
          const schedule = schedules.get(instrument.id) || [];
          const paymentsToCall = schedule.filter(
            (p) =>
              new Date(p.paymentDate) > params.refundingDate &&
              new Date(p.paymentDate) <= instrument.callDate
          );
          const dsToCall = paymentsToCall.reduce(
            (sum, p) => sum + p.totalPayment,
            0
          );
          const redemptionAtCall =
            (instrument.outstandingPrincipal || instrument.parAmount) *
            (1 + (instrument.callPremium || 0));
          escrowDeposit += dsToCall + redemptionAtCall;
        }
      }
      // Discount escrow by yield
      if (params.escrowYield) {
        // Simplified - in practice would need to match cash flows
        escrowDeposit = escrowDeposit / (1 + params.escrowYield);
      }
    }

    // Calculate issuance costs
    let issuanceCosts = 0;
    if (params.issuanceCosts) {
      issuanceCosts =
        params.issuanceCosts.type === 'PERCENTAGE'
          ? refundedPrincipal * params.issuanceCosts.value
          : params.issuanceCosts.value;
    }

    // New issue size
    const newIssueSize = refundedPrincipal + escrowDeposit + issuanceCosts;

    // Generate new debt schedule
    const newDebtParams: NewIssuanceParams = {
      projectName: 'Refunding Bonds',
      principalAmount: newIssueSize,
      issueDate: params.refundingDate,
      type: 'GENERAL_OBLIGATION',
      assumedInterestRate: params.newDebtParams.assumedInterestRate,
      termYears: params.newDebtParams.termYears,
      amortizationType: params.newDebtParams.amortizationType,
      paymentFrequency: params.newDebtParams.paymentFrequency,
    };

    const newSchedule = this.generateAmortizationSchedule(newDebtParams);
    const newDebtService = newSchedule.reduce(
      (sum, p) => sum + p.totalPayment,
      0
    );

    // Calculate savings
    const grossSavings = oldDebtService - newDebtService;

    // NPV calculation
    const discountRate = params.newDebtParams.assumedInterestRate;

    // NPV of old debt service
    let npvOldDS = 0;
    for (const instrument of instruments) {
      const schedule = schedules.get(instrument.id) || [];
      const remainingPayments = schedule.filter(
        (p) => new Date(p.paymentDate) > params.refundingDate && !p.isPaid
      );
      for (const payment of remainingPayments) {
        const years =
          this.daysBetween(params.refundingDate, new Date(payment.paymentDate)) / 365;
        npvOldDS += payment.totalPayment / Math.pow(1 + discountRate, years);
      }
    }

    // NPV of new debt service
    let npvNewDS = 0;
    for (const payment of newSchedule) {
      const years =
        this.daysBetween(params.refundingDate, payment.paymentDate) / 365;
      npvNewDS += payment.totalPayment / Math.pow(1 + discountRate, years);
    }

    const npvSavings = npvOldDS - npvNewDS - issuanceCosts;
    const npvSavingsPercent = (npvSavings / refundedPrincipal) * 100;

    // Check arbitrage (for advance refunding)
    let isArbitragePositive = true;
    let negativeArbitrage: number | undefined;
    if (params.refundingType === 'ADVANCE' && params.escrowYield) {
      const bondYield = params.newDebtParams.assumedInterestRate;
      if (params.escrowYield < bondYield) {
        isArbitragePositive = false;
        negativeArbitrage = (bondYield - params.escrowYield) * escrowDeposit;
        warnings.push(
          'Negative arbitrage detected - escrow yield is less than bond yield'
        );
      }
    }

    // Create projected instrument
    const lastPayment = newSchedule[newSchedule.length - 1];
    const projectedInstrument: Omit<DebtInstrument, 'id'> = {
      tenantId: scenario.tenantId,
      name: 'Refunding Bonds',
      type: instruments[0]?.type || 'GENERAL_OBLIGATION',
      purpose: `Refunding of ${instruments.map((i) => i.name).join(', ')}`,
      parAmount: newIssueSize,
      issueDate: params.refundingDate,
      maturityDate: lastPayment.paymentDate,
      interestRate: params.newDebtParams.assumedInterestRate,
      isVariableRate: false,
      amortizationType: params.newDebtParams.amortizationType,
      paymentFrequency: params.newDebtParams.paymentFrequency,
      isCallable: false,
      outstandingPrincipal: newIssueSize,
      isActive: true,
      isRefunded: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // Annual comparison
    const annualComparison = this.generateAnnualComparison(
      instruments,
      schedules,
      newSchedule,
      params.refundingDate
    );

    // Determine recommendation
    const isAdvised =
      npvSavingsPercent >= (params.targetSavingsPercent || 3);

    let recommendation: string;
    if (npvSavingsPercent >= 5) {
      recommendation = 'Strongly advised - excellent savings opportunity';
    } else if (npvSavingsPercent >= 3) {
      recommendation = 'Advised - meets minimum savings threshold';
    } else if (npvSavingsPercent >= 1) {
      recommendation = 'Marginal - monitor rates for better opportunity';
    } else {
      recommendation = 'Not advised - savings insufficient to justify costs';
    }

    return {
      scenarioId: scenario.id,
      refundedInstruments: instruments,
      refundedPrincipal: this.round(refundedPrincipal),
      newIssueSize: this.round(newIssueSize),
      escrowDeposit: this.round(escrowDeposit),
      issuanceCosts: this.round(issuanceCosts),
      oldDebtService: this.round(oldDebtService),
      newDebtService: this.round(newDebtService),
      grossSavings: this.round(grossSavings),
      npvSavings: this.round(npvSavings),
      npvSavingsPercent: this.round(npvSavingsPercent, 4),
      isArbitragePositive,
      negativeArbitrage: negativeArbitrage
        ? this.round(negativeArbitrage)
        : undefined,
      newSchedule,
      projectedInstrument,
      annualComparison,
      isAdvised,
      recommendation,
      warnings,
    };
  }

  /**
   * Calculate debt capacity metrics.
   */
  calculateDebtCapacity(
    instruments: DebtInstrument[],
    schedules: Map<string, DebtServiceSchedule[]>,
    options?: {
      population?: number;
      assessedValue?: number;
      legalDebtLimit?: number;
      revenues?: { source: string; amount: number }[];
    }
  ): DebtCapacityMetrics {
    const now = new Date();
    const currentYear = this.getFiscalYear(now);

    // Total outstanding debt
    const totalOutstandingDebt = instruments
      .filter((i) => i.isActive)
      .reduce((sum, i) => sum + (i.outstandingPrincipal || i.parAmount), 0);

    // Current year debt service
    let currentAnnualDebtService = 0;
    for (const instrument of instruments.filter((i) => i.isActive)) {
      const schedule = schedules.get(instrument.id) || [];
      const currentYearPayments = schedule.filter(
        (p) => this.getFiscalYear(new Date(p.paymentDate)) === currentYear
      );
      currentAnnualDebtService += currentYearPayments.reduce(
        (sum, p) => sum + p.totalPayment,
        0
      );
    }

    // Coverage ratios
    const coverageRatios: DebtCoverageRatio[] = [];
    if (options?.revenues) {
      for (const rev of options.revenues) {
        const ratio = rev.amount / currentAnnualDebtService;
        let status: 'ADEQUATE' | 'MARGINAL' | 'INSUFFICIENT';
        if (ratio >= 1.5) {
          status = 'ADEQUATE';
        } else if (ratio >= 1.1) {
          status = 'MARGINAL';
        } else {
          status = 'INSUFFICIENT';
        }

        coverageRatios.push({
          source: rev.source,
          netRevenue: rev.amount,
          debtService: currentAnnualDebtService,
          coverageRatio: this.round(ratio, 2),
          requiredCoverage: 1.25,
          status,
        });
      }
    }

    // Per capita and AV ratios
    const debtPerCapita = options?.population
      ? totalOutstandingDebt / options.population
      : undefined;

    const debtToAssessedValue = options?.assessedValue
      ? (totalOutstandingDebt / options.assessedValue) * 100
      : undefined;

    // Remaining capacity
    const remainingCapacity = options?.legalDebtLimit
      ? options.legalDebtLimit - totalOutstandingDebt
      : undefined;

    // Projected debt service
    const projectedDebtService = this.projectDebtService(
      instruments,
      schedules,
      10
    ).map((proj) => ({
      year: proj.fiscalYear,
      debtService: proj.totalDebtService,
      maturingDebt: proj.maturing.reduce(
        (sum, i) => sum + (i.outstandingPrincipal || i.parAmount),
        0
      ),
    }));

    // Stress indicators
    const stressIndicators: DebtCapacityMetrics['stressIndicators'] = [];

    if (debtPerCapita !== undefined) {
      stressIndicators.push({
        indicator: 'Debt Per Capita',
        value: debtPerCapita,
        threshold: 2000,
        status: debtPerCapita < 1000 ? 'GOOD' : debtPerCapita < 2000 ? 'CAUTION' : 'WARNING',
      });
    }

    if (debtToAssessedValue !== undefined) {
      stressIndicators.push({
        indicator: 'Debt to Assessed Value',
        value: debtToAssessedValue,
        threshold: 5,
        status: debtToAssessedValue < 2 ? 'GOOD' : debtToAssessedValue < 5 ? 'CAUTION' : 'WARNING',
      });
    }

    if (options?.legalDebtLimit) {
      const utilizationPercent =
        (totalOutstandingDebt / options.legalDebtLimit) * 100;
      stressIndicators.push({
        indicator: 'Debt Limit Utilization',
        value: utilizationPercent,
        threshold: 90,
        status: utilizationPercent < 50 ? 'GOOD' : utilizationPercent < 90 ? 'CAUTION' : 'WARNING',
      });
    }

    return {
      asOfDate: now,
      totalOutstandingDebt: this.round(totalOutstandingDebt),
      currentAnnualDebtService: this.round(currentAnnualDebtService),
      coverageRatios,
      debtPerCapita: debtPerCapita ? this.round(debtPerCapita) : undefined,
      debtToAssessedValue: debtToAssessedValue
        ? this.round(debtToAssessedValue, 2)
        : undefined,
      legalDebtLimit: options?.legalDebtLimit,
      remainingCapacity: remainingCapacity
        ? this.round(remainingCapacity)
        : undefined,
      projectedDebtService,
      stressIndicators,
    };
  }

  /**
   * Project debt service forward.
   */
  projectDebtService(
    instruments: DebtInstrument[],
    schedules: Map<string, DebtServiceSchedule[]>,
    years: number
  ): AnnualDebtProjection[] {
    const currentYear = this.getFiscalYear(new Date());
    const projections: AnnualDebtProjection[] = [];

    for (let year = currentYear; year < currentYear + years; year++) {
      let totalPrincipal = 0;
      let totalInterest = 0;
      const maturing: DebtInstrument[] = [];
      const newIssues: DebtInstrument[] = [];

      for (const instrument of instruments.filter((i) => i.isActive)) {
        const schedule = schedules.get(instrument.id) || [];
        const yearPayments = schedule.filter(
          (p) => this.getFiscalYear(new Date(p.paymentDate)) === year
        );

        totalPrincipal += yearPayments.reduce(
          (sum, p) => sum + p.principalAmount,
          0
        );
        totalInterest += yearPayments.reduce(
          (sum, p) => sum + p.interestAmount,
          0
        );

        // Check if maturing this year
        const maturityYear = this.getFiscalYear(instrument.maturityDate);
        if (maturityYear === year) {
          maturing.push(instrument);
        }

        // Check if issued this year
        const issueYear = this.getFiscalYear(instrument.issueDate);
        if (issueYear === year) {
          newIssues.push(instrument);
        }
      }

      projections.push({
        fiscalYear: year,
        totalPrincipal: this.round(totalPrincipal),
        totalInterest: this.round(totalInterest),
        totalDebtService: this.round(totalPrincipal + totalInterest),
        maturing,
        newIssues,
      });
    }

    return projections;
  }

  /**
   * Validate a debt scenario.
   */
  validateScenario(scenario: DebtScenario): {
    isValid: boolean;
    errors: string[];
    warnings: string[];
  } {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!scenario.id) errors.push('Scenario ID is required');
    if (!scenario.tenantId) errors.push('Tenant ID is required');
    if (!scenario.name) errors.push('Scenario name is required');

    switch (scenario.type) {
      case 'NEW_ISSUANCE': {
        const validation = this.validateNewIssuanceParams(scenario.params);
        errors.push(...validation.errors);
        warnings.push(...validation.warnings);
        break;
      }

      case 'EARLY_PAYOFF': {
        if (!scenario.params.instrumentId) {
          errors.push('Instrument ID is required for early payoff');
        }
        if (!scenario.params.payoffDate) {
          errors.push('Payoff date is required');
        }
        break;
      }

      case 'REFUNDING': {
        if (!scenario.params.instrumentIds?.length) {
          errors.push('At least one instrument must be selected for refunding');
        }
        if (!scenario.params.refundingDate) {
          errors.push('Refunding date is required');
        }
        if (!scenario.params.newDebtParams) {
          errors.push('New debt parameters are required');
        }
        break;
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

  private validateNewIssuanceParams(params: NewIssuanceParams): {
    isValid: boolean;
    errors: string[];
    warnings: string[];
  } {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!params.projectName) errors.push('Project name is required');
    if (!params.principalAmount || params.principalAmount <= 0) {
      errors.push('Principal amount must be positive');
    }
    if (!params.issueDate) errors.push('Issue date is required');
    if (!params.termYears || params.termYears <= 0) {
      errors.push('Term must be positive');
    }
    if (params.assumedInterestRate < 0) {
      errors.push('Interest rate cannot be negative');
    }
    if (params.assumedInterestRate > 0.15) {
      warnings.push('Interest rate above 15% is unusually high');
    }
    if (params.termYears > 30) {
      warnings.push('Term exceeds 30 years - consider if appropriate');
    }

    return { isValid: errors.length === 0, errors, warnings };
  }

  private calculateLevelPayment(
    principal: number,
    periodicRate: number,
    periods: number
  ): number {
    if (periodicRate === 0) {
      return principal / periods;
    }
    const factor = Math.pow(1 + periodicRate, periods);
    return (principal * periodicRate * factor) / (factor - 1);
  }

  private calculateTIC(
    proceeds: number,
    schedule: AmortizationEntry[]
  ): number {
    // Simplified TIC calculation using Newton-Raphson method
    let rate = 0.05; // Initial guess
    const tolerance = 0.0000001;
    const maxIterations = 100;

    for (let i = 0; i < maxIterations; i++) {
      let npv = -proceeds;
      let npvDerivative = 0;

      for (const payment of schedule) {
        const years =
          this.daysBetween(schedule[0].paymentDate, payment.paymentDate) / 365;
        const discountFactor = Math.pow(1 + rate, years);
        npv += payment.totalPayment / discountFactor;
        npvDerivative -= (years * payment.totalPayment) / (discountFactor * (1 + rate));
      }

      const newRate = rate - npv / npvDerivative;

      if (Math.abs(newRate - rate) < tolerance) {
        return newRate;
      }

      rate = newRate;
    }

    return rate;
  }

  private calculateAnnualDebtService(
    schedule: AmortizationEntry[]
  ): { year: number; principal: number; interest: number; total: number }[] {
    const byYear = new Map<
      number,
      { principal: number; interest: number; total: number }
    >();

    for (const payment of schedule) {
      const year = payment.fiscalYear;
      const existing = byYear.get(year) || {
        principal: 0,
        interest: 0,
        total: 0,
      };
      existing.principal += payment.principal;
      existing.interest += payment.interest;
      existing.total += payment.totalPayment;
      byYear.set(year, existing);
    }

    return Array.from(byYear.entries())
      .map(([year, values]) => ({
        year,
        principal: this.round(values.principal),
        interest: this.round(values.interest),
        total: this.round(values.total),
      }))
      .sort((a, b) => a.year - b.year);
  }

  private calculateAnnualSavings(
    remainingPayments: DebtServiceSchedule[]
  ): { year: number; amount: number }[] {
    const byYear = new Map<number, number>();

    for (const payment of remainingPayments) {
      const year = payment.fiscalYear;
      const existing = byYear.get(year) || 0;
      byYear.set(year, existing + payment.totalPayment);
    }

    return Array.from(byYear.entries())
      .map(([year, amount]) => ({ year, amount: this.round(amount) }))
      .sort((a, b) => a.year - b.year);
  }

  private generateAnnualProjections(
    newSchedule: AmortizationEntry[],
    existingInstruments: DebtInstrument[]
  ): AnnualDebtProjection[] {
    const annualDS = this.calculateAnnualDebtService(newSchedule);

    return annualDS.map(({ year, principal, interest, total }) => ({
      fiscalYear: year,
      totalPrincipal: principal,
      totalInterest: interest,
      totalDebtService: total,
      maturing: [],
      newIssues: [],
    }));
  }

  private generateAnnualComparison(
    oldInstruments: DebtInstrument[],
    oldSchedules: Map<string, DebtServiceSchedule[]>,
    newSchedule: AmortizationEntry[],
    refundingDate: Date
  ): { year: number; oldDS: number; newDS: number; savings: number }[] {
    const comparison: Map<
      number,
      { oldDS: number; newDS: number }
    > = new Map();

    // Old debt service by year
    for (const instrument of oldInstruments) {
      const schedule = oldSchedules.get(instrument.id) || [];
      for (const payment of schedule) {
        if (new Date(payment.paymentDate) > refundingDate) {
          const year = payment.fiscalYear;
          const existing = comparison.get(year) || { oldDS: 0, newDS: 0 };
          existing.oldDS += payment.totalPayment;
          comparison.set(year, existing);
        }
      }
    }

    // New debt service by year
    for (const payment of newSchedule) {
      const year = payment.fiscalYear;
      const existing = comparison.get(year) || { oldDS: 0, newDS: 0 };
      existing.newDS += payment.totalPayment;
      comparison.set(year, existing);
    }

    return Array.from(comparison.entries())
      .map(([year, { oldDS, newDS }]) => ({
        year,
        oldDS: this.round(oldDS),
        newDS: this.round(newDS),
        savings: this.round(oldDS - newDS),
      }))
      .sort((a, b) => a.year - b.year);
  }

  private getPeriodsPerYear(
    frequency: 'MONTHLY' | 'QUARTERLY' | 'SEMI_ANNUAL' | 'ANNUAL'
  ): number {
    switch (frequency) {
      case 'MONTHLY':
        return 12;
      case 'QUARTERLY':
        return 4;
      case 'SEMI_ANNUAL':
        return 2;
      case 'ANNUAL':
        return 1;
    }
  }

  private advancePaymentDate(
    date: Date,
    frequency: 'MONTHLY' | 'QUARTERLY' | 'SEMI_ANNUAL' | 'ANNUAL'
  ): void {
    switch (frequency) {
      case 'MONTHLY':
        date.setMonth(date.getMonth() + 1);
        break;
      case 'QUARTERLY':
        date.setMonth(date.getMonth() + 3);
        break;
      case 'SEMI_ANNUAL':
        date.setMonth(date.getMonth() + 6);
        break;
      case 'ANNUAL':
        date.setFullYear(date.getFullYear() + 1);
        break;
    }
  }

  private getFiscalYear(date: Date): number {
    // Indiana fiscal year is calendar year
    // Most governments use July 1 - June 30
    // For now, using calendar year
    return date.getFullYear();
  }

  private daysBetween(start: Date, end: Date): number {
    const msPerDay = 1000 * 60 * 60 * 24;
    return Math.floor((end.getTime() - start.getTime()) / msPerDay);
  }

  private round(value: number, decimals = 2): number {
    const factor = Math.pow(10, decimals);
    return Math.round(value * factor) / factor;
  }
}

// ============================================================================
// FACTORY FUNCTION
// ============================================================================

/**
 * Create a new debt scenario engine instance.
 */
export function createDebtScenarioEngine(): DebtScenarioEngine {
  return new DefaultDebtScenarioEngine();
}
