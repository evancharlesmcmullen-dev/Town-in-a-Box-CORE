// src/core/finance/citizen/citizen-portal.service.ts

/**
 * Town-in-a-Box Finance Engine - Citizen Portal Service
 *
 * Implementation of public-facing finance data for citizen transparency.
 */

import {
  CitizenPortalService,
  CitizenDashboard,
  CitizenFundSummary,
  RevenueCategorySummary,
  SpendingCategorySummary,
  QuickFact,
  TaxInformation,
  TaxBreakdownItem,
  BudgetExplorer,
  BudgetCategory,
  BudgetSubcategory,
  CitizenMonthlyAmount,
  SpendingTransaction,
  SpendingSearchQuery,
  SpendingSearchResult,
  CheckbookRegister,
  CheckbookEntry,
  FiscalCalendar,
  FiscalCalendarEvent,
  ChartData,
  PieSlice,
  ChartDataPoint,
} from './citizen-portal.types';

import { FinanceRepository } from '../finance.repository';
import { Fund, Transaction, BudgetLine } from '../finance.types';

// ============================================================================
// CITIZEN PORTAL SERVICE IMPLEMENTATION
// ============================================================================

/**
 * Default implementation of the citizen portal service.
 */
export class DefaultCitizenPortalService implements CitizenPortalService {
  constructor(private readonly repository: FinanceRepository) {}

  /**
   * Get citizen dashboard data.
   */
  async getDashboard(tenantId: string, fiscalYear: number): Promise<CitizenDashboard> {
    // Get all funds
    const fundsResult = await this.repository.listFunds({ tenantId, activeOnly: true });
    const funds = Array.isArray(fundsResult) ? fundsResult : fundsResult.items;

    // Get transactions for the year
    const startDate = new Date(fiscalYear, 0, 1);
    const endDate = new Date(fiscalYear, 11, 31, 23, 59, 59);
    const txResult = await this.repository.listTransactions({
      tenantId,
      fromDate: startDate,
      toDate: endDate,
      includeVoided: false,
    });
    const transactions = Array.isArray(txResult) ? txResult : txResult.items;

    // Calculate totals
    const totalReceipts = transactions
      .filter((t) => t.type === 'RECEIPT')
      .reduce((sum, t) => sum + t.amount, 0);

    const totalDisbursements = transactions
      .filter((t) => t.type === 'DISBURSEMENT')
      .reduce((sum, t) => sum + t.amount, 0);

    const totalBalance = funds.reduce((sum, f) => sum + (f.currentBalance || 0), 0);

    // Build fund summaries
    const fundSummaries = await this.buildFundSummaries(funds, transactions, fiscalYear);

    // Build revenue breakdown
    const revenueBySource = this.buildRevenueBreakdown(transactions);

    // Build spending breakdown
    const spendingByCategory = this.buildSpendingBreakdown(transactions);

    // Build quick facts
    const quickFacts = this.buildQuickFacts(
      totalReceipts,
      totalDisbursements,
      totalBalance,
      transactions.length
    );

    // Determine health indicator
    const healthIndicator = this.calculateHealthIndicator(
      totalReceipts,
      totalDisbursements,
      totalBalance
    );

    return {
      unitName: 'Local Government Unit', // Would come from tenant config
      unitType: 'Municipal Corporation',
      fiscalYear,
      lastUpdated: new Date(),
      healthIndicator,
      fundSummary: fundSummaries,
      revenueBySource,
      spendingByCategory,
      quickFacts,
    };
  }

  /**
   * Get budget explorer data.
   */
  async getBudgetExplorer(tenantId: string, fiscalYear: number): Promise<BudgetExplorer> {
    // Get budget lines
    const budgetResult = await this.repository.listBudgetLines({
      tenantId,
      fiscalYear,
    });
    const budgetLines = Array.isArray(budgetResult) ? budgetResult : budgetResult.items;

    // Get transactions for actuals
    const startDate = new Date(fiscalYear, 0, 1);
    const endDate = new Date(fiscalYear, 11, 31, 23, 59, 59);
    const txResult = await this.repository.listTransactions({
      tenantId,
      fromDate: startDate,
      toDate: endDate,
      includeVoided: false,
    });
    const transactions = Array.isArray(txResult) ? txResult : txResult.items;

    // Calculate totals
    const totalBudget = budgetLines
      .filter((bl) => bl.type === 'APPROPRIATION')
      .reduce((sum, bl) => sum + bl.amount, 0);

    const totalSpent = transactions
      .filter((t) => t.type === 'DISBURSEMENT')
      .reduce((sum, t) => sum + t.amount, 0);

    // Build categories
    const categories = this.buildBudgetCategories(budgetLines, transactions);

    return {
      fiscalYear,
      unitName: 'Local Government Unit',
      totalBudget: this.round2(totalBudget),
      totalSpent: this.round2(totalSpent),
      totalRemaining: this.round2(totalBudget - totalSpent),
      percentSpent: totalBudget > 0 ? this.round2((totalSpent / totalBudget) * 100) : 0,
      categories,
    };
  }

  /**
   * Get budget category details.
   */
  async getBudgetCategoryDetails(
    tenantId: string,
    fiscalYear: number,
    categoryId: string
  ): Promise<BudgetCategory> {
    const explorer = await this.getBudgetExplorer(tenantId, fiscalYear);
    const category = explorer.categories.find((c) => c.id === categoryId);

    if (!category) {
      throw new Error(`Category ${categoryId} not found`);
    }

    return category;
  }

  /**
   * Search spending transactions (sanitized for public).
   */
  async searchSpending(
    tenantId: string,
    query: SpendingSearchQuery
  ): Promise<SpendingSearchResult> {
    // Build date range
    const startDate = query.startDate || new Date(query.fiscalYear || new Date().getFullYear(), 0, 1);
    const endDate = query.endDate || new Date(query.fiscalYear || new Date().getFullYear(), 11, 31);

    // Get transactions
    const txResult = await this.repository.listTransactions({
      tenantId,
      fromDate: startDate,
      toDate: endDate,
      includeVoided: false,
    });
    let transactions = Array.isArray(txResult) ? txResult : txResult.items;

    // Filter to disbursements only
    transactions = transactions.filter((t) => t.type === 'DISBURSEMENT');

    // Apply search filters
    if (query.searchText) {
      const searchLower = query.searchText.toLowerCase();
      transactions = transactions.filter(
        (t) =>
          t.description.toLowerCase().includes(searchLower) ||
          t.vendorName?.toLowerCase().includes(searchLower)
      );
    }

    if (query.minAmount !== undefined) {
      transactions = transactions.filter((t) => t.amount >= query.minAmount!);
    }

    if (query.maxAmount !== undefined) {
      transactions = transactions.filter((t) => t.amount <= query.maxAmount!);
    }

    // Sort
    const sortField = query.sortBy || 'date';
    const sortDir = query.sortDirection === 'ASC' ? 1 : -1;
    transactions.sort((a, b) => {
      switch (sortField) {
        case 'date':
          return sortDir * (new Date(a.transactionDate).getTime() - new Date(b.transactionDate).getTime());
        case 'amount':
          return sortDir * (a.amount - b.amount);
        case 'payee':
          return sortDir * (a.vendorName || '').localeCompare(b.vendorName || '');
        default:
          return 0;
      }
    });

    // Calculate totals
    const totalAmount = transactions.reduce((sum, t) => sum + t.amount, 0);
    const uniquePayees = new Set(transactions.map((t) => t.vendorName)).size;

    // Category breakdown
    const categoryMap = new Map<string, { amount: number; count: number }>();
    for (const tx of transactions) {
      const category = this.categorizeForPublic(tx);
      const existing = categoryMap.get(category) || { amount: 0, count: 0 };
      existing.amount += tx.amount;
      existing.count++;
      categoryMap.set(category, existing);
    }

    // Paginate
    const page = query.page || 1;
    const pageSize = query.pageSize || 50;
    const totalCount = transactions.length;
    const totalPages = Math.ceil(totalCount / pageSize);
    const startIndex = (page - 1) * pageSize;
    const pageTransactions = transactions.slice(startIndex, startIndex + pageSize);

    // Convert to public format
    const publicTransactions: SpendingTransaction[] = pageTransactions.map((t) =>
      this.sanitizeTransaction(t)
    );

    return {
      transactions: publicTransactions,
      totalCount,
      page,
      pageSize,
      totalPages,
      summary: {
        totalAmount: this.round2(totalAmount),
        transactionCount: totalCount,
        uniquePayees,
        byCategory: Array.from(categoryMap.entries()).map(([category, data]) => ({
          category,
          amount: this.round2(data.amount),
          count: data.count,
        })),
      },
    };
  }

  /**
   * Get checkbook register.
   */
  async getCheckbookRegister(
    tenantId: string,
    fundName: string,
    startDate: Date,
    endDate: Date
  ): Promise<CheckbookRegister> {
    // Find fund
    const fundsResult = await this.repository.listFunds({ tenantId });
    const funds = Array.isArray(fundsResult) ? fundsResult : fundsResult.items;
    const fund = funds.find((f) => f.name === fundName || f.code === fundName);

    if (!fund) {
      throw new Error(`Fund ${fundName} not found`);
    }

    // Get transactions
    const txResult = await this.repository.listTransactions({
      tenantId,
      fundId: fund.id,
      fromDate: startDate,
      toDate: endDate,
      includeVoided: false,
    });
    const transactions = Array.isArray(txResult) ? txResult : txResult.items;

    // Sort by date
    transactions.sort(
      (a, b) => new Date(a.transactionDate).getTime() - new Date(b.transactionDate).getTime()
    );

    // Calculate balances
    const beginningBalance = await this.repository.calculateFundBalance(
      fund.id,
      new Date(startDate.getTime() - 1)
    );

    let runningBalance = beginningBalance;
    let totalDeposits = 0;
    let totalPayments = 0;

    const entries: CheckbookEntry[] = transactions.map((tx) => {
      let amount: number;
      let type: CheckbookEntry['type'];

      if (tx.type === 'RECEIPT') {
        amount = tx.amount;
        type = 'DEPOSIT';
        totalDeposits += tx.amount;
      } else if (tx.type === 'DISBURSEMENT') {
        amount = -tx.amount;
        type = 'PAYMENT';
        totalPayments += tx.amount;
      } else {
        amount = tx.amount >= 0 ? tx.amount : tx.amount;
        type = 'TRANSFER';
      }

      runningBalance += amount;

      return {
        date: tx.transactionDate,
        reference: tx.checkNumber || tx.externalRef || tx.id.substring(0, 8),
        payee: tx.vendorName || tx.description.substring(0, 30),
        description: tx.description,
        amount,
        type,
        fund: fund.name,
        runningBalance: this.round2(runningBalance),
      };
    });

    return {
      accountName: fund.name,
      periodStart: startDate,
      periodEnd: endDate,
      beginningBalance: this.round2(beginningBalance),
      endingBalance: this.round2(runningBalance),
      totalDeposits: this.round2(totalDeposits),
      totalPayments: this.round2(totalPayments),
      entries,
    };
  }

  /**
   * Get fiscal calendar.
   */
  async getFiscalCalendar(tenantId: string, year: number): Promise<FiscalCalendar> {
    // Standard Indiana local government fiscal calendar events
    const events: FiscalCalendarEvent[] = [
      {
        title: 'Budget Preparation Begins',
        date: new Date(year, 5, 1), // June 1
        type: 'DEADLINE',
        description: 'Departments begin preparing budget requests for next fiscal year',
      },
      {
        title: 'Budget Hearing Notice Publication',
        date: new Date(year, 7, 15), // August 15
        type: 'DEADLINE',
        description: 'Public notice of budget hearing must be published',
      },
      {
        title: 'Public Budget Hearing',
        date: new Date(year, 8, 1), // September 1
        type: 'PUBLIC_HEARING',
        description: 'Public hearing on proposed budget',
        isPublicMeeting: true,
        location: 'Town Hall',
      },
      {
        title: 'Budget Adoption Deadline',
        date: new Date(year, 9, 1), // October 1
        type: 'DEADLINE',
        description: 'Final date to adopt annual budget',
      },
      {
        title: 'Tax Levy Certification',
        date: new Date(year, 9, 15), // October 15
        type: 'DEADLINE',
        description: 'Tax levy must be certified to county auditor',
      },
      {
        title: 'AFR Filing Deadline',
        date: new Date(year, 1, 28), // February 28
        type: 'REPORT_DUE',
        description: 'Annual Financial Report due to SBOA via Gateway',
      },
      {
        title: 'Spring Property Tax Due',
        date: new Date(year, 4, 10), // May 10
        type: 'TAX_DATE',
        description: 'First installment of property taxes due',
      },
      {
        title: 'Fall Property Tax Due',
        date: new Date(year, 10, 10), // November 10
        type: 'TAX_DATE',
        description: 'Second installment of property taxes due',
      },
    ];

    // Sort by date
    events.sort((a, b) => a.date.getTime() - b.date.getTime());

    // Get upcoming events (next 30 days)
    const now = new Date();
    const thirtyDaysOut = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    const upcoming = events.filter(
      (e) => e.date >= now && e.date <= thirtyDaysOut
    );

    return {
      year,
      unitName: 'Local Government Unit',
      events,
      upcoming,
    };
  }

  /**
   * Get "where my taxes go" breakdown.
   */
  async getTaxBreakdown(tenantId: string, fiscalYear: number): Promise<TaxInformation> {
    // Get spending by category to determine breakdown
    const startDate = new Date(fiscalYear, 0, 1);
    const endDate = new Date(fiscalYear, 11, 31);

    const txResult = await this.repository.listTransactions({
      tenantId,
      fromDate: startDate,
      toDate: endDate,
      includeVoided: false,
    });
    const transactions = Array.isArray(txResult) ? txResult : txResult.items;

    const disbursements = transactions.filter((t) => t.type === 'DISBURSEMENT');
    const totalSpending = disbursements.reduce((sum, t) => sum + t.amount, 0);

    // Categorize spending
    const categoryTotals = new Map<string, number>();
    for (const tx of disbursements) {
      const category = this.categorizeForTaxBreakdown(tx);
      categoryTotals.set(category, (categoryTotals.get(category) || 0) + tx.amount);
    }

    // Build breakdown
    const colors = [
      '#2196F3', '#4CAF50', '#FFC107', '#FF5722', '#9C27B0',
      '#00BCD4', '#795548', '#607D8B', '#E91E63', '#3F51B5',
    ];
    const icons: Record<string, string> = {
      'Public Safety': 'shield',
      'Streets & Roads': 'road',
      'Parks & Recreation': 'tree',
      'Administration': 'building',
      'Debt Service': 'bank',
      'Utilities': 'bolt',
      'Other': 'circle',
    };

    const breakdown: TaxBreakdownItem[] = Array.from(categoryTotals.entries())
      .map(([name, amount], index) => ({
        name,
        percentage: totalSpending > 0 ? this.round2((amount / totalSpending) * 100) : 0,
        perDollar: totalSpending > 0 ? this.round2(amount / totalSpending) : 0,
        description: this.getCategoryDescription(name),
        color: colors[index % colors.length],
        icon: icons[name] || 'circle',
      }))
      .sort((a, b) => b.percentage - a.percentage);

    // Example calculation for $150,000 home
    const exampleHomeValue = 150000;
    const estimatedAssessedValue = exampleHomeValue * 0.1; // Indiana gross AV
    const sampleRate = 1.50; // Per $100
    const estimatedTax = (estimatedAssessedValue / 100) * sampleRate;

    return {
      propertyTaxRate: sampleRate,
      localIncomeTaxRate: 0.0175, // 1.75% example
      exampleCalculation: {
        homeValue: exampleHomeValue,
        estimatedTax: this.round2(estimatedTax),
        breakdown: breakdown.slice(0, 5).map((b) => ({
          recipient: b.name,
          amount: this.round2(estimatedTax * b.perDollar),
        })),
      },
      taxBreakdown: breakdown,
    };
  }

  /**
   * Get chart data for visualization.
   */
  async getChartData(
    tenantId: string,
    chartType: string,
    fiscalYear: number,
    options?: Record<string, unknown>
  ): Promise<ChartData> {
    switch (chartType) {
      case 'spending-by-category':
        return this.getSpendingByCategoryChart(tenantId, fiscalYear);

      case 'revenue-by-source':
        return this.getRevenueBySourceChart(tenantId, fiscalYear);

      case 'monthly-spending':
        return this.getMonthlySpendingChart(tenantId, fiscalYear);

      case 'tax-breakdown':
        return this.getTaxBreakdownChart(tenantId, fiscalYear);

      default:
        throw new Error(`Unknown chart type: ${chartType}`);
    }
  }

  // ============================================================================
  // PRIVATE HELPER METHODS
  // ============================================================================

  private async buildFundSummaries(
    funds: Fund[],
    transactions: Transaction[],
    fiscalYear: number
  ): Promise<CitizenFundSummary[]> {
    const summaries: CitizenFundSummary[] = [];
    const fundCategories: Record<string, CitizenFundSummary['category']> = {
      '101': 'GENERAL',
      '201': 'ROADS',
      '202': 'ROADS',
      '401': 'PARKS',
      '601': 'UTILITIES',
    };

    const colors = ['#2196F3', '#4CAF50', '#FFC107', '#FF5722', '#9C27B0'];

    for (const fund of funds) {
      const fundTx = transactions.filter((t) => t.fundId === fund.id);
      const ytdReceipts = fundTx
        .filter((t) => t.type === 'RECEIPT')
        .reduce((sum, t) => sum + t.amount, 0);
      const ytdSpending = fundTx
        .filter((t) => t.type === 'DISBURSEMENT')
        .reduce((sum, t) => sum + t.amount, 0);

      const category = fundCategories[fund.code] || 'OTHER';

      summaries.push({
        name: fund.name,
        description: this.getFundDescription(fund),
        category,
        balance: this.round2(fund.currentBalance || 0),
        ytdReceipts: this.round2(ytdReceipts),
        ytdSpending: this.round2(ytdSpending),
        budget: 0, // Would come from budget lines
        percentSpent: 0,
        trend: ytdReceipts > ytdSpending ? 'UP' : ytdReceipts < ytdSpending ? 'DOWN' : 'STABLE',
        color: colors[summaries.length % colors.length],
      });
    }

    return summaries.slice(0, 10); // Limit to top 10 funds
  }

  private buildRevenueBreakdown(transactions: Transaction[]): RevenueCategorySummary[] {
    const receipts = transactions.filter((t) => t.type === 'RECEIPT');
    const total = receipts.reduce((sum, t) => sum + t.amount, 0);

    const categories = new Map<string, number>();
    for (const tx of receipts) {
      const category = this.categorizeRevenue(tx);
      categories.set(category, (categories.get(category) || 0) + tx.amount);
    }

    const colors = ['#2196F3', '#4CAF50', '#FFC107', '#FF5722', '#9C27B0', '#00BCD4'];
    const descriptions: Record<string, string> = {
      'Property Taxes': 'Property tax distributions from county settlements',
      'Local Income Tax': 'Local income tax (LIT) distributions',
      'State Distributions': 'Motor vehicle highway, cigarette tax, and other state distributions',
      'Fees & Permits': 'Building permits, licenses, and user fees',
      'Grants': 'Federal and state grant funding',
      'Other': 'Miscellaneous receipts',
    };

    return Array.from(categories.entries())
      .map(([category, amount], index) => ({
        category,
        label: category,
        amount: this.round2(amount),
        percentOfTotal: total > 0 ? this.round2((amount / total) * 100) : 0,
        description: descriptions[category] || category,
        color: colors[index % colors.length],
        sortOrder: index,
      }))
      .sort((a, b) => b.amount - a.amount);
  }

  private buildSpendingBreakdown(transactions: Transaction[]): SpendingCategorySummary[] {
    const disbursements = transactions.filter((t) => t.type === 'DISBURSEMENT');
    const total = disbursements.reduce((sum, t) => sum + t.amount, 0);

    const categories = new Map<string, number>();
    for (const tx of disbursements) {
      const category = this.categorizeForPublic(tx);
      categories.set(category, (categories.get(category) || 0) + tx.amount);
    }

    const colors = ['#2196F3', '#4CAF50', '#FFC107', '#FF5722', '#9C27B0', '#00BCD4'];
    const icons: Record<string, string> = {
      'Personnel': 'users',
      'Supplies': 'box',
      'Services': 'cog',
      'Capital': 'building',
      'Debt Service': 'bank',
      'Other': 'ellipsis',
    };

    return Array.from(categories.entries())
      .map(([category, amount], index) => ({
        category,
        label: category,
        amount: this.round2(amount),
        percentOfTotal: total > 0 ? this.round2((amount / total) * 100) : 0,
        budgeted: 0,
        percentOfBudget: 0,
        description: this.getCategoryDescription(category),
        color: colors[index % colors.length],
        icon: icons[category] || 'circle',
        sortOrder: index,
      }))
      .sort((a, b) => b.amount - a.amount);
  }

  private buildBudgetCategories(
    budgetLines: BudgetLine[],
    transactions: Transaction[]
  ): BudgetCategory[] {
    // Group by category
    const categoryMap = new Map<string, { budgeted: number; spent: number }>();

    // Sum appropriations by category
    const appropriations = budgetLines.filter((bl) => bl.type === 'APPROPRIATION');
    for (const bl of appropriations) {
      const category = bl.category || 'Other';
      const existing = categoryMap.get(category) || { budgeted: 0, spent: 0 };
      existing.budgeted += bl.amount;
      categoryMap.set(category, existing);
    }

    // Sum spending by category
    const disbursements = transactions.filter((t) => t.type === 'DISBURSEMENT');
    for (const tx of disbursements) {
      const category = this.categorizeForPublic(tx);
      const existing = categoryMap.get(category) || { budgeted: 0, spent: 0 };
      existing.spent += tx.amount;
      categoryMap.set(category, existing);
    }

    const colors = ['#2196F3', '#4CAF50', '#FFC107', '#FF5722', '#9C27B0', '#00BCD4'];
    const totalBudget = Array.from(categoryMap.values()).reduce(
      (sum, c) => sum + c.budgeted,
      0
    );

    return Array.from(categoryMap.entries()).map(([name, data], index) => {
      const percentSpent = data.budgeted > 0 ? (data.spent / data.budgeted) * 100 : 0;

      let status: BudgetCategory['status'] = 'ON_TRACK';
      if (percentSpent > 100) status = 'OVER_BUDGET';
      else if (percentSpent < 50) status = 'UNDER_BUDGET';
      else if (percentSpent >= 95) status = 'COMPLETE';

      return {
        id: name.toLowerCase().replace(/\s+/g, '-'),
        name,
        description: this.getCategoryDescription(name),
        budgeted: this.round2(data.budgeted),
        spent: this.round2(data.spent),
        remaining: this.round2(data.budgeted - data.spent),
        percentSpent: this.round2(percentSpent),
        percentOfTotal: totalBudget > 0 ? this.round2((data.budgeted / totalBudget) * 100) : 0,
        status,
        color: colors[index % colors.length],
      };
    });
  }

  private buildQuickFacts(
    totalReceipts: number,
    totalDisbursements: number,
    totalBalance: number,
    transactionCount: number
  ): QuickFact[] {
    return [
      {
        label: 'Total Receipts YTD',
        value: `$${totalReceipts.toLocaleString()}`,
        numericValue: totalReceipts,
        format: 'currency',
        icon: 'arrow-down',
      },
      {
        label: 'Total Spending YTD',
        value: `$${totalDisbursements.toLocaleString()}`,
        numericValue: totalDisbursements,
        format: 'currency',
        icon: 'arrow-up',
      },
      {
        label: 'Total Fund Balance',
        value: `$${totalBalance.toLocaleString()}`,
        numericValue: totalBalance,
        format: 'currency',
        icon: 'wallet',
      },
      {
        label: 'Total Transactions',
        value: transactionCount.toLocaleString(),
        numericValue: transactionCount,
        format: 'number',
        icon: 'list',
      },
    ];
  }

  private calculateHealthIndicator(
    receipts: number,
    disbursements: number,
    balance: number
  ): CitizenDashboard['healthIndicator'] {
    if (balance < 0) return 'CONCERN';
    if (disbursements > receipts * 1.2) return 'CAUTION';
    if (disbursements > receipts) return 'STABLE';
    return 'HEALTHY';
  }

  private sanitizeTransaction(tx: Transaction): SpendingTransaction {
    return {
      reference: tx.checkNumber || tx.externalRef || tx.id.substring(0, 8),
      date: tx.transactionDate,
      payee: tx.vendorName || 'Vendor',
      payeeType: 'VENDOR',
      amount: tx.amount,
      description: tx.description.substring(0, 100),
      category: this.categorizeForPublic(tx),
      fundName: tx.fundId, // Would be fund name from lookup
      paymentMethod: tx.checkNumber ? 'CHECK' : 'ACH',
      checkNumber: tx.checkNumber,
    };
  }

  private categorizeForPublic(tx: Transaction): string {
    const desc = tx.description.toLowerCase();

    if (desc.includes('salary') || desc.includes('wage') || desc.includes('payroll')) {
      return 'Personnel';
    }
    if (desc.includes('supply') || desc.includes('supplies') || desc.includes('material')) {
      return 'Supplies';
    }
    if (desc.includes('utility') || desc.includes('electric') || desc.includes('gas')) {
      return 'Utilities';
    }
    if (desc.includes('capital') || desc.includes('equipment') || desc.includes('vehicle')) {
      return 'Capital';
    }
    if (desc.includes('debt') || desc.includes('bond') || desc.includes('principal')) {
      return 'Debt Service';
    }

    return 'Services';
  }

  private categorizeRevenue(tx: Transaction): string {
    const desc = tx.description.toLowerCase();

    if (desc.includes('property tax') || desc.includes('settlement')) {
      return 'Property Taxes';
    }
    if (desc.includes('lit') || desc.includes('income tax') || desc.includes('cvet')) {
      return 'Local Income Tax';
    }
    if (desc.includes('mvh') || desc.includes('state') || desc.includes('distribution')) {
      return 'State Distributions';
    }
    if (desc.includes('grant')) {
      return 'Grants';
    }
    if (desc.includes('fee') || desc.includes('permit') || desc.includes('license')) {
      return 'Fees & Permits';
    }

    return 'Other';
  }

  private categorizeForTaxBreakdown(tx: Transaction): string {
    const desc = tx.description.toLowerCase();

    if (desc.includes('police') || desc.includes('fire') || desc.includes('safety')) {
      return 'Public Safety';
    }
    if (desc.includes('street') || desc.includes('road') || desc.includes('highway')) {
      return 'Streets & Roads';
    }
    if (desc.includes('park') || desc.includes('recreation')) {
      return 'Parks & Recreation';
    }
    if (desc.includes('debt') || desc.includes('bond')) {
      return 'Debt Service';
    }
    if (desc.includes('utility')) {
      return 'Utilities';
    }

    return 'Administration';
  }

  private getFundDescription(fund: Fund): string {
    if (fund.code === '101') return 'General operations and administration';
    if (fund.code === '201') return 'Street and road maintenance';
    if (fund.code.startsWith('6')) return 'Utility operations';
    return fund.name;
  }

  private getCategoryDescription(category: string): string {
    const descriptions: Record<string, string> = {
      'Personnel': 'Salaries, wages, and employee benefits',
      'Supplies': 'Office supplies, materials, and consumables',
      'Services': 'Professional services, contracts, and utilities',
      'Capital': 'Equipment, vehicles, and infrastructure',
      'Debt Service': 'Bond payments and loan repayments',
      'Utilities': 'Electric, gas, water, and telecommunications',
      'Public Safety': 'Police, fire, and emergency services',
      'Streets & Roads': 'Road maintenance and improvements',
      'Parks & Recreation': 'Parks maintenance and programs',
      'Administration': 'General government administration',
    };
    return descriptions[category] || category;
  }

  private async getSpendingByCategoryChart(tenantId: string, fiscalYear: number): Promise<ChartData> {
    const dashboard = await this.getDashboard(tenantId, fiscalYear);

    const slices: PieSlice[] = dashboard.spendingByCategory.map((cat) => ({
      label: cat.label,
      value: cat.amount,
      percentage: cat.percentOfTotal,
      color: cat.color,
    }));

    return {
      type: 'DONUT',
      title: 'Spending by Category',
      subtitle: `Fiscal Year ${fiscalYear}`,
      data: slices,
      isCurrency: true,
      showLegend: true,
      showDataLabels: true,
    };
  }

  private async getRevenueBySourceChart(tenantId: string, fiscalYear: number): Promise<ChartData> {
    const dashboard = await this.getDashboard(tenantId, fiscalYear);

    const slices: PieSlice[] = dashboard.revenueBySource.map((src) => ({
      label: src.label,
      value: src.amount,
      percentage: src.percentOfTotal,
      color: src.color,
    }));

    return {
      type: 'PIE',
      title: 'Revenue Sources',
      subtitle: `Fiscal Year ${fiscalYear}`,
      data: slices,
      isCurrency: true,
      showLegend: true,
    };
  }

  private async getMonthlySpendingChart(tenantId: string, fiscalYear: number): Promise<ChartData> {
    const months = [
      'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
    ];

    // Get transactions and group by month
    const txResult = await this.repository.listTransactions({
      tenantId,
      fromDate: new Date(fiscalYear, 0, 1),
      toDate: new Date(fiscalYear, 11, 31),
      includeVoided: false,
    });
    const transactions = Array.isArray(txResult) ? txResult : txResult.items;

    const monthlyTotals = new Array(12).fill(0);
    for (const tx of transactions.filter((t) => t.type === 'DISBURSEMENT')) {
      const month = new Date(tx.transactionDate).getMonth();
      monthlyTotals[month] += tx.amount;
    }

    const dataPoints: ChartDataPoint[] = months.map((label, index) => ({
      label,
      value: this.round2(monthlyTotals[index]),
    }));

    return {
      type: 'BAR',
      title: 'Monthly Spending',
      subtitle: `Fiscal Year ${fiscalYear}`,
      data: dataPoints,
      xAxisLabel: 'Month',
      yAxisLabel: 'Amount ($)',
      isCurrency: true,
      showDataLabels: false,
    };
  }

  private async getTaxBreakdownChart(tenantId: string, fiscalYear: number): Promise<ChartData> {
    const taxInfo = await this.getTaxBreakdown(tenantId, fiscalYear);

    const slices: PieSlice[] = taxInfo.taxBreakdown.slice(0, 6).map((item) => ({
      label: item.name,
      value: item.percentage,
      percentage: item.percentage,
      color: item.color,
    }));

    return {
      type: 'DONUT',
      title: 'Where Your Tax Dollar Goes',
      subtitle: 'Per dollar of property tax paid',
      data: slices,
      isCurrency: false,
      showLegend: true,
      showDataLabels: true,
    };
  }

  private round2(value: number): number {
    return Math.round(value * 100) / 100;
  }
}

// ============================================================================
// FACTORY FUNCTION
// ============================================================================

/**
 * Create a citizen portal service.
 */
export function createCitizenPortalService(
  repository: FinanceRepository
): CitizenPortalService {
  return new DefaultCitizenPortalService(repository);
}
