// src/engines/weed-control/in-memory-weed-control.service.ts

import { randomUUID } from 'crypto';
import { TenantContext } from '../../core/tenancy/tenancy.types';
import {
  WeedComplaint,
  WeedComplaintSummary,
  WeedNotice,
  WeedInspection,
  WeedAbatement,
} from './weed-control.types';
import {
  WeedControlService,
  CreateWeedComplaintInput,
  UpdateWeedComplaintInput,
  SendWeedNoticeInput,
  RecordWeedInspectionInput,
  RecordWeedAbatementInput,
  CertifyCostsInput,
  WeedComplaintFilter,
  WeedControlStatistics,
} from './weed-control.service';

/**
 * Seed data structure for in-memory service.
 */
export interface InMemoryWeedControlSeedData {
  complaints?: WeedComplaint[];
  notices?: WeedNotice[];
  inspections?: WeedInspection[];
  abatements?: WeedAbatement[];
}

/**
 * In-memory implementation of the Weed Control service.
 * Used for testing and demo purposes.
 *
 * TODO: Implement PostgresWeedControlService for production use.
 */
export class InMemoryWeedControlService implements WeedControlService {
  private complaints: WeedComplaint[];
  private notices: WeedNotice[];
  private inspections: WeedInspection[];
  private abatements: WeedAbatement[];
  private caseCounter: Map<string, number> = new Map();

  constructor(seed: InMemoryWeedControlSeedData = {}) {
    this.complaints = seed.complaints ? [...seed.complaints] : [];
    this.notices = seed.notices ? [...seed.notices] : [];
    this.inspections = seed.inspections ? [...seed.inspections] : [];
    this.abatements = seed.abatements ? [...seed.abatements] : [];
  }

  //
  // COMPLAINTS
  //

  async createComplaint(
    ctx: TenantContext,
    input: CreateWeedComplaintInput
  ): Promise<WeedComplaint> {
    const now = new Date();
    const caseNumber = this.generateCaseNumber(ctx.tenantId);

    const complaint: WeedComplaint = {
      id: randomUUID(),
      tenantId: ctx.tenantId,
      caseNumber,
      violationType: input.violationType,
      status: 'complaint_received',
      complainantName: input.complainantName,
      complainantPhone: input.complainantPhone,
      complainantEmail: input.complainantEmail,
      isAnonymous: input.isAnonymous ?? false,
      propertyOwnerName: input.propertyOwnerName,
      propertyOwnerAddressLine1: input.propertyOwnerAddressLine1,
      propertyOwnerAddressLine2: input.propertyOwnerAddressLine2,
      propertyOwnerCity: input.propertyOwnerCity,
      propertyOwnerState: input.propertyOwnerState,
      propertyOwnerPostalCode: input.propertyOwnerPostalCode,
      siteAddressLine1: input.siteAddressLine1,
      siteAddressLine2: input.siteAddressLine2,
      siteCity: input.siteCity,
      siteState: input.siteState,
      sitePostalCode: input.sitePostalCode,
      parcelNumber: input.parcelNumber,
      violationDescription: input.violationDescription,
      complaintReceivedAt: now,
      notes: input.notes,
      createdAt: now,
    };

    this.complaints.push(complaint);
    return complaint;
  }

  async getComplaint(
    ctx: TenantContext,
    id: string
  ): Promise<WeedComplaint | null> {
    return (
      this.complaints.find(
        (c) => c.id === id && c.tenantId === ctx.tenantId
      ) ?? null
    );
  }

  async listComplaints(
    ctx: TenantContext,
    filter?: WeedComplaintFilter
  ): Promise<WeedComplaintSummary[]> {
    let results = this.complaints.filter((c) => c.tenantId === ctx.tenantId);

    if (filter?.status) {
      results = results.filter((c) => c.status === filter.status);
    }
    if (filter?.violationType) {
      results = results.filter((c) => c.violationType === filter.violationType);
    }
    if (filter?.propertyOwnerNameContains) {
      const search = filter.propertyOwnerNameContains.toLowerCase();
      results = results.filter((c) =>
        c.propertyOwnerName?.toLowerCase().includes(search)
      );
    }
    if (filter?.siteAddressContains) {
      const search = filter.siteAddressContains.toLowerCase();
      results = results.filter((c) =>
        c.siteAddressLine1?.toLowerCase().includes(search)
      );
    }
    if (filter?.fromDate) {
      results = results.filter(
        (c) => new Date(c.complaintReceivedAt) >= filter.fromDate!
      );
    }
    if (filter?.toDate) {
      results = results.filter(
        (c) => new Date(c.complaintReceivedAt) <= filter.toDate!
      );
    }
    if (filter?.hasOverdueDeadline) {
      const now = new Date();
      results = results.filter(
        (c) =>
          c.abatementDeadlineAt &&
          new Date(c.abatementDeadlineAt) < now &&
          !['complied', 'closed', 'cost_recovered'].includes(c.status)
      );
    }

    return results.map((c) => this.toComplaintSummary(c));
  }

  async updateComplaint(
    ctx: TenantContext,
    id: string,
    input: UpdateWeedComplaintInput
  ): Promise<WeedComplaint> {
    const complaint = this.complaints.find(
      (c) => c.id === id && c.tenantId === ctx.tenantId
    );
    if (!complaint) {
      throw new Error(`Complaint not found: ${id}`);
    }

    Object.assign(complaint, input, { updatedAt: new Date() });
    return complaint;
  }

  async markComplied(
    ctx: TenantContext,
    complaintId: string,
    notes?: string
  ): Promise<WeedComplaint> {
    const complaint = this.complaints.find(
      (c) => c.id === complaintId && c.tenantId === ctx.tenantId
    );
    if (!complaint) {
      throw new Error(`Complaint not found: ${complaintId}`);
    }

    complaint.status = 'complied';
    if (notes) {
      complaint.notes = complaint.notes
        ? `${complaint.notes}\n\nComplied: ${notes}`
        : `Complied: ${notes}`;
    }
    complaint.updatedAt = new Date();
    return complaint;
  }

  async closeComplaint(
    ctx: TenantContext,
    complaintId: string,
    reason?: string
  ): Promise<WeedComplaint> {
    const complaint = this.complaints.find(
      (c) => c.id === complaintId && c.tenantId === ctx.tenantId
    );
    if (!complaint) {
      throw new Error(`Complaint not found: ${complaintId}`);
    }

    complaint.status = 'closed';
    complaint.closedAt = new Date();
    if (reason) {
      complaint.notes = complaint.notes
        ? `${complaint.notes}\n\nClosed: ${reason}`
        : `Closed: ${reason}`;
    }
    complaint.updatedAt = new Date();
    return complaint;
  }

  //
  // NOTICES
  //

  async sendNotice(
    ctx: TenantContext,
    input: SendWeedNoticeInput
  ): Promise<WeedNotice> {
    // Verify complaint belongs to tenant
    const complaint = await this.getComplaint(ctx, input.complaintId);
    if (!complaint) {
      throw new Error(`Complaint not found: ${input.complaintId}`);
    }

    const now = new Date();
    const complianceDeadline = new Date(now);
    complianceDeadline.setDate(
      complianceDeadline.getDate() + input.complianceDeadlineDays
    );

    const notice: WeedNotice = {
      id: randomUUID(),
      complaintId: input.complaintId,
      noticeType: input.noticeType,
      deliveryMethod: input.deliveryMethod,
      sentAt: now,
      sentToName: input.sentToName,
      sentToAddress: input.sentToAddress,
      complianceDeadlineAt: complianceDeadline,
      trackingNumber: input.trackingNumber,
      noticeContent: input.noticeContent,
      statutoryCitation: input.statutoryCitation ?? 'IC 15-16-8',
      createdAt: now,
    };

    this.notices.push(notice);

    // Update complaint
    complaint.status = 'notice_sent';
    complaint.abatementDeadlineAt = complianceDeadline;
    complaint.updatedAt = now;

    return notice;
  }

  async listNoticesForComplaint(
    ctx: TenantContext,
    complaintId: string
  ): Promise<WeedNotice[]> {
    // Verify complaint belongs to tenant
    const complaint = await this.getComplaint(ctx, complaintId);
    if (!complaint) {
      throw new Error(`Complaint not found: ${complaintId}`);
    }
    return this.notices.filter((n) => n.complaintId === complaintId);
  }

  async recordNoticeDelivery(
    ctx: TenantContext,
    noticeId: string,
    deliveryConfirmedAt: Date
  ): Promise<WeedNotice> {
    const notice = this.notices.find((n) => n.id === noticeId);
    if (!notice) {
      throw new Error(`Notice not found: ${noticeId}`);
    }

    // Verify complaint belongs to tenant
    const complaint = await this.getComplaint(ctx, notice.complaintId);
    if (!complaint) {
      throw new Error(`Notice not authorized: ${noticeId}`);
    }

    notice.deliveryConfirmedAt = deliveryConfirmedAt;
    return notice;
  }

  async recordNoticeReturned(
    ctx: TenantContext,
    noticeId: string
  ): Promise<WeedNotice> {
    const notice = this.notices.find((n) => n.id === noticeId);
    if (!notice) {
      throw new Error(`Notice not found: ${noticeId}`);
    }

    // Verify complaint belongs to tenant
    const complaint = await this.getComplaint(ctx, notice.complaintId);
    if (!complaint) {
      throw new Error(`Notice not authorized: ${noticeId}`);
    }

    notice.returnedUndeliverable = true;
    return notice;
  }

  //
  // INSPECTIONS
  //

  async recordInspection(
    ctx: TenantContext,
    input: RecordWeedInspectionInput
  ): Promise<WeedInspection> {
    // Verify complaint belongs to tenant
    const complaint = this.complaints.find(
      (c) => c.id === input.complaintId && c.tenantId === ctx.tenantId
    );
    if (!complaint) {
      throw new Error(`Complaint not found: ${input.complaintId}`);
    }

    const now = new Date();
    const inspection: WeedInspection = {
      id: randomUUID(),
      complaintId: input.complaintId,
      inspectionDate: input.inspectionDate ?? now,
      inspectorName: input.inspectorName,
      isCompliant: input.isCompliant,
      findingsDescription: input.findingsDescription,
      photoAttachmentIds: input.photoAttachmentIds,
      createdAt: now,
    };

    this.inspections.push(inspection);

    // Update complaint status based on compliance
    if (input.isCompliant) {
      complaint.status = 'complied';
    } else {
      complaint.status = 'non_compliant';
    }
    complaint.updatedAt = now;

    return inspection;
  }

  async listInspectionsForComplaint(
    ctx: TenantContext,
    complaintId: string
  ): Promise<WeedInspection[]> {
    // Verify complaint belongs to tenant
    const complaint = await this.getComplaint(ctx, complaintId);
    if (!complaint) {
      throw new Error(`Complaint not found: ${complaintId}`);
    }
    return this.inspections.filter((i) => i.complaintId === complaintId);
  }

  //
  // ABATEMENT
  //

  async recordAbatement(
    ctx: TenantContext,
    input: RecordWeedAbatementInput
  ): Promise<WeedAbatement> {
    // Verify complaint belongs to tenant
    const complaint = this.complaints.find(
      (c) => c.id === input.complaintId && c.tenantId === ctx.tenantId
    );
    if (!complaint) {
      throw new Error(`Complaint not found: ${input.complaintId}`);
    }

    const now = new Date();
    const totalCostCents =
      input.laborCostCents +
      input.equipmentCostCents +
      input.materialsCostCents +
      input.administrativeCostCents;

    const abatement: WeedAbatement = {
      id: randomUUID(),
      complaintId: input.complaintId,
      abatementDate: input.abatementDate ?? now,
      performedBy: input.performedBy,
      workDescription: input.workDescription,
      laborCostCents: input.laborCostCents,
      equipmentCostCents: input.equipmentCostCents,
      materialsCostCents: input.materialsCostCents,
      administrativeCostCents: input.administrativeCostCents,
      totalCostCents,
      notes: input.notes,
      createdAt: now,
    };

    this.abatements.push(abatement);

    // Update complaint
    complaint.status = 'abatement_completed';
    complaint.updatedAt = now;

    return abatement;
  }

  async getAbatementForComplaint(
    ctx: TenantContext,
    complaintId: string
  ): Promise<WeedAbatement | null> {
    // Verify complaint belongs to tenant
    const complaint = await this.getComplaint(ctx, complaintId);
    if (!complaint) {
      throw new Error(`Complaint not found: ${complaintId}`);
    }
    return this.abatements.find((a) => a.complaintId === complaintId) ?? null;
  }

  async certifyCostsToCounty(
    ctx: TenantContext,
    input: CertifyCostsInput
  ): Promise<WeedAbatement> {
    const abatement = this.abatements.find((a) => a.id === input.abatementId);
    if (!abatement) {
      throw new Error(`Abatement not found: ${input.abatementId}`);
    }

    // Verify complaint belongs to tenant
    const complaint = await this.getComplaint(ctx, abatement.complaintId);
    if (!complaint) {
      throw new Error(`Abatement not authorized: ${input.abatementId}`);
    }

    abatement.certifiedToCountyAt = input.certificationDate ?? new Date();
    abatement.countyRecordingReference = input.countyRecordingReference;

    // Update complaint
    complaint.status = 'cost_recovery_pending';
    complaint.updatedAt = new Date();

    return abatement;
  }

  async recordCostRecovery(
    ctx: TenantContext,
    abatementId: string,
    recoveryAmountCents: number,
    recoveredAt?: Date
  ): Promise<WeedAbatement> {
    const abatement = this.abatements.find((a) => a.id === abatementId);
    if (!abatement) {
      throw new Error(`Abatement not found: ${abatementId}`);
    }

    // Verify complaint belongs to tenant
    const complaint = await this.getComplaint(ctx, abatement.complaintId);
    if (!complaint) {
      throw new Error(`Abatement not authorized: ${abatementId}`);
    }

    abatement.recoveredAt = recoveredAt ?? new Date();
    abatement.recoveryAmountCents = recoveryAmountCents;

    // Update complaint
    complaint.status = 'cost_recovered';
    complaint.updatedAt = new Date();

    return abatement;
  }

  //
  // REPORTING
  //

  async getOverdueComplaints(
    ctx: TenantContext
  ): Promise<WeedComplaintSummary[]> {
    return this.listComplaints(ctx, { hasOverdueDeadline: true });
  }

  async getCaseStatistics(
    ctx: TenantContext,
    year?: number
  ): Promise<WeedControlStatistics> {
    let complaints = this.complaints.filter((c) => c.tenantId === ctx.tenantId);

    if (year) {
      complaints = complaints.filter(
        (c) => new Date(c.complaintReceivedAt).getFullYear() === year
      );
    }

    const abatements = this.abatements.filter((a) =>
      complaints.some((c) => c.id === a.complaintId)
    );

    return {
      totalComplaints: complaints.length,
      complaintsComplied: complaints.filter((c) => c.status === 'complied')
        .length,
      complaintsAbated: complaints.filter(
        (c) =>
          c.status === 'abatement_completed' ||
          c.status === 'cost_recovery_pending' ||
          c.status === 'cost_recovered'
      ).length,
      complaintsClosed: complaints.filter((c) => c.status === 'closed').length,
      totalAbatementCostsCents: abatements.reduce(
        (sum, a) => sum + a.totalCostCents,
        0
      ),
      totalRecoveredCents: abatements.reduce(
        (sum, a) => sum + (a.recoveryAmountCents ?? 0),
        0
      ),
    };
  }

  //
  // HELPERS
  //

  private generateCaseNumber(tenantId: string): string {
    const year = new Date().getFullYear();
    const count = (this.caseCounter.get(tenantId) ?? 0) + 1;
    this.caseCounter.set(tenantId, count);
    return `WC-${year}-${count.toString().padStart(4, '0')}`;
  }

  private toComplaintSummary(complaint: WeedComplaint): WeedComplaintSummary {
    return {
      id: complaint.id,
      tenantId: complaint.tenantId,
      caseNumber: complaint.caseNumber,
      violationType: complaint.violationType,
      status: complaint.status,
      siteAddressLine1: complaint.siteAddressLine1,
      propertyOwnerName: complaint.propertyOwnerName,
      complaintReceivedAt: complaint.complaintReceivedAt,
      abatementDeadlineAt: complaint.abatementDeadlineAt,
    };
  }
}
