// src/core/finance/finance-rules.engine.ts

/**
 * Town-in-a-Box Finance Engine - Rule Validation Engine
 *
 * Comprehensive rule validation with:
 * - Executable rules with condition functions
 * - Legal opinion lookup
 * - Violation explanation with "Explain this" links
 * - Category-based validation
 */

import { JurisdictionProfile } from '../tenancy/tenancy.types';
import {
  FinanceRuleSet,
  RuleValidationEngine,
  RuleEvaluationContext,
  RuleValidationResult,
  RuleCategory,
  FinanceRule,
  RuleViolation,
  LegalOpinion,
  LegalCitation,
  ExplainedViolation,
  ExecutableRule,
} from './finance-rules.types';

/**
 * State-aware provider of finance/legal rule sets.
 *
 * Implementations (e.g. INFinancialRulesEngine) provide:
 * - Fund catalog for that jurisdiction type
 * - Appropriation control rules
 * - Reporting requirements (AFR, Gateway budget, special fund reports)
 */
export interface FinancialRulesEngine {
  getFinanceRules(jurisdiction: JurisdictionProfile): FinanceRuleSet;
}

// ============================================================================
// DEFAULT RULE VALIDATION ENGINE
// ============================================================================

/**
 * Default implementation of the rule validation engine.
 */
export class DefaultRuleValidationEngine implements RuleValidationEngine {
  private rules: ExecutableRule[] = [];
  private legalOpinions: Map<string, LegalOpinion> = new Map();

  constructor(
    rules: ExecutableRule[] = [],
    legalOpinions: LegalOpinion[] = []
  ) {
    this.rules = rules;
    for (const opinion of legalOpinions) {
      this.legalOpinions.set(opinion.id, opinion);
    }
  }

  /**
   * Register a new rule.
   */
  registerRule(rule: ExecutableRule): void {
    this.rules.push(rule);
  }

  /**
   * Register a legal opinion.
   */
  registerLegalOpinion(opinion: LegalOpinion): void {
    this.legalOpinions.set(opinion.id, opinion);
  }

  /**
   * Validate all rules against the context.
   */
  async validate(context: RuleEvaluationContext): Promise<RuleValidationResult> {
    const startTime = Date.now();
    const violations: RuleViolation[] = [];

    // Filter applicable rules
    const applicableRules = this.getApplicableRules(context);

    // Evaluate each rule
    for (const rule of applicableRules) {
      if (!rule.isActive) continue;

      try {
        const ruleViolations = rule.condition(context);
        violations.push(...ruleViolations);
      } catch (error) {
        // Log error but continue validation
        console.error(`Error evaluating rule ${rule.id}:`, error);
      }
    }

    return this.buildValidationResult(
      context,
      applicableRules.length,
      violations,
      Date.now() - startTime
    );
  }

  /**
   * Validate a specific category of rules.
   */
  async validateCategory(
    context: RuleEvaluationContext,
    category: RuleCategory
  ): Promise<RuleValidationResult> {
    const startTime = Date.now();
    const violations: RuleViolation[] = [];

    // Filter applicable rules for this category
    const applicableRules = this.getApplicableRules(context).filter(
      (r) => r.category === category
    );

    // Evaluate each rule
    for (const rule of applicableRules) {
      if (!rule.isActive) continue;

      try {
        const ruleViolations = rule.condition(context);
        violations.push(...ruleViolations);
      } catch (error) {
        console.error(`Error evaluating rule ${rule.id}:`, error);
      }
    }

    return this.buildValidationResult(
      context,
      applicableRules.length,
      violations,
      Date.now() - startTime
    );
  }

  /**
   * Get all available rules.
   */
  getRules(): FinanceRule[] {
    return this.rules.map((r) => this.toFinanceRule(r));
  }

  /**
   * Get rules by category.
   */
  getRulesByCategory(category: RuleCategory): FinanceRule[] {
    return this.rules
      .filter((r) => r.category === category)
      .map((r) => this.toFinanceRule(r));
  }

  /**
   * Get legal opinion by ID.
   */
  getLegalOpinion(id: string): LegalOpinion | undefined {
    return this.legalOpinions.get(id);
  }

  /**
   * Search legal opinions.
   */
  searchLegalOpinions(query: string): LegalOpinion[] {
    const lowerQuery = query.toLowerCase();
    return Array.from(this.legalOpinions.values()).filter(
      (opinion) =>
        opinion.title.toLowerCase().includes(lowerQuery) ||
        opinion.summary.toLowerCase().includes(lowerQuery) ||
        opinion.keywords.some((k) => k.toLowerCase().includes(lowerQuery)) ||
        opinion.citations.some(
          (c) =>
            c.code.toLowerCase().includes(lowerQuery) ||
            c.title.toLowerCase().includes(lowerQuery)
        )
    );
  }

  /**
   * Explain a violation with full legal context.
   */
  explainViolation(violation: RuleViolation): ExplainedViolation {
    const rule = this.rules.find((r) => r.id === violation.ruleId);

    if (!rule) {
      return {
        violation,
        rule: {
          id: violation.ruleId,
          name: violation.ruleName,
          description: '',
          category: violation.category,
          severity: violation.severity,
          messageTemplate: violation.message,
          isActive: true,
        },
        plainEnglishExplanation: violation.message,
        correctionSteps: [],
      };
    }

    const legalOpinion = violation.legalOpinionId
      ? this.legalOpinions.get(violation.legalOpinionId)
      : rule.legalOpinionId
        ? this.legalOpinions.get(rule.legalOpinionId)
        : undefined;

    // Build plain English explanation
    const plainEnglishExplanation = this.buildPlainEnglishExplanation(
      violation,
      rule,
      legalOpinion
    );

    // Build correction steps
    const correctionSteps = this.buildCorrectionSteps(violation, rule);

    return {
      violation,
      rule: this.toFinanceRule(rule),
      citation: violation.citation || rule.citation,
      legalOpinion,
      plainEnglishExplanation,
      correctionSteps,
    };
  }

  // ============================================================================
  // PRIVATE HELPER METHODS
  // ============================================================================

  private getApplicableRules(context: RuleEvaluationContext): ExecutableRule[] {
    return this.rules.filter((rule) => {
      // Check state
      if (rule.state && rule.state !== context.jurisdiction.state) {
        return false;
      }

      // Check jurisdiction type
      if (
        rule.jurisdictionTypes &&
        !rule.jurisdictionTypes.includes(context.jurisdiction.kind)
      ) {
        return false;
      }

      // Check effective date
      if (rule.effectiveDate && context.evaluationDate < rule.effectiveDate) {
        return false;
      }

      // Check sunset date
      if (rule.sunsetDate && context.evaluationDate > rule.sunsetDate) {
        return false;
      }

      return true;
    });
  }

  private buildValidationResult(
    context: RuleEvaluationContext,
    rulesChecked: number,
    violations: RuleViolation[],
    durationMs: number
  ): RuleValidationResult {
    const summary = {
      critical: violations.filter((v) => v.severity === 'CRITICAL').length,
      errors: violations.filter((v) => v.severity === 'ERROR').length,
      warnings: violations.filter((v) => v.severity === 'WARNING').length,
      info: violations.filter((v) => v.severity === 'INFO').length,
    };

    const byCategory: Record<RuleCategory, number> = {
      APPROPRIATION: 0,
      LEVY: 0,
      SURPLUS: 0,
      TRANSFER: 0,
      PUBLICATION: 0,
      MEETING_NOTICE: 0,
      DEBT: 0,
      INVESTMENT: 0,
      PROCUREMENT: 0,
      PAYROLL: 0,
      REPORTING: 0,
      AUDIT: 0,
    };

    for (const v of violations) {
      byCategory[v.category]++;
    }

    const passed = summary.critical === 0 && summary.errors === 0;
    const canFile = summary.critical === 0;

    return {
      tenantId: context.tenantId,
      fiscalYear: context.fiscalYear,
      evaluatedAt: new Date(),
      rulesChecked,
      rulesPassed: rulesChecked - violations.length,
      violations,
      summary,
      byCategory,
      passed,
      canFile,
      durationMs,
    };
  }

  private toFinanceRule(rule: ExecutableRule): FinanceRule {
    const { condition, ...financeRule } = rule;
    return financeRule;
  }

  private buildPlainEnglishExplanation(
    violation: RuleViolation,
    rule: ExecutableRule,
    opinion?: LegalOpinion
  ): string {
    let explanation = violation.message;

    if (opinion) {
      explanation += `\n\n${opinion.summary}`;
    }

    if (rule.citation) {
      explanation += `\n\nThis is required by ${rule.citation.title} (${rule.citation.code}).`;
    }

    return explanation;
  }

  private buildCorrectionSteps(
    violation: RuleViolation,
    rule: ExecutableRule
  ): string[] {
    const steps: string[] = [];

    if (violation.correctionGuidance) {
      steps.push(violation.correctionGuidance);
    } else if (rule.correctionGuidance) {
      steps.push(rule.correctionGuidance);
    }

    // Add category-specific generic guidance
    switch (violation.category) {
      case 'APPROPRIATION':
        steps.push(
          'Review the appropriation amounts in the budget',
          'Consider requesting an additional appropriation if needed',
          'Ensure all expenditures have proper authorization'
        );
        break;

      case 'LEVY':
        steps.push(
          'Review the levy calculation worksheet',
          'Verify compliance with growth quotient limits',
          'Check circuit breaker impact calculations'
        );
        break;

      case 'SURPLUS':
        steps.push(
          'Review fund balance calculations',
          'Consider transfers to reduce excess surplus',
          'Document reasons for surplus if retention is justified'
        );
        break;

      case 'TRANSFER':
        steps.push(
          'Verify transfer is between compatible funds',
          'Ensure proper authorization was obtained',
          'Document the purpose of the transfer'
        );
        break;

      case 'PUBLICATION':
        steps.push(
          'Verify publication dates and content requirements',
          'Ensure publication was in a qualified newspaper',
          'Retain proof of publication for audit'
        );
        break;

      case 'MEETING_NOTICE':
        steps.push(
          'Verify notice was posted within required timeframe',
          'Ensure notice includes all required elements',
          'Document posting locations and dates'
        );
        break;
    }

    return steps;
  }
}

// ============================================================================
// RULE BUILDER HELPERS
// ============================================================================

/**
 * Helper to create a rule with proper typing.
 */
export function createRule(
  base: Omit<FinanceRule, 'isActive'> & { isActive?: boolean },
  condition: (context: RuleEvaluationContext) => RuleViolation[]
): ExecutableRule {
  return {
    ...base,
    isActive: base.isActive ?? true,
    condition,
  };
}

/**
 * Helper to create a violation.
 */
export function createViolation(
  rule: FinanceRule,
  overrides: Partial<RuleViolation> & {
    message: string;
    entityId?: string;
    entityDescription?: string;
  }
): RuleViolation {
  return {
    ruleId: rule.id,
    ruleName: rule.name,
    category: rule.category,
    severity: rule.severity,
    message: overrides.message,
    citation: rule.citation,
    legalOpinionId: rule.legalOpinionId,
    correctionGuidance: rule.correctionGuidance,
    detectedAt: new Date(),
    ...overrides,
  };
}

/**
 * Create a legal citation.
 */
export function createCitation(
  code: string,
  title: string,
  description: string,
  source: LegalCitation['source'] = 'INDIANA_CODE',
  options?: Partial<LegalCitation>
): LegalCitation {
  return {
    code,
    title,
    description,
    source,
    ...options,
  };
}

/**
 * Create a legal opinion.
 */
export function createLegalOpinion(
  id: string,
  title: string,
  summary: string,
  category: RuleCategory,
  citations: LegalCitation[],
  keywords: string[],
  options?: Partial<LegalOpinion>
): LegalOpinion {
  return {
    id,
    title,
    summary,
    category,
    citations,
    keywords,
    isCurrent: true,
    ...options,
  };
}

// ============================================================================
// FACTORY FUNCTION
// ============================================================================

/**
 * Create a new rule validation engine.
 */
export function createRuleValidationEngine(
  rules: ExecutableRule[] = [],
  legalOpinions: LegalOpinion[] = []
): DefaultRuleValidationEngine {
  return new DefaultRuleValidationEngine(rules, legalOpinions);
}
