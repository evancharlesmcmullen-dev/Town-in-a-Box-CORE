// src/engines/meetings/meeting-notice.helper.ts

import { TenantContext } from '../../core/tenancy/tenancy.types';
import { Meeting, MeetingType } from './meeting.types';
import {
  NoticeService,
  CreateNoticeInput,
} from '../../core/notices/notice.service';

function buildTitle(meeting: Meeting): string {
  const base = meeting.bodyId ? meeting.bodyId : 'Meeting';
  if (meeting.type === 'special') {
    return `Special Meeting - ${base}`;
  }
  if (meeting.type === 'emergency') {
    return `Emergency Meeting - ${base}`;
  }
  return `${base} Meeting`;
}

function formatBody(meeting: Meeting): string {
  const dateStr = meeting.scheduledStart.toISOString();
  const location = meeting.location || 'TBD';
  return `Meeting scheduled for ${dateStr} at ${location}.`;
}

export async function ensureMeetingNotice(
  ctx: TenantContext,
  noticeService: NoticeService,
  meeting: Meeting
): Promise<void> {
  const input: CreateNoticeInput = {
    type: 'meeting',
    title: buildTitle(meeting),
    body: formatBody(meeting),
    channels: ['website', 'officePosting'],
    relatedType: 'Meeting',
    relatedId: meeting.id,
    effectiveDate: meeting.scheduledStart,
  };

  await noticeService.createNotice(ctx, input);
}
