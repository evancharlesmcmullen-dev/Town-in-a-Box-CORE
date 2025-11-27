// src/core/notifications/in-memory-notification.service.ts
//
// In-memory implementation of NotificationService for testing and development.

import { randomUUID } from 'crypto';
import { TenantContext } from '../tenancy/tenancy.types';
import {
  Notification,
  CreateNotificationInput,
  NotificationDeliveryStatus,
  NotificationPreferences,
  NotificationChannel,
} from './notification.types';
import { NotificationService, NotificationFilter } from './notification.service';

/**
 * Seed data for initializing the in-memory service.
 */
export interface InMemoryNotificationSeedData {
  notifications?: Notification[];
  deliveryStatuses?: NotificationDeliveryStatus[];
  preferences?: NotificationPreferences[];
}

/**
 * Callback type for notification delivery.
 * Used for testing or integrating with external services.
 */
export type NotificationDeliveryCallback = (
  notification: Notification,
  channel: NotificationChannel
) => Promise<{ success: boolean; error?: string }>;

/**
 * In-memory NotificationService implementation.
 *
 * For testing and development. In production, replace with a service
 * that integrates with email providers (SendGrid, SES), SMS providers
 * (Twilio), and push notification services.
 */
export class InMemoryNotificationService implements NotificationService {
  private notifications: Notification[] = [];
  private deliveryStatuses: NotificationDeliveryStatus[] = [];
  private preferences: NotificationPreferences[] = [];
  private deliveryCallback?: NotificationDeliveryCallback;

  constructor(
    seed: InMemoryNotificationSeedData = {},
    deliveryCallback?: NotificationDeliveryCallback
  ) {
    this.notifications = seed.notifications ? [...seed.notifications] : [];
    this.deliveryStatuses = seed.deliveryStatuses ? [...seed.deliveryStatuses] : [];
    this.preferences = seed.preferences ? [...seed.preferences] : [];
    this.deliveryCallback = deliveryCallback;
  }

  /**
   * Set the delivery callback for testing.
   */
  setDeliveryCallback(callback: NotificationDeliveryCallback): void {
    this.deliveryCallback = callback;
  }

  async createNotification(
    ctx: TenantContext,
    input: CreateNotificationInput
  ): Promise<Notification> {
    const now = new Date();
    const notification: Notification = {
      id: randomUUID(),
      tenantId: ctx.tenantId,
      category: input.category,
      priority: input.priority ?? 'MEDIUM',
      title: input.title,
      body: input.body,
      recipientUserIds: input.recipientUserIds,
      recipientEmails: input.recipientEmails,
      channels: input.channels ?? ['EMAIL', 'IN_APP'],
      referenceId: input.referenceId,
      referenceType: input.referenceType,
      createdAt: now.toISOString(),
      scheduledAt: input.scheduledAt,
      metadata: input.metadata,
    };

    this.notifications.push(notification);

    // If not scheduled for later, send immediately
    if (!input.scheduledAt || new Date(input.scheduledAt) <= now) {
      await this.deliverNotification(notification);
    }

    return notification;
  }

  async getNotification(
    ctx: TenantContext,
    id: string
  ): Promise<Notification | null> {
    return this.notifications.find(
      n => n.id === id && n.tenantId === ctx.tenantId
    ) ?? null;
  }

  async listNotifications(
    ctx: TenantContext,
    filter?: NotificationFilter
  ): Promise<Notification[]> {
    let results = this.notifications.filter(n => n.tenantId === ctx.tenantId);

    if (filter?.category) {
      results = results.filter(n => n.category === filter.category);
    }

    if (filter?.referenceId) {
      results = results.filter(n => n.referenceId === filter.referenceId);
    }

    if (filter?.sentOnly) {
      results = results.filter(n => n.sentAt !== undefined);
    }

    if (filter?.pendingOnly) {
      results = results.filter(n => n.sentAt === undefined);
    }

    if (filter?.fromDate) {
      const fromIso = filter.fromDate.toISOString();
      results = results.filter(n => n.createdAt >= fromIso);
    }

    if (filter?.toDate) {
      const toIso = filter.toDate.toISOString();
      results = results.filter(n => n.createdAt <= toIso);
    }

    return results.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async cancelNotification(
    ctx: TenantContext,
    id: string
  ): Promise<boolean> {
    const notification = this.notifications.find(
      n => n.id === id && n.tenantId === ctx.tenantId
    );

    if (!notification || notification.sentAt) {
      return false;
    }

    // Remove the notification
    const index = this.notifications.indexOf(notification);
    if (index > -1) {
      this.notifications.splice(index, 1);
    }

    return true;
  }

  async sendNow(
    ctx: TenantContext,
    id: string
  ): Promise<NotificationDeliveryStatus[]> {
    const notification = this.notifications.find(
      n => n.id === id && n.tenantId === ctx.tenantId
    );

    if (!notification) {
      throw new Error('Notification not found');
    }

    if (notification.sentAt) {
      // Already sent, return existing statuses
      return this.deliveryStatuses.filter(s => s.notificationId === id);
    }

    return this.deliverNotification(notification);
  }

  async getDeliveryStatus(
    ctx: TenantContext,
    notificationId: string
  ): Promise<NotificationDeliveryStatus[]> {
    const notification = this.notifications.find(
      n => n.id === notificationId && n.tenantId === ctx.tenantId
    );

    if (!notification) {
      throw new Error('Notification not found');
    }

    return this.deliveryStatuses.filter(s => s.notificationId === notificationId);
  }

  async getPreferences(
    ctx: TenantContext,
    userId: string
  ): Promise<NotificationPreferences> {
    const existing = this.preferences.find(
      p => p.userId === userId && p.tenantId === ctx.tenantId
    );

    if (existing) {
      return existing;
    }

    // Return default preferences
    return {
      userId,
      tenantId: ctx.tenantId,
      enabledChannels: ['EMAIL', 'IN_APP'],
      categoryPreferences: [],
    };
  }

  async updatePreferences(
    ctx: TenantContext,
    preferences: Partial<NotificationPreferences> & { userId: string }
  ): Promise<NotificationPreferences> {
    const existingIndex = this.preferences.findIndex(
      p => p.userId === preferences.userId && p.tenantId === ctx.tenantId
    );

    const updated: NotificationPreferences = {
      userId: preferences.userId,
      tenantId: ctx.tenantId,
      enabledChannels: preferences.enabledChannels ?? ['EMAIL', 'IN_APP'],
      categoryPreferences: preferences.categoryPreferences ?? [],
      notificationEmail: preferences.notificationEmail,
      smsPhoneNumber: preferences.smsPhoneNumber,
      quietHours: preferences.quietHours,
    };

    if (existingIndex >= 0) {
      this.preferences[existingIndex] = updated;
    } else {
      this.preferences.push(updated);
    }

    return updated;
  }

  async processScheduledNotifications(ctx: TenantContext): Promise<number> {
    const now = new Date();
    const nowIso = now.toISOString();

    const pending = this.notifications.filter(
      n =>
        n.tenantId === ctx.tenantId &&
        !n.sentAt &&
        n.scheduledAt &&
        n.scheduledAt <= nowIso
    );

    let sentCount = 0;
    for (const notification of pending) {
      await this.deliverNotification(notification);
      sentCount++;
    }

    return sentCount;
  }

  /**
   * Internal method to deliver a notification.
   */
  private async deliverNotification(
    notification: Notification
  ): Promise<NotificationDeliveryStatus[]> {
    const now = new Date();
    const statuses: NotificationDeliveryStatus[] = [];

    for (const channel of notification.channels) {
      let status: NotificationDeliveryStatus;

      if (this.deliveryCallback) {
        try {
          const result = await this.deliveryCallback(notification, channel);
          status = {
            notificationId: notification.id,
            channel,
            status: result.success ? 'SENT' : 'FAILED',
            attemptedAt: now.toISOString(),
            deliveredAt: result.success ? now.toISOString() : undefined,
            failureReason: result.error,
          };
        } catch (error) {
          status = {
            notificationId: notification.id,
            channel,
            status: 'FAILED',
            attemptedAt: now.toISOString(),
            failureReason: error instanceof Error ? error.message : 'Unknown error',
          };
        }
      } else {
        // In-memory mock: always succeeds
        status = {
          notificationId: notification.id,
          channel,
          status: 'SENT',
          attemptedAt: now.toISOString(),
          deliveredAt: now.toISOString(),
        };
      }

      statuses.push(status);
      this.deliveryStatuses.push(status);
    }

    // Mark notification as sent
    notification.sentAt = now.toISOString();

    return statuses;
  }

  /**
   * Get all stored notifications (for testing).
   */
  getAllNotifications(): Notification[] {
    return [...this.notifications];
  }

  /**
   * Clear all data (for testing).
   */
  clear(): void {
    this.notifications = [];
    this.deliveryStatuses = [];
    this.preferences = [];
  }
}
