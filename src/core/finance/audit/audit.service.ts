// src/core/finance/audit/audit.service.ts

/**
 * Town-in-a-Box Finance Engine - Audit Trail Service
 *
 * Implementation of the audit trail service including:
 * - Audit entry recording
 * - Change detection and tracking
 * - Query and reporting
 * - Audit packet generation
 */

import { v4 as uuidv4 } from 'uuid';

import {
  AuditTrailService,
  AuditTrailEntry,
  AuditTrailQuery,
  AuditTrailQueryResult,
  EntityHistoryReport,
  AuditActivityReport,
  AuditPacket,
  AuditPacketSummary,
  AuditPacketTransaction,
  AuditChange,
  AuditEntityType,
  AuditActionType,
  AuditContext,
  AuditPacketOptions,
} from './audit.types';

import { FinanceRepository } from '../finance.repository';
import { Transaction, Fund } from '../finance.types';

// ============================================================================
// DEFAULT AUDIT TRAIL SERVICE
// ============================================================================

/**
 * Default implementation of the audit trail service.
 */
export class DefaultAuditTrailService implements AuditTrailService {
  private entries: AuditTrailEntry[] = [];
  private repository?: FinanceRepository;

  constructor(repository?: FinanceRepository) {
    this.repository = repository;
  }

  /**
   * Record an audit trail entry.
   */
  async record(
    entry: Omit<AuditTrailEntry, 'id' | 'timestamp'>
  ): Promise<AuditTrailEntry> {
    const fullEntry: AuditTrailEntry = {
      ...entry,
      id: uuidv4(),
      timestamp: new Date(),
    };

    this.entries.push(fullEntry);
    return fullEntry;
  }

  /**
   * Record a create action.
   */
  async recordCreate(
    tenantId: string,
    userId: string,
    entityType: AuditEntityType,
    entityId: string,
    entityDescription: string,
    state: Record<string, unknown>,
    metadata?: Record<string, unknown>
  ): Promise<AuditTrailEntry> {
    return this.record({
      tenantId,
      userId,
      action: 'CREATE',
      entityType,
      entityId,
      entityDescription,
      description: `Created ${entityType.toLowerCase()}: ${entityDescription}`,
      newState: state,
      metadata,
    });
  }

  /**
   * Record an update action with change tracking.
   */
  async recordUpdate(
    tenantId: string,
    userId: string,
    entityType: AuditEntityType,
    entityId: string,
    entityDescription: string,
    previousState: Record<string, unknown>,
    newState: Record<string, unknown>,
    description?: string
  ): Promise<AuditTrailEntry> {
    const changes = this.detectChanges(previousState, newState);
    const changedFields = changes.map((c) => c.field).join(', ');

    return this.record({
      tenantId,
      userId,
      action: 'UPDATE',
      entityType,
      entityId,
      entityDescription,
      description:
        description ||
        `Updated ${entityType.toLowerCase()}: ${entityDescription} (${changedFields})`,
      changes,
      previousState,
      newState,
    });
  }

  /**
   * Record a delete action.
   */
  async recordDelete(
    tenantId: string,
    userId: string,
    entityType: AuditEntityType,
    entityId: string,
    entityDescription: string,
    finalState: Record<string, unknown>,
    reason?: string
  ): Promise<AuditTrailEntry> {
    return this.record({
      tenantId,
      userId,
      action: 'DELETE',
      entityType,
      entityId,
      entityDescription,
      description: `Deleted ${entityType.toLowerCase()}: ${entityDescription}${reason ? ` (Reason: ${reason})` : ''}`,
      previousState: finalState,
      metadata: reason ? { reason } : undefined,
    });
  }

  /**
   * Query audit trail entries.
   */
  async query(query: AuditTrailQuery): Promise<AuditTrailQueryResult> {
    let filtered = this.entries.filter((e) => e.tenantId === query.tenantId);

    if (query.entityType) {
      filtered = filtered.filter((e) => e.entityType === query.entityType);
    }

    if (query.entityId) {
      filtered = filtered.filter((e) => e.entityId === query.entityId);
    }

    if (query.actionTypes?.length) {
      filtered = filtered.filter((e) => query.actionTypes!.includes(e.action));
    }

    if (query.userId) {
      filtered = filtered.filter((e) => e.userId === query.userId);
    }

    if (query.startDate) {
      filtered = filtered.filter((e) => e.timestamp >= query.startDate!);
    }

    if (query.endDate) {
      filtered = filtered.filter((e) => e.timestamp <= query.endDate!);
    }

    if (query.searchText) {
      const searchLower = query.searchText.toLowerCase();
      filtered = filtered.filter(
        (e) =>
          e.description.toLowerCase().includes(searchLower) ||
          e.entityDescription?.toLowerCase().includes(searchLower)
      );
    }

    if (query.source) {
      filtered = filtered.filter((e) => e.source === query.source);
    }

    // Sort
    filtered.sort((a, b) => {
      const order = query.sortOrder === 'ASC' ? 1 : -1;
      return order * (a.timestamp.getTime() - b.timestamp.getTime());
    });

    const totalCount = filtered.length;

    // Paginate
    if (query.offset) {
      filtered = filtered.slice(query.offset);
    }
    if (query.limit) {
      filtered = filtered.slice(0, query.limit);
    }

    return {
      entries: filtered,
      totalCount,
      query,
    };
  }

  /**
   * Get history for a specific entity.
   */
  async getEntityHistory(
    tenantId: string,
    entityType: AuditEntityType,
    entityId: string
  ): Promise<EntityHistoryReport> {
    const history = this.entries
      .filter(
        (e) =>
          e.tenantId === tenantId &&
          e.entityType === entityType &&
          e.entityId === entityId
      )
      .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

    const createEntry = history.find((e) => e.action === 'CREATE');
    const lastModifyEntry = [...history]
      .reverse()
      .find((e) => e.action === 'UPDATE' || e.action === 'CORRECTION');

    return {
      entityType,
      entityId,
      entityDescription: history[0]?.entityDescription || entityId,
      created: {
        timestamp: createEntry?.timestamp || history[0]?.timestamp || new Date(),
        userId: createEntry?.userId || history[0]?.userId || 'unknown',
        userDisplayName: createEntry?.userDisplayName,
      },
      lastModified: lastModifyEntry
        ? {
            timestamp: lastModifyEntry.timestamp,
            userId: lastModifyEntry.userId,
            userDisplayName: lastModifyEntry.userDisplayName,
          }
        : undefined,
      history,
      currentState: history[history.length - 1]?.newState,
    };
  }

  /**
   * Generate audit activity report.
   */
  async generateActivityReport(
    tenantId: string,
    startDate: Date,
    endDate: Date
  ): Promise<AuditActivityReport> {
    const entries = this.entries.filter(
      (e) =>
        e.tenantId === tenantId &&
        e.timestamp >= startDate &&
        e.timestamp <= endDate
    );

    // Calculate statistics
    const actionsByType: Record<AuditActionType, number> = {} as Record<AuditActionType, number>;
    const actionsByEntityType: Record<AuditEntityType, number> = {} as Record<AuditEntityType, number>;
    const userCounts: Map<string, { displayName: string; count: number }> = new Map();
    const dayCounts: Map<string, number> = new Map();

    for (const entry of entries) {
      // By action type
      actionsByType[entry.action] = (actionsByType[entry.action] || 0) + 1;

      // By entity type
      actionsByEntityType[entry.entityType] =
        (actionsByEntityType[entry.entityType] || 0) + 1;

      // By user
      const userKey = entry.userId;
      const existing = userCounts.get(userKey) || {
        displayName: entry.userDisplayName || entry.userId,
        count: 0,
      };
      existing.count++;
      userCounts.set(userKey, existing);

      // By day
      const dateKey = entry.timestamp.toISOString().split('T')[0];
      dayCounts.set(dateKey, (dayCounts.get(dateKey) || 0) + 1);
    }

    // High-risk actions
    const highRiskActions = entries.filter((e) =>
      ['DELETE', 'VOID', 'CORRECTION', 'PERMISSION_CHANGE'].includes(e.action)
    );

    // After-hours activity (before 7am or after 7pm)
    const afterHoursActivity = entries.filter((e) => {
      const hour = e.timestamp.getHours();
      return hour < 7 || hour >= 19;
    });

    return {
      periodStart: startDate,
      periodEnd: endDate,
      tenantId,
      generatedAt: new Date(),
      summary: {
        totalActions: entries.length,
        uniqueUsers: userCounts.size,
        actionsByType,
        actionsByEntityType,
        actionsByUser: Array.from(userCounts.entries()).map(
          ([userId, data]) => ({
            userId,
            displayName: data.displayName,
            count: data.count,
          })
        ),
        actionsByDay: Array.from(dayCounts.entries())
          .map(([date, count]) => ({ date, count }))
          .sort((a, b) => a.date.localeCompare(b.date)),
      },
      highRiskActions,
      afterHoursActivity:
        afterHoursActivity.length > 0 ? afterHoursActivity : undefined,
    };
  }

  /**
   * Generate audit packet for Gateway support.
   */
  async generateAuditPacket(
    tenantId: string,
    type: AuditPacket['type'],
    entityId: string,
    fiscalYear: number,
    userId: string
  ): Promise<AuditPacket> {
    const packetId = uuidv4();

    // Get entity-specific data
    let summary: AuditPacketSummary;
    let transactions: AuditPacketTransaction[] = [];
    let title: string;

    switch (type) {
      case 'FUND_SUMMARY': {
        const fund = this.repository
          ? await this.repository.getFundById(entityId)
          : null;

        summary = {
          entityType: 'Fund',
          entityId,
          entityName: fund?.name || entityId,
          metrics: [
            { label: 'Fund Code', value: fund?.code || 'N/A' },
            { label: 'Fund Type', value: fund?.type || 'N/A' },
            {
              label: 'Current Balance',
              value: fund?.currentBalance || 0,
              format: 'currency',
            },
          ],
        };
        title = `Fund Summary: ${fund?.name || entityId}`;

        // Get fund transactions
        if (this.repository) {
          const txResult = await this.repository.listTransactions({
            tenantId,
            fundIds: [entityId],
          });
          const txList = Array.isArray(txResult) ? txResult : txResult.data;

          transactions = txList.map((t: Transaction) => ({
            transactionId: t.id,
            date: t.transactionDate,
            type: t.type,
            amount: t.amount,
            description: t.description,
            fundCode: fund?.code,
            reference: t.checkNumber || t.externalRef,
            importBatchId: t.importBatchId,
            editCount: t.editHistory?.length || 0,
          }));
        }
        break;
      }

      case 'GATEWAY_LINE':
      case 'AFR_SUPPORT':
      default: {
        summary = {
          entityType: type,
          entityId,
          entityName: entityId,
          metrics: [],
        };
        title = `Audit Packet: ${entityId}`;
        break;
      }
    }

    // Get audit trail for this entity
    const auditResult = await this.query({
      tenantId,
      entityId,
    });

    // Validation (placeholder - would integrate with rule engine)
    const validationResults = {
      passed: true,
      errors: [] as string[],
      warnings: [] as string[],
    };

    return {
      id: packetId,
      tenantId,
      generatedAt: new Date(),
      generatedBy: userId,
      type,
      title,
      fiscalYear,
      summary,
      transactions,
      auditTrail: auditResult.entries,
      validationResults,
    };
  }

  /**
   * Export audit packet as PDF.
   * Note: In production, this would use a PDF generation library.
   */
  async exportPacketAsPdf(packet: AuditPacket): Promise<Buffer> {
    // Generate text representation for PDF
    const lines: string[] = [];

    lines.push('='.repeat(60));
    lines.push(`AUDIT PACKET: ${packet.title}`);
    lines.push('='.repeat(60));
    lines.push('');
    lines.push(`Packet ID: ${packet.id}`);
    lines.push(`Generated: ${packet.generatedAt.toISOString()}`);
    lines.push(`Generated By: ${packet.generatedBy}`);
    lines.push(`Fiscal Year: ${packet.fiscalYear}`);
    lines.push('');

    // Summary
    lines.push('-'.repeat(40));
    lines.push('SUMMARY');
    lines.push('-'.repeat(40));
    lines.push(`Entity: ${packet.summary.entityName}`);
    for (const metric of packet.summary.metrics) {
      let value = String(metric.value);
      if (metric.format === 'currency') {
        value = `$${Number(metric.value).toLocaleString()}`;
      }
      lines.push(`${metric.label}: ${value}`);
    }
    lines.push('');

    // Transactions
    if (packet.transactions.length > 0) {
      lines.push('-'.repeat(40));
      lines.push(`TRANSACTIONS (${packet.transactions.length})`);
      lines.push('-'.repeat(40));
      for (const tx of packet.transactions.slice(0, 50)) {
        lines.push(
          `${tx.date.toISOString().split('T')[0]} | ${tx.type.padEnd(12)} | $${tx.amount.toLocaleString().padStart(12)} | ${tx.description}`
        );
      }
      if (packet.transactions.length > 50) {
        lines.push(`... and ${packet.transactions.length - 50} more transactions`);
      }
      lines.push('');
    }

    // Audit Trail
    if (packet.auditTrail.length > 0) {
      lines.push('-'.repeat(40));
      lines.push(`AUDIT TRAIL (${packet.auditTrail.length})`);
      lines.push('-'.repeat(40));
      for (const entry of packet.auditTrail.slice(0, 20)) {
        lines.push(
          `${entry.timestamp.toISOString()} | ${entry.action.padEnd(10)} | ${entry.userId} | ${entry.description}`
        );
      }
      if (packet.auditTrail.length > 20) {
        lines.push(`... and ${packet.auditTrail.length - 20} more entries`);
      }
      lines.push('');
    }

    // Validation
    if (packet.validationResults) {
      lines.push('-'.repeat(40));
      lines.push('VALIDATION RESULTS');
      lines.push('-'.repeat(40));
      lines.push(`Status: ${packet.validationResults.passed ? 'PASSED' : 'FAILED'}`);
      for (const error of packet.validationResults.errors) {
        lines.push(`  ERROR: ${error}`);
      }
      for (const warning of packet.validationResults.warnings) {
        lines.push(`  WARNING: ${warning}`);
      }
      lines.push('');
    }

    lines.push('='.repeat(60));
    lines.push('END OF AUDIT PACKET');
    lines.push('='.repeat(60));

    // Convert to buffer (in production, would generate actual PDF)
    return Buffer.from(lines.join('\n'), 'utf-8');
  }

  /**
   * Export audit packet as JSON.
   */
  exportPacketAsJson(packet: AuditPacket): string {
    return JSON.stringify(packet, null, 2);
  }

  // ============================================================================
  // PRIVATE HELPER METHODS
  // ============================================================================

  /**
   * Detect changes between two states.
   */
  private detectChanges(
    previousState: Record<string, unknown>,
    newState: Record<string, unknown>
  ): AuditChange[] {
    const changes: AuditChange[] = [];
    const allKeys = new Set([
      ...Object.keys(previousState),
      ...Object.keys(newState),
    ]);

    for (const key of allKeys) {
      const oldValue = previousState[key];
      const newValue = newState[key];

      if (!this.valuesEqual(oldValue, newValue)) {
        changes.push({
          field: key,
          oldValue,
          newValue,
          dataType: this.getDataType(newValue ?? oldValue),
        });
      }
    }

    return changes;
  }

  /**
   * Check if two values are equal.
   */
  private valuesEqual(a: unknown, b: unknown): boolean {
    if (a === b) return true;
    if (a == null || b == null) return a === b;

    // Handle dates
    if (a instanceof Date && b instanceof Date) {
      return a.getTime() === b.getTime();
    }

    // Handle arrays and objects
    if (typeof a === 'object' && typeof b === 'object') {
      return JSON.stringify(a) === JSON.stringify(b);
    }

    return false;
  }

  /**
   * Get the data type of a value.
   */
  private getDataType(
    value: unknown
  ): 'string' | 'number' | 'boolean' | 'date' | 'object' | 'array' {
    if (value instanceof Date) return 'date';
    if (Array.isArray(value)) return 'array';
    if (value === null) return 'object';
    return typeof value as 'string' | 'number' | 'boolean' | 'object';
  }

  // ============================================================================
  // TESTING HELPERS
  // ============================================================================

  /**
   * Clear all entries (for testing).
   */
  clear(): void {
    this.entries = [];
  }

  /**
   * Get entry count (for testing).
   */
  getEntryCount(): number {
    return this.entries.length;
  }
}

// ============================================================================
// FACTORY FUNCTION
// ============================================================================

/**
 * Create a new audit trail service.
 */
export function createAuditTrailService(
  repository?: FinanceRepository
): DefaultAuditTrailService {
  return new DefaultAuditTrailService(repository);
}

// ============================================================================
// AUDIT CONTEXT HELPER
// ============================================================================

/**
 * Create an audit context from request information.
 */
export function createAuditContext(
  tenantId: string,
  userId: string,
  options?: Partial<AuditContext>
): AuditContext {
  return {
    tenantId,
    userId,
    ...options,
  };
}

/**
 * Helper to wrap an entity operation with audit logging.
 */
export async function withAuditLogging<T>(
  service: AuditTrailService,
  context: AuditContext,
  entityType: AuditEntityType,
  operation: () => Promise<{ result: T; entityId: string; description: string; state: Record<string, unknown> }>
): Promise<T> {
  const { result, entityId, description, state } = await operation();

  await service.recordCreate(
    context.tenantId,
    context.userId,
    entityType,
    entityId,
    description,
    state,
    {
      source: context.source,
      ipAddress: context.ipAddress,
    }
  );

  return result;
}
