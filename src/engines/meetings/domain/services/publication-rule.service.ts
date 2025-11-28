// src/engines/meetings/domain/services/publication-rule.service.ts
//
// Service for managing publication rules that define statutory notice requirements.
// Handles rule lookup, tenant rule management, and seeding default Indiana rules.

import { TenantContext } from '../../../../core/tenancy/tenancy.types';
import {
  PublicationRule,
  NoticeReason,
  NoticeChannelType,
} from '../types';
import {
  INDIANA_PUBLICATION_RULES,
  IndianaPublicationRuleDefinition,
} from '../constants/indiana.constants';

// =============================================================================
// TYPES
// =============================================================================

/**
 * Input for creating a publication rule.
 */
export interface CreatePublicationRuleInput {
  ruleType: NoticeReason;
  requiredPublications: number;
  requiredLeadDays: number;
  mustBeConsecutive: boolean;
  requiredChannels: NoticeChannelType[];
  statutoryCite: string;
  description?: string;
}

/**
 * Data store interface for publication rules.
 * Implementations can use SQL, in-memory, etc.
 */
export interface PublicationRuleStore {
  /**
   * Find a rule by notice reason for a tenant.
   */
  findByReason(
    ctx: TenantContext,
    reason: NoticeReason
  ): Promise<PublicationRule | null>;

  /**
   * Get all rules for a tenant.
   */
  findAllForTenant(ctx: TenantContext): Promise<PublicationRule[]>;

  /**
   * Create a new publication rule.
   */
  create(
    ctx: TenantContext,
    input: CreatePublicationRuleInput
  ): Promise<PublicationRule>;

  /**
   * Create multiple rules in a batch.
   */
  createMany(
    ctx: TenantContext,
    inputs: CreatePublicationRuleInput[]
  ): Promise<PublicationRule[]>;

  /**
   * Check if rules exist for a tenant.
   */
  hasRules(ctx: TenantContext): Promise<boolean>;
}

// =============================================================================
// SERVICE CLASS
// =============================================================================

/**
 * Publication Rule Service.
 *
 * Manages publication rules that define statutory notice requirements
 * for different types of hearings and meetings.
 */
export class PublicationRuleService {
  constructor(private readonly store: PublicationRuleStore) {}

  /**
   * Get the applicable rule for a specific notice reason.
   *
   * @param ctx Tenant context
   * @param reason The notice reason type
   * @returns The publication rule or null if not found
   */
  async getRuleForReason(
    ctx: TenantContext,
    reason: NoticeReason
  ): Promise<PublicationRule | null> {
    return this.store.findByReason(ctx, reason);
  }

  /**
   * Get all publication rules for the tenant.
   *
   * @param ctx Tenant context
   * @returns Array of publication rules
   */
  async getRulesForTenant(ctx: TenantContext): Promise<PublicationRule[]> {
    return this.store.findAllForTenant(ctx);
  }

  /**
   * Seed default Indiana publication rules for a new tenant.
   *
   * This creates all standard Indiana statutory publication requirements.
   * Should be called when a new tenant is provisioned.
   *
   * @param ctx Tenant context
   */
  async seedDefaultRules(ctx: TenantContext): Promise<void> {
    // Check if rules already exist
    const hasExisting = await this.store.hasRules(ctx);
    if (hasExisting) {
      return; // Don't duplicate rules
    }

    // Convert Indiana rules to create inputs
    const inputs: CreatePublicationRuleInput[] = INDIANA_PUBLICATION_RULES.map(
      (rule) => ({
        ruleType: rule.ruleType as NoticeReason,
        requiredPublications: rule.requiredPublications,
        requiredLeadDays: rule.requiredLeadDays,
        mustBeConsecutive: rule.mustBeConsecutive,
        requiredChannels: rule.requiredChannels as NoticeChannelType[],
        statutoryCite: rule.statutoryCite,
        description: rule.description,
      })
    );

    await this.store.createMany(ctx, inputs);
  }

  /**
   * Create a custom publication rule for a tenant.
   *
   * @param ctx Tenant context
   * @param input Rule creation input
   * @returns The created rule
   */
  async createRule(
    ctx: TenantContext,
    input: CreatePublicationRuleInput
  ): Promise<PublicationRule> {
    return this.store.create(ctx, input);
  }
}

// =============================================================================
// IN-MEMORY STORE IMPLEMENTATION
// =============================================================================

/**
 * In-memory implementation of PublicationRuleStore.
 * Useful for testing and development.
 */
export class InMemoryPublicationRuleStore implements PublicationRuleStore {
  private rules: Map<string, PublicationRule[]> = new Map();

  async findByReason(
    ctx: TenantContext,
    reason: NoticeReason
  ): Promise<PublicationRule | null> {
    const tenantRules = this.rules.get(ctx.tenantId) ?? [];
    return tenantRules.find((r) => r.ruleType === reason && r.isActive) ?? null;
  }

  async findAllForTenant(ctx: TenantContext): Promise<PublicationRule[]> {
    return this.rules.get(ctx.tenantId) ?? [];
  }

  async create(
    ctx: TenantContext,
    input: CreatePublicationRuleInput
  ): Promise<PublicationRule> {
    const rule: PublicationRule = {
      id: crypto.randomUUID(),
      tenantId: ctx.tenantId,
      ruleType: input.ruleType,
      requiredPublications: input.requiredPublications,
      requiredLeadDays: input.requiredLeadDays,
      mustBeConsecutive: input.mustBeConsecutive,
      requiredChannels: input.requiredChannels,
      statutoryCite: input.statutoryCite,
      description: input.description,
      isActive: true,
      createdAt: new Date(),
    };

    const tenantRules = this.rules.get(ctx.tenantId) ?? [];
    tenantRules.push(rule);
    this.rules.set(ctx.tenantId, tenantRules);

    return rule;
  }

  async createMany(
    ctx: TenantContext,
    inputs: CreatePublicationRuleInput[]
  ): Promise<PublicationRule[]> {
    const created: PublicationRule[] = [];
    for (const input of inputs) {
      created.push(await this.create(ctx, input));
    }
    return created;
  }

  async hasRules(ctx: TenantContext): Promise<boolean> {
    const tenantRules = this.rules.get(ctx.tenantId);
    return tenantRules !== undefined && tenantRules.length > 0;
  }

  /**
   * Clear all rules (for testing).
   */
  clear(): void {
    this.rules.clear();
  }
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Get the default Indiana rule definition for a notice reason.
 * This is useful for displaying information even if custom rules haven't been seeded.
 *
 * @param reason The notice reason
 * @returns The default rule definition or undefined
 */
export function getDefaultIndianaRule(
  reason: NoticeReason
): IndianaPublicationRuleDefinition | undefined {
  return INDIANA_PUBLICATION_RULES.find((r) => r.ruleType === reason);
}

/**
 * Check if a notice reason requires newspaper publication.
 *
 * @param reason The notice reason
 * @returns True if newspaper publication is required
 */
export function requiresNewspaperPublication(reason: NoticeReason): boolean {
  const rule = getDefaultIndianaRule(reason);
  if (!rule) return false;
  return rule.requiredChannels.includes('NEWSPAPER') && rule.requiredPublications > 0;
}

/**
 * Get the minimum lead time required for a notice reason.
 *
 * @param reason The notice reason
 * @returns Minimum lead days or 0 if unknown
 */
export function getMinimumLeadDays(reason: NoticeReason): number {
  const rule = getDefaultIndianaRule(reason);
  return rule?.requiredLeadDays ?? 0;
}
