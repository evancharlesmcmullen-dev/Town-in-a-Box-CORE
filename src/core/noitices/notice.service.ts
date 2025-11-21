// src/core/notices/notice.service.ts

import { TenantContext } from '../tenancy/types';
import {
  Notice,
  NoticeSummary,
  NoticeDelivery,
  NoticeChannel,
  NoticeType,
} from './notice.types';

/**
 * Filters for searching notices.
 */
export interface NoticeFilter {
  type?: NoticeType;
  relatedType?: string;
  relatedId?: string;
  fromDate?: Date;
  toDate?: Date;
  searchText?: string;
}

/**
 * Input for creating a notice.
 */
export interface CreateNoticeInput {
  type: NoticeType;
  title: string;
  body: string;
  channels: NoticeChannel[];
  relatedType?: string;
  relatedId?: string;
  effectiveDate?: Date;
}

/**
 * Input for recording a delivery/posting of a notice.
 */
export interface RecordNoticeDeliveryInput {
  noticeId: string;
  channel: NoticeChannel;
  deliveredAt: Date;
  proofRecordId?: string;
  details?: Record<string, unknown>;
}

/**
 * Service interface for the notice engine.
 *
 * Domain engines (Meetings, Finance/Budget, Code Enforcement, Utilities,
 * Township Assistance, Fire Contracts, etc.) will call this when they need
 * to generate and/or track legal/public notices.
 */
export interface NoticeService {
  //
  // NOTICES
  //

  createNotice(
    ctx: TenantContext,
    input: CreateNoticeInput
  ): Promise<Notice>;

  getNotice(
    ctx: TenantContext,
    id: string
  ): Promise<Notice | null>;

  listNotices(
    ctx: TenantContext,
    filter?: NoticeFilter
  ): Promise<NoticeSummary[]>;

  //
  // DELIVERIES
  //

  recordDelivery(
    ctx: TenantContext,
    input: RecordNoticeDeliveryInput
  ): Promise<NoticeDelivery[]>;   // return all deliveries for that notice

  listDeliveriesForNotice(
    ctx: TenantContext,
    noticeId: string
  ): Promise<NoticeDelivery[]>;
}