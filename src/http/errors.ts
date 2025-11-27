// src/http/errors.ts
// Error types and centralized error handler for the HTTP API.

import { Request, Response, NextFunction } from 'express';

/**
 * Standard error response shape for all API errors.
 */
export interface ApiErrorBody {
  error: string;       // short code
  message: string;     // human-readable
  details?: unknown;   // optional extra info
}

/**
 * Base class for application errors with HTTP status code mapping.
 */
export class AppError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly statusCode: number = 500,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = 'AppError';
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Validation error (400 Bad Request).
 */
export class ValidationError extends AppError {
  constructor(message: string, details?: unknown) {
    super('VALIDATION_ERROR', message, 400, details);
    this.name = 'ValidationError';
  }
}

/**
 * Not found error (404 Not Found).
 */
export class NotFoundError extends AppError {
  constructor(message: string, details?: unknown) {
    super('NOT_FOUND', message, 404, details);
    this.name = 'NotFoundError';
  }
}

/**
 * AI-related error codes.
 */
export type AiErrorCode =
  | 'AI_UNAVAILABLE'
  | 'AI_RATE_LIMITED'
  | 'AI_TIMEOUT'
  | 'AI_INVALID_RESPONSE'
  | 'AI_CONFIGURATION_ERROR';

/**
 * AI-related error (502/503 depending on code).
 */
export class AiError extends AppError {
  constructor(
    public readonly aiCode: AiErrorCode,
    message: string,
    details?: unknown
  ) {
    const statusCode = aiCodeToStatus(aiCode);
    super(aiCode, message, statusCode, details);
    this.name = 'AiError';
  }
}

function aiCodeToStatus(code: AiErrorCode): number {
  switch (code) {
    case 'AI_UNAVAILABLE':
      return 503;
    case 'AI_RATE_LIMITED':
      return 503;
    case 'AI_TIMEOUT':
      return 504;
    case 'AI_INVALID_RESPONSE':
      return 502;
    case 'AI_CONFIGURATION_ERROR':
      return 500;
    default:
      return 502;
  }
}

/**
 * Centralized error handling middleware.
 * Should be registered after all routes.
 */
export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  const requestId = (req as any).requestId ?? 'unknown';

  // Log the error
  console.error(`[${requestId}] Error:`, err.message);

  // Build error response
  let statusCode = 500;
  let body: ApiErrorBody;

  if (err instanceof AppError) {
    statusCode = err.statusCode;
    body = {
      error: err.code,
      message: err.message,
      details: err.details,
    };
  } else {
    // Unknown error - don't leak internal details
    body = {
      error: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred',
    };
  }

  res.status(statusCode).json(body);
}

/**
 * 404 handler for unmatched routes.
 */
export function notFoundHandler(req: Request, res: Response): void {
  const body: ApiErrorBody = {
    error: 'NOT_FOUND',
    message: `Cannot ${req.method} ${req.path}`,
  };
  res.status(404).json(body);
}
