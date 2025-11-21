// src/core/comms/in-memory-comms.service.ts

import { randomUUID } from 'crypto';
import { TenantContext } from '../tenancy/tenancy.types';
import {
  OutboundChannel,
  EmailTemplate,
  SentEmail,
} from './comms.types';
import {
  CommsService,
  SendTemplatedEmailInput,
} from './comms.service';

export interface InMemoryCommsSeedData {
  channels?: OutboundChannel[];
  templates?: EmailTemplate[];
  sentEmails?: SentEmail[];
}

/**
 * In-memory CommsService for demos/tests. Data is scoped per tenant and
 * only lasts for the process lifetime.
 */
export class InMemoryCommsService implements CommsService {
  private channels: OutboundChannel[];
  private templates: EmailTemplate[];
  private sentEmails: SentEmail[];

  constructor(seed: InMemoryCommsSeedData = {}) {
    this.channels = seed.channels ? [...seed.channels] : [];
    this.templates = seed.templates ? [...seed.templates] : [];
    this.sentEmails = seed.sentEmails ? [...seed.sentEmails] : [];
  }

  //
  // CHANNELS
  //

  async listOutboundChannels(ctx: TenantContext): Promise<OutboundChannel[]> {
    return this.channels.filter((c) => c.tenantId === ctx.tenantId);
  }

  async getOutboundChannel(
    ctx: TenantContext,
    id: string
  ): Promise<OutboundChannel | null> {
    return (
      this.channels.find(
        (c) => c.id === id && c.tenantId === ctx.tenantId
      ) ?? null
    );
  }

  //
  // TEMPLATES
  //

  async listEmailTemplates(ctx: TenantContext): Promise<EmailTemplate[]> {
    return this.templates.filter((t) => t.tenantId === ctx.tenantId);
  }

  async getEmailTemplateByCode(
    ctx: TenantContext,
    code: string
  ): Promise<EmailTemplate | null> {
    return (
      this.templates.find(
        (t) => t.code === code && t.tenantId === ctx.tenantId
      ) ?? null
    );
  }

  //
  // SENDING
  //

  async sendTemplatedEmail(
    ctx: TenantContext,
    input: SendTemplatedEmailInput
  ): Promise<SentEmail> {
    const template = await this.getEmailTemplateByCode(ctx, input.templateCode);
    if (!template) {
      throw new Error('Email template not found for tenant');
    }

    const render = (tpl: string): string =>
      tpl.replace(/\{\{(\w+)\}\}/g, (_, key: string) => {
        const value = input.variables[key];
        return value === undefined || value === null ? '' : String(value);
      });

    const subject = render(template.subjectTemplate);
    const body = render(template.bodyTemplate);

    const sent: SentEmail = {
      id: randomUUID(),
      tenantId: ctx.tenantId,
      channelId: input.channelId,
      toAddress: input.toAddress,
      subject,
      body,
      sentAt: new Date(),
    };

    this.sentEmails.push(sent);
    return sent;
  }

  async listSentEmails(ctx: TenantContext): Promise<SentEmail[]> {
    return this.sentEmails.filter((s) => s.tenantId === ctx.tenantId);
  }
}
