// src/states/in/records/in-records.config.ts

import { DomainConfig, StatutoryCitation } from '../../../core/state';

/**
 * Indiana Records Configuration
 *
 * Configuration for records retention per IC 5-15 and
 * Indiana Archives and Records Administration (IARA) schedules.
 */
export interface INRecordsConfig extends DomainConfig {
  domain: 'records';

  // Retention schedules
  retentionSchedules: RetentionSchedule[];

  // Archives contact
  archivesContact?: ArchivesContact;

  // Commission meeting schedule (for destruction approvals)
  commissionSchedule?: string;
}

/**
 * Retention schedule for a record type.
 */
export interface RetentionSchedule {
  recordType: string;
  description: string;
  retentionYears: number | 'permanent';
  retentionTrigger: 'creation' | 'close' | 'superseded' | 'fiscal-year-end';
  requiresCommissionApproval: boolean;
  citation?: StatutoryCitation;
  notes?: string;
}

/**
 * Archives contact information.
 */
export interface ArchivesContact {
  name: string;
  phone?: string;
  email?: string;
  url?: string;
}

/**
 * Default Indiana records configuration.
 */
export const DEFAULT_IN_RECORDS_CONFIG: INRecordsConfig = {
  domain: 'records',
  enabled: true,

  retentionSchedules: [
    {
      recordType: 'meeting-minutes',
      description: 'Official minutes of governing body meetings.',
      retentionYears: 'permanent',
      retentionTrigger: 'creation',
      requiresCommissionApproval: false,
      notes: 'Permanent retention required.',
    },
    {
      recordType: 'ordinances',
      description: 'Adopted ordinances and resolutions.',
      retentionYears: 'permanent',
      retentionTrigger: 'creation',
      requiresCommissionApproval: false,
    },
    {
      recordType: 'financial-records',
      description: 'General ledgers, journals, and annual reports.',
      retentionYears: 10,
      retentionTrigger: 'fiscal-year-end',
      requiresCommissionApproval: true,
      citation: { code: 'IC 5-15-6' },
    },
    {
      recordType: 'payroll-records',
      description: 'Payroll registers, timesheets, and related records.',
      retentionYears: 7,
      retentionTrigger: 'fiscal-year-end',
      requiresCommissionApproval: true,
    },
    {
      recordType: 'personnel-files',
      description: 'Employee personnel files.',
      retentionYears: 7,
      retentionTrigger: 'close', // After separation
      requiresCommissionApproval: true,
    },
    {
      recordType: 'contracts',
      description: 'Executed contracts and agreements.',
      retentionYears: 10,
      retentionTrigger: 'close', // After expiration
      requiresCommissionApproval: true,
    },
    {
      recordType: 'apra-requests',
      description: 'Public records requests and responses.',
      retentionYears: 3,
      retentionTrigger: 'close',
      requiresCommissionApproval: true,
    },
    {
      recordType: 'correspondence-general',
      description: 'General correspondence not related to specific programs.',
      retentionYears: 3,
      retentionTrigger: 'creation',
      requiresCommissionApproval: true,
    },
  ],

  archivesContact: {
    name: 'Indiana Archives and Records Administration',
    url: 'https://www.in.gov/iara/',
    email: 'arc@iara.in.gov',
  },
};
