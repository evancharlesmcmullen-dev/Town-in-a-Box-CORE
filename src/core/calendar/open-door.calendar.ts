// src/core/calendar/open-door.calendar.ts
//
// Calendar utility for Indiana Open Door Law (IC 5-14-1.5-5) compliance.
//
// The law requires public meeting notice to be posted "at least 48 hours
// (excluding Saturdays, Sundays, and legal holidays)" before the meeting.

/**
 * Options for Open Door Law calendar calculations.
 */
export interface OpenDoorCalendarOptions {
  /**
   * Legal holidays to exclude, as ISO date strings (YYYY-MM-DD).
   * These are in addition to weekends (Saturdays and Sundays).
   *
   * @example ['2025-01-01', '2025-07-04', '2025-12-25']
   */
  holidays?: string[];
}

/**
 * Result of an Open Door compliance check.
 */
export interface OpenDoorComplianceResult {
  /** The deadline by which notice must be posted. */
  requiredPostedBy: Date;
  /** Whether the actual posting time meets the deadline. */
  isTimely: boolean;
  /** Number of business hours between posting and meeting. */
  businessHoursLead: number;
}

/**
 * Compute the latest lawful notice posting time for a meeting.
 *
 * Per IC 5-14-1.5-5, notice must be posted "at least 48 hours
 * (excluding Saturdays, Sundays, and legal holidays)" before the meeting.
 *
 * The algorithm:
 * 1. Start with the meeting time
 * 2. Count backward 48 "business hours" (hours on weekdays that aren't holidays)
 * 3. Return that datetime as the deadline
 *
 * @param scheduledStart - When the meeting is scheduled to begin
 * @param opts - Optional configuration (holidays list)
 * @returns The latest datetime by which notice must be posted to be compliant
 *
 * @example
 * // Meeting on Monday at 7 PM
 * const meeting = new Date('2025-02-10T19:00:00');
 * const deadline = computeRequiredPostedBy(meeting);
 * // Returns Thursday at 7 PM (skipping Sat/Sun)
 */
export function computeRequiredPostedBy(
  scheduledStart: Date,
  opts: OpenDoorCalendarOptions = {}
): Date {
  const holidays = new Set(opts.holidays ?? []);

  // We need to count back 48 business hours
  // A business hour is an hour on a weekday (Mon-Fri) that isn't a holiday
  let remainingHours = 48;
  let current = new Date(scheduledStart);

  while (remainingHours > 0) {
    // Move back 1 hour
    current = new Date(current.getTime() - 60 * 60 * 1000);

    // Check if this hour counts as a business hour
    if (!isWeekendOrHoliday(current, holidays)) {
      remainingHours--;
    }
  }

  return current;
}

/**
 * Check if a notice posting time is compliant with Open Door Law.
 *
 * @param scheduledStart - When the meeting is scheduled to begin
 * @param postedAt - When the notice was actually posted
 * @param opts - Optional configuration (holidays list)
 * @returns Compliance result with deadline, timeliness, and lead time
 *
 * @example
 * const meeting = new Date('2025-02-10T19:00:00');
 * const posted = new Date('2025-02-06T10:00:00');
 * const result = checkOpenDoorCompliance(meeting, posted);
 * // result.isTimely === true (posted well before deadline)
 */
export function checkOpenDoorCompliance(
  scheduledStart: Date,
  postedAt: Date,
  opts: OpenDoorCalendarOptions = {}
): OpenDoorComplianceResult {
  const requiredPostedBy = computeRequiredPostedBy(scheduledStart, opts);
  const isTimely = postedAt.getTime() <= requiredPostedBy.getTime();
  const businessHoursLead = countBusinessHours(postedAt, scheduledStart, opts);

  return {
    requiredPostedBy,
    isTimely,
    businessHoursLead,
  };
}

/**
 * Count business hours between two dates.
 *
 * @param from - Start datetime
 * @param to - End datetime
 * @param opts - Optional configuration (holidays list)
 * @returns Number of business hours between the dates
 */
export function countBusinessHours(
  from: Date,
  to: Date,
  opts: OpenDoorCalendarOptions = {}
): number {
  const holidays = new Set(opts.holidays ?? []);

  if (from >= to) {
    return 0;
  }

  let count = 0;
  let current = new Date(from);

  while (current < to) {
    if (!isWeekendOrHoliday(current, holidays)) {
      count++;
    }
    current = new Date(current.getTime() + 60 * 60 * 1000);
  }

  return count;
}

/**
 * Check if a date falls on a weekend or holiday.
 *
 * @param date - The date to check
 * @param holidays - Set of holiday dates as ISO strings (YYYY-MM-DD)
 * @returns true if the date is a Saturday, Sunday, or listed holiday
 */
function isWeekendOrHoliday(date: Date, holidays: Set<string>): boolean {
  const day = date.getDay(); // 0=Sunday, 6=Saturday

  // Check weekend
  if (day === 0 || day === 6) {
    return true;
  }

  // Check holiday (compare date portion only)
  const isoDate = toIsoDateString(date);
  return holidays.has(isoDate);
}

/**
 * Convert a Date to ISO date string (YYYY-MM-DD) in local time.
 * This is used for holiday comparison.
 */
function toIsoDateString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Standard Indiana state holidays for Open Door Law calculations.
 * These can be used as a baseline; municipalities may observe additional holidays.
 *
 * Note: This returns holidays for a specific year. You should generate
 * the list for the relevant year(s) of your meetings.
 */
export function getIndianaStateHolidays(year: number): string[] {
  // Indiana observes these state holidays (IC 1-1-9-1):
  // - New Year's Day (Jan 1)
  // - Martin Luther King Jr. Day (3rd Monday in January)
  // - Presidents Day (3rd Monday in February)
  // - Memorial Day (last Monday in May)
  // - Juneteenth (June 19)
  // - Independence Day (July 4)
  // - Labor Day (1st Monday in September)
  // - Columbus Day (2nd Monday in October)
  // - Veterans Day (November 11)
  // - Thanksgiving Day (4th Thursday in November)
  // - Day after Thanksgiving
  // - Christmas Day (December 25)

  const holidays: string[] = [];

  // Fixed holidays
  holidays.push(`${year}-01-01`); // New Year's Day
  holidays.push(`${year}-06-19`); // Juneteenth
  holidays.push(`${year}-07-04`); // Independence Day
  holidays.push(`${year}-11-11`); // Veterans Day
  holidays.push(`${year}-12-25`); // Christmas Day

  // MLK Day: 3rd Monday in January
  holidays.push(getNthWeekdayOfMonth(year, 0, 1, 3)); // month 0 = January, weekday 1 = Monday

  // Presidents Day: 3rd Monday in February
  holidays.push(getNthWeekdayOfMonth(year, 1, 1, 3));

  // Memorial Day: last Monday in May
  holidays.push(getLastWeekdayOfMonth(year, 4, 1)); // month 4 = May

  // Labor Day: 1st Monday in September
  holidays.push(getNthWeekdayOfMonth(year, 8, 1, 1)); // month 8 = September

  // Columbus Day: 2nd Monday in October
  holidays.push(getNthWeekdayOfMonth(year, 9, 1, 2)); // month 9 = October

  // Thanksgiving: 4th Thursday in November
  const thanksgiving = getNthWeekdayOfMonth(year, 10, 4, 4); // month 10 = November, weekday 4 = Thursday
  holidays.push(thanksgiving);

  // Day after Thanksgiving
  const thanksgivingDate = new Date(thanksgiving);
  thanksgivingDate.setDate(thanksgivingDate.getDate() + 1);
  holidays.push(toIsoDateString(thanksgivingDate));

  return holidays;
}

/**
 * Get the Nth occurrence of a weekday in a month.
 * @param year - The year
 * @param month - The month (0-11)
 * @param weekday - The day of week (0=Sunday, 1=Monday, etc.)
 * @param n - Which occurrence (1=first, 2=second, etc.)
 * @returns ISO date string (YYYY-MM-DD)
 */
function getNthWeekdayOfMonth(
  year: number,
  month: number,
  weekday: number,
  n: number
): string {
  const date = new Date(year, month, 1);
  let count = 0;

  while (date.getMonth() === month) {
    if (date.getDay() === weekday) {
      count++;
      if (count === n) {
        return toIsoDateString(date);
      }
    }
    date.setDate(date.getDate() + 1);
  }

  throw new Error(`Could not find ${n}th weekday ${weekday} in month ${month}`);
}

/**
 * Get the last occurrence of a weekday in a month.
 * @param year - The year
 * @param month - The month (0-11)
 * @param weekday - The day of week (0=Sunday, 1=Monday, etc.)
 * @returns ISO date string (YYYY-MM-DD)
 */
function getLastWeekdayOfMonth(
  year: number,
  month: number,
  weekday: number
): string {
  // Start from the last day of the month
  const date = new Date(year, month + 1, 0); // Day 0 of next month = last day of this month

  while (date.getDay() !== weekday) {
    date.setDate(date.getDate() - 1);
  }

  return toIsoDateString(date);
}

// =============================================================================
// APRA (Indiana Access to Public Records Act) Calendar Utilities
// =============================================================================

/**
 * Options for APRA deadline calculations.
 */
export interface ApraCalendarOptions {
  /**
   * Legal holidays to exclude, as ISO date strings (YYYY-MM-DD).
   * These are in addition to weekends (Saturdays and Sundays).
   *
   * @example ['2025-01-01', '2025-07-04', '2025-12-25']
   */
  holidays?: string[];
}

/**
 * Compute the APRA statutory deadline for responding to a records request.
 *
 * Per IC 5-14-3-9(a), a public agency must respond to a request for
 * records "within a reasonable time" but not later than 7 business days
 * after the date the request is received.
 *
 * Business days exclude weekends (Saturday and Sunday) and Indiana
 * state holidays.
 *
 * @param receivedAt - When the request was received
 * @param opts - Optional configuration (holidays list)
 * @returns The deadline date/time
 *
 * @example
 * // Request received Monday Jan 6, 2025
 * const received = new Date('2025-01-06T09:00:00');
 * const deadline = computeApraDeadline(received);
 * // Returns Jan 15, 2025 at 09:00:00 (7 business days later)
 * // Skipping weekends and any holidays
 */
export function computeApraDeadline(
  receivedAt: Date,
  opts: ApraCalendarOptions = {}
): Date {
  const holidays = new Set(opts.holidays ?? []);

  // Start from the day after receipt (the first business day counts)
  let current = new Date(receivedAt);
  let businessDaysRemaining = 7;

  while (businessDaysRemaining > 0) {
    // Move to next day
    current = new Date(current.getTime() + 24 * 60 * 60 * 1000);

    // Check if this is a business day
    if (!isWeekendOrHoliday(current, holidays)) {
      businessDaysRemaining--;
    }
  }

  // Preserve the original time of day
  current.setHours(
    receivedAt.getHours(),
    receivedAt.getMinutes(),
    receivedAt.getSeconds(),
    receivedAt.getMilliseconds()
  );

  return current;
}

/**
 * Add N business days to a date.
 *
 * Business days exclude weekends and specified holidays.
 *
 * @param startDate - The starting date
 * @param businessDays - Number of business days to add
 * @param opts - Optional configuration (holidays list)
 * @returns The resulting date
 */
export function addBusinessDays(
  startDate: Date,
  businessDays: number,
  opts: ApraCalendarOptions = {}
): Date {
  const holidays = new Set(opts.holidays ?? []);
  let current = new Date(startDate);
  let daysRemaining = businessDays;

  while (daysRemaining > 0) {
    // Move to next day
    current = new Date(current.getTime() + 24 * 60 * 60 * 1000);

    // Check if this is a business day
    if (!isWeekendOrHoliday(current, holidays)) {
      daysRemaining--;
    }
  }

  // Preserve the original time of day
  current.setHours(
    startDate.getHours(),
    startDate.getMinutes(),
    startDate.getSeconds(),
    startDate.getMilliseconds()
  );

  return current;
}
