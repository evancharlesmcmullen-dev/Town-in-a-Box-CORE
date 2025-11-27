// src/core/notifications/notification.service.ts
//
// Core notification service interface.
// Implementations may use email providers, SMS gateways, push services, etc.

import { TenantContext } from '../tenancy/tenancy.types';
import {
  Notification,
  CreateNotificationInput,
  NotificationFilter,
} from './notification.types';

/**
 * Core notification service interface.
 *
 * Used by all engines to send notifications to users (staff or public).
 * Implementations handle the actual delivery via email, SMS, push, etc.
 *
 * @example
 * await notificationService.send(ctx, {
 *   type: 'apra_deadline',
 *   subject: 'APRA Request Deadline Approaching',
 *   body: 'Request #123 is due in 2 days.',
 *   priority: 'high',
 *   channels: ['email'],
 *   recipientEmail: 'clerk@town.gov',
 * });
 */
export interface NotificationService {
  /**
   * Send a notification.
   *
   * Creates and immediately queues the notification for delivery.
   *
   * @param ctx - Tenant context
   * @param input - Notification details
   * @returns The created notification
   */
  send(
    ctx: TenantContext,
    input: CreateNotificationInput
  ): Promise<Notification>;

  /**
   * Schedule a notification for later delivery.
   *
   * @param ctx - Tenant context
   * @param input - Notification details (scheduledAt should be set)
   * @returns The created notification with pending status
   */
  schedule(
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
  get(ctx: TenantContext, id: string): Promise<Notification | null>;

  /**
   * List notifications with optional filtering.
   *
   * @param ctx - Tenant context
   * @param filter - Optional filters
   * @returns List of notifications
   */
  list(ctx: TenantContext, filter?: NotificationFilter): Promise<Notification[]>;

  /**
   * Mark a notification as read.
   *
   * @param ctx - Tenant context
   * @param id - Notification ID
   * @returns The updated notification
   */
  markAsRead(ctx: TenantContext, id: string): Promise<Notification>;

  /**
   * Cancel a pending/scheduled notification.
   *
   * @param ctx - Tenant context
   * @param id - Notification ID
   * @returns The cancelled notification
   */
  cancel(ctx: TenantContext, id: string): Promise<Notification>;

  /**
   * Get count of unread notifications for a user.
   *
   * @param ctx - Tenant context
   * @param userId - User ID
   * @returns Count of unread notifications
   */
  getUnreadCount(ctx: TenantContext, userId: string): Promise<number>;
}
