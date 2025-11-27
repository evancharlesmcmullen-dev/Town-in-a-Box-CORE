// src/http/middleware.ts
// Middleware for logging, request correlation, and tenant context.

import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';
import { TenantContext } from '../core/tenancy/tenancy.types';

/**
 * Extended Express Request with requestId and tenant context.
 */
export interface ApiRequest extends Request {
  requestId: string;
  tenantContext: TenantContext;
}

/**
 * Logging and request correlation middleware.
 * Generates a unique requestId for each request and logs request/response info.
 */
export function requestLogger(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const start = Date.now();
  const requestId = randomUUID();

  // Attach requestId to request
  (req as ApiRequest).requestId = requestId;

  // Log request completion on finish
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(
      `[${requestId}] ${req.method} ${req.originalUrl} -> ${res.statusCode} (${duration}ms)`
    );
  });

  next();
}

/**
 * Stub tenant context middleware.
 * In production, this would extract tenant info from auth headers/JWT.
 * For now, uses a default test tenant.
 */
export function tenantContextMiddleware(
  req: Request,
  _res: Response,
  next: NextFunction
): void {
  // Extract tenant ID from header or use default
  const tenantId = req.headers['x-tenant-id'] as string || 'default-tenant';
  const userId = req.headers['x-user-id'] as string || undefined;

  const ctx: TenantContext = {
    tenantId,
    jurisdiction: {
      tenantId,
      state: 'IN',
      kind: 'town',
      name: 'Test Town',
      authorityTags: [],
    },
    userId,
    roles: [],
  };

  (req as ApiRequest).tenantContext = ctx;
  next();
}

/**
 * Async handler wrapper to catch errors and pass them to next().
 */
export function asyncHandler<
  Req extends Request = Request,
  Res extends Response = Response
>(
  fn: (req: Req, res: Res, next: NextFunction) => Promise<void>
): (req: Req, res: Res, next: NextFunction) => void {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
