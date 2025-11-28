// src/engines/meetings/domain/services/findings-template.service.ts
//
// Service for managing findings of fact templates.
// Provides statutory criteria templates for Indiana BZA/Plan Commission cases.

import { TenantContext } from '../../../../core/tenancy/tenancy.types';
import {
  FindingsCaseType,
  FindingsOfFact,
  FindingsCriterion,
  CriterionTemplate,
} from '../types';
import {
  INDIANA_FINDINGS_TEMPLATES,
  getFindingsTemplate,
  FindingsTemplateDefinition,
} from '../constants/indiana.constants';

/**
 * Store interface for findings and criteria persistence.
 */
export interface FindingsStore {
  createFindings(
    ctx: TenantContext,
    findings: Omit<FindingsOfFact, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<FindingsOfFact>;

  createCriteria(
    ctx: TenantContext,
    criteria: Array<Omit<FindingsCriterion, 'id' | 'createdAt' | 'updatedAt'>>
  ): Promise<FindingsCriterion[]>;

  getFindings(ctx: TenantContext, findingsId: string): Promise<FindingsOfFact | null>;

  getFindingsByAgendaItem(
    ctx: TenantContext,
    agendaItemId: string
  ): Promise<FindingsOfFact | null>;

  getCriteria(ctx: TenantContext, findingsId: string): Promise<FindingsCriterion[]>;
}

/**
 * Service for managing findings of fact templates.
 */
export class FindingsTemplateService {
  constructor(private readonly store: FindingsStore) {}

  /**
   * Get statutory criteria for a case type.
   * Returns the default Indiana template criteria.
   */
  getCriteriaForCaseType(caseType: FindingsCaseType): CriterionTemplate[] {
    const template = getFindingsTemplate(caseType);
    if (!template) {
      return [];
    }

    return template.criteria.map((c) => ({
      criterionNumber: c.criterionNumber,
      criterionText: c.criterionText,
      statutoryCite: c.statutoryCite,
      isRequired: c.isRequired,
      guidanceNotes: c.guidanceNotes,
    }));
  }

  /**
   * Get all available case types with their templates.
   */
  getAvailableCaseTypes(): Array<{
    caseType: string;
    templateName: string;
    statutoryCite: string;
    criteriaCount: number;
  }> {
    return INDIANA_FINDINGS_TEMPLATES.map((t) => ({
      caseType: t.caseType,
      templateName: t.templateName,
      statutoryCite: t.statutoryCite,
      criteriaCount: t.criteria.length,
    }));
  }

  /**
   * Get the full template definition for a case type.
   */
  getTemplate(caseType: FindingsCaseType): FindingsTemplateDefinition | undefined {
    return getFindingsTemplate(caseType);
  }

  /**
   * Create findings from template with pre-populated criteria.
   */
  async createFindingsFromTemplate(
    ctx: TenantContext,
    input: {
      meetingId: string;
      agendaItemId?: string;
      caseType: FindingsCaseType;
    }
  ): Promise<FindingsOfFact> {
    const template = getFindingsTemplate(input.caseType);
    if (!template) {
      throw new Error(`No template found for case type: ${input.caseType}`);
    }

    // Create the findings record
    const findings = await this.store.createFindings(ctx, {
      tenantId: ctx.tenantId,
      meetingId: input.meetingId,
      agendaItemId: input.agendaItemId,
      caseType: input.caseType,
      statutoryCite: template.statutoryCite,
      status: 'DRAFT',
      isLocked: false,
      createdByUserId: ctx.userId,
    });

    // Create criteria from template
    if (template.criteria.length > 0) {
      const criteria = await this.store.createCriteria(
        ctx,
        template.criteria.map((c, index) => ({
          tenantId: ctx.tenantId,
          findingsId: findings.id,
          criterionNumber: c.criterionNumber,
          criterionText: c.criterionText,
          statutoryCite: c.statutoryCite,
          isRequired: c.isRequired,
          guidanceNotes: c.guidanceNotes,
          orderIndex: index,
        }))
      );

      findings.criteria = criteria;
    } else {
      findings.criteria = [];
    }

    return findings;
  }

  /**
   * Check if a case type requires findings of fact.
   */
  requiresFindings(caseType: string): boolean {
    const validCaseTypes: string[] = [
      'DEVELOPMENT_VARIANCE',
      'USE_VARIANCE',
      'SPECIAL_EXCEPTION',
      'SUBDIVISION_WAIVER',
    ];
    return validCaseTypes.includes(caseType);
  }

  /**
   * Get guidance notes for a specific criterion.
   */
  getGuidanceNotes(caseType: FindingsCaseType, criterionNumber: number): string | undefined {
    const template = getFindingsTemplate(caseType);
    if (!template) {
      return undefined;
    }

    const criterion = template.criteria.find(
      (c) => c.criterionNumber === criterionNumber
    );
    return criterion?.guidanceNotes;
  }
}

/**
 * In-memory implementation for testing.
 */
export class InMemoryFindingsStore implements FindingsStore {
  private findings: Map<string, FindingsOfFact> = new Map();
  private criteria: Map<string, FindingsCriterion[]> = new Map();
  private idCounter = 1;

  private generateId(): string {
    return `findings-${this.idCounter++}`;
  }

  async createFindings(
    ctx: TenantContext,
    input: Omit<FindingsOfFact, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<FindingsOfFact> {
    const now = new Date();
    const findings: FindingsOfFact = {
      ...input,
      id: this.generateId(),
      createdAt: now,
      updatedAt: now,
    };
    this.findings.set(findings.id, findings);
    return findings;
  }

  async createCriteria(
    ctx: TenantContext,
    criteriaInput: Array<Omit<FindingsCriterion, 'id' | 'createdAt' | 'updatedAt'>>
  ): Promise<FindingsCriterion[]> {
    const now = new Date();
    const created: FindingsCriterion[] = criteriaInput.map((c) => ({
      ...c,
      id: this.generateId(),
      createdAt: now,
      updatedAt: now,
    }));

    const findingsId = created[0]?.findingsId;
    if (findingsId) {
      const existing = this.criteria.get(findingsId) || [];
      this.criteria.set(findingsId, [...existing, ...created]);
    }

    return created;
  }

  async getFindings(
    ctx: TenantContext,
    findingsId: string
  ): Promise<FindingsOfFact | null> {
    const findings = this.findings.get(findingsId);
    if (!findings || findings.tenantId !== ctx.tenantId) {
      return null;
    }

    const criteria = this.criteria.get(findingsId) || [];
    return {
      ...findings,
      criteria,
    };
  }

  async getFindingsByAgendaItem(
    ctx: TenantContext,
    agendaItemId: string
  ): Promise<FindingsOfFact | null> {
    for (const findings of this.findings.values()) {
      if (
        findings.agendaItemId === agendaItemId &&
        findings.tenantId === ctx.tenantId
      ) {
        const criteria = this.criteria.get(findings.id) || [];
        return {
          ...findings,
          criteria,
        };
      }
    }
    return null;
  }

  async getCriteria(
    ctx: TenantContext,
    findingsId: string
  ): Promise<FindingsCriterion[]> {
    return this.criteria.get(findingsId) || [];
  }

  // Helper for testing
  clear(): void {
    this.findings.clear();
    this.criteria.clear();
    this.idCounter = 1;
  }
}
