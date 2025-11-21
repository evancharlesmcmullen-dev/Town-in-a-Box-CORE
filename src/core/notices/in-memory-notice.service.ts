// src/core/notices/in-memory-notice.service.ts

import { randomUUID } from 'crypto';
import { TenantContext } from '../tenancy/tenancy.types';
import {
  Notice,
  NoticeSummary,
  NoticeDelivery,
  NoticeChannel,
  NoticeType,
} from './notice.types';
import {
  NoticeService,
  CreateNoticeInput,
  NoticeFilter,
  RecordNoticeDeliveryInput,
} from './notice.service';

export interface InMemoryNoticeSeedData {
  notices?: Notice[];
  deliveries?: NoticeDelivery[];
}

/**
 * In-memory NoticeService for demos/tests. Data is scoped per tenant and
 * exists only for the process lifetime.
 */
export class InMemoryNoticeService implements NoticeService {
  private notices: Notice[];
  private deliveries: NoticeDelivery[];

  constructor(seed: InMemoryNoticeSeedData = {}) {
    this.notices = seed.notices ? [...seed.notices] : [];
    this.deliveries = seed.deliveries ? [...seed.deliveries] : [];
  }

  async createNotice(
    ctx: TenantContext,
    input: CreateNoticeInput
  ): Promise<Notice> {
    const now = new Date();
    const notice: Notice = {
      id: randomUUID(),
      tenantId: ctx.tenantId,
      type: input.type as NoticeType,
      title: input.title,
      body: input.body,
      channels: [...input.channels] as NoticeChannel[],
      relatedType: input.relatedType,
      relatedId: input.relatedId,
      effectiveDate: input.effectiveDate,
      createdAt: now,
      createdByUserId: ctx.userId,
    };

    this.notices.push(notice);
    return notice;
  }

  async getNotice(
    ctx: TenantContext,
    id: string
  ): Promise<Notice | null> {
    return (
      this.notices.find(
        (n) => n.id === id && n.tenantId === ctx.tenantId
      ) ?? null
    );
  }

  async listNotices(
    ctx: TenantContext,
    filter: NoticeFilter = {}
  ): Promise<NoticeSummary[]> {
    let results = this.notices.filter(
      (n) => n.tenantId === ctx.tenantId
    );

    if (filter.type) {
      results = results.filter((n) => n.type === filter.type);
    }

    if (filter.relatedType) {
      results = results.filter((n) => n.relatedType === filter.relatedType);
    }

    if (filter.relatedId) {
      results = results.filter((n) => n.relatedId === filter.relatedId);
    }

    if (filter.fromDate) {
      results = results.filter((n) => n.createdAt >= filter.fromDate!);
    }

    if (filter.toDate) {
      results = results.filter((n) => n.createdAt <= filter.toDate!);
    }

    if (filter.searchText) {
      const q = filter.searchText.toLowerCase();
      results = results.filter(
        (n) =>
          n.title.toLowerCase().includes(q) ||
          n.body.toLowerCase().includes(q)
      );
    }

    return results.map<NoticeSummary>((n) => ({
      id: n.id,
      tenantId: n.tenantId,
      type: n.type,
      title: n.title,
      createdAt: n.createdAt,
      effectiveDate: n.effectiveDate,
    }));
  }

  async recordDelivery(
    ctx: TenantContext,
    input: RecordNoticeDeliveryInput
  ): Promise<NoticeDelivery[]> {
    const notice = this.notices.find(
      (n) => n.id === input.noticeId && n.tenantId === ctx.tenantId
    );

    if (!notice) {
      throw new Error('Notice not found for tenant');
    }

    const delivery: NoticeDelivery = {
      id: randomUUID(),
      tenantId: ctx.tenantId,
      noticeId: input.noticeId,
      channel: input.channel,
      deliveredAt: input.deliveredAt,
      deliveredByUserId: ctx.userId,
      proofRecordId: input.proofRecordId,
      details: input.details,
    };

    this.deliveries.push(delivery);

    return this.deliveries.filter(
      (d) => d.tenantId === ctx.tenantId && d.noticeId === input.noticeId
    );
  }

  async listDeliveriesForNotice(
    ctx: TenantContext,
    noticeId: string
  ): Promise<NoticeDelivery[]> {
    return this.deliveries.filter(
      (d) => d.tenantId === ctx.tenantId && d.noticeId === noticeId
    );
  }
}
