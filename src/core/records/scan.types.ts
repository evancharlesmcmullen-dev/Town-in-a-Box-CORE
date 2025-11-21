// src/core/records/scan.types.ts

/**
 * A batch of scanned documents (e.g. a box/file).
 */
export interface ScanBatch {
  id: string;
  tenantId: string;

  label: string;           // e.g. "Old contracts drawer 1"
  createdAt: Date;
  createdByUserId?: string;
}

/**
 * A single scanned document in a batch.
 */
export interface ScannedDocument {
  id: string;
  tenantId: string;

  batchId: string;
  originalDescription?: string;

  storageRefId: string;    // link to Record or external storage
  createdAt: Date;
}