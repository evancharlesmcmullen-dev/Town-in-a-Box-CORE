// src/core/finance/audit/audit.types.ts

/**
 * Town-in-a-Box Finance Engine - Audit & Traceability Types
 *
 * Comprehensive audit system including:
 * - Audit trail for all actions
 * - Edit history tracking
 * - Audit-ready packet generation
 * - Support documentation for Gateway filings
 */

// ============================================================================
// AUDIT ACTION TYPES
// ============================================================================

/**
 * Types of actions that can be audited.
 */
export type AuditActionType =
  // Entity lifecycle
  | 'CREATE'
  | 'UPDATE'
  | 'DELETE'
  | 'RESTORE'

  // Financial actions
  | 'APPROVE'
  | 'REJECT'
  | 'VOID'
  | 'POST'
  | 'UNPOST'
  | 'RECONCILE'

  // Transfers and adjustments
  | 'TRANSFER'
  | 'ADJUSTMENT'
  | 'CORRECTION'

  // Import/Export
  | 'IMPORT'
  | 'EXPORT'
  | 'GENERATE_REPORT'

  // Access and review
  | 'VIEW'
  | 'PRINT'
  | 'DOWNLOAD'

  // Administrative
  | 'LOGIN'
  | 'LOGOUT'
  | 'PERMISSION_CHANGE'
  | 'CONFIGURATION_CHANGE'

  // Workflow
  | 'SUBMIT_FOR_APPROVAL'
  | 'RETURN_FOR_REVISION'
  | 'ESCALATE';

/**
 * Entity types that can be audited.
 */
export type AuditEntityType =
  | 'FUND'
  | 'ACCOUNT'
  | 'TRANSACTION'
  | 'BUDGET_LINE'
  | 'VENDOR'
  | 'DEBT_INSTRUMENT'
  | 'BANK_ACCOUNT'
  | 'IMPORT_BATCH'
  | 'REPORT'
  | 'USER'
  | 'CONFIGURATION'
  | 'RULE_VALIDATION'
  | 'GATEWAY_SUBMISSION';

// ============================================================================
// AUDIT TRAIL ENTRY
// ============================================================================

/**
 * A single audit trail entry.
 */
export interface AuditTrailEntry {
  /** Unique entry ID */
  id: string;

  /** Tenant ID */
  tenantId: string;

  /** Timestamp of the action */
  timestamp: Date;

  /** User ID who performed the action */
  userId: string;

  /** User display name (for historical reference) */
  userDisplayName?: string;

  /** Type of action */
  action: AuditActionType;

  /** Entity type affected */
  entityType: AuditEntityType;

  /** Entity ID affected */
  entityId: string;

  /** Entity description (for readability) */
  entityDescription?: string;

  /** Human-readable description of the change */
  description: string;

  /** Detailed changes (before/after values) */
  changes?: AuditChange[];

  /** Previous values (snapshot before change) */
  previousState?: Record<string, unknown>;

  /** New values (snapshot after change) */
  newState?: Record<string, unknown>;

  /** IP address of the user */
  ipAddress?: string;

  /** User agent/browser info */
  userAgent?: string;

  /** Session ID */
  sessionId?: string;

  /** Related entity IDs (e.g., affected transactions) */
  relatedEntityIds?: string[];

  /** Additional metadata */
  metadata?: Record<string, unknown>;

  /** Whether this action was system-generated */
  isSystemAction?: boolean;

  /** Source of the action (UI, API, import, etc.) */
  source?: 'UI' | 'API' | 'IMPORT' | 'SYSTEM' | 'MIGRATION';
}

/**
 * A specific field change within an audit entry.
 */
export interface AuditChange {
  /** Field name that changed */
  field: string;

  /** Previous value */
  oldValue: unknown;

  /** New value */
  newValue: unknown;

  /** Data type of the field */
  dataType?: 'string' | 'number' | 'boolean' | 'date' | 'object' | 'array';
}

// ============================================================================
// EDIT HISTORY
// ============================================================================

/**
 * Edit history entry stored on entities.
 */
export interface EditHistoryEntry {
  /** Timestamp of edit */
  timestamp: Date;

  /** User who made the edit */
  userId: string;

  /** User display name */
  userDisplayName?: string;

  /** Type of edit */
  editType: 'CREATE' | 'UPDATE' | 'CORRECTION' | 'APPROVAL' | 'VOID';

  /** Description of the edit */
  description: string;

  /** Fields changed */
  changedFields?: string[];

  /** Reason for edit (if correction) */
  reason?: string;
}

// ============================================================================
// AUDIT QUERY
// ============================================================================

/**
 * Query parameters for searching audit trail.
 */
export interface AuditTrailQuery {
  /** Filter by tenant */
  tenantId: string;

  /** Filter by entity type */
  entityType?: AuditEntityType;

  /** Filter by specific entity ID */
  entityId?: string;

  /** Filter by action type */
  actionTypes?: AuditActionType[];

  /** Filter by user ID */
  userId?: string;

  /** Start date range */
  startDate?: Date;

  /** End date range */
  endDate?: Date;

  /** Search in description */
  searchText?: string;

  /** Filter by source */
  source?: AuditTrailEntry['source'];

  /** Pagination */
  limit?: number;
  offset?: number;

  /** Sort order */
  sortOrder?: 'ASC' | 'DESC';
}

/**
 * Result of an audit trail query.
 */
export interface AuditTrailQueryResult {
  /** Matching entries */
  entries: AuditTrailEntry[];

  /** Total count (for pagination) */
  totalCount: number;

  /** Query parameters used */
  query: AuditTrailQuery;
}

// ============================================================================
// AUDIT PACKET
// ============================================================================

/**
 * Audit-ready packet for a Gateway line item or report.
 */
export interface AuditPacket {
  /** Packet ID */
  id: string;

  /** Tenant ID */
  tenantId: string;

  /** Generation timestamp */
  generatedAt: Date;

  /** Generated by user ID */
  generatedBy: string;

  /** Packet type */
  type: 'GATEWAY_LINE' | 'FUND_SUMMARY' | 'TRANSACTION_DETAIL' | 'BUDGET_REPORT' | 'AFR_SUPPORT';

  /** Title */
  title: string;

  /** Description */
  description?: string;

  /** Fiscal year */
  fiscalYear: number;

  /** Period covered */
  periodStart?: Date;
  periodEnd?: Date;

  /** Summary data */
  summary: AuditPacketSummary;

  /** Supporting transactions */
  transactions: AuditPacketTransaction[];

  /** Audit trail entries related to this item */
  auditTrail: AuditTrailEntry[];

  /** Validation results */
  validationResults?: {
    passed: boolean;
    errors: string[];
    warnings: string[];
  };

  /** Attachments (document references) */
  attachments?: AuditPacketAttachment[];

  /** Digital signature if signed */
  signature?: {
    signedBy: string;
    signedAt: Date;
    signatureHash: string;
  };
}

/**
 * Summary section of an audit packet.
 */
export interface AuditPacketSummary {
  /** Entity type being documented */
  entityType: string;

  /** Entity identifier */
  entityId?: string;

  /** Entity name/description */
  entityName: string;

  /** Key metrics */
  metrics: {
    label: string;
    value: string | number;
    format?: 'currency' | 'number' | 'percent' | 'date';
  }[];

  /** Notes/explanations */
  notes?: string[];
}

/**
 * Transaction detail in an audit packet.
 */
export interface AuditPacketTransaction {
  /** Transaction ID */
  transactionId: string;

  /** Transaction date */
  date: Date;

  /** Transaction type */
  type: string;

  /** Amount */
  amount: number;

  /** Description */
  description: string;

  /** Fund code */
  fundCode?: string;

  /** Account code */
  accountCode?: string;

  /** Vendor name */
  vendorName?: string;

  /** Reference number */
  reference?: string;

  /** Import batch ID (for traceability) */
  importBatchId?: string;

  /** Edit count */
  editCount?: number;
}

/**
 * Attachment reference in an audit packet.
 */
export interface AuditPacketAttachment {
  /** Attachment ID */
  id: string;

  /** File name */
  fileName: string;

  /** File type */
  fileType: string;

  /** File size in bytes */
  fileSize: number;

  /** Storage location/URL */
  storageUrl?: string;

  /** Description */
  description?: string;

  /** Upload date */
  uploadedAt: Date;

  /** Uploaded by */
  uploadedBy: string;
}

// ============================================================================
// AUDIT REPORT TYPES
// ============================================================================

/**
 * Audit activity report for a period.
 */
export interface AuditActivityReport {
  /** Report period */
  periodStart: Date;
  periodEnd: Date;

  /** Tenant ID */
  tenantId: string;

  /** Generated at */
  generatedAt: Date;

  /** Summary statistics */
  summary: {
    totalActions: number;
    uniqueUsers: number;
    actionsByType: Record<AuditActionType, number>;
    actionsByEntityType: Record<AuditEntityType, number>;
    actionsByUser: { userId: string; displayName: string; count: number }[];
    actionsByDay: { date: string; count: number }[];
  };

  /** High-risk actions (deletions, voids, corrections) */
  highRiskActions: AuditTrailEntry[];

  /** Failed validation attempts */
  failedValidations?: AuditTrailEntry[];

  /** After-hours activity */
  afterHoursActivity?: AuditTrailEntry[];
}

/**
 * Entity history report showing all changes to an entity.
 */
export interface EntityHistoryReport {
  /** Entity type */
  entityType: AuditEntityType;

  /** Entity ID */
  entityId: string;

  /** Entity description */
  entityDescription: string;

  /** Creation info */
  created: {
    timestamp: Date;
    userId: string;
    userDisplayName?: string;
  };

  /** Last modified info */
  lastModified?: {
    timestamp: Date;
    userId: string;
    userDisplayName?: string;
  };

  /** All changes in chronological order */
  history: AuditTrailEntry[];

  /** Current state */
  currentState?: Record<string, unknown>;
}

// ============================================================================
// AUDIT SERVICE INTERFACE
// ============================================================================

/**
 * Audit trail service interface.
 */
export interface AuditTrailService {
  /**
   * Record an audit trail entry.
   */
  record(entry: Omit<AuditTrailEntry, 'id' | 'timestamp'>): Promise<AuditTrailEntry>;

  /**
   * Record a create action.
   */
  recordCreate(
    tenantId: string,
    userId: string,
    entityType: AuditEntityType,
    entityId: string,
    entityDescription: string,
    state: Record<string, unknown>,
    metadata?: Record<string, unknown>
  ): Promise<AuditTrailEntry>;

  /**
   * Record an update action with change tracking.
   */
  recordUpdate(
    tenantId: string,
    userId: string,
    entityType: AuditEntityType,
    entityId: string,
    entityDescription: string,
    previousState: Record<string, unknown>,
    newState: Record<string, unknown>,
    description?: string
  ): Promise<AuditTrailEntry>;

  /**
   * Record a delete action.
   */
  recordDelete(
    tenantId: string,
    userId: string,
    entityType: AuditEntityType,
    entityId: string,
    entityDescription: string,
    finalState: Record<string, unknown>,
    reason?: string
  ): Promise<AuditTrailEntry>;

  /**
   * Query audit trail entries.
   */
  query(query: AuditTrailQuery): Promise<AuditTrailQueryResult>;

  /**
   * Get history for a specific entity.
   */
  getEntityHistory(
    tenantId: string,
    entityType: AuditEntityType,
    entityId: string
  ): Promise<EntityHistoryReport>;

  /**
   * Generate audit activity report.
   */
  generateActivityReport(
    tenantId: string,
    startDate: Date,
    endDate: Date
  ): Promise<AuditActivityReport>;

  /**
   * Generate audit packet for Gateway support.
   */
  generateAuditPacket(
    tenantId: string,
    type: AuditPacket['type'],
    entityId: string,
    fiscalYear: number,
    userId: string
  ): Promise<AuditPacket>;

  /**
   * Export audit packet as PDF.
   */
  exportPacketAsPdf(packet: AuditPacket): Promise<Buffer>;

  /**
   * Export audit packet as JSON.
   */
  exportPacketAsJson(packet: AuditPacket): string;
}

// ============================================================================
// HELPER TYPES
// ============================================================================

/**
 * Context for creating audit entries.
 */
export interface AuditContext {
  tenantId: string;
  userId: string;
  userDisplayName?: string;
  ipAddress?: string;
  userAgent?: string;
  sessionId?: string;
  source?: AuditTrailEntry['source'];
}

/**
 * Options for audit packet generation.
 */
export interface AuditPacketOptions {
  /** Include full transaction details */
  includeTransactionDetails?: boolean;

  /** Include audit trail */
  includeAuditTrail?: boolean;

  /** Include validation results */
  includeValidation?: boolean;

  /** Date range for transactions */
  startDate?: Date;
  endDate?: Date;

  /** Custom notes to include */
  notes?: string[];
}
