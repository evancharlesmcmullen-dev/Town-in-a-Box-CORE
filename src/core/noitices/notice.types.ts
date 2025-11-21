// src/core/notices/notice.types.ts

import { RecordSecurityLevel } from '../records/record.types';

/**
 * Where and how a notice is published/delivered.
 */
export type NoticeChannel =
  | 'website'
  | 'officePosting'
  | 'newspaper'
  | 'mail'
  | 'email'
  | 'doorHanger'
  | 'socialMedia'
  | 'other';

/**
 * High-level type of notice.
 */
export type NoticeType =
  | 'meeting'
  | 'budget'
  | 'ordinance'
  | 'hearing'
  | 'codeEnforcement'
  | 'utility'
  | 'assistance'
  | 'fireContract'
  | 'cemetery'
  | 'other';

/**
 * Core notice entity describing a legal/public notice.
 */
export interface Notice {
  id: string;
  tenantId: string;

  type: NoticeType;
  title: string;
  body: string;

  channels: NoticeChannel[];

  // Optional reference to a related domain object (meeting, case, etc.).
  relatedType?: string;        // e.g. "Meeting", "CodeCase"
  relatedId?: string;

  // When the notice is intended to cover (e.g., meeting time).
  effectiveDate?: Date;

  createdAt: Date;
  createdByUserId?: string;
}

/**
 * A specific posting/delivery of a notice to a channel.
 */
export interface NoticeDelivery {
  id: string;
  tenantId: string;

  noticeId: string;
  channel: NoticeChannel;

  deliveredAt: Date;
  deliveredByUserId?: string;

  // Optional link into Records if the published ad or screenshot is stored.
  proofRecordId?: string;

  // For APRA/Open Door defenses, we may store extra metadata.
  details?: Record<string, unknown>;
}

/**
 * Summary for listing/searching notices.
 */
export interface NoticeSummary {
  id: string;
  tenantId: string;
  type: NoticeType;
  title: string;
  createdAt: Date;
  effectiveDate?: Date;
}