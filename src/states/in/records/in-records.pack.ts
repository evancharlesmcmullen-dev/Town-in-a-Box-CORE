// src/states/in/records/in-records.pack.ts

import { JurisdictionProfile } from '../../../core/tenancy/tenancy.types';
import { StatePack, stateRegistry } from '../../../core/state';
import { INRecordsConfig, DEFAULT_IN_RECORDS_CONFIG } from './in-records.config';

/**
 * Indiana Records Pack
 *
 * Bundles records retention and management rules
 * for Indiana jurisdictions per IC 5-15.
 */
export class INRecordsPack implements StatePack<INRecordsConfig> {
  readonly state = 'IN' as const;
  readonly domain = 'records';
  readonly version = '1.0.0';

  config: INRecordsConfig;

  constructor(config?: Partial<INRecordsConfig>) {
    this.config = {
      ...DEFAULT_IN_RECORDS_CONFIG,
      ...config,
    };
  }

  /**
   * Check if this pack applies to the given jurisdiction.
   */
  appliesTo(j: JurisdictionProfile): boolean {
    return j.state === 'IN';
  }

  /**
   * Get retention schedule for a record type.
   */
  getRetentionSchedule(recordType: string) {
    return this.config.retentionSchedules.find((r) => r.recordType === recordType);
  }

  /**
   * Get all retention schedules.
   */
  getAllRetentionSchedules() {
    return this.config.retentionSchedules;
  }

  /**
   * Check if a record type requires Commission approval for destruction.
   */
  requiresCommissionApproval(recordType: string): boolean {
    const schedule = this.getRetentionSchedule(recordType);
    return schedule?.requiresCommissionApproval ?? true;
  }
}

// Create and register the default Indiana records pack
export const inRecordsPack = new INRecordsPack();
stateRegistry.registerPack(inRecordsPack);
