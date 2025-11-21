// src/core/comms/comms.service.ts

import { TenantContext } from '../tenancy/types';
import {
  OutboundChannel,
  EmailTemplate,
  SentEmail,
} from './comms.types';

/**
 * Input for sending an email using a template.
 */
export interface SendTemplatedEmailInput {
  templateCode: string;
  channelId: string;
  toAddress: string;
  variables: Record<string, unknown>;   // used to fill subject/body
}

/**
 * Service interface for outbound communications.
 *
 * Implementations will typically wrap an SMTP provider or email API.
 * For now, we design the interface and can implement an in-memory version.
 */
export interface CommsService {
  //
  // CHANNELS
  //

  listOutboundChannels(ctx: TenantContext): Promise<OutboundChannel[]>;

  getOutboundChannel(
    ctx: TenantContext,
    id: string
  ): Promise<OutboundChannel | null>;

  //
  // TEMPLATES
  //

  listEmailTemplates(ctx: TenantContext): Promise<EmailTemplate[]>;

  getEmailTemplateByCode(
    ctx: TenantContext,
    code: string
  ): Promise<EmailTemplate | null>;

  //
  // SENDING
  //

  /**
   * Send an email using a stored template and return the logged SentEmail.
   */
  sendTemplatedEmail(
    ctx: TenantContext,
    input: SendTemplatedEmailInput
  ): Promise<SentEmail>;

  /**
   * List sent emails for a tenant (for auditing/troubleshooting).
   */
  listSentEmails(
    ctx: TenantContext
  ): Promise<SentEmail[]>;
}