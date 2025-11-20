// src/core/audit/in-memory-audit.service.ts

import { randomUUID } from 'crypto';
import { AuditEvent, AuditEventInput } from './audit.types';
import { AuditService } from './audit.service';

/**
 * Very simple in-memory implementation of AuditService.
 *
 * Notes:
 * - This is only for development/testing and demos.
 * - Events are stored in memory and lost when the process restarts.
 * - A real implementation would append to a database or log store.
 */
export class InMemoryAuditService implements AuditService {
  private events: AuditEvent[] = [];

  async log(event: AuditEvent): Promise<void> {
    this.events.push(event);
  }

  async logFromInput(input: AuditEventInput): Promise<AuditEvent> {
    const now = new Date();
    const ctx = input.ctx;

    const event: AuditEvent = {
      id: randomUUID(),
      tenantId: ctx ? ctx.tenantId : 'unknown-tenant',
      timestamp: now,
      userId: ctx ? ctx.userId ?? null : null,
      ipAddress: null,     // we can wire real request metadata later
      userAgent: null,
      actionType: input.actionType,
      targetType: input.targetType,
      targetId: input.targetId ?? null,
      severity: input.severity ?? 'info',
      details: input.details,
    };

    this.events.push(event);
    return event;
  }

  /**
   * Helper for tests/demos: get all events currently in memory.
   * Not part of the AuditService interface, so callers should type-narrow
   * if they need it.
   */
  getAllEvents(): AuditEvent[] {
    return [...this.events];
  }
}