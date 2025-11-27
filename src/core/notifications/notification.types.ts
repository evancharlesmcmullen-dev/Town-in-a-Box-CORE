// src/core/notifications/notification.types.ts
//
// Core types for the notification system.
// Used by all engines (APRA, meetings, planning, etc.) for alerts and reminders.

/**
 * Priority level for notifications.
 */
export type NotificationPriority = 'low' | 'normal' | 'high' | 'urgent';

/**
 * Channel through which a notification can be delivered.
 */
export type NotificationChannel = 'email' | 'sms' | 'push' | 'in_app' | 'webhook';

/**
 * Status of a notification.
 */
export type NotificationStatus = 'pending' | 'sent' | 'delivered' | 'failed' | 'read';

/**
 * A notification entity.
 */
export interface Notification {
  /** Unique identifier */
  id: string;
  /** Tenant this notification belongs to */
  tenantId: string;

  /** Notification type/category (e.g., "apra_deadline", "meeting_reminder") */
  type: string;
  /** Subject/title of the notification */
  subject: string;
  /** Body/message content */
  body: string;

  /** Priority level */
  priority: NotificationPriority;
  /** Delivery channels requested */
  channels: NotificationChannel[];

  /** Recipient user ID (if internal) */
  recipientUserId?: string;
  /** Recipient email (if external) */
  recipientEmail?: string;
  /** Recipient phone (for SMS) */
  recipientPhone?: string;

  /** Related entity ID (e.g., APRA request ID) */
  relatedEntityId?: string;
  /** Related entity type (e.g., "apra_request") */
  relatedEntityType?: string;

  /** Current status */
  status: NotificationStatus;

  /** When the notification was created (ISO 8601) */
  createdAt: string;
  /** When the notification should be sent (for scheduled notifications) */
  scheduledAt?: string;
  /** When the notification was actually sent (ISO 8601) */
  sentAt?: string;
  /** When the notification was delivered (ISO 8601) */
  deliveredAt?: string;
  /** When the notification was read (ISO 8601) */
  readAt?: string;

  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Input for creating a notification.
 */
export interface CreateNotificationInput {
  type: string;
  subject: string;
  body: string;
  priority?: NotificationPriority;
  channels?: NotificationChannel[];
  recipientUserId?: string;
  recipientEmail?: string;
  recipientPhone?: string;
  relatedEntityId?: string;
  relatedEntityType?: string;
  scheduledAt?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Filter options for listing notifications.
 */
export interface NotificationFilter {
  /** Filter by type(s) */
  types?: string[];
  /** Filter by status(es) */
  statuses?: NotificationStatus[];
  /** Filter by recipient user ID */
  recipientUserId?: string;
  /** Filter by related entity ID */
  relatedEntityId?: string;
  /** Filter by priority */
  priority?: NotificationPriority;
  /** Only include unread notifications */
  unreadOnly?: boolean;
  /** Limit results */
  limit?: number;
}
