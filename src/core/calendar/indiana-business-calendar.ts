// src/core/calendar/indiana-business-calendar.ts

/**
 * Indiana state holidays (observed dates).
 * Per IC 1-1-9-1, these are the official state holidays.
 * This list needs to be updated annually for floating holidays.
 */
export function getIndianaHolidays(year: number): Date[] {
  const holidays: Date[] = [];

  // New Year's Day - January 1
  holidays.push(observedDate(new Date(year, 0, 1)));

  // Martin Luther King Jr. Day - 3rd Monday of January
  holidays.push(nthWeekdayOfMonth(year, 0, 1, 3));

  // Presidents' Day - 3rd Monday of February
  holidays.push(nthWeekdayOfMonth(year, 1, 1, 3));

  // Good Friday - Friday before Easter (variable)
  holidays.push(goodFriday(year));

  // Primary Election Day - first Tuesday after first Monday in May (even years)
  if (year % 2 === 0) {
    holidays.push(primaryElectionDay(year));
  }

  // Memorial Day - last Monday of May
  holidays.push(lastWeekdayOfMonth(year, 4, 1));

  // Independence Day - July 4
  holidays.push(observedDate(new Date(year, 6, 4)));

  // Labor Day - 1st Monday of September
  holidays.push(nthWeekdayOfMonth(year, 8, 1, 1));

  // Columbus Day - 2nd Monday of October
  holidays.push(nthWeekdayOfMonth(year, 9, 1, 2));

  // General Election Day - first Tuesday after first Monday in November (even years)
  if (year % 2 === 0) {
    holidays.push(generalElectionDay(year));
  }

  // Veterans Day - November 11
  holidays.push(observedDate(new Date(year, 10, 11)));

  // Thanksgiving Day - 4th Thursday of November
  holidays.push(nthWeekdayOfMonth(year, 10, 4, 4));

  // Day after Thanksgiving - Friday after Thanksgiving
  const thanksgiving = nthWeekdayOfMonth(year, 10, 4, 4);
  holidays.push(new Date(thanksgiving.getTime() + 24 * 60 * 60 * 1000));

  // Christmas Day - December 25
  holidays.push(observedDate(new Date(year, 11, 25)));

  return holidays;
}

/**
 * Check if a date is a weekend (Saturday or Sunday).
 */
export function isWeekend(date: Date): boolean {
  const day = date.getDay();
  return day === 0 || day === 6;
}

/**
 * Check if a date is an Indiana state holiday.
 */
export function isIndianaHoliday(date: Date): boolean {
  const year = date.getFullYear();
  const holidays = getIndianaHolidays(year);
  const dateStr = toDateString(date);
  return holidays.some((h) => toDateString(h) === dateStr);
}

/**
 * Check if a date is a business day in Indiana.
 * Business days exclude weekends and state holidays.
 */
export function isIndianaBusinessDay(date: Date): boolean {
  return !isWeekend(date) && !isIndianaHoliday(date);
}

/**
 * Calculate the deadline for Open Door Law notice posting.
 * Indiana requires notices to be posted at least 48 hours before a meeting,
 * excluding weekends and legal holidays (IC 5-14-1.5-5).
 *
 * @param meetingStart - The meeting start date/time
 * @returns The latest date/time by which notice must be posted
 */
export function calculateNoticeDeadline(meetingStart: Date): Date {
  // We need to subtract 48 business hours (2 business days) from the meeting time.
  // Working backwards: find 2 business days before the meeting.
  let deadline = new Date(meetingStart);
  let businessDaysToSubtract = 2;

  while (businessDaysToSubtract > 0) {
    deadline = new Date(deadline.getTime() - 24 * 60 * 60 * 1000);
    if (isIndianaBusinessDay(deadline)) {
      businessDaysToSubtract--;
    }
  }

  // Preserve the original time of day
  deadline.setHours(
    meetingStart.getHours(),
    meetingStart.getMinutes(),
    meetingStart.getSeconds(),
    meetingStart.getMilliseconds()
  );

  return deadline;
}

/**
 * Check if a notice posted at `postedAt` satisfies the 48 business hour
 * requirement for a meeting at `meetingStart`.
 */
export function isNoticeCompliant(postedAt: Date, meetingStart: Date): boolean {
  const deadline = calculateNoticeDeadline(meetingStart);
  return postedAt <= deadline;
}

// ---- Helper functions ----

function toDateString(date: Date): string {
  return date.toISOString().split('T')[0];
}

function observedDate(date: Date): Date {
  const day = date.getDay();
  if (day === 0) {
    // Sunday -> observed Monday
    return new Date(date.getTime() + 24 * 60 * 60 * 1000);
  }
  if (day === 6) {
    // Saturday -> observed Friday
    return new Date(date.getTime() - 24 * 60 * 60 * 1000);
  }
  return date;
}

function nthWeekdayOfMonth(
  year: number,
  month: number,
  weekday: number,
  n: number
): Date {
  const firstDay = new Date(year, month, 1);
  const firstWeekday = firstDay.getDay();
  let dayOffset = weekday - firstWeekday;
  if (dayOffset < 0) dayOffset += 7;
  const day = 1 + dayOffset + (n - 1) * 7;
  return new Date(year, month, day);
}

function lastWeekdayOfMonth(
  year: number,
  month: number,
  weekday: number
): Date {
  const lastDay = new Date(year, month + 1, 0);
  const lastWeekdayOfMonthDay = lastDay.getDay();
  let dayOffset = lastWeekdayOfMonthDay - weekday;
  if (dayOffset < 0) dayOffset += 7;
  return new Date(year, month, lastDay.getDate() - dayOffset);
}

function goodFriday(year: number): Date {
  // Calculate Easter Sunday using the anonymous Gregorian algorithm
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31) - 1;
  const day = ((h + l - 7 * m + 114) % 31) + 1;

  const easter = new Date(year, month, day);
  // Good Friday is 2 days before Easter
  return new Date(easter.getTime() - 2 * 24 * 60 * 60 * 1000);
}

function primaryElectionDay(year: number): Date {
  // First Tuesday after first Monday in May
  const firstMonday = nthWeekdayOfMonth(year, 4, 1, 1);
  return new Date(firstMonday.getTime() + 24 * 60 * 60 * 1000);
}

function generalElectionDay(year: number): Date {
  // First Tuesday after first Monday in November
  const firstMonday = nthWeekdayOfMonth(year, 10, 1, 1);
  return new Date(firstMonday.getTime() + 24 * 60 * 60 * 1000);
}
