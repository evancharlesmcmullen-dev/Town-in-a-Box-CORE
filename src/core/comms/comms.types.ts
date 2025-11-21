// src/core/comms/comms.types.ts

/**
 * Types of communication channels we support.
 * For now we focus on email; later we can add SMS, etc.
 */
export type CommsChannelType = 'email';

/**
 * A logical outbound channel, e.g. "recordsrequest@...", "no-reply@...".
 */
export interface OutboundChannel {
  id: string;
  tenantId: string;

  type: CommsChannelType;
  address: string;           // email address
  displayName?: string;      // e.g. "Township Records"
  isActive: boolean;
}

/**
 * Email template definition.
 */
export interface EmailTemplate {
  id: string;
  tenantId: string;

  code: string;              // e.g. "APRA_ACK", "MEETING_NOTICE", "ASSISTANCE_DENIAL"
  subjectTemplate: string;
  bodyTemplate: string;

  isActive: boolean;
}

/**
 * A sent email (log).
 */
export interface SentEmail {
  id: string;
  tenantId: string;

  channelId: string;         // OutboundChannel id

  toAddress: string;
  subject: string;
  body: string;

  sentAt: Date;
  // Later: status, failures, provider messageId, etc.
}