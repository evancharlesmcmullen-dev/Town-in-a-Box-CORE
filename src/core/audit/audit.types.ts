// src/core/audit/audit.types.ts

import { TenantContext } from '../tenancy/tenancy.types';

/**
 * Severity levels for audit events.
 */
export type AuditEventSeverity =
  | 'info'
  | 'warning'
  | 'error'
  | 'critical';

/**
 * Core audit event shape for "who did what when" across the platform.
 *
 * This must be treated as append-only. Do not update or delete events in
 * normal operation – only add new ones.
 */
export interface AuditEvent {
  id: string;
  tenantId: string;

  // When the action happened (UTC).
  timestamp: Date;

  // Who did it (null for system/background actions).
  userId: string | null;

  // Basic request metadata for forensics.
  ipAddress: string | null;
  userAgent: string | null;

  // What happened.
  actionType: string;    // e.g. "APRA_REQUEST_CREATED", "MEETING_SCHEDULED"
  targetType: string;    // e.g. "ApraRequest", "Meeting", "User"
  targetId: string | null;

  // Optional structured details (diffs, parameters, etc.).
  severity: AuditEventSeverity;
  details?: Record<string, unknown>;
}

/**
 * Input shape when logging a new audit event (no id yet).
 */
export interface AuditEventInput {
  ctx: TenantContext | null;    // tenant + user context, if available
  actionType: string;
  targetType: string;
  targetId?: string | null;
  severity?: AuditEventSeverity;
  details?: Record<string, unknown>;
}