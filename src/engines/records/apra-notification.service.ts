// src/engines/records/apra-notification.service.ts
//
// APRA-specific notification service for deadline alerts and status updates.

import { TenantContext } from '../../core/tenancy/tenancy.types';
import { NotificationService } from '../../core/notifications/notification.service';
import { ApraService } from './apra.service';
import { ApraRequest, ApraRequestStatus } from './apra.types';

// ===========================================================================
// TYPES
// ===========================================================================

/**
 * Configuration for the APRA notification service.
 */
export interface ApraNotificationConfig {
  /** Number of days before deadline to send warning (default: 2) */
  warningDays: number;
  /** Number of days before deadline to send urgent warning (default: 1) */
  urgentDays: number;
  /** Default email for staff notifications */
  defaultStaffEmail?: string;
  /** Default user ID for staff notifications */
  defaultStaffUserId?: string;
}

/**
 * Default configuration.
 */
export const DEFAULT_APRA_NOTIFICATION_CONFIG: ApraNotificationConfig = {
  warningDays: 2,
  urgentDays: 1,
};

/**
 * Alert for a request approaching or past deadline.
 */
export interface DeadlineAlert {
  requestId: string;
  requesterName: string;
  statutoryDeadlineAt: string;
  status: ApraRequestStatus;
  daysRemaining: number;
}

/**
 * Result from checking deadlines.
 */
export interface DeadlineCheckResult {
  /** Number of requests checked */
  requestsChecked: number;
  /** Requests approaching deadline (within warning window) */
  approachingDeadline: DeadlineAlert[];
  /** Requests past deadline */
  pastDeadline: DeadlineAlert[];
  /** Number of notifications sent */
  notificationsSent: number;
  /** Timestamp of this check */
  checkedAt: string;
}

// ===========================================================================
// APRA NOTIFICATION SERVICE
// ===========================================================================

/**
 * APRA-specific notification service.
 *
 * Provides:
 * - Deadline checking and alerts (IC 5-14-3-9 7 business day requirement)
 * - Status change notifications
 * - New request notifications
 * - Clarification received notifications
 *
 * @example
 * const apraNotifications = new ApraNotificationService(
 *   apraService,
 *   notificationService
 * );
 *
 * // Check for approaching deadlines
 * const result = await apraNotifications.checkDeadlines(ctx);
 * console.log(`${result.notificationsSent} notifications sent`);
 */
export class ApraNotificationService {
  private config: ApraNotificationConfig;

  constructor(
    private readonly apraService: ApraService,
    private readonly notifications: NotificationService,
    config: Partial<ApraNotificationConfig> = {}
  ) {
    this.config = { ...DEFAULT_APRA_NOTIFICATION_CONFIG, ...config };
  }

  /**
   * Check all open requests for approaching or past deadlines.
   *
   * Sends notifications for requests within the warning window.
   *
   * @param ctx - Tenant context
   * @returns Summary of deadline check results
   */
  async checkDeadlines(ctx: TenantContext): Promise<DeadlineCheckResult> {
    // Get all open requests (not closed, fulfilled, or denied)
    const openStatuses: ApraRequestStatus[] = [
      'RECEIVED',
      'NEEDS_CLARIFICATION',
      'IN_REVIEW',
      'PARTIALLY_FULFILLED',
    ];

    const requests = await this.apraService.listRequests(ctx, {
      status: openStatuses,
    });

    const now = new Date();
    const approaching: DeadlineAlert[] = [];
    const pastDeadline: DeadlineAlert[] = [];
    let notificationsSent = 0;

    for (const summary of requests) {
      if (!summary.statutoryDeadlineAt) continue;

      const deadline = new Date(summary.statutoryDeadlineAt);
      const daysRemaining = this.calculateDaysRemaining(now, deadline);

      // Get full request for details
      const request = await this.apraService.getRequest(ctx, summary.id);
      if (!request) continue;

      const alert: DeadlineAlert = {
        requestId: request.id,
        requesterName: request.requesterName,
        statutoryDeadlineAt: request.statutoryDeadlineAt!,
        status: request.status,
        daysRemaining,
      };

      if (daysRemaining < 0) {
        pastDeadline.push(alert);
        await this.sendDeadlineNotification(ctx, request, 'past_due');
        notificationsSent++;
      } else if (daysRemaining <= this.config.urgentDays) {
        approaching.push(alert);
        await this.sendDeadlineNotification(ctx, request, 'urgent');
        notificationsSent++;
      } else if (daysRemaining <= this.config.warningDays) {
        approaching.push(alert);
        await this.sendDeadlineNotification(ctx, request, 'warning');
        notificationsSent++;
      }
    }

    return {
      requestsChecked: requests.length,
      approachingDeadline: approaching,
      pastDeadline,
      notificationsSent,
      checkedAt: now.toISOString(),
    };
  }

  /**
   * Notify staff of a new APRA request.
   *
   * @param ctx - Tenant context
   * @param request - The new request
   */
  async notifyNewRequest(ctx: TenantContext, request: ApraRequest): Promise<void> {
    await this.notifications.send(ctx, {
      type: 'apra_new_request',
      subject: `New APRA Request from ${request.requesterName}`,
      body: this.formatNewRequestBody(request),
      priority: 'normal',
      channels: ['email', 'in_app'],
      recipientUserId: this.config.defaultStaffUserId,
      recipientEmail: this.config.defaultStaffEmail,
      relatedEntityId: request.id,
      relatedEntityType: 'apra_request',
    });
  }

  /**
   * Notify staff of a status change.
   *
   * @param ctx - Tenant context
   * @param request - The updated request
   * @param oldStatus - Previous status
   */
  async notifyStatusChange(
    ctx: TenantContext,
    request: ApraRequest,
    oldStatus: ApraRequestStatus
  ): Promise<void> {
    await this.notifications.send(ctx, {
      type: 'apra_status_change',
      subject: `APRA Request Status Changed: ${oldStatus} → ${request.status}`,
      body: this.formatStatusChangeBody(request, oldStatus),
      priority: 'normal',
      channels: ['in_app'],
      recipientUserId: this.config.defaultStaffUserId,
      relatedEntityId: request.id,
      relatedEntityType: 'apra_request',
      metadata: { oldStatus, newStatus: request.status },
    });
  }

  /**
   * Notify staff that a clarification response was received.
   *
   * @param ctx - Tenant context
   * @param request - The request
   * @param clarificationResponse - The requester's response
   */
  async notifyClarificationReceived(
    ctx: TenantContext,
    request: ApraRequest,
    clarificationResponse: string
  ): Promise<void> {
    await this.notifications.send(ctx, {
      type: 'apra_clarification_received',
      subject: `Clarification Received: ${request.requesterName}`,
      body: this.formatClarificationReceivedBody(request, clarificationResponse),
      priority: 'high',
      channels: ['email', 'in_app'],
      recipientUserId: this.config.defaultStaffUserId,
      recipientEmail: this.config.defaultStaffEmail,
      relatedEntityId: request.id,
      relatedEntityType: 'apra_request',
    });
  }

  // ---------- Private helpers ----------

  private async sendDeadlineNotification(
    ctx: TenantContext,
    request: ApraRequest,
    urgency: 'warning' | 'urgent' | 'past_due'
  ): Promise<void> {
    const priority = urgency === 'past_due' ? 'urgent' : urgency === 'urgent' ? 'high' : 'normal';

    const subject = this.formatDeadlineSubject(request, urgency);
    const body = this.formatDeadlineBody(request, urgency);

    await this.notifications.send(ctx, {
      type: `apra_deadline_${urgency}`,
      subject,
      body,
      priority,
      channels: ['email', 'in_app'],
      recipientUserId: this.config.defaultStaffUserId,
      recipientEmail: this.config.defaultStaffEmail,
      relatedEntityId: request.id,
      relatedEntityType: 'apra_request',
      metadata: { urgency },
    });
  }

  private formatDeadlineSubject(
    request: ApraRequest,
    urgency: 'warning' | 'urgent' | 'past_due'
  ): string {
    switch (urgency) {
      case 'past_due':
        return `[OVERDUE] APRA Request ${request.id.slice(0, 8)} Past Deadline`;
      case 'urgent':
        return `[URGENT] APRA Request ${request.id.slice(0, 8)} Due Tomorrow`;
      case 'warning':
        return `APRA Request ${request.id.slice(0, 8)} Due in 2 Days`;
    }
  }

  private formatDeadlineBody(
    request: ApraRequest,
    urgency: 'warning' | 'urgent' | 'past_due'
  ): string {
    const deadlineDate = request.statutoryDeadlineAt
      ? new Date(request.statutoryDeadlineAt).toLocaleDateString()
      : 'Unknown';

    let intro: string;
    switch (urgency) {
      case 'past_due':
        intro = `The statutory deadline for this request has PASSED.`;
        break;
      case 'urgent':
        intro = `This request is due TOMORROW per IC 5-14-3-9.`;
        break;
      case 'warning':
        intro = `This request is due in 2 days per IC 5-14-3-9.`;
        break;
    }

    return `${intro}

Request ID: ${request.id}
Requester: ${request.requesterName}
Received: ${new Date(request.receivedAt).toLocaleDateString()}
Deadline: ${deadlineDate}
Status: ${request.status}

Description:
"${request.description}"

Please take action to ensure timely response.`;
  }

  private formatNewRequestBody(request: ApraRequest): string {
    return `A new public records request has been received.

Request ID: ${request.id}
Requester: ${request.requesterName}
${request.requesterEmail ? `Email: ${request.requesterEmail}` : ''}
Received: ${new Date(request.receivedAt).toLocaleDateString()}
Deadline: ${request.statutoryDeadlineAt ? new Date(request.statutoryDeadlineAt).toLocaleDateString() : 'Not set'}

Description:
"${request.description}"

Per IC 5-14-3-9, you have 7 business days to respond.`;
  }

  private formatStatusChangeBody(
    request: ApraRequest,
    oldStatus: ApraRequestStatus
  ): string {
    return `Request ID: ${request.id}
Requester: ${request.requesterName}
Status: ${oldStatus} → ${request.status}
Updated: ${new Date(request.updatedAt).toLocaleString()}`;
  }

  private formatClarificationReceivedBody(
    request: ApraRequest,
    clarificationResponse: string
  ): string {
    return `The requester has responded to a clarification request.

Request ID: ${request.id}
Requester: ${request.requesterName}

Clarification Response:
"${clarificationResponse}"

Note: The 7-day deadline clock restarts from the clarification response date per IC 5-14-3-9(b).`;
  }

  /**
   * Calculate days remaining until deadline.
   * Returns negative number if past deadline.
   */
  private calculateDaysRemaining(now: Date, deadline: Date): number {
    const msPerDay = 24 * 60 * 60 * 1000;
    const diffMs = deadline.getTime() - now.getTime();
    return Math.floor(diffMs / msPerDay);
  }
}
