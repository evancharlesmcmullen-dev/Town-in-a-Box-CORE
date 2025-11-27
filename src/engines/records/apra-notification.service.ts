// src/engines/records/apra-notification.service.ts
//
// APRA-specific notification service for deadline alerts.
// Integrates ApraService with NotificationService to send:
// - Deadline approaching alerts (3 days, 1 day, overdue)
// - Status change notifications
// - Clarification received alerts

import { TenantContext } from '../../core/tenancy/tenancy.types';
import { NotificationService } from '../../core/notifications/notification.service';
import { CreateNotificationInput, NotificationPriority } from '../../core/notifications/notification.types';
import { ApraService } from './apra.service';
import { ApraRequest, ApraRequestStatus } from './apra.types';

/**
 * Configuration for APRA notifications.
 */
export interface ApraNotificationConfig {
  /** Days before deadline to send first warning (default: 3) */
  firstWarningDays?: number;
  /** Days before deadline to send urgent warning (default: 1) */
  urgentWarningDays?: number;
  /** Whether to send notifications for status changes (default: true) */
  notifyOnStatusChange?: boolean;
  /** Whether to send notifications for new requests (default: true) */
  notifyOnNewRequest?: boolean;
  /** User IDs who should receive APRA notifications */
  recipientUserIds: string[];
  /** Email addresses who should receive APRA notifications */
  recipientEmails?: string[];
}

/**
 * Result of checking and sending deadline notifications.
 */
export interface DeadlineCheckResult {
  /** Number of requests checked */
  requestsChecked: number;
  /** Number of notifications sent */
  notificationsSent: number;
  /** Details of notifications sent */
  notifications: {
    requestId: string;
    requesterName: string;
    daysUntilDeadline: number;
    priority: NotificationPriority;
  }[];
}

/**
 * Service for managing APRA-related notifications.
 *
 * This service:
 * - Checks for approaching deadlines and sends warnings
 * - Sends notifications on status changes
 * - Integrates with the generic NotificationService
 *
 * @example
 * const apraNotifications = new ApraNotificationService(
 *   apraService,
 *   notificationService,
 *   { recipientUserIds: ['clerk-id-1'] }
 * );
 *
 * // Run daily to check for approaching deadlines
 * const result = await apraNotifications.checkDeadlines(ctx);
 * console.log(`Sent ${result.notificationsSent} deadline warnings`);
 */
export class ApraNotificationService {
  private readonly config: Required<ApraNotificationConfig>;

  constructor(
    private readonly apraService: ApraService,
    private readonly notificationService: NotificationService,
    config: ApraNotificationConfig
  ) {
    this.config = {
      firstWarningDays: config.firstWarningDays ?? 3,
      urgentWarningDays: config.urgentWarningDays ?? 1,
      notifyOnStatusChange: config.notifyOnStatusChange ?? true,
      notifyOnNewRequest: config.notifyOnNewRequest ?? true,
      recipientUserIds: config.recipientUserIds,
      recipientEmails: config.recipientEmails ?? [],
    };
  }

  /**
   * Check all active requests for approaching deadlines and send notifications.
   *
   * Should be called periodically (e.g., daily) to catch approaching deadlines.
   *
   * @param ctx - Tenant context
   * @returns Summary of checks and notifications sent
   */
  async checkDeadlines(ctx: TenantContext): Promise<DeadlineCheckResult> {
    const now = new Date();
    const result: DeadlineCheckResult = {
      requestsChecked: 0,
      notificationsSent: 0,
      notifications: [],
    };

    // Get all active requests (not fulfilled, denied, or closed)
    const activeStatuses: ApraRequestStatus[] = [
      'RECEIVED',
      'IN_REVIEW',
      'NEEDS_CLARIFICATION',
      'PARTIALLY_FULFILLED',
    ];

    const requests = await this.apraService.listRequests(ctx, {
      status: activeStatuses,
    });

    result.requestsChecked = requests.length;

    for (const summary of requests) {
      if (!summary.statutoryDeadlineAt) {
        continue;
      }

      const request = await this.apraService.getRequest(ctx, summary.id);
      if (!request) {
        continue;
      }

      const deadline = new Date(request.statutoryDeadlineAt!);
      const daysUntilDeadline = Math.ceil(
        (deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
      );

      // Determine if notification is needed and at what priority
      const shouldNotify = this.shouldSendDeadlineNotification(daysUntilDeadline);
      if (!shouldNotify) {
        continue;
      }

      const priority = this.getDeadlinePriority(daysUntilDeadline);
      await this.sendDeadlineNotification(ctx, request, daysUntilDeadline, priority);

      result.notificationsSent++;
      result.notifications.push({
        requestId: request.id,
        requesterName: request.requesterName,
        daysUntilDeadline,
        priority,
      });
    }

    return result;
  }

  /**
   * Send notification when a new APRA request is received.
   *
   * @param ctx - Tenant context
   * @param request - The new request
   */
  async notifyNewRequest(ctx: TenantContext, request: ApraRequest): Promise<void> {
    if (!this.config.notifyOnNewRequest) {
      return;
    }

    const deadline = request.statutoryDeadlineAt
      ? new Date(request.statutoryDeadlineAt).toLocaleDateString()
      : 'Not set';

    const input: CreateNotificationInput = {
      category: 'APRA_STATUS',
      priority: 'MEDIUM',
      title: `New APRA Request: ${request.requesterName}`,
      body: `A new APRA request has been received.

**Requester:** ${request.requesterName}
**Received:** ${new Date(request.receivedAt).toLocaleDateString()}
**Deadline:** ${deadline}

**Request:**
${request.description}

Please review and begin processing within the statutory deadline.`,
      recipientUserIds: this.config.recipientUserIds,
      recipientEmails: this.config.recipientEmails,
      referenceId: request.id,
      referenceType: 'APRA_REQUEST',
      metadata: {
        requestId: request.id,
        requesterName: request.requesterName,
        event: 'NEW_REQUEST',
      },
    };

    await this.notificationService.createNotification(ctx, input);
  }

  /**
   * Send notification when a request's status changes.
   *
   * @param ctx - Tenant context
   * @param request - The request
   * @param oldStatus - Previous status
   * @param newStatus - New status
   * @param note - Optional note about the change
   */
  async notifyStatusChange(
    ctx: TenantContext,
    request: ApraRequest,
    oldStatus: ApraRequestStatus,
    newStatus: ApraRequestStatus,
    note?: string
  ): Promise<void> {
    if (!this.config.notifyOnStatusChange) {
      return;
    }

    const statusDescriptions: Record<ApraRequestStatus, string> = {
      RECEIVED: 'Received',
      NEEDS_CLARIFICATION: 'Needs Clarification',
      IN_REVIEW: 'In Review',
      PARTIALLY_FULFILLED: 'Partially Fulfilled',
      FULFILLED: 'Fulfilled',
      DENIED: 'Denied',
      CLOSED: 'Closed',
    };

    const input: CreateNotificationInput = {
      category: 'APRA_STATUS',
      priority: this.getStatusChangePriority(newStatus),
      title: `APRA Status Change: ${statusDescriptions[newStatus]}`,
      body: `APRA request status has been updated.

**Request ID:** ${request.id}
**Requester:** ${request.requesterName}
**Status Changed:** ${statusDescriptions[oldStatus]} → ${statusDescriptions[newStatus]}
${note ? `\n**Note:** ${note}` : ''}

${this.getStatusChangeGuidance(newStatus)}`,
      recipientUserIds: this.config.recipientUserIds,
      recipientEmails: this.config.recipientEmails,
      referenceId: request.id,
      referenceType: 'APRA_REQUEST',
      metadata: {
        requestId: request.id,
        requesterName: request.requesterName,
        oldStatus,
        newStatus,
        event: 'STATUS_CHANGE',
      },
    };

    await this.notificationService.createNotification(ctx, input);
  }

  /**
   * Send notification when clarification is received from requester.
   *
   * @param ctx - Tenant context
   * @param request - The request
   * @param clarificationText - The clarification provided
   */
  async notifyClarificationReceived(
    ctx: TenantContext,
    request: ApraRequest,
    clarificationText: string
  ): Promise<void> {
    const deadline = request.statutoryDeadlineAt
      ? new Date(request.statutoryDeadlineAt).toLocaleDateString()
      : 'Not set';

    const input: CreateNotificationInput = {
      category: 'APRA_STATUS',
      priority: 'HIGH',
      title: `Clarification Received: ${request.requesterName}`,
      body: `The requester has provided clarification for their APRA request.

**Request ID:** ${request.id}
**Requester:** ${request.requesterName}
**New Deadline:** ${deadline}

**Clarification:**
${clarificationText}

The statutory deadline has been reset. Please resume processing this request.`,
      recipientUserIds: this.config.recipientUserIds,
      recipientEmails: this.config.recipientEmails,
      referenceId: request.id,
      referenceType: 'APRA_REQUEST',
      metadata: {
        requestId: request.id,
        requesterName: request.requesterName,
        event: 'CLARIFICATION_RECEIVED',
      },
    };

    await this.notificationService.createNotification(ctx, input);
  }

  // ---------- Private helpers ----------

  private shouldSendDeadlineNotification(daysUntilDeadline: number): boolean {
    // Send if overdue or at warning thresholds
    return (
      daysUntilDeadline <= 0 ||
      daysUntilDeadline === this.config.urgentWarningDays ||
      daysUntilDeadline === this.config.firstWarningDays
    );
  }

  private getDeadlinePriority(daysUntilDeadline: number): NotificationPriority {
    if (daysUntilDeadline <= 0) {
      return 'URGENT';
    }
    if (daysUntilDeadline <= this.config.urgentWarningDays) {
      return 'HIGH';
    }
    return 'MEDIUM';
  }

  private async sendDeadlineNotification(
    ctx: TenantContext,
    request: ApraRequest,
    daysUntilDeadline: number,
    priority: NotificationPriority
  ): Promise<void> {
    const deadline = request.statutoryDeadlineAt
      ? new Date(request.statutoryDeadlineAt).toLocaleDateString()
      : 'Unknown';

    let title: string;
    let urgencyMessage: string;

    if (daysUntilDeadline <= 0) {
      title = `⚠️ APRA DEADLINE OVERDUE: ${request.requesterName}`;
      urgencyMessage = `**This request is ${Math.abs(daysUntilDeadline)} day(s) overdue!**

Per IC 5-14-3-9, the agency must respond within 7 business days. Failure to respond timely may result in legal consequences.`;
    } else if (daysUntilDeadline === 1) {
      title = `🔴 APRA Deadline Tomorrow: ${request.requesterName}`;
      urgencyMessage = `**The statutory deadline is TOMORROW.**

Please prioritize completing this request today to ensure timely compliance.`;
    } else {
      title = `🟡 APRA Deadline Approaching: ${request.requesterName}`;
      urgencyMessage = `**${daysUntilDeadline} business days until the statutory deadline.**

Please ensure this request is on track for timely completion.`;
    }

    const input: CreateNotificationInput = {
      category: 'APRA_DEADLINE',
      priority,
      title,
      body: `${urgencyMessage}

**Request ID:** ${request.id}
**Requester:** ${request.requesterName}
**Deadline:** ${deadline}
**Current Status:** ${request.status}

**Request:**
${request.description.substring(0, 500)}${request.description.length > 500 ? '...' : ''}`,
      recipientUserIds: this.config.recipientUserIds,
      recipientEmails: this.config.recipientEmails,
      referenceId: request.id,
      referenceType: 'APRA_REQUEST',
      metadata: {
        requestId: request.id,
        requesterName: request.requesterName,
        daysUntilDeadline,
        event: 'DEADLINE_WARNING',
      },
    };

    await this.notificationService.createNotification(ctx, input);
  }

  private getStatusChangePriority(newStatus: ApraRequestStatus): NotificationPriority {
    switch (newStatus) {
      case 'DENIED':
        return 'HIGH';
      case 'NEEDS_CLARIFICATION':
        return 'MEDIUM';
      case 'FULFILLED':
      case 'CLOSED':
        return 'LOW';
      default:
        return 'MEDIUM';
    }
  }

  private getStatusChangeGuidance(newStatus: ApraRequestStatus): string {
    switch (newStatus) {
      case 'NEEDS_CLARIFICATION':
        return 'The deadline clock is paused until the requester responds.';
      case 'IN_REVIEW':
        return 'Staff should search for and review responsive records.';
      case 'FULFILLED':
        return 'The request has been completed. No further action needed.';
      case 'DENIED':
        return 'Ensure the denial letter includes specific exemption citations per IC 5-14-3-4.';
      case 'CLOSED':
        return 'The request has been administratively closed.';
      default:
        return '';
    }
  }
}
