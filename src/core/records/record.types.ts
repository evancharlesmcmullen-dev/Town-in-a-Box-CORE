// src/core/records/record.types.ts

/**
 * High-level classification for a record in the system.
 * This is descriptive, not authoritative; APRA/legal classification
 * still comes from the legal engine and domain engines.
 */
export type RecordType =
  | 'document'
  | 'email'
  | 'media'
  | 'scan'
  | 'meetingAgenda'
  | 'meetingMinutes'
  | 'ordinance'
  | 'resolution'
  | 'contract'
  | 'planningCaseFile'
  | 'utilityBill'
  | 'other';

/**
 * Security level for a record.
 * NOTE: 'privilegedLegal' will be used for LegalVault.
 */
export type RecordSecurityLevel =
  | 'public'
  | 'staff'
  | 'privilegedLegal';

/**
 * Generic pointer to where the actual file/bytes live.
 * Could be S3, GCS, local disk, or an external system.
 */
export interface StorageRef {
  provider: 'gcs' | 's3' | 'local' | 'external';
  bucketOrContainer?: string;
  pathOrKey?: string;
  externalUrl?: string; // for systems we just link to
}

/**
 * Core Record entity – the system's view of a stored item.
 * Domain engines will link to records via recordId.
 */
export interface Record {
  id: string;
  tenantId: string;

  type: RecordType;
  title: string;
  description?: string;

  tags: string[];         // free-form tags, e.g. ["BZA", "Variance 2025-01"]
  securityLevel: RecordSecurityLevel;

  storage: StorageRef;
  mimeType?: string;
  sizeBytes?: number;

  createdAt: Date;
  createdByUserId?: string;
}

/**
 * Lightweight record summary for search/list views.
 */
export interface RecordSummary {
  id: string;
  tenantId: string;
  type: RecordType;
  title: string;
  securityLevel: RecordSecurityLevel;
  createdAt: Date;
}

/**
 * Basic filter options for record search.
 */
export interface RecordFilter {
  type?: RecordType;
  tags?: string[];
  securityLevel?: RecordSecurityLevel;
  fromDate?: Date;
  toDate?: Date;
  searchText?: string;   // implementation-specific (title/description/etc.)
}