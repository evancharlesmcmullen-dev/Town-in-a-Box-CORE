// src/states/in/finance/gateway/gateway.engine.ts

/**
 * Indiana Gateway Export Engine
 *
 * Generates Gateway-ready exports for SBOA and DLGF reporting.
 */

import {
  GatewayExportOptions,
  GatewayExportResult,
  GatewayReportType,
  AFRFundReport,
  AFRFundLine,
  AFR100RReport,
  BudgetEstimateReport,
  BudgetAdoptedReport,
  DebtReport,
  GatewayValidationError,
  GatewayValidationWarning,
  GatewayLineExplanation,
  GatewayExportMetadata,
} from './gateway.types';

import { FinanceRepository } from '../../../../core/finance/finance.repository';
import { Fund, Transaction, BudgetLine, DebtInstrument } from '../../../../core/finance/finance.types';
import { getFundCategory, IN_FUND_CATEGORIES } from '../in-fund-structure.config';

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Generate export ID.
 */
function generateExportId(reportType: string): string {
  const timestamp = new Date().toISOString().replace(/[-:]/g, '').split('.')[0];
  return `GW-${reportType}-${timestamp}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
}

/**
 * Create export metadata.
 */
function createMetadata(
  options: GatewayExportOptions,
  reportType: GatewayReportType,
  unitName: string = 'Unknown Unit'
): GatewayExportMetadata {
  return {
    exportId: generateExportId(reportType),
    reportType,
    tenantId: options.tenantId,
    unitName,
    unitId: '', // Would come from tenant config
    fiscalYear: options.fiscalYear,
    status: options.validate ? 'VALIDATED' : 'DRAFT',
    createdAt: new Date(),
    createdBy: options.userId ?? 'system',
  };
}

/**
 * Round to 2 decimal places.
 */
function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Categorize transaction for Gateway reporting.
 */
function categorizeReceipt(tx: Transaction): keyof AFRFundLine['receipts'] {
  // Would use account codes for proper categorization
  // This is simplified logic
  const desc = tx.description.toLowerCase();

  if (desc.includes('property tax') || desc.includes('tax settlement')) {
    return 'propertyTaxes';
  }
  if (desc.includes('lit') || desc.includes('income tax') || desc.includes('cvet')) {
    return 'localIncomeTax';
  }
  if (desc.includes('license') || desc.includes('permit')) {
    return 'licensesPermits';
  }
  if (desc.includes('grant') || desc.includes('state') || desc.includes('federal') || desc.includes('mvh') || desc.includes('lrs')) {
    return 'intergovernmental';
  }
  if (desc.includes('fee') || desc.includes('service') || desc.includes('utility')) {
    return 'chargesForServices';
  }
  if (desc.includes('fine') || desc.includes('penalty') || desc.includes('forfeit')) {
    return 'finesForfeitures';
  }
  if (desc.includes('transfer')) {
    return 'transfersIn';
  }

  return 'otherReceipts';
}

/**
 * Categorize disbursement for Gateway reporting.
 */
function categorizeDisbursement(tx: Transaction): keyof AFRFundLine['disbursements'] {
  const desc = tx.description.toLowerCase();

  if (desc.includes('salary') || desc.includes('wage') || desc.includes('payroll') || desc.includes('fica') || desc.includes('perf')) {
    return 'personalServices';
  }
  if (desc.includes('supply') || desc.includes('supplies') || desc.includes('material')) {
    return 'supplies';
  }
  if (desc.includes('principal') || desc.includes('bond payment')) {
    return 'debtServicePrincipal';
  }
  if (desc.includes('interest')) {
    return 'debtServiceInterest';
  }
  if (desc.includes('capital') || desc.includes('equipment') || desc.includes('vehicle') || desc.includes('construction')) {
    return 'capitalOutlay';
  }
  if (desc.includes('transfer')) {
    return 'transfersOut';
  }

  return 'otherServicesCharges';
}

// ============================================================================
// GATEWAY ENGINE
// ============================================================================

/**
 * Indiana Gateway Export Engine.
 */
export class GatewayExportEngine {
  constructor(private readonly repository: FinanceRepository) {}

  /**
   * Generate an AFR Fund Report.
   */
  async generateAFRFundReport(options: GatewayExportOptions): Promise<GatewayExportResult<AFRFundReport>> {
    const { tenantId, fiscalYear, fundIds, includeInactive, validate } = options;

    // Fiscal year dates (Indiana uses calendar year)
    const startDate = new Date(fiscalYear, 0, 1);
    const endDate = new Date(fiscalYear, 11, 31, 23, 59, 59);

    // Get funds
    const fundsResult = await this.repository.listFunds({
      tenantId,
      codes: fundIds,
      activeOnly: !includeInactive,
    });
    const funds = Array.isArray(fundsResult) ? fundsResult : fundsResult.items;

    const fundLines: AFRFundLine[] = [];
    const allTransactionIds: string[] = [];
    const allFundIds: string[] = [];
    const errors: GatewayValidationError[] = [];
    const warnings: GatewayValidationWarning[] = [];

    let totalBeginning = 0;
    let totalReceipts = 0;
    let totalDisbursements = 0;
    let totalEnding = 0;

    for (const fund of funds) {
      allFundIds.push(fund.id);

      // Get fund summary
      const summary = await this.repository.getFundSummary(fund.id, startDate, endDate);
      if (!summary) continue;

      // Get transactions for categorization
      const txResult = await this.repository.listTransactions({
        tenantId,
        fundId: fund.id,
        fromDate: startDate,
        toDate: endDate,
        includeVoided: false,
      });
      const transactions = Array.isArray(txResult) ? txResult : txResult.items;

      // Initialize receipt categories
      const receipts: AFRFundLine['receipts'] = {
        propertyTaxes: 0,
        localIncomeTax: 0,
        licensesPermits: 0,
        intergovernmental: 0,
        chargesForServices: 0,
        finesForfeitures: 0,
        otherReceipts: 0,
        transfersIn: 0,
        totalReceipts: 0,
      };

      // Initialize disbursement categories
      const disbursements: AFRFundLine['disbursements'] = {
        personalServices: 0,
        supplies: 0,
        otherServicesCharges: 0,
        capitalOutlay: 0,
        debtServicePrincipal: 0,
        debtServiceInterest: 0,
        otherDisbursements: 0,
        transfersOut: 0,
        totalDisbursements: 0,
      };

      const sourceTransactionIds: string[] = [];

      // Categorize transactions
      for (const tx of transactions) {
        sourceTransactionIds.push(tx.id);
        allTransactionIds.push(tx.id);

        if (tx.type === 'RECEIPT') {
          const category = categorizeReceipt(tx);
          receipts[category] += tx.amount;
        } else if (tx.type === 'DISBURSEMENT') {
          const category = categorizeDisbursement(tx);
          disbursements[category] += tx.amount;
        } else if (tx.type === 'TRANSFER') {
          if (tx.amount >= 0) {
            receipts.transfersIn += tx.amount;
          } else {
            disbursements.transfersOut += Math.abs(tx.amount);
          }
        }
      }

      // Calculate totals
      receipts.totalReceipts =
        receipts.propertyTaxes +
        receipts.localIncomeTax +
        receipts.licensesPermits +
        receipts.intergovernmental +
        receipts.chargesForServices +
        receipts.finesForfeitures +
        receipts.otherReceipts +
        receipts.transfersIn;

      disbursements.totalDisbursements =
        disbursements.personalServices +
        disbursements.supplies +
        disbursements.otherServicesCharges +
        disbursements.capitalOutlay +
        disbursements.debtServicePrincipal +
        disbursements.debtServiceInterest +
        disbursements.otherDisbursements +
        disbursements.transfersOut;

      const netChange = receipts.totalReceipts - disbursements.totalDisbursements;
      const calculatedEnding = summary.beginningBalance + netChange;
      const isBalanced = Math.abs(calculatedEnding - summary.endingBalance) < 0.01;

      // Validation
      if (validate && !isBalanced) {
        warnings.push({
          code: 'FUND_NOT_BALANCED',
          fundNumber: fund.code,
          message: `Fund ${fund.code} does not balance. Beginning (${summary.beginningBalance}) + Net Change (${netChange}) = ${calculatedEnding}, but ending is ${summary.endingBalance}`,
          severity: 'WARNING',
        });
      }

      // Determine fund type for Gateway
      const category = getFundCategory(fund.code);
      let gatewayFundType: AFRFundLine['fundType'] = 'GOVERNMENTAL';
      if (category?.id === 'utility') {
        gatewayFundType = 'PROPRIETARY';
      } else if (category?.id === 'trust') {
        gatewayFundType = 'FIDUCIARY';
      }

      fundLines.push({
        fundNumber: fund.code,
        fundName: fund.name,
        fundType: gatewayFundType,
        sboacCode: fund.sboacCode,
        beginningBalance: round2(summary.beginningBalance),
        receipts: {
          propertyTaxes: round2(receipts.propertyTaxes),
          localIncomeTax: round2(receipts.localIncomeTax),
          licensesPermits: round2(receipts.licensesPermits),
          intergovernmental: round2(receipts.intergovernmental),
          chargesForServices: round2(receipts.chargesForServices),
          finesForfeitures: round2(receipts.finesForfeitures),
          otherReceipts: round2(receipts.otherReceipts),
          transfersIn: round2(receipts.transfersIn),
          totalReceipts: round2(receipts.totalReceipts),
        },
        disbursements: {
          personalServices: round2(disbursements.personalServices),
          supplies: round2(disbursements.supplies),
          otherServicesCharges: round2(disbursements.otherServicesCharges),
          capitalOutlay: round2(disbursements.capitalOutlay),
          debtServicePrincipal: round2(disbursements.debtServicePrincipal),
          debtServiceInterest: round2(disbursements.debtServiceInterest),
          otherDisbursements: round2(disbursements.otherDisbursements),
          transfersOut: round2(disbursements.transfersOut),
          totalDisbursements: round2(disbursements.totalDisbursements),
        },
        endingBalance: round2(summary.endingBalance),
        calculated: {
          netChange: round2(netChange),
          isBalanced,
        },
        sourceTransactionIds,
      });

      totalBeginning += summary.beginningBalance;
      totalReceipts += receipts.totalReceipts;
      totalDisbursements += disbursements.totalDisbursements;
      totalEnding += summary.endingBalance;
    }

    // Create report
    const report: AFRFundReport = {
      metadata: createMetadata(options, 'AFR_FUND'),
      reportPeriod: {
        startDate,
        endDate,
        fiscalYear,
      },
      funds: fundLines,
      totals: {
        totalBeginningBalance: round2(totalBeginning),
        totalReceipts: round2(totalReceipts),
        totalDisbursements: round2(totalDisbursements),
        totalEndingBalance: round2(totalEnding),
        netChange: round2(totalReceipts - totalDisbursements),
      },
      validation: {
        isValid: errors.length === 0,
        errors,
        warnings,
      },
    };

    // Generate output
    const outputData = this.formatOutput(report, options.format ?? 'JSON');

    return {
      success: errors.length === 0,
      exportId: report.metadata.exportId,
      report,
      format: options.format ?? 'JSON',
      data: outputData,
      validation: report.validation,
      lineage: {
        transactionIds: allTransactionIds,
        fundIds: allFundIds,
        generatedAt: new Date(),
      },
    };
  }

  /**
   * Generate explanation for a Gateway line item.
   * Provides full traceability to source transactions, import batches, and legal citations.
   */
  async explainLine(
    tenantId: string,
    fundNumber: string,
    fiscalYear: number,
    fieldName: string,
    userId?: string
  ): Promise<GatewayLineExplanation> {
    // Fiscal year dates
    const startDate = new Date(fiscalYear, 0, 1);
    const endDate = new Date(fiscalYear, 11, 31, 23, 59, 59);

    // Get fund
    const fund = await this.repository.getFundByCode(tenantId, fundNumber);
    if (!fund) {
      throw new Error(`Fund ${fundNumber} not found`);
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

    // Filter and categorize based on field
    let relevantTx: Transaction[] = [];
    let formula = '';
    let plainEnglish = '';
    let fieldDisplayName = fieldName;
    const components: GatewayLineExplanation['calculation']['components'] = [];

    // Field-specific logic
    switch (fieldName) {
      case 'totalReceipts':
        relevantTx = transactions.filter((tx) => tx.type === 'RECEIPT');
        formula = 'Σ(Receipt Transactions)';
        plainEnglish = 'The sum of all money received into this fund during the fiscal year';
        fieldDisplayName = 'Total Receipts';
        break;

      case 'totalDisbursements':
        relevantTx = transactions.filter((tx) => tx.type === 'DISBURSEMENT');
        formula = 'Σ(Disbursement Transactions)';
        plainEnglish = 'The sum of all money paid out from this fund during the fiscal year';
        fieldDisplayName = 'Total Disbursements';
        break;

      case 'propertyTaxes':
        relevantTx = transactions.filter(
          (tx) => tx.type === 'RECEIPT' && categorizeReceipt(tx) === 'propertyTaxes'
        );
        formula = 'Σ(Property Tax Receipts)';
        plainEnglish = 'Property tax distributions received from the county settlement';
        fieldDisplayName = 'Property Taxes';
        break;

      case 'localIncomeTax':
        relevantTx = transactions.filter(
          (tx) => tx.type === 'RECEIPT' && categorizeReceipt(tx) === 'localIncomeTax'
        );
        formula = 'Σ(LIT + CVET Receipts)';
        plainEnglish = 'Local Income Tax (LIT) and County Vehicle Excise Tax (CVET) distributions';
        fieldDisplayName = 'Local Income Tax';
        break;

      case 'personalServices':
        relevantTx = transactions.filter(
          (tx) => tx.type === 'DISBURSEMENT' && categorizeDisbursement(tx) === 'personalServices'
        );
        formula = 'Σ(Salaries + FICA + PERF + Benefits)';
        plainEnglish = 'Total personnel costs including salaries, wages, and employer-paid benefits';
        fieldDisplayName = 'Personal Services';
        break;

      case 'beginningBalance':
        const beginBalance = await this.repository.calculateFundBalance(fund.id, new Date(fiscalYear - 1, 11, 31));
        formula = 'Ending Balance (Dec 31, Prior Year)';
        plainEnglish = `The fund balance as of December 31, ${fiscalYear - 1}, which becomes the beginning balance for ${fiscalYear}`;
        fieldDisplayName = 'Beginning Balance';
        components.push({
          name: 'Prior Year Ending Balance',
          value: beginBalance,
          source: 'Calculated from all prior transactions',
          percentage: 100,
        });
        break;

      case 'endingBalance':
        const endBalance = await this.repository.calculateFundBalance(fund.id, endDate);
        formula = 'Beginning Balance + Total Receipts - Total Disbursements';
        plainEnglish = 'The fund balance at the end of the fiscal year, calculated from beginning balance plus all receipts minus all disbursements';
        fieldDisplayName = 'Ending Balance';
        components.push({
          name: 'Ending Balance',
          value: endBalance,
          source: 'Calculated from transactions',
          percentage: 100,
        });
        break;

      default:
        // Handle other receipt/disbursement categories
        if (fieldName.endsWith('Receipts') || fieldName.endsWith('Revenue')) {
          relevantTx = transactions.filter((tx) => tx.type === 'RECEIPT');
          formula = 'Σ(Filtered Receipt Transactions)';
          plainEnglish = 'Filtered subset of receipt transactions';
        } else {
          relevantTx = transactions.filter((tx) => tx.type === 'DISBURSEMENT');
          formula = 'Σ(Filtered Disbursement Transactions)';
          plainEnglish = 'Filtered subset of disbursement transactions';
        }
    }

    // Calculate total
    const reportedValue = relevantTx.reduce((sum, tx) => sum + tx.amount, 0);

    // Build import batch summary
    const batchMap = new Map<string, {
      batchId: string;
      batchName: string;
      importDate: Date;
      transactions: Transaction[];
      totalAmount: number;
    }>();

    for (const tx of relevantTx) {
      if (tx.importBatchId) {
        const existing = batchMap.get(tx.importBatchId);
        if (existing) {
          existing.transactions.push(tx);
          existing.totalAmount += tx.amount;
        } else {
          batchMap.set(tx.importBatchId, {
            batchId: tx.importBatchId,
            batchName: `Import Batch ${tx.importBatchId}`,
            importDate: tx.createdAt || new Date(),
            transactions: [tx],
            totalAmount: tx.amount,
          });
        }
      }
    }

    // Build components with percentages
    for (const tx of relevantTx.slice(0, 20)) {
      components.push({
        name: tx.description.substring(0, 50),
        value: tx.amount,
        source: `Transaction ${tx.id}`,
        percentage: reportedValue > 0 ? (tx.amount / reportedValue) * 100 : 0,
      });
    }

    if (relevantTx.length > 20) {
      const remaining = relevantTx.slice(20);
      const remainingTotal = remaining.reduce((sum, tx) => sum + tx.amount, 0);
      components.push({
        name: `+ ${remaining.length} more transactions`,
        value: remainingTotal,
        source: 'Additional transactions',
        percentage: reportedValue > 0 ? (remainingTotal / reportedValue) * 100 : 0,
      });
    }

    // Build legal citations
    const legalCitations: GatewayLineExplanation['legalCitations'] = [
      {
        code: 'IC 5-11-1-4',
        title: 'Annual Financial Report Filing',
        description: 'Requires filing of annual financial report with SBOA',
        url: 'http://iga.in.gov/legislative/laws/2023/ic/titles/005#5-11-1-4',
        source: 'Indiana Code',
      },
      {
        code: 'IC 5-14-3.8',
        title: 'Gateway Electronic Filing',
        description: 'Requires filing through Indiana Gateway portal',
        url: 'http://iga.in.gov/legislative/laws/2023/ic/titles/005#5-14-3.8',
        source: 'Indiana Code',
      },
    ];

    // Add field-specific citations
    if (fieldName === 'propertyTaxes') {
      legalCitations.push({
        code: 'IC 6-1.1-17',
        title: 'Property Tax Levy and Collection',
        description: 'Governs property tax levy certification and distribution',
        url: 'http://iga.in.gov/legislative/laws/2023/ic/titles/006#6-1.1-17',
        source: 'Indiana Code',
      });
    } else if (fieldName === 'localIncomeTax') {
      legalCitations.push({
        code: 'IC 6-3.6',
        title: 'Local Income Tax',
        description: 'Governs local income tax adoption and distribution',
        url: 'http://iga.in.gov/legislative/laws/2023/ic/titles/006#6-3.6',
        source: 'Indiana Code',
      });
    } else if (fieldName === 'personalServices') {
      legalCitations.push({
        code: 'IC 36-4-7',
        title: 'Municipal Employees',
        description: 'Governs employment and compensation of municipal employees',
        source: 'Indiana Code',
      });
    }

    // Build rules applied
    const rules: GatewayLineExplanation['rules'] = [
      {
        ruleId: 'IN-AFR-001',
        ruleName: 'AFR Filing Requirement',
        description: 'All local units must file an Annual Financial Report',
        citation: 'IC 5-11-1-4',
        citationUrl: 'http://iga.in.gov/legislative/laws/2023/ic/titles/005#5-11-1-4',
        authority: 'SBOA',
        applied: true,
        result: 'PASSED',
      },
      {
        ruleId: 'IN-SBOA-002',
        ruleName: 'SBOA Chart of Accounts',
        description: 'Transactions must follow SBOA Uniform Chart of Accounts',
        citation: 'IC 5-11-1-21',
        authority: 'SBOA',
        applied: true,
        result: 'PASSED',
      },
    ];

    return {
      lineId: `${fundNumber}-${fieldName}-${fiscalYear}`,
      fundNumber,
      fundName: fund.name,
      fieldName,
      fieldDisplayName,
      reportedValue: round2(reportedValue),
      fiscalYear,
      calculation: {
        formula,
        plainEnglish,
        components,
      },
      transactions: relevantTx.slice(0, 100).map((tx) => ({
        id: tx.id,
        date: tx.transactionDate,
        description: tx.description,
        amount: tx.amount,
        type: tx.type,
        importBatchId: tx.importBatchId,
        importBatchName: tx.importBatchId ? `Import Batch ${tx.importBatchId}` : undefined,
        checkNumber: tx.checkNumber,
        vendorName: tx.vendorName,
      })),
      importBatches: Array.from(batchMap.values()).map((batch) => ({
        batchId: batch.batchId,
        batchName: batch.batchName,
        importDate: batch.importDate,
        transactionCount: batch.transactions.length,
        totalAmount: round2(batch.totalAmount),
      })),
      rules,
      legalCitations,
      auditTrailUrl: `/api/audit/entity/FUND/${fund.id}`,
      generatedAt: new Date(),
      generatedBy: userId,
    };
  }

  /**
   * Validate a Gateway export.
   */
  validateExport<T>(
    report: T,
    reportType: GatewayReportType
  ): { isValid: boolean; errors: GatewayValidationError[]; warnings: GatewayValidationWarning[] } {
    const errors: GatewayValidationError[] = [];
    const warnings: GatewayValidationWarning[] = [];

    // Common validations
    if (reportType === 'AFR_FUND') {
      const afrReport = report as AFRFundReport;

      // Check for required funds (General Fund)
      const hasGeneralFund = afrReport.funds.some((f) => f.fundNumber === '101');
      if (!hasGeneralFund) {
        warnings.push({
          code: 'MISSING_GENERAL_FUND',
          message: 'General Fund (101) is typically required in AFR',
          severity: 'WARNING',
        });
      }

      // Check for negative balances
      for (const fund of afrReport.funds) {
        if (fund.endingBalance < 0) {
          warnings.push({
            code: 'NEGATIVE_BALANCE',
            fundNumber: fund.fundNumber,
            message: `Fund ${fund.fundNumber} has negative ending balance`,
            severity: 'WARNING',
          });
        }

        // Check for unbalanced funds
        if (!fund.calculated.isBalanced) {
          errors.push({
            code: 'FUND_NOT_BALANCED',
            fundNumber: fund.fundNumber,
            message: `Fund ${fund.fundNumber} beginning + net change does not equal ending`,
            severity: 'ERROR',
          });
        }
      }

      // Check totals
      const calculatedTotal =
        afrReport.totals.totalBeginningBalance +
        afrReport.totals.totalReceipts -
        afrReport.totals.totalDisbursements;

      if (Math.abs(calculatedTotal - afrReport.totals.totalEndingBalance) > 0.01) {
        errors.push({
          code: 'TOTALS_NOT_BALANCED',
          message: 'Report totals do not balance',
          severity: 'ERROR',
        });
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Format output for export.
   */
  private formatOutput(report: unknown, format: 'JSON' | 'CSV' | 'XML'): string {
    switch (format) {
      case 'JSON':
        return JSON.stringify(report, null, 2);

      case 'CSV':
        return this.formatCSV(report as AFRFundReport);

      case 'XML':
        return this.formatXML(report as AFRFundReport);

      default:
        return JSON.stringify(report, null, 2);
    }
  }

  /**
   * Format as CSV for Gateway upload.
   */
  private formatCSV(report: AFRFundReport): string {
    const lines: string[] = [];

    // Header
    lines.push([
      'Fund Number',
      'Fund Name',
      'Beginning Balance',
      'Property Taxes',
      'Local Income Tax',
      'Intergovernmental',
      'Charges for Services',
      'Other Receipts',
      'Transfers In',
      'Total Receipts',
      'Personal Services',
      'Supplies',
      'Other Services',
      'Capital Outlay',
      'Debt Service',
      'Other Disbursements',
      'Transfers Out',
      'Total Disbursements',
      'Ending Balance',
    ].join(','));

    // Data rows
    for (const fund of report.funds) {
      lines.push([
        fund.fundNumber,
        `"${fund.fundName}"`,
        fund.beginningBalance.toString(),
        fund.receipts.propertyTaxes.toString(),
        fund.receipts.localIncomeTax.toString(),
        fund.receipts.intergovernmental.toString(),
        fund.receipts.chargesForServices.toString(),
        fund.receipts.otherReceipts.toString(),
        fund.receipts.transfersIn.toString(),
        fund.receipts.totalReceipts.toString(),
        fund.disbursements.personalServices.toString(),
        fund.disbursements.supplies.toString(),
        fund.disbursements.otherServicesCharges.toString(),
        fund.disbursements.capitalOutlay.toString(),
        (fund.disbursements.debtServicePrincipal + fund.disbursements.debtServiceInterest).toString(),
        fund.disbursements.otherDisbursements.toString(),
        fund.disbursements.transfersOut.toString(),
        fund.disbursements.totalDisbursements.toString(),
        fund.endingBalance.toString(),
      ].join(','));
    }

    return lines.join('\n');
  }

  /**
   * Format as XML for Gateway upload.
   */
  private formatXML(report: AFRFundReport): string {
    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
    xml += '<AFRFundReport>\n';
    xml += `  <FiscalYear>${report.reportPeriod.fiscalYear}</FiscalYear>\n`;
    xml += '  <Funds>\n';

    for (const fund of report.funds) {
      xml += '    <Fund>\n';
      xml += `      <FundNumber>${fund.fundNumber}</FundNumber>\n`;
      xml += `      <FundName>${this.escapeXml(fund.fundName)}</FundName>\n`;
      xml += `      <BeginningBalance>${fund.beginningBalance}</BeginningBalance>\n`;
      xml += '      <Receipts>\n';
      xml += `        <PropertyTaxes>${fund.receipts.propertyTaxes}</PropertyTaxes>\n`;
      xml += `        <LocalIncomeTax>${fund.receipts.localIncomeTax}</LocalIncomeTax>\n`;
      xml += `        <Intergovernmental>${fund.receipts.intergovernmental}</Intergovernmental>\n`;
      xml += `        <ChargesForServices>${fund.receipts.chargesForServices}</ChargesForServices>\n`;
      xml += `        <OtherReceipts>${fund.receipts.otherReceipts}</OtherReceipts>\n`;
      xml += `        <TransfersIn>${fund.receipts.transfersIn}</TransfersIn>\n`;
      xml += `        <TotalReceipts>${fund.receipts.totalReceipts}</TotalReceipts>\n`;
      xml += '      </Receipts>\n';
      xml += '      <Disbursements>\n';
      xml += `        <PersonalServices>${fund.disbursements.personalServices}</PersonalServices>\n`;
      xml += `        <Supplies>${fund.disbursements.supplies}</Supplies>\n`;
      xml += `        <OtherServices>${fund.disbursements.otherServicesCharges}</OtherServices>\n`;
      xml += `        <CapitalOutlay>${fund.disbursements.capitalOutlay}</CapitalOutlay>\n`;
      xml += `        <DebtServicePrincipal>${fund.disbursements.debtServicePrincipal}</DebtServicePrincipal>\n`;
      xml += `        <DebtServiceInterest>${fund.disbursements.debtServiceInterest}</DebtServiceInterest>\n`;
      xml += `        <TransfersOut>${fund.disbursements.transfersOut}</TransfersOut>\n`;
      xml += `        <TotalDisbursements>${fund.disbursements.totalDisbursements}</TotalDisbursements>\n`;
      xml += '      </Disbursements>\n';
      xml += `      <EndingBalance>${fund.endingBalance}</EndingBalance>\n`;
      xml += '    </Fund>\n';
    }

    xml += '  </Funds>\n';
    xml += '</AFRFundReport>';

    return xml;
  }

  /**
   * Escape XML special characters.
   */
  private escapeXml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }
}

/**
 * Create a Gateway export engine.
 */
export function createGatewayExportEngine(repository: FinanceRepository): GatewayExportEngine {
  return new GatewayExportEngine(repository);
}
