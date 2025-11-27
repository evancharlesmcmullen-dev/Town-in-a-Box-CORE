// src/core/notifications/email-notification.service.ts
//
// Email-based notification service implementation.
// Supports SMTP and SendGrid transports.

import { randomUUID } from 'crypto';
import { TenantContext } from '../tenancy/tenancy.types';
import {
  Notification,
  NotificationStatus,
  CreateNotificationInput,
  NotificationFilter,
} from './notification.types';
import { NotificationService } from './notification.service';

// ===========================================================================
// CONFIGURATION
// ===========================================================================

/**
 * Email transport configuration.
 */
export interface EmailTransportConfig {
  /** Transport type */
  type: 'smtp' | 'sendgrid' | 'console';

  /** SMTP configuration (when type = 'smtp') */
  smtp?: {
    host: string;
    port: number;
    secure: boolean;
    auth?: {
      user: string;
      pass: string;
    };
  };

  /** SendGrid configuration (when type = 'sendgrid') */
  sendgrid?: {
    apiKey: string;
  };

  /** Default from address */
  fromAddress: string;
  /** Default from name */
  fromName: string;
}

/**
 * Load email configuration from environment.
 */
export function loadEmailConfig(): EmailTransportConfig {
  const type = (process.env.EMAIL_TRANSPORT || 'console') as 'smtp' | 'sendgrid' | 'console';

  return {
    type,
    smtp: type === 'smtp'
      ? {
          host: process.env.SMTP_HOST || 'localhost',
          port: parseInt(process.env.SMTP_PORT || '587', 10),
          secure: process.env.SMTP_SECURE === 'true',
          auth: process.env.SMTP_USER
            ? {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASS || '',
              }
            : undefined,
        }
      : undefined,
    sendgrid: type === 'sendgrid'
      ? {
          apiKey: process.env.SENDGRID_API_KEY || '',
        }
      : undefined,
    fromAddress: process.env.EMAIL_FROM_ADDRESS || 'noreply@example.gov',
    fromName: process.env.EMAIL_FROM_NAME || 'Town Clerk Office',
  };
}

// ===========================================================================
// EMAIL TRANSPORT INTERFACE
// ===========================================================================

/**
 * Internal interface for email sending.
 */
interface EmailTransport {
  send(options: {
    to: string;
    subject: string;
    text: string;
    html?: string;
  }): Promise<void>;
}

/**
 * Console transport for development - just logs emails.
 */
class ConsoleEmailTransport implements EmailTransport {
  constructor(private config: EmailTransportConfig) {}

  async send(options: { to: string; subject: string; text: string; html?: string }): Promise<void> {
    console.log('='.repeat(60));
    console.log('📧 EMAIL NOTIFICATION (console transport)');
    console.log('='.repeat(60));
    console.log(`From: ${this.config.fromName} <${this.config.fromAddress}>`);
    console.log(`To: ${options.to}`);
    console.log(`Subject: ${options.subject}`);
    console.log('-'.repeat(60));
    console.log(options.text);
    console.log('='.repeat(60));
  }
}

/**
 * SMTP transport using nodemailer (requires nodemailer to be installed).
 *
 * This is a placeholder implementation. In production, you would:
 * 1. npm install nodemailer @types/nodemailer
 * 2. Uncomment and use the actual nodemailer code
 */
class SmtpEmailTransport implements EmailTransport {
  constructor(private config: EmailTransportConfig) {
    if (!config.smtp) {
      throw new Error('SMTP configuration is required for SMTP transport');
    }
  }

  async send(options: { to: string; subject: string; text: string; html?: string }): Promise<void> {
    // In production, use nodemailer:
    //
    // import nodemailer from 'nodemailer';
    //
    // const transporter = nodemailer.createTransport({
    //   host: this.config.smtp!.host,
    //   port: this.config.smtp!.port,
    //   secure: this.config.smtp!.secure,
    //   auth: this.config.smtp!.auth,
    // });
    //
    // await transporter.sendMail({
    //   from: `"${this.config.fromName}" <${this.config.fromAddress}>`,
    //   to: options.to,
    //   subject: options.subject,
    //   text: options.text,
    //   html: options.html,
    // });

    // For now, fall back to console logging with a warning
    console.warn('[SmtpEmailTransport] nodemailer not installed, falling back to console');
    const console_transport = new ConsoleEmailTransport(this.config);
    await console_transport.send(options);
  }
}

/**
 * SendGrid transport using the SendGrid API.
 *
 * This is a placeholder implementation. In production, you would:
 * 1. npm install @sendgrid/mail
 * 2. Uncomment and use the actual SendGrid code
 */
class SendGridEmailTransport implements EmailTransport {
  constructor(private config: EmailTransportConfig) {
    if (!config.sendgrid?.apiKey) {
      throw new Error('SendGrid API key is required for SendGrid transport');
    }
  }

  async send(options: { to: string; subject: string; text: string; html?: string }): Promise<void> {
    // In production, use @sendgrid/mail:
    //
    // import sgMail from '@sendgrid/mail';
    //
    // sgMail.setApiKey(this.config.sendgrid!.apiKey);
    //
    // await sgMail.send({
    //   to: options.to,
    //   from: {
    //     email: this.config.fromAddress,
    //     name: this.config.fromName,
    //   },
    //   subject: options.subject,
    //   text: options.text,
    //   html: options.html,
    // });

    // For now, fall back to console logging with a warning
    console.warn('[SendGridEmailTransport] @sendgrid/mail not installed, falling back to console');
    const console_transport = new ConsoleEmailTransport(this.config);
    await console_transport.send(options);
  }
}

/**
 * Create the appropriate email transport based on config.
 */
function createEmailTransport(config: EmailTransportConfig): EmailTransport {
  switch (config.type) {
    case 'smtp':
      return new SmtpEmailTransport(config);
    case 'sendgrid':
      return new SendGridEmailTransport(config);
    case 'console':
    default:
      return new ConsoleEmailTransport(config);
  }
}

// ===========================================================================
// EMAIL NOTIFICATION SERVICE
// ===========================================================================

/**
 * Email-based notification service.
 *
 * Sends notifications via email using configurable transport (SMTP, SendGrid, or console).
 * Also maintains an in-memory record of sent notifications for querying.
 *
 * Configuration via environment variables:
 * - EMAIL_TRANSPORT: 'smtp', 'sendgrid', or 'console' (default: 'console')
 * - EMAIL_FROM_ADDRESS: Sender email address
 * - EMAIL_FROM_NAME: Sender display name
 *
 * For SMTP:
 * - SMTP_HOST, SMTP_PORT, SMTP_SECURE, SMTP_USER, SMTP_PASS
 *
 * For SendGrid:
 * - SENDGRID_API_KEY
 *
 * @example
 * const notificationService = new EmailNotificationService();
 * await notificationService.send(ctx, {
 *   type: 'apra_deadline',
 *   subject: 'APRA Request Deadline',
 *   body: 'Your request is due in 2 days.',
 *   recipientEmail: 'clerk@town.gov',
 * });
 */
export class EmailNotificationService implements NotificationService {
  private transport: EmailTransport;
  private config: EmailTransportConfig;

  // In-memory storage for notification records
  // In production, this should be persisted to a database
  private notifications: Map<string, Notification> = new Map();

  constructor(config?: EmailTransportConfig) {
    this.config = config || loadEmailConfig();
    this.transport = createEmailTransport(this.config);
  }

  async send(
    ctx: TenantContext,
    input: CreateNotificationInput
  ): Promise<Notification> {
    const now = new Date().toISOString();

    const notification: Notification = {
      id: randomUUID(),
      tenantId: ctx.tenantId,
      type: input.type,
      subject: input.subject,
      body: input.body,
      priority: input.priority ?? 'normal',
      channels: input.channels ?? ['email'],
      recipientUserId: input.recipientUserId,
      recipientEmail: input.recipientEmail,
      recipientPhone: input.recipientPhone,
      relatedEntityId: input.relatedEntityId,
      relatedEntityType: input.relatedEntityType,
      metadata: input.metadata,
      status: 'pending',
      createdAt: now,
    };

    // Send email if recipient email is provided
    if (input.recipientEmail && (input.channels ?? ['email']).includes('email')) {
      try {
        await this.transport.send({
          to: input.recipientEmail,
          subject: input.subject,
          text: input.body,
        });
        notification.status = 'sent';
        notification.sentAt = new Date().toISOString();
      } catch (error) {
        notification.status = 'failed';
        console.error('Failed to send email notification:', error);
      }
    } else {
      // No email to send, mark as delivered (for in_app notifications)
      notification.status = 'delivered';
      notification.deliveredAt = new Date().toISOString();
    }

    this.notifications.set(notification.id, notification);
    return notification;
  }

  async schedule(
    ctx: TenantContext,
    input: CreateNotificationInput
  ): Promise<Notification> {
    const now = new Date().toISOString();

    const notification: Notification = {
      id: randomUUID(),
      tenantId: ctx.tenantId,
      type: input.type,
      subject: input.subject,
      body: input.body,
      priority: input.priority ?? 'normal',
      channels: input.channels ?? ['email'],
      recipientUserId: input.recipientUserId,
      recipientEmail: input.recipientEmail,
      recipientPhone: input.recipientPhone,
      relatedEntityId: input.relatedEntityId,
      relatedEntityType: input.relatedEntityType,
      scheduledAt: input.scheduledAt,
      metadata: input.metadata,
      status: 'pending',
      createdAt: now,
    };

    this.notifications.set(notification.id, notification);

    // In production, you would store this in a database and have a
    // background job process scheduled notifications
    console.log(`[EmailNotificationService] Scheduled notification ${notification.id} for ${input.scheduledAt}`);

    return notification;
  }

  async get(ctx: TenantContext, id: string): Promise<Notification | null> {
    const notification = this.notifications.get(id);
    if (!notification || notification.tenantId !== ctx.tenantId) {
      return null;
    }
    return notification;
  }

  async list(
    ctx: TenantContext,
    filter?: NotificationFilter
  ): Promise<Notification[]> {
    let results = Array.from(this.notifications.values()).filter(
      (n) => n.tenantId === ctx.tenantId
    );

    if (filter?.types?.length) {
      results = results.filter((n) => filter.types!.includes(n.type));
    }

    if (filter?.statuses?.length) {
      results = results.filter((n) => filter.statuses!.includes(n.status));
    }

    if (filter?.recipientUserId) {
      results = results.filter((n) => n.recipientUserId === filter.recipientUserId);
    }

    if (filter?.relatedEntityId) {
      results = results.filter((n) => n.relatedEntityId === filter.relatedEntityId);
    }

    if (filter?.priority) {
      results = results.filter((n) => n.priority === filter.priority);
    }

    if (filter?.unreadOnly) {
      results = results.filter((n) => !n.readAt);
    }

    // Sort by createdAt descending (newest first)
    results.sort((a, b) => b.createdAt.localeCompare(a.createdAt));

    if (filter?.limit && filter.limit > 0) {
      results = results.slice(0, filter.limit);
    }

    return results;
  }

  async markAsRead(ctx: TenantContext, id: string): Promise<Notification> {
    const notification = await this.get(ctx, id);
    if (!notification) {
      throw new Error('Notification not found');
    }

    notification.status = 'read';
    notification.readAt = new Date().toISOString();
    return notification;
  }

  async cancel(ctx: TenantContext, id: string): Promise<Notification> {
    const notification = await this.get(ctx, id);
    if (!notification) {
      throw new Error('Notification not found');
    }

    if (notification.status !== 'pending') {
      throw new Error('Can only cancel pending notifications');
    }

    notification.status = 'failed';
    return notification;
  }

  async getUnreadCount(ctx: TenantContext, userId: string): Promise<number> {
    const unread = await this.list(ctx, {
      recipientUserId: userId,
      unreadOnly: true,
    });
    return unread.length;
  }
}
