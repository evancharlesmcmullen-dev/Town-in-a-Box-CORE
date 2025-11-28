// src/core/finance/finance-rules.types.ts

/**
 * Town-in-a-Box Finance Engine - Finance Rules & Legal Opinions Types
 *
 * Comprehensive rule validation system including:
 * - Rule categories (appropriation, levy, surplus, transfer, publication)
 * - Legal citations and opinions
 * - Violation detection with severity levels
 * - "Explain this" links to legal guidance
 */

import { JurisdictionProfile } from '../tenancy/tenancy.types';
import { Fund, Account, Transaction, BudgetLine } from './finance.types';

// ============================================================================
// RULE CATEGORIES
// ============================================================================

/**
 * High-level category of a finance rule.
 */
export type RuleCategory =
  | 'APPROPRIATION'    // Spending limits, additional appropriations
  | 'LEVY'             // Tax levy limits, circuit breaker, growth caps
  | 'SURPLUS'          // Fund balance requirements, excess surplus rules
  | 'TRANSFER'         // Inter-fund transfer rules
  | 'PUBLICATION'      // Public notice requirements
  | 'MEETING_NOTICE'   // Meeting notice for budget hearings
  | 'DEBT'             // Debt issuance limits and procedures
  | 'INVESTMENT'       // Investment policy requirements
  | 'PROCUREMENT'      // Purchasing thresholds and procedures
  | 'PAYROLL'          // Payroll/personnel rules
  | 'REPORTING'        // Filing deadlines and requirements
  | 'AUDIT';           // Audit requirements

/**
 * Severity level of a rule violation.
 */
export type RuleSeverity =
  | 'ERROR'     // Must be corrected, blocks filing
  | 'WARNING'   // Should be reviewed, may require explanation
  | 'INFO'      // Informational, best practice suggestion
  | 'CRITICAL'; // Serious violation, may trigger audit

/**
 * High-level category of a fund for rule purposes.
 */
export type FundCategory =
  | 'general'
  | 'road'
  | 'utility'
  | 'capital'
  | 'debtService'
  | 'grant'
  | 'specialRevenue'
  | 'other';

/**
 * A canonical fund definition for Indiana units.
 * This is not the live Fund entity, but the rule/catalog entry.
 */
export interface FundDefinition {
  code: string;              // e.g. "101"
  name: string;              // e.g. "General Fund"
  category: FundCategory;

  // Optional flags for special behavior or oversight.
  isRestricted?: boolean;    // e.g. utility funds, CCD, cumulative funds
  description?: string;

  // Allowed use tags for high-level guardrails (e.g. "operations", "roads", "cemeteries").
  allowedUseTags?: string[];
}

// ============================================================================
// LEGAL CITATIONS & OPINIONS
// ============================================================================

/**
 * Reference to a legal citation (statute, regulation, etc.).
 */
export interface LegalCitation {
  /** Citation code (e.g., "IC 6-1.1-18.5-3") */
  code: string;

  /** Full title */
  title: string;

  /** Short description */
  description: string;

  /** Full URL to official code */
  url?: string;

  /** Source (e.g., "Indiana Code", "IAC", "SBOA Bulletin") */
  source: 'INDIANA_CODE' | 'IAC' | 'SBOA_BULLETIN' | 'DLGF_MEMO' | 'ATTORNEY_GENERAL' | 'CASE_LAW' | 'OTHER';

  /** Year enacted/last amended */
  year?: number;

  /** Keywords for search */
  keywords?: string[];
}

/**
 * Legal opinion or guidance document.
 */
export interface LegalOpinion {
  /** Unique ID */
  id: string;

  /** Title */
  title: string;

  /** Summary in plain English */
  summary: string;

  /** Full text or excerpt */
  fullText?: string;

  /** Related citations */
  citations: LegalCitation[];

  /** Category */
  category: RuleCategory;

  /** Keywords */
  keywords: string[];

  /** Date issued/updated */
  issuedDate?: Date;

  /** Issuing authority */
  authority?: string;

  /** Whether this is still current guidance */
  isCurrent: boolean;

  /** Related opinion IDs */
  relatedOpinions?: string[];
}

// ============================================================================
// FINANCE RULES
// ============================================================================

/**
 * Context for rule evaluation.
 */
export interface RuleEvaluationContext {
  /** Tenant ID */
  tenantId: string;

  /** Fiscal year being evaluated */
  fiscalYear: number;

  /** Jurisdiction profile */
  jurisdiction: JurisdictionProfile;

  /** Current date */
  evaluationDate: Date;

  /** Funds in scope */
  funds?: Fund[];

  /** Accounts in scope */
  accounts?: Account[];

  /** Transactions in scope */
  transactions?: Transaction[];

  /** Budget lines in scope */
  budgetLines?: BudgetLine[];

  /** Additional context data */
  additionalData?: Record<string, unknown>;
}

/**
 * A finance rule definition.
 */
export interface FinanceRule {
  /** Unique rule ID */
  id: string;

  /** Human-readable name */
  name: string;

  /** Description of what the rule checks */
  description: string;

  /** Rule category */
  category: RuleCategory;

  /** Default severity if violated */
  severity: RuleSeverity;

  /** Primary legal citation */
  citation?: LegalCitation;

  /** Additional citations */
  additionalCitations?: LegalCitation[];

  /** Related legal opinion ID */
  legalOpinionId?: string;

  /** Message template for violations (supports {placeholders}) */
  messageTemplate: string;

  /** Suggested corrective action */
  correctionGuidance?: string;

  /** State this rule applies to (undefined = all states) */
  state?: string;

  /** Jurisdiction types this rule applies to */
  jurisdictionTypes?: string[];

  /** Whether rule is currently active */
  isActive: boolean;

  /** Effective date of rule */
  effectiveDate?: Date;

  /** Sunset date if rule expires */
  sunsetDate?: Date;

  /** Tags for filtering */
  tags?: string[];
}

/**
 * Result of evaluating a single rule.
 */
export interface RuleViolation {
  /** Rule that was violated */
  ruleId: string;

  /** Rule name */
  ruleName: string;

  /** Category */
  category: RuleCategory;

  /** Severity */
  severity: RuleSeverity;

  /** Violation message (populated from template) */
  message: string;

  /** Affected entity type */
  entityType?: 'FUND' | 'ACCOUNT' | 'TRANSACTION' | 'BUDGET_LINE' | 'OVERALL';

  /** Affected entity ID */
  entityId?: string;

  /** Affected entity name/description */
  entityDescription?: string;

  /** Actual value that caused violation */
  actualValue?: unknown;

  /** Expected/limit value */
  expectedValue?: unknown;

  /** Legal citation for reference */
  citation?: LegalCitation;

  /** Link to legal opinion for "Explain this" */
  legalOpinionId?: string;

  /** Suggested corrective action */
  correctionGuidance?: string;

  /** When violation was detected */
  detectedAt: Date;

  /** Additional details */
  details?: Record<string, unknown>;
}

/**
 * Result of a complete rule validation run.
 */
export interface RuleValidationResult {
  /** Tenant ID */
  tenantId: string;

  /** Fiscal year evaluated */
  fiscalYear: number;

  /** When validation was run */
  evaluatedAt: Date;

  /** Total rules checked */
  rulesChecked: number;

  /** Rules passed */
  rulesPassed: number;

  /** All violations found */
  violations: RuleViolation[];

  /** Summary by severity */
  summary: {
    critical: number;
    errors: number;
    warnings: number;
    info: number;
  };

  /** Summary by category */
  byCategory: Record<RuleCategory, number>;

  /** Overall pass/fail status */
  passed: boolean;

  /** Can proceed with filing? */
  canFile: boolean;

  /** Duration in milliseconds */
  durationMs: number;
}

// ============================================================================
// APPROPRIATION RULES
// ============================================================================

/**
 * Rules around appropriations and spending.
 */
export interface AppropriationRuleSet {
  // True if spending generally may not exceed appropriation (Indiana IC 6-1.1-18, SBOA rules).
  enforceAppropriationLimit: boolean;

  // Whether additional appropriations are allowed mid-year and basic note for process.
  allowsAdditionalAppropriations: boolean;
  additionalAppropriationNotes?: string;

  // Whether encumbrance accounting is expected for this unit.
  supportsEncumbrances: boolean;
}

// ============================================================================
// REPORTING REQUIREMENTS
// ============================================================================

/**
 * A reporting requirement tied to finance, budgets, or funds
 * (e.g., AFR, Gateway budget file, special fund reports).
 */
export type ReportingFrequency = 'annual' | 'monthly' | 'quarterly' | 'adHoc';

export interface FinanceReportingRequirement {
  id: string;                     // e.g. "AFR", "BUDGET_GW", "TA7", "FOOD_BEV_REPORT"
  name: string;                   // human-friendly
  description?: string;

  frequency: ReportingFrequency;
  dueDescription?: string;        // e.g. "Due 60 days after year end", "Due by March 1"
  statutoryCitation?: string;     // e.g. "IC 5-11-1-4", "IC 36-7-32.5-14.5"

  // e.g. ["Gateway AFR upload", "SBOA AFR", "Township Form 15"]
  formCodes?: string[];

  overseenBy?: ('SBOA' | 'DLGF' | 'LegislativeBody' | 'Other')[];
}

// ============================================================================
// AGGREGATED RULE SET
// ============================================================================

/**
 * Aggregated rule set for finance for a given jurisdiction.
 */
export interface FinanceRuleSet {
  jurisdiction: JurisdictionProfile;

  fundCatalog: FundDefinition[];
  appropriationRules: AppropriationRuleSet;
  reportingRequirements: FinanceReportingRequirement[];

  /** Finance validation rules */
  validationRules?: FinanceRule[];

  /** Available legal opinions */
  legalOpinions?: LegalOpinion[];
}

// ============================================================================
// RULE CONDITION FUNCTION TYPES
// ============================================================================

/**
 * Type for rule condition functions.
 * Returns violations if rule is violated, empty array if passed.
 */
export type RuleConditionFn = (
  context: RuleEvaluationContext
) => RuleViolation[];

/**
 * Rule definition with condition function.
 */
export interface ExecutableRule extends FinanceRule {
  /** Condition function to evaluate */
  condition: RuleConditionFn;
}

// ============================================================================
// RULE ENGINE INTERFACE
// ============================================================================

/**
 * Interface for rule engine implementations.
 */
export interface RuleValidationEngine {
  /**
   * Validate all rules against the context.
   */
  validate(context: RuleEvaluationContext): Promise<RuleValidationResult>;

  /**
   * Validate a specific category of rules.
   */
  validateCategory(
    context: RuleEvaluationContext,
    category: RuleCategory
  ): Promise<RuleValidationResult>;

  /**
   * Get all available rules.
   */
  getRules(): FinanceRule[];

  /**
   * Get rules by category.
   */
  getRulesByCategory(category: RuleCategory): FinanceRule[];

  /**
   * Get legal opinion by ID.
   */
  getLegalOpinion(id: string): LegalOpinion | undefined;

  /**
   * Search legal opinions.
   */
  searchLegalOpinions(query: string): LegalOpinion[];

  /**
   * Explain a violation with full legal context.
   */
  explainViolation(violation: RuleViolation): ExplainedViolation;
}

/**
 * Violation with full explanation for UI display.
 */
export interface ExplainedViolation {
  /** Original violation */
  violation: RuleViolation;

  /** Full rule definition */
  rule: FinanceRule;

  /** Primary legal citation */
  citation?: LegalCitation;

  /** Full legal opinion */
  legalOpinion?: LegalOpinion;

  /** Plain English explanation */
  plainEnglishExplanation: string;

  /** Step-by-step correction guidance */
  correctionSteps: string[];

  /** Related violations */
  relatedViolations?: RuleViolation[];

  /** Similar past issues (for pattern detection) */
  historicalContext?: string;
}
