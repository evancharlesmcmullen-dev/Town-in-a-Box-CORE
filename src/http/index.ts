// src/http/index.ts
// HTTP module exports.

export { createServer, startServer, ServerConfig } from './server';
export { AiClient, MockAiClient, ScannedDeadline } from './ai.routes';
export {
  AppError,
  ValidationError,
  NotFoundError,
  AiError,
  AiErrorCode,
  ApiErrorBody,
  errorHandler,
  notFoundHandler,
} from './errors';
export {
  assertString,
  assertOptionalString,
  assertBoolean,
  assertIsoDate,
  assertOneOf,
  assertNonEmptyArray,
  assertStringArray,
  assertDateAfter,
} from './validation';
export {
  ApiRequest,
  requestLogger,
  tenantContextMiddleware,
  asyncHandler,
} from './middleware';
