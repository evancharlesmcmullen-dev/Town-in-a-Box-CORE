// src/core/records/records-core.service.ts

import { TenantContext } from '../tenancy/tenancy.types';
import {
  Record,
  RecordSummary,
  RecordFilter,
} from './record.types';

/**
 * RecordsCoreService is the low-level "record store" for Town-in-a-Box.
 *
 * Domain engines (APRA, Meetings, Planning, Finance, etc.) will:
 * - Create records when they generate documents, scans, media clips, etc.
 * - Link their domain entities to records by recordId.
 *
 * Implementations may store files in:
 * - Cloud object storage (GCS/S3),
 * - On-prem storage,
 * - Or external systems (via StorageRef).
 */
export interface RecordsCoreService {
  /**
   * Create a new record in the store.
   */
  createRecord(
    ctx: TenantContext,
    record: Omit<Record, 'id' | 'tenantId' | 'createdAt'>
  ): Promise<Record>;

  /**
   * Fetch a single record by id (enforcing tenant boundaries).
   */
  getRecord(
    ctx: TenantContext,
    id: string
  ): Promise<Record | null>;

  /**
   * List/search records for a tenant using a basic filter.
   * Implementations may support additional search capabilities.
   */
  listRecords(
    ctx: TenantContext,
    filter?: RecordFilter
  ): Promise<RecordSummary[]>;
}