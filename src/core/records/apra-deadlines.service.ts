// src/core/records/apra-deadlines.service.ts
//
// APRA Deadline Calculator Service
//
// Calculates response deadlines for APRA requests based on configuration.
// Uses business days (excluding weekends) by default per IC 5-14-3-9(a).
// Holiday handling can be added in future versions.

import { INApraConfig } from '../../states/in/apra/in-apra.config';
import { ApraDeadlineInfo } from './apra-workflow.types';

/**
 * Calculate APRA deadlines based on config and a received date.
 *
 * For v1:
 * - standardResponseDays: initial due date = receivedAt + N days
 * - extensionResponseDays: extended due date = receivedAt + M days (if config allows)
 * - businessDaysOnly: if true, count business days (Mon-Fri), skip weekends
 *
 * Note: Holiday handling is not included in v1. For production use,
 * integrate with the calendar utilities in src/core/calendar/.
 *
 * @param receivedAt - When the request was received
 * @param config - APRA configuration (typically from INApraConfig)
 * @returns Computed deadline information
 *
 * @example
 * ```typescript
 * import { calculateApraDeadlines } from './apra-deadlines.service';
 * import { DEFAULT_IN_APRA_CONFIG } from '../../states/in/apra/in-apra.config';
 *
 * const received = new Date('2025-01-06T09:00:00'); // Monday
 * const deadlines = calculateApraDeadlines(received, DEFAULT_IN_APRA_CONFIG);
 *
 * console.log(deadlines.initialDueDate);  // 2025-01-15 (7 business days)
 * console.log(deadlines.extendedDueDate); // 2025-01-24 (14 business days)
 * console.log(deadlines.usesBusinessDays); // true
 * ```
 */
export function calculateApraDeadlines(
  receivedAt: Date,
  config: Partial<INApraConfig>
): ApraDeadlineInfo {
  // Get config values with sensible defaults
  const standardDays = config.standardResponseDays ?? 7;
  const extensionDays = config.extensionResponseDays;
  const usesBusinessDays = config.businessDaysOnly ?? true;

  // Calculate initial due date
  const initialDueDate = addDays(receivedAt, standardDays, usesBusinessDays);

  // Calculate extended due date if extension is configured
  const extendedDueDate = extensionDays
    ? addDays(receivedAt, extensionDays, usesBusinessDays)
    : undefined;

  return {
    initialDueDate,
    extendedDueDate,
    usesBusinessDays,
  };
}

/**
 * Add days to a date, optionally skipping weekends.
 *
 * Simple implementation for v1:
 * - If businessDaysOnly is false, adds calendar days directly
 * - If businessDaysOnly is true, skips Saturdays and Sundays
 * - Does NOT account for holidays (can be added in v2)
 *
 * @param start - Starting date
 * @param days - Number of days to add
 * @param businessDaysOnly - Whether to skip weekends
 * @returns The resulting date
 *
 * @example
 * ```typescript
 * // Add 7 business days to a Monday
 * const monday = new Date('2025-01-06');
 * const result = addDays(monday, 7, true);
 * // result = 2025-01-15 (skips Sat 1/11 and Sun 1/12)
 * ```
 */
export function addDays(
  start: Date,
  days: number,
  businessDaysOnly: boolean
): Date {
  // Clone the start date to avoid mutation
  const result = new Date(start.getTime());

  let remaining = days;

  while (remaining > 0) {
    // Move to next day
    result.setDate(result.getDate() + 1);

    if (!businessDaysOnly) {
      // Calendar days - count every day
      remaining--;
    } else {
      // Business days - skip weekends
      const dayOfWeek = result.getDay(); // 0 = Sunday, 6 = Saturday
      if (dayOfWeek !== 0 && dayOfWeek !== 6) {
        remaining--;
      }
    }
  }

  return result;
}

/**
 * Calculate how many days remain until a deadline.
 *
 * @param deadline - The deadline date
 * @param asOf - The reference date (defaults to now)
 * @param businessDaysOnly - Whether to count business days only
 * @returns Number of days remaining (negative if past due)
 *
 * @example
 * ```typescript
 * const deadline = new Date('2025-01-15');
 * const today = new Date('2025-01-10');
 * const remaining = getDaysUntilDeadline(deadline, today, true);
 * // remaining = 3 (business days: Mon, Tue, Wed)
 * ```
 */
export function getDaysUntilDeadline(
  deadline: Date,
  asOf: Date = new Date(),
  businessDaysOnly: boolean = true
): number {
  // Normalize to start of day for comparison
  const deadlineDate = new Date(deadline);
  deadlineDate.setHours(0, 0, 0, 0);

  const asOfDate = new Date(asOf);
  asOfDate.setHours(0, 0, 0, 0);

  if (asOfDate >= deadlineDate) {
    // Past due or due today - count backwards
    return -countDaysBetween(deadlineDate, asOfDate, businessDaysOnly);
  }

  // Future deadline - count forward
  return countDaysBetween(asOfDate, deadlineDate, businessDaysOnly);
}

/**
 * Count the number of days between two dates.
 *
 * @param from - Start date (exclusive)
 * @param to - End date (inclusive)
 * @param businessDaysOnly - Whether to count business days only
 * @returns Number of days
 */
export function countDaysBetween(
  from: Date,
  to: Date,
  businessDaysOnly: boolean
): number {
  const start = new Date(from);
  const end = new Date(to);

  let count = 0;
  const current = new Date(start);

  while (current < end) {
    current.setDate(current.getDate() + 1);

    if (!businessDaysOnly) {
      count++;
    } else {
      const dayOfWeek = current.getDay();
      if (dayOfWeek !== 0 && dayOfWeek !== 6) {
        count++;
      }
    }
  }

  return count;
}

/**
 * Check if a deadline has been exceeded.
 *
 * @param deadline - The deadline to check
 * @param asOf - The reference date (defaults to now)
 * @returns true if the deadline has passed
 */
export function isDeadlineExceeded(
  deadline: Date,
  asOf: Date = new Date()
): boolean {
  return asOf > deadline;
}

/**
 * Get a deadline status classification.
 *
 * @param deadline - The deadline date
 * @param asOf - The reference date (defaults to now)
 * @param businessDaysOnly - Whether to use business days
 * @returns Status: 'OVERDUE', 'DUE_TODAY', 'DUE_SOON' (within 2 days), or 'ON_TRACK'
 *
 * @example
 * ```typescript
 * const deadline = new Date('2025-01-15');
 * const status = getDeadlineStatus(deadline, new Date('2025-01-13'), true);
 * // status = 'DUE_SOON' (2 business days remaining)
 * ```
 */
export function getDeadlineStatus(
  deadline: Date,
  asOf: Date = new Date(),
  businessDaysOnly: boolean = true
): 'OVERDUE' | 'DUE_TODAY' | 'DUE_SOON' | 'ON_TRACK' {
  const daysRemaining = getDaysUntilDeadline(deadline, asOf, businessDaysOnly);

  if (daysRemaining < 0) {
    return 'OVERDUE';
  }

  if (daysRemaining === 0) {
    return 'DUE_TODAY';
  }

  if (daysRemaining <= 2) {
    return 'DUE_SOON';
  }

  return 'ON_TRACK';
}

/**
 * Recalculate deadlines from a new start date.
 *
 * Used when the deadline clock restarts, such as after receiving
 * clarification from a requester.
 *
 * @param newStartDate - The new start date for deadline calculation
 * @param config - APRA configuration
 * @returns New deadline information
 *
 * @example
 * ```typescript
 * // Requester responded to clarification request
 * const clarificationReceived = new Date('2025-01-15');
 * const newDeadlines = recalculateDeadlines(clarificationReceived, apraConfig);
 * // Deadline clock restarts from Jan 15
 * ```
 */
export function recalculateDeadlines(
  newStartDate: Date,
  config: Partial<INApraConfig>
): ApraDeadlineInfo {
  return calculateApraDeadlines(newStartDate, config);
}

/**
 * Format a deadline for display.
 *
 * @param deadline - The deadline date
 * @param includeTime - Whether to include time in the format
 * @returns Formatted date string
 */
export function formatDeadline(
  deadline: Date,
  includeTime: boolean = false
): string {
  const options: Intl.DateTimeFormatOptions = {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  };

  if (includeTime) {
    options.hour = 'numeric';
    options.minute = '2-digit';
  }

  return new Intl.DateTimeFormat('en-US', options).format(deadline);
}

/**
 * Get a summary of deadline status for UI display.
 *
 * @param deadlines - The deadline info
 * @param asOf - Reference date (defaults to now)
 * @returns Summary object with status, message, and days remaining
 */
export function getDeadlineSummary(
  deadlines: ApraDeadlineInfo,
  asOf: Date = new Date()
): {
  status: 'OVERDUE' | 'DUE_TODAY' | 'DUE_SOON' | 'ON_TRACK';
  message: string;
  daysRemaining: number;
  isExtended: boolean;
} {
  // Use extended deadline if available, otherwise initial
  const activeDeadline = deadlines.extendedDueDate ?? deadlines.initialDueDate;
  const isExtended = !!deadlines.extendedDueDate;

  const status = getDeadlineStatus(activeDeadline, asOf, deadlines.usesBusinessDays);
  const daysRemaining = getDaysUntilDeadline(
    activeDeadline,
    asOf,
    deadlines.usesBusinessDays
  );

  let message: string;
  switch (status) {
    case 'OVERDUE':
      message = `Overdue by ${Math.abs(daysRemaining)} business day(s)`;
      break;
    case 'DUE_TODAY':
      message = 'Due today';
      break;
    case 'DUE_SOON':
      message = `Due in ${daysRemaining} business day(s)`;
      break;
    case 'ON_TRACK':
      message = `${daysRemaining} business day(s) remaining`;
      break;
  }

  if (isExtended) {
    message += ' (extended)';
  }

  return {
    status,
    message,
    daysRemaining,
    isExtended,
  };
}
