// src/http/validation.ts
// Lightweight validation utilities for HTTP request bodies.

import { ValidationError } from './errors';

/**
 * Assert that a value is a non-empty string.
 */
export function assertString(
  value: unknown,
  fieldName: string
): asserts value is string {
  if (typeof value !== 'string') {
    throw new ValidationError(`${fieldName} must be a string`);
  }
  if (value.trim().length === 0) {
    throw new ValidationError(`${fieldName} must be a non-empty string`);
  }
}

/**
 * Assert that a value is a string (allow optional/empty).
 */
export function assertOptionalString(
  value: unknown,
  fieldName: string
): asserts value is string | undefined {
  if (value === undefined || value === null) return;
  if (typeof value !== 'string') {
    throw new ValidationError(`${fieldName} must be a string`);
  }
}

/**
 * Assert that a value is a boolean.
 */
export function assertBoolean(
  value: unknown,
  fieldName: string
): asserts value is boolean {
  if (typeof value !== 'boolean') {
    throw new ValidationError(`${fieldName} must be a boolean`);
  }
}

/**
 * Assert that a value is a parseable ISO date string.
 * Returns the parsed Date.
 */
export function assertIsoDate(value: unknown, fieldName: string): Date {
  if (typeof value !== 'string') {
    throw new ValidationError(`${fieldName} must be a string`);
  }
  const date = new Date(value);
  if (isNaN(date.getTime())) {
    throw new ValidationError(`${fieldName} must be a valid ISO date string`);
  }
  return date;
}

/**
 * Assert that a value is one of the allowed values.
 */
export function assertOneOf<T extends string>(
  value: unknown,
  allowed: readonly T[],
  fieldName: string
): asserts value is T {
  if (typeof value !== 'string') {
    throw new ValidationError(`${fieldName} must be a string`);
  }
  if (!allowed.includes(value as T)) {
    throw new ValidationError(
      `${fieldName} must be one of: ${allowed.join(', ')}`
    );
  }
}

/**
 * Assert that a value is a non-empty array.
 */
export function assertNonEmptyArray<T = unknown>(
  value: unknown,
  fieldName: string
): asserts value is T[] {
  if (!Array.isArray(value)) {
    throw new ValidationError(`${fieldName} must be an array`);
  }
  if (value.length === 0) {
    throw new ValidationError(`${fieldName} must not be empty`);
  }
}

/**
 * Assert that every element in an array is a non-empty string.
 */
export function assertStringArray(
  value: unknown,
  fieldName: string
): asserts value is string[] {
  assertNonEmptyArray(value, fieldName);
  for (let i = 0; i < (value as unknown[]).length; i++) {
    const item = (value as unknown[])[i];
    if (typeof item !== 'string' || item.trim().length === 0) {
      throw new ValidationError(
        `${fieldName}[${i}] must be a non-empty string`
      );
    }
  }
}

/**
 * Assert that an optional date (if provided) is after another date.
 */
export function assertDateAfter(
  date: Date,
  afterDate: Date,
  fieldName: string,
  afterFieldName: string
): void {
  if (date.getTime() <= afterDate.getTime()) {
    throw new ValidationError(
      `${fieldName} must be after ${afterFieldName}`
    );
  }
}
