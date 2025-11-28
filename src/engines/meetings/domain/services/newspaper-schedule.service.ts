// src/engines/meetings/domain/services/newspaper-schedule.service.ts
//
// Service for managing newspaper schedules and calculating publication/submission deadlines.
// Handles the complex logic of mapping hearing dates to newspaper publication cycles.

import { TenantContext } from '../../../../core/tenancy/tenancy.types';
import {
  NewspaperSchedule,
  DayOfWeek,
  SubmissionDeadline,
} from '../types';
import { INDIANA_TIMEZONES } from '../constants/indiana.constants';

// =============================================================================
// CONSTANTS
// =============================================================================

/**
 * Map of day names to JavaScript day numbers (0 = Sunday).
 */
const DAY_TO_NUMBER: Record<DayOfWeek, number> = {
  SUNDAY: 0,
  MONDAY: 1,
  TUESDAY: 2,
  WEDNESDAY: 3,
  THURSDAY: 4,
  FRIDAY: 5,
  SATURDAY: 6,
};

/**
 * Map of JavaScript day numbers to day names.
 */
const NUMBER_TO_DAY: Record<number, DayOfWeek> = {
  0: 'SUNDAY',
  1: 'MONDAY',
  2: 'TUESDAY',
  3: 'WEDNESDAY',
  4: 'THURSDAY',
  5: 'FRIDAY',
  6: 'SATURDAY',
};

// =============================================================================
// TYPES
// =============================================================================

/**
 * Input for creating a newspaper schedule.
 */
export interface CreateNewspaperScheduleInput {
  name: string;
  publicationDays: DayOfWeek[];
  submissionDeadlines?: SubmissionDeadline[];
  submissionLeadDays: number;
  holidayClosures?: Date[];
  canAccommodateRush?: boolean;
  isLegalPublication?: boolean;
  contactInfo?: {
    phone?: string;
    email?: string;
    contactName?: string;
    address?: string;
  };
}

/**
 * Input for updating a newspaper schedule.
 */
export interface UpdateNewspaperScheduleInput {
  name?: string;
  publicationDays?: DayOfWeek[];
  submissionDeadlines?: SubmissionDeadline[];
  submissionLeadDays?: number;
  holidayClosures?: Date[];
  canAccommodateRush?: boolean;
  contactInfo?: {
    phone?: string;
    email?: string;
    contactName?: string;
    address?: string;
  };
}

/**
 * Data store interface for newspaper schedules.
 */
export interface NewspaperScheduleStore {
  /**
   * Find a schedule by ID.
   */
  findById(ctx: TenantContext, id: string): Promise<NewspaperSchedule | null>;

  /**
   * Find all schedules for a tenant.
   */
  findAllForTenant(ctx: TenantContext): Promise<NewspaperSchedule[]>;

  /**
   * Create a new schedule.
   */
  create(
    ctx: TenantContext,
    input: CreateNewspaperScheduleInput
  ): Promise<NewspaperSchedule>;

  /**
   * Update a schedule.
   */
  update(
    ctx: TenantContext,
    id: string,
    input: UpdateNewspaperScheduleInput
  ): Promise<NewspaperSchedule>;
}

// =============================================================================
// SERVICE CLASS
// =============================================================================

/**
 * Newspaper Schedule Service.
 *
 * Manages newspaper publication schedules and provides deadline calculations
 * for legal notice submissions.
 */
export class NewspaperScheduleService {
  constructor(private readonly store: NewspaperScheduleStore) {}

  /**
   * Get schedule for a notice channel (newspaper).
   *
   * @param ctx Tenant context
   * @param channelId The newspaper schedule ID
   * @returns The schedule or null if not found
   */
  async getSchedule(
    ctx: TenantContext,
    channelId: string
  ): Promise<NewspaperSchedule | null> {
    return this.store.findById(ctx, channelId);
  }

  /**
   * Get all newspaper schedules for a tenant.
   *
   * @param ctx Tenant context
   * @returns Array of newspaper schedules
   */
  async getAllSchedules(ctx: TenantContext): Promise<NewspaperSchedule[]> {
    return this.store.findAllForTenant(ctx);
  }

  /**
   * Find the next publication date on or after a given date.
   *
   * Accounts for:
   * - Newspaper's publication days
   * - Holiday closures
   *
   * @param schedule The newspaper schedule
   * @param onOrAfter The earliest acceptable date
   * @returns The next publication date
   */
  findNextPublicationDate(schedule: NewspaperSchedule, onOrAfter: Date): Date {
    const publicationDayNumbers = schedule.publicationDays.map(
      (d) => DAY_TO_NUMBER[d]
    );

    // Start from onOrAfter date
    let candidate = new Date(onOrAfter);
    candidate.setHours(0, 0, 0, 0);

    // Look up to 60 days ahead (should find publication day within a week)
    for (let i = 0; i < 60; i++) {
      const dayOfWeek = candidate.getDay();

      // Check if this is a publication day
      if (publicationDayNumbers.includes(dayOfWeek)) {
        // Check if this date is a holiday closure
        if (!this.isHolidayClosure(schedule, candidate)) {
          return candidate;
        }
      }

      // Move to next day
      candidate = addDays(candidate, 1);
    }

    // Fallback: return the original date + 7 days if no publication found
    return addDays(onOrAfter, 7);
  }

  /**
   * Calculate the submission deadline for a target publication date.
   *
   * Uses the schedule's submission deadlines if defined for the specific
   * publication day, otherwise falls back to the general lead days.
   *
   * @param schedule The newspaper schedule
   * @param publicationDate The target publication date
   * @returns The submission deadline (date and time)
   */
  getSubmissionDeadline(schedule: NewspaperSchedule, publicationDate: Date): Date {
    const pubDay = NUMBER_TO_DAY[publicationDate.getDay()];

    // Look for specific deadline for this publication day
    const specificDeadline = schedule.submissionDeadlines?.find(
      (d) => d.publicationDay === pubDay
    );

    if (specificDeadline) {
      // Calculate based on specific deadline config
      const deadline = addDays(
        publicationDate,
        -specificDeadline.daysBeforePublication
      );
      deadline.setHours(0, 0, 0, 0);

      // Parse time (HH:MM format)
      const [hours, minutes] = specificDeadline.submissionTime.split(':').map(Number);
      deadline.setHours(hours, minutes, 0, 0);

      return deadline;
    }

    // Fall back to general lead days (default 5 PM deadline)
    const deadline = addDays(publicationDate, -schedule.submissionLeadDays);
    deadline.setHours(17, 0, 0, 0); // 5 PM default

    return deadline;
  }

  /**
   * Check if a submission deadline has passed.
   *
   * @param schedule The newspaper schedule
   * @param targetPubDate The target publication date
   * @param now Current date/time
   * @returns True if the deadline has passed
   */
  isDeadlinePassed(
    schedule: NewspaperSchedule,
    targetPubDate: Date,
    now: Date
  ): boolean {
    const deadline = this.getSubmissionDeadline(schedule, targetPubDate);
    return now > deadline;
  }

  /**
   * Create a new newspaper schedule.
   *
   * @param ctx Tenant context
   * @param input Schedule creation input
   * @returns The created schedule
   */
  async createSchedule(
    ctx: TenantContext,
    input: CreateNewspaperScheduleInput
  ): Promise<NewspaperSchedule> {
    return this.store.create(ctx, input);
  }

  /**
   * Update a newspaper schedule.
   *
   * @param ctx Tenant context
   * @param id Schedule ID
   * @param input Update input
   * @returns The updated schedule
   */
  async updateSchedule(
    ctx: TenantContext,
    id: string,
    input: UpdateNewspaperScheduleInput
  ): Promise<NewspaperSchedule> {
    return this.store.update(ctx, id, input);
  }

  /**
   * Check if a date is a holiday closure for the newspaper.
   */
  private isHolidayClosure(schedule: NewspaperSchedule, date: Date): boolean {
    if (!schedule.holidayClosures || schedule.holidayClosures.length === 0) {
      return false;
    }

    const dateStr = date.toISOString().split('T')[0];
    return schedule.holidayClosures.some(
      (closure) => closure.toISOString().split('T')[0] === dateStr
    );
  }
}

// =============================================================================
// IN-MEMORY STORE IMPLEMENTATION
// =============================================================================

/**
 * In-memory implementation of NewspaperScheduleStore.
 */
export class InMemoryNewspaperScheduleStore implements NewspaperScheduleStore {
  private schedules: Map<string, NewspaperSchedule[]> = new Map();

  async findById(
    ctx: TenantContext,
    id: string
  ): Promise<NewspaperSchedule | null> {
    const tenantSchedules = this.schedules.get(ctx.tenantId) ?? [];
    return tenantSchedules.find((s) => s.id === id && s.isActive) ?? null;
  }

  async findAllForTenant(ctx: TenantContext): Promise<NewspaperSchedule[]> {
    return (this.schedules.get(ctx.tenantId) ?? []).filter((s) => s.isActive);
  }

  async create(
    ctx: TenantContext,
    input: CreateNewspaperScheduleInput
  ): Promise<NewspaperSchedule> {
    const schedule: NewspaperSchedule = {
      id: crypto.randomUUID(),
      tenantId: ctx.tenantId,
      name: input.name,
      publicationDays: input.publicationDays,
      submissionDeadlines: input.submissionDeadlines ?? [],
      submissionLeadDays: input.submissionLeadDays,
      holidayClosures: input.holidayClosures ?? [],
      canAccommodateRush: input.canAccommodateRush ?? false,
      isLegalPublication: input.isLegalPublication ?? true,
      contactInfo: input.contactInfo,
      isActive: true,
      createdAt: new Date(),
    };

    const tenantSchedules = this.schedules.get(ctx.tenantId) ?? [];
    tenantSchedules.push(schedule);
    this.schedules.set(ctx.tenantId, tenantSchedules);

    return schedule;
  }

  async update(
    ctx: TenantContext,
    id: string,
    input: UpdateNewspaperScheduleInput
  ): Promise<NewspaperSchedule> {
    const tenantSchedules = this.schedules.get(ctx.tenantId) ?? [];
    const index = tenantSchedules.findIndex((s) => s.id === id);

    if (index === -1) {
      throw new Error(`Newspaper schedule not found: ${id}`);
    }

    const existing = tenantSchedules[index];
    const updated: NewspaperSchedule = {
      ...existing,
      ...input,
    };

    tenantSchedules[index] = updated;
    return updated;
  }

  /**
   * Clear all schedules (for testing).
   */
  clear(): void {
    this.schedules.clear();
  }
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Add days to a date.
 *
 * @param date The base date
 * @param days Number of days to add (can be negative)
 * @returns A new date with days added
 */
export function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

/**
 * Get the day of week name from a date.
 *
 * @param date The date
 * @returns The day name
 */
export function getDayOfWeek(date: Date): DayOfWeek {
  return NUMBER_TO_DAY[date.getDay()];
}

/**
 * Count business days between two dates.
 * Business days are Monday-Friday.
 *
 * @param start Start date
 * @param end End date
 * @returns Number of business days
 */
export function countBusinessDays(start: Date, end: Date): number {
  let count = 0;
  const current = new Date(start);
  current.setHours(0, 0, 0, 0);
  const endDate = new Date(end);
  endDate.setHours(0, 0, 0, 0);

  while (current < endDate) {
    const dayOfWeek = current.getDay();
    // Monday = 1, Friday = 5
    if (dayOfWeek >= 1 && dayOfWeek <= 5) {
      count++;
    }
    current.setDate(current.getDate() + 1);
  }

  return count;
}

/**
 * Calculate the date that is N weeks before a given date.
 *
 * @param date The reference date
 * @param weeks Number of weeks before
 * @returns The calculated date
 */
export function weeksBefore(date: Date, weeks: number): Date {
  return addDays(date, -weeks * 7);
}
