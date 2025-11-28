// src/states/in/finance/in-finance-rules.ts

/**
 * Indiana Finance Rules
 *
 * State-specific finance validation rules including:
 * - IC 6-1.1-18.5: Circuit-breaker levy cap
 * - IC 36-1-12: Budget approval process
 * - IC 5-3-1: Publication requirements
 * - SBOA guidelines and reporting requirements
 */

import {
  ExecutableRule,
  LegalOpinion,
  LegalCitation,
  RuleViolation,
  RuleEvaluationContext,
} from '../../../core/finance/finance-rules.types';

import {
  createRule,
  createViolation,
  createCitation,
  createLegalOpinion,
  createRuleValidationEngine,
  DefaultRuleValidationEngine,
} from '../../../core/finance/finance-rules.engine';

// ============================================================================
// INDIANA LEGAL CITATIONS
// ============================================================================

export const IN_CITATIONS = {
  // Levy and Property Tax
  CIRCUIT_BREAKER: createCitation(
    'IC 6-1.1-20.6',
    'Property Tax Cap (Circuit Breaker)',
    'Limits property taxes to 1% for homesteads, 2% for other residential/agricultural, 3% for other property',
    'INDIANA_CODE',
    { year: 2008, url: 'http://iga.in.gov/legislative/laws/2023/ic/titles/006#6-1.1-20.6' }
  ),

  LEVY_LIMITS: createCitation(
    'IC 6-1.1-18.5',
    'Levy Limitations',
    'Property tax levy limitations and growth quotient calculations',
    'INDIANA_CODE',
    { year: 1973, url: 'http://iga.in.gov/legislative/laws/2023/ic/titles/006#6-1.1-18.5' }
  ),

  MAX_LEVY_GROWTH: createCitation(
    'IC 6-1.1-18.5-3',
    'Maximum Levy Growth',
    'Levy may not exceed prior year levy times the assessed value growth quotient',
    'INDIANA_CODE',
    { year: 1973 }
  ),

  // Budget Process
  BUDGET_ADOPTION: createCitation(
    'IC 6-1.1-17',
    'Budget Adoption Procedures',
    'Requirements for adopting annual budgets, tax levies, and tax rates',
    'INDIANA_CODE'
  ),

  BUDGET_HEARING: createCitation(
    'IC 6-1.1-17-3',
    'Budget Hearing Requirements',
    'Public hearing must be held before budget adoption',
    'INDIANA_CODE'
  ),

  ADDITIONAL_APPROPRIATION: createCitation(
    'IC 6-1.1-18-5',
    'Additional Appropriations',
    'Procedure for additional appropriations after budget adoption',
    'INDIANA_CODE'
  ),

  // Appropriations
  APPROPRIATION_LIMIT: createCitation(
    'IC 6-1.1-18-4',
    'Appropriation Limitations',
    'Expenditures may not exceed appropriations',
    'INDIANA_CODE'
  ),

  // Publication Requirements
  PUBLICATION_GENERAL: createCitation(
    'IC 5-3-1',
    'Publication Requirements',
    'General requirements for legal publications and notices',
    'INDIANA_CODE',
    { url: 'http://iga.in.gov/legislative/laws/2023/ic/titles/005#5-3-1' }
  ),

  BUDGET_PUBLICATION: createCitation(
    'IC 6-1.1-17-3.5',
    'Budget Notice Publication',
    'Budget notice must be published at least 10 days before hearing',
    'INDIANA_CODE'
  ),

  // Transfers
  FUND_TRANSFER: createCitation(
    'IC 36-1-8-4',
    'Interfund Transfers',
    'Requirements for transfers between funds',
    'INDIANA_CODE'
  ),

  // Surplus
  EXCESS_LEVY_SURPLUS: createCitation(
    'IC 6-1.1-18.5-17',
    'Excess Levy Appeals and Surplus',
    'Handling of excess levy collections and surplus funds',
    'INDIANA_CODE'
  ),

  // Reporting
  AFR_REQUIREMENT: createCitation(
    'IC 5-11-1-4',
    'Annual Financial Report',
    'Requirement to file annual financial report with SBOA',
    'INDIANA_CODE'
  ),

  GATEWAY_FILING: createCitation(
    'IC 5-14-3.8',
    'Gateway Electronic Filing',
    'Requirement to file reports through Indiana Gateway',
    'INDIANA_CODE'
  ),

  // Debt
  DEBT_LIMIT: createCitation(
    'IC 36-1-15',
    'Debt Service Fund Requirements',
    'Requirements for debt service funds and payments',
    'INDIANA_CODE'
  ),

  BOND_ISSUANCE: createCitation(
    'IC 36-4-6',
    'Municipal Bond Issuance',
    'Procedures for issuing bonds',
    'INDIANA_CODE'
  ),

  // Meeting Notice
  OPEN_DOOR_LAW: createCitation(
    'IC 5-14-1.5',
    'Open Door Law',
    'Requirements for public meetings and notices',
    'INDIANA_CODE',
    { url: 'http://iga.in.gov/legislative/laws/2023/ic/titles/005#5-14-1.5' }
  ),

  MEETING_NOTICE: createCitation(
    'IC 5-14-1.5-5',
    'Meeting Notice Requirements',
    'Notice must be posted 48 hours before meeting',
    'INDIANA_CODE'
  ),
};

// ============================================================================
// INDIANA LEGAL OPINIONS
// ============================================================================

export const IN_LEGAL_OPINIONS: LegalOpinion[] = [
  createLegalOpinion(
    'IN-LEVY-001',
    'Understanding Indiana Property Tax Levy Limits',
    'Indiana property tax levies are subject to strict growth limitations under IC 6-1.1-18.5. ' +
    'The maximum levy is calculated by multiplying the prior year\'s maximum permissible levy ' +
    'by the assessed value growth quotient (AVGQ). The AVGQ is determined by DLGF and reflects ' +
    'growth in the tax base. Units may not exceed this calculated maximum without an excess levy ' +
    'appeal. Violations may result in DLGF adjustments to the certified levy.',
    'LEVY',
    [IN_CITATIONS.LEVY_LIMITS, IN_CITATIONS.MAX_LEVY_GROWTH],
    ['levy', 'property tax', 'growth quotient', 'AVGQ', 'DLGF'],
    {
      authority: 'DLGF/SBOA',
      issuedDate: new Date('2020-01-01'),
    }
  ),

  createLegalOpinion(
    'IN-LEVY-002',
    'Circuit Breaker Tax Credit Impact',
    'The circuit breaker (IC 6-1.1-20.6) caps property taxes at 1% for homesteads, 2% for ' +
    'other residential and agricultural property, and 3% for all other property. When a ' +
    'taxpayer\'s bill exceeds these percentages of gross assessed value, a credit is applied. ' +
    'This credit reduces revenue to local units. Units must project circuit breaker losses ' +
    'when budgeting and may need to reduce appropriations or find alternative revenue sources.',
    'LEVY',
    [IN_CITATIONS.CIRCUIT_BREAKER],
    ['circuit breaker', 'tax cap', 'homestead', 'property tax credit'],
    {
      authority: 'DLGF',
      issuedDate: new Date('2008-01-01'),
    }
  ),

  createLegalOpinion(
    'IN-APPROP-001',
    'Appropriation Limits and Additional Appropriations',
    'Indiana law prohibits expenditures in excess of appropriations (IC 6-1.1-18-4). ' +
    'If a unit needs to spend more than appropriated, it must follow the additional ' +
    'appropriation process under IC 6-1.1-18-5. This requires publication of notice, ' +
    'a public hearing, and approval by the fiscal body. The additional appropriation ' +
    'must identify the source of funds. Spending without appropriation authority is a ' +
    'serious compliance violation that may trigger SBOA audit findings.',
    'APPROPRIATION',
    [IN_CITATIONS.APPROPRIATION_LIMIT, IN_CITATIONS.ADDITIONAL_APPROPRIATION],
    ['appropriation', 'additional appropriation', 'spending limit', 'over-expenditure'],
    {
      authority: 'SBOA',
      issuedDate: new Date('2019-01-01'),
    }
  ),

  createLegalOpinion(
    'IN-PUB-001',
    'Budget Publication Requirements',
    'Before holding a public hearing on the proposed budget, the unit must publish notice ' +
    'in accordance with IC 6-1.1-17-3.5. The notice must be published at least 10 days ' +
    'before the hearing date in a newspaper of general circulation. The notice must include ' +
    'the proposed budget amounts, proposed tax levies, proposed tax rates, and the time, ' +
    'date, and place of the public hearing. Failure to properly publish may invalidate ' +
    'the budget adoption.',
    'PUBLICATION',
    [IN_CITATIONS.BUDGET_PUBLICATION, IN_CITATIONS.PUBLICATION_GENERAL],
    ['publication', 'budget notice', 'newspaper', 'public hearing'],
    {
      authority: 'DLGF',
    }
  ),

  createLegalOpinion(
    'IN-MEET-001',
    'Open Door Law Meeting Notice Requirements',
    'Under Indiana\'s Open Door Law (IC 5-14-1.5), public meetings require at least ' +
    '48 hours advance notice. The notice must include the date, time, and place of the ' +
    'meeting. Notice must be posted at the principal office of the governing body and ' +
    'delivered to news media that have requested notice. Special meetings have different ' +
    'requirements. Budget adoption meetings and public hearings must comply with these ' +
    'requirements in addition to any specific budget notice requirements.',
    'MEETING_NOTICE',
    [IN_CITATIONS.OPEN_DOOR_LAW, IN_CITATIONS.MEETING_NOTICE],
    ['open door', 'meeting notice', '48 hours', 'public meeting'],
    {
      authority: 'Public Access Counselor',
    }
  ),

  createLegalOpinion(
    'IN-TRANSFER-001',
    'Interfund Transfer Requirements',
    'Transfers between funds are governed by IC 36-1-8-4. Not all transfers are permitted; ' +
    'some funds have restrictions on transfers in or out. General Fund transfers to other ' +
    'funds require fiscal body approval. Transfers from restricted funds (like cumulative ' +
    'funds or utility funds) are generally prohibited except as specifically allowed by ' +
    'statute. Documentation of transfer purpose and authorization is required for audit.',
    'TRANSFER',
    [IN_CITATIONS.FUND_TRANSFER],
    ['transfer', 'interfund', 'fund transfer', 'restricted funds'],
    {
      authority: 'SBOA',
    }
  ),

  createLegalOpinion(
    'IN-REPORT-001',
    'Annual Financial Report (AFR) Filing Requirements',
    'All local governmental units must file an Annual Financial Report with SBOA within ' +
    '60 days after the close of the fiscal year (IC 5-11-1-4). The report must be filed ' +
    'through Indiana Gateway. Late filing may result in withholding of state distributions ' +
    'and potential audit referral. The AFR must include all funds, all receipts and ' +
    'disbursements, and must balance according to SBOA standards.',
    'REPORTING',
    [IN_CITATIONS.AFR_REQUIREMENT, IN_CITATIONS.GATEWAY_FILING],
    ['AFR', 'annual financial report', 'Gateway', 'SBOA', 'filing deadline'],
    {
      authority: 'SBOA',
    }
  ),
];

// ============================================================================
// INDIANA FINANCE RULES
// ============================================================================

/**
 * Create all Indiana finance rules.
 */
export function createIndianaFinanceRules(): ExecutableRule[] {
  const rules: ExecutableRule[] = [];

  // ---------------------------------------------------------------------------
  // APPROPRIATION RULES
  // ---------------------------------------------------------------------------

  rules.push(
    createRule(
      {
        id: 'IN-APPROP-001',
        name: 'Expenditures Cannot Exceed Appropriations',
        description: 'Disbursements in any fund may not exceed the appropriated amount',
        category: 'APPROPRIATION',
        severity: 'ERROR',
        citation: IN_CITATIONS.APPROPRIATION_LIMIT,
        legalOpinionId: 'IN-APPROP-001',
        messageTemplate: 'Fund {fundCode} ({fundName}) expenditures of {actual} exceed appropriation of {limit}',
        correctionGuidance: 'Request an additional appropriation or reduce expenditures',
        state: 'IN',
      },
      (context: RuleEvaluationContext): RuleViolation[] => {
        const violations: RuleViolation[] = [];

        if (!context.funds || !context.budgetLines || !context.transactions) {
          return violations;
        }

        for (const fund of context.funds) {
          // Get appropriations for this fund
          const appropriations = context.budgetLines
            .filter((bl) => bl.fundId === fund.id && bl.type === 'APPROPRIATION')
            .reduce((sum, bl) => sum + bl.amount, 0);

          // Get disbursements for this fund
          const disbursements = context.transactions
            .filter(
              (t) =>
                t.fundId === fund.id &&
                t.type === 'DISBURSEMENT' &&
                t.status !== 'VOID'
            )
            .reduce((sum, t) => sum + t.amount, 0);

          if (disbursements > appropriations && appropriations > 0) {
            violations.push(
              createViolation(
                {
                  id: 'IN-APPROP-001',
                  name: 'Expenditures Cannot Exceed Appropriations',
                  description: '',
                  category: 'APPROPRIATION',
                  severity: 'ERROR',
                  citation: IN_CITATIONS.APPROPRIATION_LIMIT,
                  legalOpinionId: 'IN-APPROP-001',
                  messageTemplate: '',
                  isActive: true,
                },
                {
                  message: `Fund ${fund.code} (${fund.name}) expenditures of $${disbursements.toLocaleString()} exceed appropriation of $${appropriations.toLocaleString()}`,
                  entityType: 'FUND',
                  entityId: fund.id,
                  entityDescription: `${fund.code} - ${fund.name}`,
                  actualValue: disbursements,
                  expectedValue: appropriations,
                  details: {
                    fundCode: fund.code,
                    fundName: fund.name,
                    disbursements,
                    appropriations,
                    overageAmount: disbursements - appropriations,
                    overagePercent: ((disbursements - appropriations) / appropriations) * 100,
                  },
                }
              )
            );
          }
        }

        return violations;
      }
    )
  );

  // ---------------------------------------------------------------------------
  // LEVY RULES
  // ---------------------------------------------------------------------------

  rules.push(
    createRule(
      {
        id: 'IN-LEVY-001',
        name: 'Levy Growth Limitation',
        description: 'Property tax levy may not exceed prior year levy times growth quotient',
        category: 'LEVY',
        severity: 'ERROR',
        citation: IN_CITATIONS.MAX_LEVY_GROWTH,
        legalOpinionId: 'IN-LEVY-001',
        messageTemplate: 'Proposed levy of {proposed} exceeds maximum allowable levy of {maximum}',
        correctionGuidance: 'Reduce the proposed levy or file an excess levy appeal with DLGF',
        state: 'IN',
      },
      (context: RuleEvaluationContext): RuleViolation[] => {
        const violations: RuleViolation[] = [];

        // Check for levy data in additional context
        const levyData = context.additionalData?.levyData as {
          proposedLevy?: number;
          priorYearLevy?: number;
          growthQuotient?: number;
        } | undefined;

        if (!levyData?.proposedLevy || !levyData?.priorYearLevy || !levyData?.growthQuotient) {
          return violations;
        }

        const maxLevy = levyData.priorYearLevy * levyData.growthQuotient;

        if (levyData.proposedLevy > maxLevy) {
          violations.push(
            createViolation(
              {
                id: 'IN-LEVY-001',
                name: 'Levy Growth Limitation',
                description: '',
                category: 'LEVY',
                severity: 'ERROR',
                citation: IN_CITATIONS.MAX_LEVY_GROWTH,
                legalOpinionId: 'IN-LEVY-001',
                messageTemplate: '',
                isActive: true,
              },
              {
                message: `Proposed levy of $${levyData.proposedLevy.toLocaleString()} exceeds maximum allowable levy of $${maxLevy.toLocaleString()}`,
                entityType: 'OVERALL',
                actualValue: levyData.proposedLevy,
                expectedValue: maxLevy,
                details: {
                  proposedLevy: levyData.proposedLevy,
                  priorYearLevy: levyData.priorYearLevy,
                  growthQuotient: levyData.growthQuotient,
                  maxLevy,
                  excessAmount: levyData.proposedLevy - maxLevy,
                },
              }
            )
          );
        }

        return violations;
      }
    )
  );

  // ---------------------------------------------------------------------------
  // SURPLUS RULES
  // ---------------------------------------------------------------------------

  rules.push(
    createRule(
      {
        id: 'IN-SURPLUS-001',
        name: 'Excessive Fund Balance Warning',
        description: 'Fund balance exceeding two years of expenditures may indicate over-taxation',
        category: 'SURPLUS',
        severity: 'WARNING',
        citation: IN_CITATIONS.EXCESS_LEVY_SURPLUS,
        messageTemplate: 'Fund {fundCode} balance of {balance} exceeds recommended maximum',
        correctionGuidance: 'Consider reducing the levy or transferring excess to appropriate funds',
        state: 'IN',
      },
      (context: RuleEvaluationContext): RuleViolation[] => {
        const violations: RuleViolation[] = [];

        if (!context.funds || !context.transactions) {
          return violations;
        }

        for (const fund of context.funds) {
          if (!fund.currentBalance || fund.type !== 'GOVERNMENTAL') {
            continue;
          }

          // Calculate annual expenditures
          const annualExpenses = context.transactions
            .filter(
              (t) =>
                t.fundId === fund.id &&
                t.type === 'DISBURSEMENT' &&
                t.status !== 'VOID' &&
                new Date(t.transactionDate).getFullYear() === context.fiscalYear
            )
            .reduce((sum, t) => sum + t.amount, 0);

          // Check if balance exceeds 2x annual expenses
          const threshold = annualExpenses * 2;

          if (fund.currentBalance > threshold && threshold > 0) {
            violations.push(
              createViolation(
                {
                  id: 'IN-SURPLUS-001',
                  name: 'Excessive Fund Balance Warning',
                  description: '',
                  category: 'SURPLUS',
                  severity: 'WARNING',
                  citation: IN_CITATIONS.EXCESS_LEVY_SURPLUS,
                  messageTemplate: '',
                  isActive: true,
                },
                {
                  message: `Fund ${fund.code} (${fund.name}) balance of $${fund.currentBalance.toLocaleString()} exceeds recommended maximum of $${threshold.toLocaleString()} (2x annual expenditures)`,
                  entityType: 'FUND',
                  entityId: fund.id,
                  entityDescription: `${fund.code} - ${fund.name}`,
                  actualValue: fund.currentBalance,
                  expectedValue: threshold,
                  details: {
                    fundCode: fund.code,
                    fundName: fund.name,
                    currentBalance: fund.currentBalance,
                    annualExpenses,
                    threshold,
                    excessAmount: fund.currentBalance - threshold,
                  },
                }
              )
            );
          }
        }

        return violations;
      }
    )
  );

  // ---------------------------------------------------------------------------
  // TRANSFER RULES
  // ---------------------------------------------------------------------------

  rules.push(
    createRule(
      {
        id: 'IN-TRANSFER-001',
        name: 'Restricted Fund Transfer Check',
        description: 'Transfers from restricted funds must be specifically authorized',
        category: 'TRANSFER',
        severity: 'ERROR',
        citation: IN_CITATIONS.FUND_TRANSFER,
        legalOpinionId: 'IN-TRANSFER-001',
        messageTemplate: 'Transfer from restricted fund {fundCode} requires specific statutory authority',
        correctionGuidance: 'Verify statutory authority for the transfer or reverse it',
        state: 'IN',
      },
      (context: RuleEvaluationContext): RuleViolation[] => {
        const violations: RuleViolation[] = [];

        if (!context.funds || !context.transactions) {
          return violations;
        }

        // Build fund lookup
        const fundsById = new Map(context.funds.map((f) => [f.id, f]));

        // Check transfer transactions
        const transfers = context.transactions.filter(
          (t) => t.type === 'TRANSFER' && t.status !== 'VOID'
        );

        for (const transfer of transfers) {
          const sourceFund = fundsById.get(transfer.fundId);

          if (sourceFund?.isRestricted) {
            violations.push(
              createViolation(
                {
                  id: 'IN-TRANSFER-001',
                  name: 'Restricted Fund Transfer Check',
                  description: '',
                  category: 'TRANSFER',
                  severity: 'ERROR',
                  citation: IN_CITATIONS.FUND_TRANSFER,
                  legalOpinionId: 'IN-TRANSFER-001',
                  messageTemplate: '',
                  isActive: true,
                },
                {
                  message: `Transfer of $${transfer.amount.toLocaleString()} from restricted fund ${sourceFund.code} (${sourceFund.name}) requires specific statutory authority`,
                  entityType: 'TRANSACTION',
                  entityId: transfer.id,
                  entityDescription: `Transfer from ${sourceFund.code}`,
                  actualValue: transfer.amount,
                  details: {
                    transactionId: transfer.id,
                    fundCode: sourceFund.code,
                    fundName: sourceFund.name,
                    amount: transfer.amount,
                    date: transfer.transactionDate,
                  },
                }
              )
            );
          }
        }

        return violations;
      }
    )
  );

  // ---------------------------------------------------------------------------
  // REPORTING RULES
  // ---------------------------------------------------------------------------

  rules.push(
    createRule(
      {
        id: 'IN-REPORT-001',
        name: 'AFR Filing Deadline',
        description: 'Annual Financial Report must be filed within 60 days of year end',
        category: 'REPORTING',
        severity: 'WARNING',
        citation: IN_CITATIONS.AFR_REQUIREMENT,
        legalOpinionId: 'IN-REPORT-001',
        messageTemplate: 'AFR for fiscal year {year} is due by {dueDate}',
        correctionGuidance: 'File AFR through Indiana Gateway before the deadline',
        state: 'IN',
      },
      (context: RuleEvaluationContext): RuleViolation[] => {
        const violations: RuleViolation[] = [];

        // Check if evaluation date is past AFR due date
        const fiscalYearEnd = new Date(context.fiscalYear, 11, 31);
        const dueDate = new Date(context.fiscalYear + 1, 1, 28); // Feb 28

        // Check additional data for AFR filing status
        const afrFiled = context.additionalData?.afrFiled as boolean | undefined;

        if (context.evaluationDate > dueDate && !afrFiled) {
          violations.push(
            createViolation(
              {
                id: 'IN-REPORT-001',
                name: 'AFR Filing Deadline',
                description: '',
                category: 'REPORTING',
                severity: 'WARNING',
                citation: IN_CITATIONS.AFR_REQUIREMENT,
                legalOpinionId: 'IN-REPORT-001',
                messageTemplate: '',
                isActive: true,
              },
              {
                message: `AFR for fiscal year ${context.fiscalYear} was due by ${dueDate.toLocaleDateString()} and may not have been filed`,
                entityType: 'OVERALL',
                details: {
                  fiscalYear: context.fiscalYear,
                  dueDate: dueDate.toISOString(),
                  evaluationDate: context.evaluationDate.toISOString(),
                },
              }
            )
          );
        }

        return violations;
      }
    )
  );

  // ---------------------------------------------------------------------------
  // NEGATIVE BALANCE RULE
  // ---------------------------------------------------------------------------

  rules.push(
    createRule(
      {
        id: 'IN-BAL-001',
        name: 'Negative Fund Balance',
        description: 'Fund balance should not be negative',
        category: 'APPROPRIATION',
        severity: 'CRITICAL',
        citation: IN_CITATIONS.APPROPRIATION_LIMIT,
        messageTemplate: 'Fund {fundCode} has a negative balance of {balance}',
        correctionGuidance: 'Transfer funds from another source or reduce expenditures immediately',
        state: 'IN',
      },
      (context: RuleEvaluationContext): RuleViolation[] => {
        const violations: RuleViolation[] = [];

        if (!context.funds) {
          return violations;
        }

        for (const fund of context.funds) {
          if (fund.currentBalance !== undefined && fund.currentBalance < 0) {
            violations.push(
              createViolation(
                {
                  id: 'IN-BAL-001',
                  name: 'Negative Fund Balance',
                  description: '',
                  category: 'APPROPRIATION',
                  severity: 'CRITICAL',
                  citation: IN_CITATIONS.APPROPRIATION_LIMIT,
                  messageTemplate: '',
                  isActive: true,
                },
                {
                  message: `Fund ${fund.code} (${fund.name}) has a negative balance of $${fund.currentBalance.toLocaleString()}`,
                  entityType: 'FUND',
                  entityId: fund.id,
                  entityDescription: `${fund.code} - ${fund.name}`,
                  actualValue: fund.currentBalance,
                  expectedValue: 0,
                  details: {
                    fundCode: fund.code,
                    fundName: fund.name,
                    currentBalance: fund.currentBalance,
                  },
                }
              )
            );
          }
        }

        return violations;
      }
    )
  );

  return rules;
}

// ============================================================================
// INDIANA RULE ENGINE FACTORY
// ============================================================================

/**
 * Create an Indiana-specific rule validation engine.
 */
export function createIndianaRuleEngine(): DefaultRuleValidationEngine {
  return createRuleValidationEngine(
    createIndianaFinanceRules(),
    IN_LEGAL_OPINIONS
  );
}

// Export citations for use in other modules
export { IN_CITATIONS as IndianaLegalCitations };
