// src/core/notifications/in-memory-notification.service.ts
//
// In-memory implementation of NotificationService for development and testing.

import { randomUUID } from 'crypto';
import { TenantContext } from '../tenancy/tenancy.types';
import {
  Notification,
  NotificationStatus,
  CreateNotificationInput,
  NotificationFilter,
} from './notification.types';
import { NotificationService } from './notification.service';

/**
 * Seed data for initializing the in-memory notification service.
 */
export interface InMemoryNotificationSeedData {
  notifications?: Notification[];
}

/**
 * In-memory implementation of NotificationService.
 *
 * Stores all notifications in memory. Useful for:
 * - Development without external services
 * - Unit and integration testing
 * - Demo environments
 *
 * In production, replace with an implementation that uses:
 * - Email provider (SendGrid, AWS SES, etc.)
 * - SMS gateway (Twilio, etc.)
 * - Push notification service
 *
 * @example
 * const service = new InMemoryNotificationService();
 * const notification = await service.send(ctx, {
 *   type: 'test',
 *   subject: 'Hello',
 *   body: 'Test message',
 * });
 */
export class InMemoryNotificationService implements NotificationService {
  private notifications: Map<string, Notification> = new Map();

  constructor(seed?: InMemoryNotificationSeedData) {
    if (seed?.notifications) {
      for (const n of seed.notifications) {
        this.notifications.set(n.id, n);
      }
    }
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
      channels: input.channels ?? ['in_app'],
      recipientUserId: input.recipientUserId,
      recipientEmail: input.recipientEmail,
      recipientPhone: input.recipientPhone,
      relatedEntityId: input.relatedEntityId,
      relatedEntityType: input.relatedEntityType,
      metadata: input.metadata,
      status: 'sent', // In-memory immediately "sends"
      createdAt: now,
      sentAt: now,
    };

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
      channels: input.channels ?? ['in_app'],
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

  // ---------- Test helpers ----------

  /**
   * Clear all notifications (for testing).
   */
  clear(): void {
    this.notifications.clear();
  }

  /**
   * Get all notifications regardless of tenant (for testing).
   */
  getAllNotifications(): Notification[] {
    return Array.from(this.notifications.values());
  }

  /**
   * Get notifications by type (for testing).
   */
  getByType(type: string): Notification[] {
    return Array.from(this.notifications.values()).filter((n) => n.type === type);
  }
}
