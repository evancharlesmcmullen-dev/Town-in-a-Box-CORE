// src/core/audit/audit.service.ts

import { AuditEvent, AuditEventInput } from './audit.types';

/**
 * AuditService is responsible for recording immutable audit events.
 *
 * Implementations MUST:
 * - Treat the underlying storage as append-only (no deletions/updates).
 * - Be multi-tenant aware (tenantId is always recorded).
 */
export interface AuditService {
  /**
   * Persist a fully specified audit event.
   * Typically used by infrastructure layers that have already constructed an event.
   */
  log(event: AuditEvent): Promise<void>;

  /**
   * Convenience method for logging from higher-level code.
   * Takes a TenantContext and other fields via AuditEventInput, fills in timestamp,
   * id, and returns the resulting event.
   */
  logFromInput(input: AuditEventInput): Promise<AuditEvent>;
}