// src/core/finance/reports/report.generator.ts

/**
 * Town-in-a-Box Finance Engine - Report Generator
 *
 * Generates financial reports from repository data.
 */

import {
  ReportGenerator,
  ReportMetadata,
  ReportPeriod,
  ReportFormat,
  ReportOptions,
  TrialBalanceReport,
  TrialBalanceOptions,
  FundSummaryReport,
  FundSummaryLine,
  BudgetVsActualReport,
  BudgetVsActualOptions,
  BudgetVsActualLine,
  RevenueSummaryReport,
  RevenueSummaryLine,
  ExpenditureSummaryReport,
  ExpenditureSummaryLine,
  TransactionRegisterReport,
  TransactionRegisterOptions,
  TransactionRegisterLine,
  DebtScheduleReport,
  FundBalanceStatementReport,
  FundBalanceClassificationLine,
} from './report.types';

import { FinanceRepository } from '../finance.repository';
import { Fund, Account, Transaction, BudgetLine, FundType } from '../finance.types';

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Generate a unique report ID.
 */
function generateReportId(reportType: string): string {
  return `${reportType}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Create report metadata.
 */
function createMetadata(
  reportType: ReportMetadata['reportType'],
  title: string,
  options: ReportOptions,
  tenantName: string = 'Unknown'
): ReportMetadata {
  return {
    reportId: generateReportId(reportType),
    reportType,
    title,
    tenantId: options.tenantId,
    tenantName,
    period: options.period,
    generatedAt: new Date(),
    parameters: {
      fundIds: options.fundIds,
      includeInactiveFunds: options.includeInactiveFunds,
      includeZeroBalances: options.includeZeroBalances,
    },
  };
}

/**
 * Round to 2 decimal places.
 */
function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Calculate percentage safely.
 */
function calcPercent(part: number, whole: number): number {
  if (whole === 0) return 0;
  return round2((part / whole) * 100);
}

// ============================================================================
// DEFAULT REPORT GENERATOR
// ============================================================================

/**
 * Default report generator implementation.
 */
export class DefaultReportGenerator implements ReportGenerator {
  constructor(private readonly repository: FinanceRepository) {}

  /**
   * Generate a trial balance report.
   */
  async generateTrialBalance(options: TrialBalanceOptions): Promise<TrialBalanceReport> {
    const { tenantId, fundIds, asOfDate, includeZeroBalances } = options;

    // Get funds
    const fundsResult = await this.repository.listFunds({
      tenantId,
      codes: fundIds,
      activeOnly: !options.includeInactiveFunds,
    });
    const funds = Array.isArray(fundsResult) ? fundsResult : fundsResult.items;

    // Get accounts for each fund
    const lines: TrialBalanceReport['lines'] = [];
    let totalDebits = 0;
    let totalCredits = 0;

    for (const fund of funds) {
      const accounts = await this.repository.listAccountsForFund(fund.id);

      for (const account of accounts) {
        // Get transactions up to asOfDate
        const txResult = await this.repository.listTransactions({
          tenantId,
          fundId: fund.id,
          accountId: account.id,
          toDate: asOfDate,
          includeVoided: false,
        });
        const transactions = Array.isArray(txResult) ? txResult : txResult.items;

        // Calculate balance
        let balance = 0;
        for (const tx of transactions) {
          if (tx.type === 'RECEIPT') {
            balance += tx.amount;
          } else if (tx.type === 'DISBURSEMENT') {
            balance -= tx.amount;
          } else if (tx.type === 'TRANSFER') {
            balance += tx.amount;
          } else if (tx.type === 'ADJUSTMENT') {
            balance += tx.amount;
          }
        }

        // Skip zero balances if not included
        if (!includeZeroBalances && balance === 0) continue;

        // Determine debit/credit based on account type and balance
        const isDebitNormal = ['ASSET', 'EXPENDITURE', 'EXPENSE'].includes(account.type);
        const debit = isDebitNormal ? Math.max(0, balance) : Math.max(0, -balance);
        const credit = isDebitNormal ? Math.max(0, -balance) : Math.max(0, balance);

        totalDebits += debit;
        totalCredits += credit;

        lines.push({
          account: {
            id: account.id,
            code: account.code,
            name: account.name,
            type: account.type,
            level: account.level,
          },
          fund: {
            id: fund.id,
            code: fund.code,
            name: fund.name,
          },
          debit: round2(debit),
          credit: round2(credit),
          balance: round2(balance),
        });
      }
    }

    return {
      metadata: createMetadata('TRIAL_BALANCE', 'Trial Balance', options),
      lines,
      totals: {
        totalDebits: round2(totalDebits),
        totalCredits: round2(totalCredits),
        difference: round2(totalDebits - totalCredits),
        isBalanced: Math.abs(totalDebits - totalCredits) < 0.01,
      },
    };
  }

  /**
   * Generate a fund summary report.
   */
  async generateFundSummary(options: ReportOptions): Promise<FundSummaryReport> {
    const { tenantId, fundIds, period } = options;

    // Get funds
    const fundsResult = await this.repository.listFunds({
      tenantId,
      codes: fundIds,
      activeOnly: !options.includeInactiveFunds,
    });
    const funds = Array.isArray(fundsResult) ? fundsResult : fundsResult.items;

    const fundLines: FundSummaryLine[] = [];

    let totalBeginning = 0;
    let totalReceipts = 0;
    let totalDisbursements = 0;
    let totalTransfersIn = 0;
    let totalTransfersOut = 0;

    for (const fund of funds) {
      const summary = await this.repository.getFundSummary(
        fund.id,
        period.startDate,
        period.endDate
      );

      if (!summary) continue;

      // Categorize receipts and disbursements
      const txResult = await this.repository.listTransactions({
        tenantId,
        fundId: fund.id,
        fromDate: period.startDate,
        toDate: period.endDate,
        includeVoided: false,
      });
      const transactions = Array.isArray(txResult) ? txResult : txResult.items;

      const receipts = {
        propertyTax: 0,
        intergovernmental: 0,
        chargesForServices: 0,
        other: 0,
        total: summary.totalReceipts,
      };

      const disbursements = {
        personalServices: 0,
        supplies: 0,
        services: 0,
        capital: 0,
        debtService: 0,
        other: 0,
        total: summary.totalDisbursements,
      };

      let transfersIn = 0;
      let transfersOut = 0;

      for (const tx of transactions) {
        if (tx.type === 'TRANSFER') {
          if (tx.amount >= 0) {
            transfersIn += tx.amount;
          } else {
            transfersOut += Math.abs(tx.amount);
          }
        }
      }

      totalBeginning += summary.beginningBalance;
      totalReceipts += summary.totalReceipts;
      totalDisbursements += summary.totalDisbursements;
      totalTransfersIn += transfersIn;
      totalTransfersOut += transfersOut;

      fundLines.push({
        fund: {
          id: fund.id,
          code: fund.code,
          name: fund.name,
          type: fund.type,
          category: fund.category,
          isRestricted: fund.isRestricted,
        },
        beginningBalance: round2(summary.beginningBalance),
        receipts,
        disbursements,
        transfersIn: round2(transfersIn),
        transfersOut: round2(transfersOut),
        netChange: round2(summary.netChange),
        endingBalance: round2(summary.endingBalance),
      });
    }

    // Group by type
    const governmental = fundLines.filter((f) => f.fund.type === 'GOVERNMENTAL');
    const proprietary = fundLines.filter((f) => f.fund.type === 'PROPRIETARY');
    const fiduciary = fundLines.filter((f) => f.fund.type === 'FIDUCIARY');

    const totalNetChange = totalReceipts - totalDisbursements + totalTransfersIn - totalTransfersOut;

    return {
      metadata: createMetadata('FUND_SUMMARY', 'Fund Summary Report', options),
      funds: fundLines,
      totals: {
        totalBeginningBalance: round2(totalBeginning),
        totalReceipts: round2(totalReceipts),
        totalDisbursements: round2(totalDisbursements),
        totalTransfersIn: round2(totalTransfersIn),
        totalTransfersOut: round2(totalTransfersOut),
        totalNetChange: round2(totalNetChange),
        totalEndingBalance: round2(totalBeginning + totalNetChange),
      },
      byType: {
        governmental,
        proprietary,
        fiduciary,
      },
    };
  }

  /**
   * Generate a budget vs actual report.
   */
  async generateBudgetVsActual(options: BudgetVsActualOptions): Promise<BudgetVsActualReport> {
    const { tenantId, fundIds, fiscalYear, period, includeEncumbrances } = options;

    // Get budget lines for the year
    const budgetLines = await this.repository.listBudgetLinesForYear(tenantId, fiscalYear);

    // Filter by funds if specified
    const filteredBudget = fundIds?.length
      ? budgetLines.filter((b) => fundIds.includes(b.fundId))
      : budgetLines;

    // Get funds for lookup
    const fundsResult = await this.repository.listFunds({ tenantId });
    const funds = Array.isArray(fundsResult) ? fundsResult : fundsResult.items;
    const fundMap = new Map(funds.map((f) => [f.id, f]));

    const lines: BudgetVsActualLine[] = [];
    let totalRevenueBudget = 0;
    let totalRevenueActual = 0;
    let totalExpBudget = 0;
    let totalExpActual = 0;
    let totalEncumbered = 0;

    for (const budget of filteredBudget) {
      const fund = fundMap.get(budget.fundId);
      if (!fund) continue;

      // Get actual transactions
      const txResult = await this.repository.listTransactions({
        tenantId,
        fundId: budget.fundId,
        accountId: budget.accountId,
        fromDate: period.startDate,
        toDate: period.endDate,
        includeVoided: false,
      });
      const transactions = Array.isArray(txResult) ? txResult : txResult.items;

      let actual = 0;
      for (const tx of transactions) {
        if (budget.lineType === 'REVENUE' && tx.type === 'RECEIPT') {
          actual += tx.amount;
        } else if (budget.lineType === 'APPROPRIATION' && tx.type === 'DISBURSEMENT') {
          actual += tx.amount;
        }
      }

      const adopted = budget.adoptedAmount;
      const amended = budget.amendedAmount ?? budget.adoptedAmount;
      const encumbered = budget.encumberedAmount ?? 0;
      const available = amended - actual - encumbered;
      const variance = amended - actual;

      if (budget.lineType === 'REVENUE') {
        totalRevenueBudget += amended;
        totalRevenueActual += actual;
      } else {
        totalExpBudget += amended;
        totalExpActual += actual;
        totalEncumbered += encumbered;
      }

      lines.push({
        fund: {
          id: fund.id,
          code: fund.code,
          name: fund.name,
        },
        category: budget.category,
        lineType: budget.lineType ?? 'APPROPRIATION',
        adopted: round2(adopted),
        amended: round2(amended),
        actual: round2(actual),
        encumbered: round2(encumbered),
        available: round2(available),
        percentUsed: calcPercent(actual, amended),
        variance: round2(variance),
        variancePercent: calcPercent(variance, amended),
      });
    }

    return {
      metadata: createMetadata('BUDGET_VS_ACTUAL', `Budget vs Actual - FY ${fiscalYear}`, options),
      fiscalYear,
      lines,
      summary: {
        revenue: {
          budgeted: round2(totalRevenueBudget),
          actual: round2(totalRevenueActual),
          variance: round2(totalRevenueBudget - totalRevenueActual),
          percentCollected: calcPercent(totalRevenueActual, totalRevenueBudget),
        },
        expenditure: {
          budgeted: round2(totalExpBudget),
          actual: round2(totalExpActual),
          encumbered: round2(totalEncumbered),
          available: round2(totalExpBudget - totalExpActual - totalEncumbered),
          percentUsed: calcPercent(totalExpActual, totalExpBudget),
        },
        netPosition: {
          budgeted: round2(totalRevenueBudget - totalExpBudget),
          actual: round2(totalRevenueActual - totalExpActual),
          variance: round2(
            (totalRevenueActual - totalExpActual) -
            (totalRevenueBudget - totalExpBudget)
          ),
        },
      },
    };
  }

  /**
   * Generate a revenue summary report.
   */
  async generateRevenueSummary(options: ReportOptions): Promise<RevenueSummaryReport> {
    const { tenantId, fundIds, period } = options;

    // Get receipts for the period
    const txResult = await this.repository.listTransactions({
      tenantId,
      fundIds,
      types: ['RECEIPT'],
      fromDate: period.startDate,
      toDate: period.endDate,
      includeVoided: false,
    });
    const transactions = Array.isArray(txResult) ? txResult : txResult.items;

    // Group by category (simplified - would use account codes in real impl)
    const categoryMap = new Map<string, RevenueSummaryLine>();
    let totalReceived = 0;

    for (const tx of transactions) {
      const category = 'other'; // Would derive from account code
      const existing = categoryMap.get(category) ?? {
        category,
        categoryName: 'Other Revenue',
        budgeted: 0,
        received: 0,
        variance: 0,
        percentCollected: 0,
      };

      existing.received += tx.amount;
      categoryMap.set(category, existing);
      totalReceived += tx.amount;
    }

    const lines = Array.from(categoryMap.values());

    // Calculate percentages
    for (const line of lines) {
      line.received = round2(line.received);
      line.variance = round2(line.budgeted - line.received);
      line.percentCollected = calcPercent(line.received, line.budgeted || line.received);
    }

    return {
      metadata: createMetadata('REVENUE_SUMMARY', 'Revenue Summary', options),
      lines,
      total: {
        budgeted: 0, // Would sum from budget
        received: round2(totalReceived),
        variance: 0,
        percentCollected: 0,
      },
    };
  }

  /**
   * Generate an expenditure summary report.
   */
  async generateExpenditureSummary(options: ReportOptions): Promise<ExpenditureSummaryReport> {
    const { tenantId, fundIds, period } = options;

    // Get disbursements for the period
    const txResult = await this.repository.listTransactions({
      tenantId,
      fundIds,
      types: ['DISBURSEMENT'],
      fromDate: period.startDate,
      toDate: period.endDate,
      includeVoided: false,
    });
    const transactions = Array.isArray(txResult) ? txResult : txResult.items;

    // Group by category
    const categoryMap = new Map<string, ExpenditureSummaryLine>();
    let totalExpended = 0;

    for (const tx of transactions) {
      const category = 'other';
      const existing = categoryMap.get(category) ?? {
        category,
        categoryName: 'Other Expenditures',
        budgeted: 0,
        expended: 0,
        encumbered: 0,
        available: 0,
        percentUsed: 0,
      };

      existing.expended += tx.amount;
      categoryMap.set(category, existing);
      totalExpended += tx.amount;
    }

    const lines = Array.from(categoryMap.values());

    // Calculate percentages
    for (const line of lines) {
      line.expended = round2(line.expended);
      line.available = round2(line.budgeted - line.expended - line.encumbered);
      line.percentUsed = calcPercent(line.expended, line.budgeted || line.expended);
    }

    return {
      metadata: createMetadata('EXPENDITURE_SUMMARY', 'Expenditure Summary', options),
      lines,
      total: {
        budgeted: 0,
        expended: round2(totalExpended),
        encumbered: 0,
        available: 0,
        percentUsed: 0,
      },
    };
  }

  /**
   * Generate a transaction register report.
   */
  async generateTransactionRegister(
    options: TransactionRegisterOptions
  ): Promise<TransactionRegisterReport> {
    const { tenantId, fundIds, period, transactionTypes, statuses, vendorId, showRunningBalance } = options;

    // Get transactions
    const txResult = await this.repository.listTransactions({
      tenantId,
      fundIds,
      types: transactionTypes,
      statuses,
      vendorId,
      fromDate: period.startDate,
      toDate: period.endDate,
      includeVoided: true,
    });
    const transactions = Array.isArray(txResult) ? txResult : txResult.items;

    // Get funds for lookup
    const fundsResult = await this.repository.listFunds({ tenantId });
    const funds = Array.isArray(fundsResult) ? fundsResult : fundsResult.items;
    const fundMap = new Map(funds.map((f) => [f.id, f]));

    // Get vendors for lookup
    const vendorsResult = await this.repository.listVendors({ tenantId });
    const vendors = Array.isArray(vendorsResult) ? vendorsResult : vendorsResult.items;
    const vendorMap = new Map(vendors.map((v) => [v.id, v]));

    const lines: TransactionRegisterLine[] = [];
    let totalReceipts = 0;
    let totalDisbursements = 0;
    let totalTransfers = 0;
    let totalAdjustments = 0;
    let runningBalance = 0;

    // Sort by date
    const sortedTx = [...transactions].sort(
      (a, b) => new Date(a.transactionDate).getTime() - new Date(b.transactionDate).getTime()
    );

    for (const tx of sortedTx) {
      const fund = fundMap.get(tx.fundId);
      const vendor = tx.vendorId ? vendorMap.get(tx.vendorId) : undefined;

      // Update running balance
      if (tx.status !== 'VOIDED') {
        if (tx.type === 'RECEIPT') {
          runningBalance += tx.amount;
          totalReceipts += tx.amount;
        } else if (tx.type === 'DISBURSEMENT') {
          runningBalance -= tx.amount;
          totalDisbursements += tx.amount;
        } else if (tx.type === 'TRANSFER') {
          runningBalance += tx.amount;
          totalTransfers += Math.abs(tx.amount);
        } else {
          runningBalance += tx.amount;
          totalAdjustments += tx.amount;
        }
      }

      lines.push({
        transaction: {
          id: tx.id,
          date: tx.transactionDate,
          type: tx.type,
          status: tx.status,
          checkNumber: tx.checkNumber,
          receiptNumber: tx.receiptNumber,
          externalRef: tx.externalRef,
        },
        fund: {
          code: fund?.code ?? '',
          name: fund?.name ?? 'Unknown',
        },
        vendor: vendor
          ? {
              id: vendor.id,
              name: vendor.name,
            }
          : undefined,
        description: tx.description,
        amount: round2(tx.amount),
        runningBalance: showRunningBalance ? round2(runningBalance) : undefined,
      });
    }

    return {
      metadata: createMetadata('TRANSACTION_REGISTER', 'Transaction Register', options),
      transactions: lines,
      summary: {
        transactionCount: lines.length,
        totalReceipts: round2(totalReceipts),
        totalDisbursements: round2(totalDisbursements),
        totalTransfers: round2(totalTransfers),
        totalAdjustments: round2(totalAdjustments),
        netChange: round2(totalReceipts - totalDisbursements + totalTransfers + totalAdjustments),
      },
    };
  }

  /**
   * Generate a debt schedule report.
   */
  async generateDebtSchedule(options: ReportOptions): Promise<DebtScheduleReport> {
    const { tenantId } = options;

    // Get debt instruments
    const debtResult = await this.repository.listDebtInstruments({
      tenantId,
      activeOnly: !options.includeInactiveFunds,
    });
    const instruments = Array.isArray(debtResult) ? debtResult : debtResult.items;

    const instrumentReports = [];
    let totalOutstanding = 0;
    let currentYearPrincipal = 0;
    let currentYearInterest = 0;
    let totalFutureDebtService = 0;

    const currentYear = options.period.fiscalYear;

    for (const inst of instruments) {
      const schedule = await this.repository.getDebtServiceSchedule(inst.id);
      const scheduleLines = schedule.map((s) => ({
        instrument: {
          id: inst.id,
          name: inst.name,
          type: inst.type,
          issueDate: inst.issueDate,
          maturityDate: inst.maturityDate,
          originalAmount: inst.parAmount,
          interestRate: inst.interestRate,
        },
        fiscalYear: s.fiscalYear,
        principalDue: s.principalAmount,
        interestDue: s.interestAmount,
        totalDue: s.totalPayment,
        principalPaid: s.isPaid ? s.principalAmount : 0,
        interestPaid: s.isPaid ? s.interestAmount : 0,
        totalPaid: s.isPaid ? s.totalPayment : 0,
        outstandingPrincipal: s.remainingPrincipal ?? 0,
      }));

      totalOutstanding += inst.outstandingPrincipal ?? 0;

      // Sum current year
      const currentYearPayments = scheduleLines.filter((s) => s.fiscalYear === currentYear);
      for (const p of currentYearPayments) {
        currentYearPrincipal += p.principalDue;
        currentYearInterest += p.interestDue;
      }

      // Sum future debt service
      const futurePayments = scheduleLines.filter((s) => s.fiscalYear >= currentYear);
      for (const p of futurePayments) {
        totalFutureDebtService += p.totalDue;
      }

      instrumentReports.push({
        id: inst.id,
        name: inst.name,
        type: inst.type,
        issueDate: inst.issueDate,
        maturityDate: inst.maturityDate,
        originalAmount: inst.parAmount,
        outstandingPrincipal: inst.outstandingPrincipal ?? 0,
        interestRate: inst.interestRate,
        schedule: scheduleLines,
      });
    }

    return {
      metadata: createMetadata('DEBT_SCHEDULE', 'Debt Schedule', options),
      instruments: instrumentReports,
      summary: {
        totalOutstandingPrincipal: round2(totalOutstanding),
        currentYearPrincipal: round2(currentYearPrincipal),
        currentYearInterest: round2(currentYearInterest),
        currentYearTotal: round2(currentYearPrincipal + currentYearInterest),
        totalFutureDebtService: round2(totalFutureDebtService),
      },
    };
  }

  /**
   * Generate a fund balance statement.
   */
  async generateFundBalanceStatement(
    options: ReportOptions
  ): Promise<FundBalanceStatementReport> {
    const { tenantId, fundIds, period } = options;

    // Get funds
    const fundsResult = await this.repository.listFunds({
      tenantId,
      codes: fundIds,
      activeOnly: !options.includeInactiveFunds,
    });
    const funds = Array.isArray(fundsResult) ? fundsResult : fundsResult.items;

    const classifications: FundBalanceClassificationLine[] = [];
    const totals = {
      nonspendable: 0,
      restricted: 0,
      committed: 0,
      assigned: 0,
      unassigned: 0,
      totalFundBalance: 0,
    };

    for (const fund of funds) {
      // Get GASB 54 classification
      const classification = await this.repository.getFundBalanceClassification(
        fund.id,
        period.fiscalYear
      );

      if (classification) {
        classifications.push({
          fund: {
            id: fund.id,
            code: fund.code,
            name: fund.name,
            type: fund.type,
          },
          nonspendable: round2(classification.nonspendable),
          restricted: round2(classification.restricted),
          committed: round2(classification.committed),
          assigned: round2(classification.assigned),
          unassigned: round2(classification.unassigned),
          totalFundBalance: round2(classification.totalFundBalance),
        });

        totals.nonspendable += classification.nonspendable;
        totals.restricted += classification.restricted;
        totals.committed += classification.committed;
        totals.assigned += classification.assigned;
        totals.unassigned += classification.unassigned;
        totals.totalFundBalance += classification.totalFundBalance;
      } else {
        // Calculate from current balance
        const balance = await this.repository.calculateFundBalance(
          fund.id,
          period.endDate
        );

        // Default classification based on fund type
        const line: FundBalanceClassificationLine = {
          fund: {
            id: fund.id,
            code: fund.code,
            name: fund.name,
            type: fund.type,
          },
          nonspendable: 0,
          restricted: 0,
          committed: 0,
          assigned: 0,
          unassigned: 0,
          totalFundBalance: round2(balance),
        };

        // Classify based on fund characteristics
        if (fund.isRestricted) {
          line.restricted = balance;
          totals.restricted += balance;
        } else if (fund.type === 'GOVERNMENTAL' && fund.code === '101') {
          // General Fund - unassigned
          line.unassigned = balance;
          totals.unassigned += balance;
        } else {
          // Other funds - assigned
          line.assigned = balance;
          totals.assigned += balance;
        }

        totals.totalFundBalance += balance;
        classifications.push(line);
      }
    }

    // Round totals
    totals.nonspendable = round2(totals.nonspendable);
    totals.restricted = round2(totals.restricted);
    totals.committed = round2(totals.committed);
    totals.assigned = round2(totals.assigned);
    totals.unassigned = round2(totals.unassigned);
    totals.totalFundBalance = round2(totals.totalFundBalance);

    return {
      metadata: createMetadata('FUND_BALANCE_STATEMENT', 'Fund Balance Statement', options),
      classifications,
      totals,
    };
  }

  /**
   * Export report to specified format.
   */
  async exportReport<T>(report: T, format: ReportFormat): Promise<Buffer | string> {
    switch (format) {
      case 'JSON':
        return JSON.stringify(report, null, 2);

      case 'CSV':
        return this.exportToCSV(report);

      case 'HTML':
        return this.exportToHTML(report);

      case 'XLSX':
      case 'PDF':
        // Would require additional libraries (xlsx, pdfkit, etc.)
        throw new Error(`Export format ${format} not yet implemented`);

      default:
        throw new Error(`Unknown export format: ${format}`);
    }
  }

  /**
   * Export report to CSV.
   */
  private exportToCSV(report: unknown): string {
    // Simplified CSV export
    const data = report as Record<string, unknown>;
    const lines: string[] = [];

    if (Array.isArray(data['lines'])) {
      const items = data['lines'] as Record<string, unknown>[];
      if (items.length > 0) {
        // Header
        const headers = Object.keys(items[0]).filter((k) => typeof items[0][k] !== 'object');
        lines.push(headers.join(','));

        // Data
        for (const item of items) {
          const values = headers.map((h) => {
            const val = item[h];
            if (val === null || val === undefined) return '';
            if (typeof val === 'string' && val.includes(',')) {
              return `"${val}"`;
            }
            return String(val);
          });
          lines.push(values.join(','));
        }
      }
    }

    return lines.join('\n');
  }

  /**
   * Export report to HTML.
   */
  private exportToHTML(report: unknown): string {
    const data = report as { metadata?: ReportMetadata; [key: string]: unknown };
    const title = data.metadata?.title ?? 'Report';

    let html = `<!DOCTYPE html>
<html>
<head>
  <title>${title}</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 20px; }
    table { border-collapse: collapse; width: 100%; margin: 20px 0; }
    th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
    th { background-color: #f2f2f2; }
    .number { text-align: right; }
    h1 { color: #333; }
    .metadata { color: #666; font-size: 0.9em; }
  </style>
</head>
<body>
  <h1>${title}</h1>`;

    if (data.metadata) {
      html += `
  <div class="metadata">
    <p>Tenant: ${data.metadata.tenantName}</p>
    <p>Period: ${data.metadata.period.startDate.toLocaleDateString()} - ${data.metadata.period.endDate.toLocaleDateString()}</p>
    <p>Generated: ${data.metadata.generatedAt.toLocaleString()}</p>
  </div>`;
    }

    // Render data tables
    if (Array.isArray(data['lines']) || Array.isArray(data['funds']) || Array.isArray(data['transactions'])) {
      const items = (data['lines'] ?? data['funds'] ?? data['transactions']) as Record<string, unknown>[];
      if (items.length > 0) {
        html += '<table>';

        // Header
        const headers = Object.keys(items[0]).filter((k) => typeof items[0][k] !== 'object');
        html += '<tr>' + headers.map((h) => `<th>${h}</th>`).join('') + '</tr>';

        // Data
        for (const item of items) {
          const cells = headers.map((h) => {
            const val = item[h];
            const isNumber = typeof val === 'number';
            return `<td class="${isNumber ? 'number' : ''}">${val ?? ''}</td>`;
          });
          html += '<tr>' + cells.join('') + '</tr>';
        }

        html += '</table>';
      }
    }

    html += '</body></html>';
    return html;
  }
}

/**
 * Create a report generator.
 */
export function createReportGenerator(repository: FinanceRepository): ReportGenerator {
  return new DefaultReportGenerator(repository);
}
