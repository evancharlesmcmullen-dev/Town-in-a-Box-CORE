// src/core/notifications/notification.service.ts
//
// Notification service interface.

import { TenantContext } from '../tenancy/tenancy.types';
import {
  Notification,
  CreateNotificationInput,
  NotificationDeliveryStatus,
  NotificationPreferences,
  NotificationCategory,
} from './notification.types';

/**
 * Filter options for listing notifications.
 */
export interface NotificationFilter {
  /** Filter by category */
  category?: NotificationCategory;
  /** Filter by reference ID */
  referenceId?: string;
  /** Filter by sent status */
  sentOnly?: boolean;
  /** Filter by pending status */
  pendingOnly?: boolean;
  /** From date (created) */
  fromDate?: Date;
  /** To date (created) */
  toDate?: Date;
}

/**
 * Service interface for managing notifications.
 *
 * Implementations handle:
 * - Creating and scheduling notifications
 * - Delivery via various channels (email, SMS, etc.)
 * - Tracking delivery status
 * - Managing user preferences
 */
export interface NotificationService {
  /**
   * Create a new notification.
   *
   * If scheduledAt is provided, the notification will be queued for later.
   * Otherwise, it will be sent immediately.
   *
   * @param ctx - Tenant context
   * @param input - Notification details
   * @returns The created notification
   */
  createNotification(
    ctx: TenantContext,
    input: CreateNotificationInput
  ): Promise<Notification>;

  /**
   * Get a notification by ID.
   *
   * @param ctx - Tenant context
   * @param id - Notification ID
   * @returns The notification or null if not found
   */
  getNotification(
    ctx: TenantContext,
    id: string
  ): Promise<Notification | null>;

  /**
   * List notifications with optional filtering.
   *
   * @param ctx - Tenant context
   * @param filter - Filter options
   * @returns List of notifications
   */
  listNotifications(
    ctx: TenantContext,
    filter?: NotificationFilter
  ): Promise<Notification[]>;

  /**
   * Cancel a pending notification.
   *
   * Only works for notifications that haven't been sent yet.
   *
   * @param ctx - Tenant context
   * @param id - Notification ID
   * @returns True if cancelled, false if already sent
   */
  cancelNotification(
    ctx: TenantContext,
    id: string
  ): Promise<boolean>;

  /**
   * Send a notification immediately.
   *
   * Bypasses scheduling and sends right away.
   *
   * @param ctx - Tenant context
   * @param id - Notification ID
   * @returns Delivery statuses for each channel
   */
  sendNow(
    ctx: TenantContext,
    id: string
  ): Promise<NotificationDeliveryStatus[]>;

  /**
   * Get delivery status for a notification.
   *
   * @param ctx - Tenant context
   * @param notificationId - Notification ID
   * @returns Delivery statuses for each channel
   */
  getDeliveryStatus(
    ctx: TenantContext,
    notificationId: string
  ): Promise<NotificationDeliveryStatus[]>;

  /**
   * Get user notification preferences.
   *
   * @param ctx - Tenant context
   * @param userId - User ID
   * @returns User preferences or default preferences if not set
   */
  getPreferences(
    ctx: TenantContext,
    userId: string
  ): Promise<NotificationPreferences>;

  /**
   * Update user notification preferences.
   *
   * @param ctx - Tenant context
   * @param preferences - Updated preferences
   * @returns The saved preferences
   */
  updatePreferences(
    ctx: TenantContext,
    preferences: Partial<NotificationPreferences> & { userId: string }
  ): Promise<NotificationPreferences>;

  /**
   * Process scheduled notifications that are due.
   *
   * This should be called periodically (e.g., every minute) to send
   * scheduled notifications whose scheduledAt time has passed.
   *
   * @param ctx - Tenant context
   * @returns Number of notifications sent
   */
  processScheduledNotifications(ctx: TenantContext): Promise<number>;
}
