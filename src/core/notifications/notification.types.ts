// src/core/notifications/notification.types.ts
//
// Core types for the notification system.
// Generic enough to support APRA deadlines, meeting reminders, and other alerts.

/**
 * Notification delivery channels.
 */
export type NotificationChannel = 'EMAIL' | 'SMS' | 'IN_APP' | 'WEBHOOK';

/**
 * Priority levels for notifications.
 */
export type NotificationPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';

/**
 * Categories of notifications.
 */
export type NotificationCategory =
  | 'APRA_DEADLINE'      // APRA statutory deadline approaching
  | 'APRA_STATUS'        // APRA request status change
  | 'MEETING_NOTICE'     // Meeting notice deadline
  | 'MEETING_REMINDER'   // Meeting starting soon
  | 'ASSISTANCE_CASE'    // Township assistance case update
  | 'COMPLIANCE_TASK'    // Compliance task due
  | 'SYSTEM'             // System alerts
  | 'OTHER';

/**
 * A notification to be sent or that has been sent.
 */
export interface Notification {
  id: string;
  tenantId: string;

  /** Category of the notification */
  category: NotificationCategory;
  /** Priority level */
  priority: NotificationPriority;

  /** Short summary/subject */
  title: string;
  /** Full message body (may contain markdown) */
  body: string;

  /** Recipient user ID(s) */
  recipientUserIds: string[];
  /** Optional specific email addresses to send to */
  recipientEmails?: string[];

  /** Channels to use for delivery */
  channels: NotificationChannel[];

  /** Reference to related entity (e.g., APRA request ID) */
  referenceId?: string;
  /** Type of referenced entity */
  referenceType?: string;

  /** When the notification was created (ISO 8601) */
  createdAt: string;
  /** When the notification was scheduled to send (ISO 8601) */
  scheduledAt?: string;
  /** When the notification was actually sent (ISO 8601) */
  sentAt?: string;

  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Input for creating a new notification.
 */
export interface CreateNotificationInput {
  category: NotificationCategory;
  priority?: NotificationPriority;
  title: string;
  body: string;
  recipientUserIds: string[];
  recipientEmails?: string[];
  channels?: NotificationChannel[];
  referenceId?: string;
  referenceType?: string;
  scheduledAt?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Delivery status for a notification.
 */
export interface NotificationDeliveryStatus {
  notificationId: string;
  channel: NotificationChannel;
  status: 'PENDING' | 'SENT' | 'DELIVERED' | 'FAILED' | 'BOUNCED';
  attemptedAt?: string;
  deliveredAt?: string;
  failureReason?: string;
}

/**
 * User notification preferences.
 */
export interface NotificationPreferences {
  userId: string;
  tenantId: string;

  /** Which channels the user wants to receive notifications on */
  enabledChannels: NotificationChannel[];

  /** Per-category preferences */
  categoryPreferences: {
    category: NotificationCategory;
    enabled: boolean;
    channels?: NotificationChannel[];
  }[];

  /** Email address for notifications (may differ from account email) */
  notificationEmail?: string;

  /** Phone number for SMS */
  smsPhoneNumber?: string;

  /** Quiet hours (no notifications during these times) */
  quietHours?: {
    start: string; // HH:mm format
    end: string;
    timezone: string;
  };
}
