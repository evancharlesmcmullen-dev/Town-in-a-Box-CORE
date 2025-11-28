// src/engines/meetings/domain/services/notice-requirement.service.ts
//
// Service for managing notice requirements and delivery tracking.
// Handles the workflow from requirement generation through delivery confirmation.

import { TenantContext } from '../../../../core/tenancy/tenancy.types';
import {
  NoticeRequirement,
  NoticeRequirementStatus,
  NoticeDelivery,
  NoticeDeliveryStatus,
  NoticeReason,
  RiskLevel,
  CreateNoticeDeliveryInput,
  DeliveryConfirmation,
  NoticeChannelType,
} from '../types';
import { PublicationRuleService } from './publication-rule.service';
import { DeadlineCalculatorService } from './deadline-calculator.service';

// =============================================================================
// TYPES
// =============================================================================

/**
 * Input for generating notice requirements.
 */
export interface GenerateRequirementsInput {
  meetingId: string;
  meetingDate: Date;
  meetingType: string;
  agendaItemId?: string;
  noticeReason?: NoticeReason;
  newspaperChannelId?: string;
}

/**
 * Input for updating requirement status.
 */
export interface UpdateRequirementStatusInput {
  status: NoticeRequirementStatus;
  satisfiedByUserId?: string;
  failureReason?: string;
  waiverReason?: string;
  waivedByUserId?: string;
}

/**
 * Data store interface for notice requirements.
 */
export interface NoticeRequirementStore {
  /**
   * Find a requirement by ID.
   */
  findById(ctx: TenantContext, id: string): Promise<NoticeRequirement | null>;

  /**
   * Find requirements for a meeting.
   */
  findByMeetingId(ctx: TenantContext, meetingId: string): Promise<NoticeRequirement[]>;

  /**
   * Find requirements for an agenda item.
   */
  findByAgendaItemId(
    ctx: TenantContext,
    agendaItemId: string
  ): Promise<NoticeRequirement[]>;

  /**
   * Create a notice requirement.
   */
  create(
    ctx: TenantContext,
    input: {
      meetingId: string;
      agendaItemId?: string;
      noticeReason: NoticeReason;
      ruleId: string;
      calculatedDeadlineAt?: Date;
      riskLevel?: RiskLevel;
    }
  ): Promise<NoticeRequirement>;

  /**
   * Update a requirement.
   */
  update(
    ctx: TenantContext,
    id: string,
    input: Partial<NoticeRequirement>
  ): Promise<NoticeRequirement>;
}

/**
 * Data store interface for notice deliveries.
 */
export interface NoticeDeliveryStore {
  /**
   * Find a delivery by ID.
   */
  findById(ctx: TenantContext, id: string): Promise<NoticeDelivery | null>;

  /**
   * Find deliveries for a requirement.
   */
  findByRequirementId(
    ctx: TenantContext,
    requirementId: string
  ): Promise<NoticeDelivery[]>;

  /**
   * Create a delivery.
   */
  create(
    ctx: TenantContext,
    input: {
      requirementId: string;
      channelType: NoticeChannelType;
      channelId?: string;
      publicationNumber: number;
      targetPublicationDate?: Date;
      notes?: string;
    }
  ): Promise<NoticeDelivery>;

  /**
   * Update a delivery.
   */
  update(
    ctx: TenantContext,
    id: string,
    input: Partial<NoticeDelivery>
  ): Promise<NoticeDelivery>;
}

// =============================================================================
// SERVICE CLASS
// =============================================================================

/**
 * Notice Requirement Service.
 *
 * Manages the lifecycle of notice requirements from generation through
 * delivery confirmation. Integrates with deadline calculator for risk assessment.
 */
export class NoticeRequirementService {
  constructor(
    private readonly requirementStore: NoticeRequirementStore,
    private readonly deliveryStore: NoticeDeliveryStore,
    private readonly ruleService: PublicationRuleService,
    private readonly deadlineCalculator: DeadlineCalculatorService
  ) {}

  /**
   * Auto-generate requirements when a meeting/hearing is scheduled.
   *
   * @param ctx Tenant context
   * @param meetingId The meeting ID
   * @param agendaItemId Optional agenda item ID (for item-level hearings)
   * @param input Generation input
   * @returns Generated notice requirements
   */
  async generateRequirements(
    ctx: TenantContext,
    input: GenerateRequirementsInput
  ): Promise<NoticeRequirement[]> {
    const requirements: NoticeRequirement[] = [];

    // Determine the notice reason
    const reason = input.noticeReason ?? this.inferNoticeReason(input);

    // Get the applicable rule
    const rule = await this.ruleService.getRuleForReason(ctx, reason);

    if (!rule) {
      // No rule found - may be OPEN_DOOR_MEETING with different requirements
      return requirements;
    }

    // Calculate deadlines
    const calculation = await this.deadlineCalculator.calculateDeadlines(
      ctx,
      input.meetingDate,
      reason,
      input.newspaperChannelId
    );

    // Create the requirement
    const requirement = await this.requirementStore.create(ctx, {
      meetingId: input.meetingId,
      agendaItemId: input.agendaItemId,
      noticeReason: reason,
      ruleId: rule.id,
      calculatedDeadlineAt: calculation.earliestSubmissionDeadline,
      riskLevel: calculation.riskLevel,
    });

    requirements.push(requirement);

    return requirements;
  }

  /**
   * Get requirements for a meeting.
   *
   * @param ctx Tenant context
   * @param meetingId The meeting ID
   * @returns Array of notice requirements with deliveries
   */
  async getRequirements(
    ctx: TenantContext,
    meetingId: string
  ): Promise<NoticeRequirement[]> {
    const requirements = await this.requirementStore.findByMeetingId(
      ctx,
      meetingId
    );

    // Load deliveries for each requirement
    for (const req of requirements) {
      req.deliveries = await this.deliveryStore.findByRequirementId(ctx, req.id);
    }

    return requirements;
  }

  /**
   * Get a single requirement by ID.
   *
   * @param ctx Tenant context
   * @param id Requirement ID
   * @returns The requirement or null
   */
  async getRequirement(
    ctx: TenantContext,
    id: string
  ): Promise<NoticeRequirement | null> {
    const requirement = await this.requirementStore.findById(ctx, id);

    if (requirement) {
      requirement.deliveries = await this.deliveryStore.findByRequirementId(
        ctx,
        requirement.id
      );
    }

    return requirement;
  }

  /**
   * Update requirement status.
   *
   * @param ctx Tenant context
   * @param requirementId The requirement ID
   * @param status New status
   * @returns Updated requirement
   */
  async updateStatus(
    ctx: TenantContext,
    requirementId: string,
    input: UpdateRequirementStatusInput
  ): Promise<NoticeRequirement> {
    const now = new Date();
    const updates: Partial<NoticeRequirement> = {
      status: input.status,
      updatedAt: now,
    };

    switch (input.status) {
      case 'SATISFIED':
        updates.satisfiedAt = now;
        updates.satisfiedByUserId = input.satisfiedByUserId ?? ctx.userId;
        break;
      case 'FAILED':
        updates.failedAt = now;
        updates.failureReason = input.failureReason;
        break;
      case 'WAIVED':
        updates.waivedAt = now;
        updates.waivedByUserId = input.waivedByUserId ?? ctx.userId;
        updates.waiverReason = input.waiverReason;
        break;
      case 'IN_PROGRESS':
        // Just update status
        break;
    }

    return this.requirementStore.update(ctx, requirementId, updates);
  }

  /**
   * Record a delivery attempt.
   *
   * @param ctx Tenant context
   * @param requirementId The requirement ID
   * @param delivery Delivery input
   * @returns Created delivery record
   */
  async recordDelivery(
    ctx: TenantContext,
    requirementId: string,
    delivery: CreateNoticeDeliveryInput
  ): Promise<NoticeDelivery> {
    // Verify requirement exists
    const requirement = await this.requirementStore.findById(ctx, requirementId);
    if (!requirement) {
      throw new Error(`Notice requirement not found: ${requirementId}`);
    }

    // Create the delivery record
    const created = await this.deliveryStore.create(ctx, {
      requirementId,
      channelType: delivery.channelType,
      channelId: delivery.channelId,
      publicationNumber: delivery.publicationNumber,
      targetPublicationDate: delivery.targetPublicationDate,
      notes: delivery.notes,
    });

    // Update requirement status to IN_PROGRESS if it was NOT_STARTED
    if (requirement.status === 'NOT_STARTED') {
      await this.requirementStore.update(ctx, requirementId, {
        status: 'IN_PROGRESS',
        updatedAt: new Date(),
      });
    }

    return created;
  }

  /**
   * Submit a delivery (mark as sent to newspaper/channel).
   *
   * @param ctx Tenant context
   * @param deliveryId The delivery ID
   * @returns Updated delivery
   */
  async submitDelivery(
    ctx: TenantContext,
    deliveryId: string
  ): Promise<NoticeDelivery> {
    return this.deliveryStore.update(ctx, deliveryId, {
      status: 'SUBMITTED',
      submittedAt: new Date(),
      submittedByUserId: ctx.userId,
      updatedAt: new Date(),
    });
  }

  /**
   * Confirm delivery with proof document.
   *
   * @param ctx Tenant context
   * @param deliveryId The delivery ID
   * @param confirmation Confirmation details
   * @returns Updated delivery
   */
  async confirmDelivery(
    ctx: TenantContext,
    deliveryId: string,
    confirmation: DeliveryConfirmation
  ): Promise<NoticeDelivery> {
    const delivery = await this.deliveryStore.findById(ctx, deliveryId);
    if (!delivery) {
      throw new Error(`Notice delivery not found: ${deliveryId}`);
    }

    // Update delivery as confirmed
    const updated = await this.deliveryStore.update(ctx, deliveryId, {
      status: 'CONFIRMED',
      actualPublicationDate: confirmation.actualPublicationDate,
      confirmedAt: new Date(),
      confirmedByUserId: ctx.userId,
      proofDocumentId: confirmation.proofDocumentId,
      affidavitFileId: confirmation.affidavitFileId,
      notes: confirmation.notes
        ? `${delivery.notes ?? ''}\n${confirmation.notes}`.trim()
        : delivery.notes,
      updatedAt: new Date(),
    });

    // Check if all required deliveries are confirmed
    await this.checkRequirementSatisfaction(ctx, delivery.requirementId);

    return updated;
  }

  /**
   * Mark a delivery as failed.
   *
   * @param ctx Tenant context
   * @param deliveryId The delivery ID
   * @param reason Failure reason
   * @returns Updated delivery
   */
  async failDelivery(
    ctx: TenantContext,
    deliveryId: string,
    reason: string
  ): Promise<NoticeDelivery> {
    const delivery = await this.deliveryStore.findById(ctx, deliveryId);
    if (!delivery) {
      throw new Error(`Notice delivery not found: ${deliveryId}`);
    }

    return this.deliveryStore.update(ctx, deliveryId, {
      status: 'FAILED',
      notes: `${delivery.notes ?? ''}\nFailed: ${reason}`.trim(),
      updatedAt: new Date(),
    });
  }

  /**
   * Refresh risk assessment for a requirement.
   *
   * @param ctx Tenant context
   * @param requirementId The requirement ID
   * @returns Updated requirement with new risk level
   */
  async refreshRiskAssessment(
    ctx: TenantContext,
    requirementId: string
  ): Promise<NoticeRequirement> {
    const requirement = await this.requirementStore.findById(ctx, requirementId);
    if (!requirement) {
      throw new Error(`Notice requirement not found: ${requirementId}`);
    }

    // Skip if already satisfied or failed
    if (
      requirement.status === 'SATISFIED' ||
      requirement.status === 'FAILED' ||
      requirement.status === 'WAIVED'
    ) {
      return requirement;
    }

    // Calculate new risk level
    const newRiskLevel = requirement.calculatedDeadlineAt
      ? this.deadlineCalculator.assessRisk(requirement.calculatedDeadlineAt)
      : undefined;

    // Update if changed
    if (newRiskLevel && newRiskLevel !== requirement.riskLevel) {
      return this.requirementStore.update(ctx, requirementId, {
        riskLevel: newRiskLevel,
        updatedAt: new Date(),
      });
    }

    return requirement;
  }

  /**
   * Check if all deliveries are confirmed and update requirement status.
   */
  private async checkRequirementSatisfaction(
    ctx: TenantContext,
    requirementId: string
  ): Promise<void> {
    const requirement = await this.requirementStore.findById(ctx, requirementId);
    if (!requirement) return;

    const rule = await this.ruleService.getRuleForReason(
      ctx,
      requirement.noticeReason
    );
    if (!rule) return;

    const deliveries = await this.deliveryStore.findByRequirementId(
      ctx,
      requirementId
    );

    // Count confirmed deliveries
    const confirmedCount = deliveries.filter(
      (d) => d.status === 'CONFIRMED'
    ).length;

    // Check if requirement is satisfied
    if (confirmedCount >= rule.requiredPublications) {
      await this.requirementStore.update(ctx, requirementId, {
        status: 'SATISFIED',
        satisfiedAt: new Date(),
        satisfiedByUserId: ctx.userId,
        updatedAt: new Date(),
      });
    }
  }

  /**
   * Infer notice reason from meeting/hearing type.
   */
  private inferNoticeReason(input: GenerateRequirementsInput): NoticeReason {
    // Map common meeting types to notice reasons
    const typeMap: Record<string, NoticeReason> = {
      REGULAR: 'OPEN_DOOR_MEETING',
      SPECIAL: 'OPEN_DOOR_MEETING',
      PUBLIC_HEARING: 'GENERAL_PUBLIC_HEARING',
      ZONING_HEARING: 'ZONING_MAP_AMENDMENT',
      VARIANCE_HEARING: 'VARIANCE_HEARING',
      BZA_HEARING: 'VARIANCE_HEARING',
      BOND_HEARING: 'BOND_HEARING',
      BUDGET_HEARING: 'BUDGET_HEARING',
      ANNEXATION_HEARING: 'ANNEXATION_HEARING',
    };

    return typeMap[input.meetingType] ?? 'OPEN_DOOR_MEETING';
  }
}

// =============================================================================
// IN-MEMORY STORE IMPLEMENTATIONS
// =============================================================================

/**
 * In-memory implementation of NoticeRequirementStore.
 */
export class InMemoryNoticeRequirementStore implements NoticeRequirementStore {
  private requirements: Map<string, NoticeRequirement[]> = new Map();

  async findById(
    ctx: TenantContext,
    id: string
  ): Promise<NoticeRequirement | null> {
    const tenantReqs = this.requirements.get(ctx.tenantId) ?? [];
    return tenantReqs.find((r) => r.id === id) ?? null;
  }

  async findByMeetingId(
    ctx: TenantContext,
    meetingId: string
  ): Promise<NoticeRequirement[]> {
    const tenantReqs = this.requirements.get(ctx.tenantId) ?? [];
    return tenantReqs.filter((r) => r.meetingId === meetingId);
  }

  async findByAgendaItemId(
    ctx: TenantContext,
    agendaItemId: string
  ): Promise<NoticeRequirement[]> {
    const tenantReqs = this.requirements.get(ctx.tenantId) ?? [];
    return tenantReqs.filter((r) => r.agendaItemId === agendaItemId);
  }

  async create(
    ctx: TenantContext,
    input: {
      meetingId: string;
      agendaItemId?: string;
      noticeReason: NoticeReason;
      ruleId: string;
      calculatedDeadlineAt?: Date;
      riskLevel?: RiskLevel;
    }
  ): Promise<NoticeRequirement> {
    const now = new Date();
    const requirement: NoticeRequirement = {
      id: crypto.randomUUID(),
      tenantId: ctx.tenantId,
      meetingId: input.meetingId,
      agendaItemId: input.agendaItemId,
      noticeReason: input.noticeReason,
      ruleId: input.ruleId,
      status: 'NOT_STARTED',
      calculatedDeadlineAt: input.calculatedDeadlineAt,
      riskLevel: input.riskLevel,
      createdAt: now,
      updatedAt: now,
    };

    const tenantReqs = this.requirements.get(ctx.tenantId) ?? [];
    tenantReqs.push(requirement);
    this.requirements.set(ctx.tenantId, tenantReqs);

    return requirement;
  }

  async update(
    ctx: TenantContext,
    id: string,
    input: Partial<NoticeRequirement>
  ): Promise<NoticeRequirement> {
    const tenantReqs = this.requirements.get(ctx.tenantId) ?? [];
    const index = tenantReqs.findIndex((r) => r.id === id);

    if (index === -1) {
      throw new Error(`Notice requirement not found: ${id}`);
    }

    const updated = { ...tenantReqs[index], ...input };
    tenantReqs[index] = updated;
    return updated;
  }

  clear(): void {
    this.requirements.clear();
  }
}

/**
 * In-memory implementation of NoticeDeliveryStore.
 */
export class InMemoryNoticeDeliveryStore implements NoticeDeliveryStore {
  private deliveries: Map<string, NoticeDelivery[]> = new Map();

  async findById(ctx: TenantContext, id: string): Promise<NoticeDelivery | null> {
    const tenantDels = this.deliveries.get(ctx.tenantId) ?? [];
    return tenantDels.find((d) => d.id === id) ?? null;
  }

  async findByRequirementId(
    ctx: TenantContext,
    requirementId: string
  ): Promise<NoticeDelivery[]> {
    const tenantDels = this.deliveries.get(ctx.tenantId) ?? [];
    return tenantDels.filter((d) => d.requirementId === requirementId);
  }

  async create(
    ctx: TenantContext,
    input: {
      requirementId: string;
      channelType: NoticeChannelType;
      channelId?: string;
      publicationNumber: number;
      targetPublicationDate?: Date;
      notes?: string;
    }
  ): Promise<NoticeDelivery> {
    const now = new Date();
    const delivery: NoticeDelivery = {
      id: crypto.randomUUID(),
      tenantId: ctx.tenantId,
      requirementId: input.requirementId,
      channelType: input.channelType,
      channelId: input.channelId,
      status: 'PENDING',
      publicationNumber: input.publicationNumber,
      targetPublicationDate: input.targetPublicationDate,
      notes: input.notes,
      createdAt: now,
      updatedAt: now,
    };

    const tenantDels = this.deliveries.get(ctx.tenantId) ?? [];
    tenantDels.push(delivery);
    this.deliveries.set(ctx.tenantId, tenantDels);

    return delivery;
  }

  async update(
    ctx: TenantContext,
    id: string,
    input: Partial<NoticeDelivery>
  ): Promise<NoticeDelivery> {
    const tenantDels = this.deliveries.get(ctx.tenantId) ?? [];
    const index = tenantDels.findIndex((d) => d.id === id);

    if (index === -1) {
      throw new Error(`Notice delivery not found: ${id}`);
    }

    const updated = { ...tenantDels[index], ...input };
    tenantDels[index] = updated;
    return updated;
  }

  clear(): void {
    this.deliveries.clear();
  }
}
