// src/core/dashboard/dashboard.types.ts
//
// Dashboard Snapshot Types
//
// Defines the structure for the "Clerk Cockpit" tenant dashboard snapshot.
// Aggregates Finance, Meetings, and APRA data into a single view.
//
// Design principles:
// - All types are plain data structures (no methods/behavior)
// - Optional fields for graceful degradation when modules aren't enabled
// - Extendable shape for future domain additions

import { TenantIdentity } from '../state/state.types';

// ============================================================================
// MAIN DASHBOARD SNAPSHOT
// ============================================================================

/**
 * High-level dashboard snapshot for a tenant.
 *
 * This is the root object for the "Clerk Cockpit" view.
 * It aggregates data from Finance, Meetings, and APRA modules.
 */
export interface TenantDashboardSnapshot {
  /** Tenant ID */
  tenantId: string;

  /** Tenant display name (e.g., "Town of Lapel") */
  tenantName: string;

  /** State code (e.g., "IN") */
  state: string;

  /** Entity class (e.g., "TOWN", "CITY", "TOWNSHIP") */
  entityClass: string;

  /** When this snapshot was generated */
  asOf: Date;

  /** Finance section data */
  finance: FinanceDashboardSection;

  /** Meetings section data */
  meetings: MeetingsDashboardSection;

  /** APRA (public records) section data */
  apra: ApraDashboardSection;
}

// ============================================================================
// FINANCE DASHBOARD SECTION
// ============================================================================

/**
 * A key fund's balance for dashboard display.
 * Shows the most important funds (General, MVH, etc.) at a glance.
 */
export interface KeyFundBalance {
  /** Fund ID */
  fundId: string;

  /** Fund code (e.g., "101", "201") */
  fundCode: string;

  /** Fund name (e.g., "General Fund", "Motor Vehicle Highway") */
  fundName: string;

  /** Current ending balance */
  endingBalance: number;
}

/**
 * Debt coverage alert for a fund that falls below requirements.
 * Surfaces years where debt service coverage ratio is a concern.
 */
export interface DebtCoverageAlert {
  /** Fund ID paying the debt service */
  fundId: string;

  /** Fund code */
  fundCode: string;

  /** Fund name */
  fundName: string;

  /** Calendar year of the concern */
  year: number;

  /** Calculated coverage ratio (revenue / debt service), null if N/A */
  coverageRatio: number | null;

  /** Minimum required coverage ratio from bond covenants */
  minCoverageRatio?: number;

  /** Whether the coverage meets the requirement (null if N/A) */
  meetsRequirement: boolean | null;
}

/**
 * Finance dashboard section.
 * Provides a high-level overview of the tenant's financial position.
 */
export interface FinanceDashboardSection {
  /** When this section's data was computed */
  asOf: Date;

  /** Total number of funds in the system */
  totalFunds: number;

  /** Key fund balances for dashboard display */
  keyFundBalances: KeyFundBalance[];

  /** Future years with debt coverage concerns */
  upcomingDebtCoverageConcerns: DebtCoverageAlert[];

  /** Additional notes or alerts */
  notes?: string[];
}

// ============================================================================
// MEETINGS DASHBOARD SECTION
// ============================================================================

/**
 * Summary of an upcoming meeting for dashboard display.
 */
export interface UpcomingMeetingSummary {
  /** Meeting ID */
  meetingId: string;

  /** Name of the governing body (e.g., "Town Council") */
  governingBodyName: string;

  /** Scheduled start time */
  scheduledStart: Date;

  /** Meeting location */
  location?: string;
}

/**
 * Meetings dashboard section.
 * Provides an overview of upcoming meetings and compliance info.
 */
export interface MeetingsDashboardSection {
  /** Number of upcoming meetings */
  upcomingMeetingsCount: number;

  /** Details of the next scheduled meeting, if any */
  nextMeeting?: UpcomingMeetingSummary;

  /** Required notice hours from config (e.g., 48 for Indiana Open Door Law) */
  noticeHoursRequirement?: number;

  /** Whether the tenant supports remote participation */
  supportsRemoteParticipation?: boolean;

  /** Additional notes or alerts */
  notes?: string[];
}

// ============================================================================
// APRA DASHBOARD SECTION
// ============================================================================

/**
 * Summary of an APRA request for dashboard display.
 */
export interface ApraRequestSummary {
  /** Request ID */
  requestId: string;

  /** Current status (e.g., "RECEIVED", "IN_REVIEW", "FULFILLED") */
  status: string;

  /** When the request was received */
  receivedAt: Date;

  /** Initial statutory due date (7 business days from received) */
  initialDueDate: Date;

  /** Extended due date, if an extension was granted */
  extendedDueDate?: Date;

  /** Days remaining until due (negative if overdue) */
  daysUntilDue?: number;

  /** Whether the request is past its due date */
  isOverdue: boolean;
}

/**
 * APRA (public records) dashboard section.
 * Provides an overview of open records requests and compliance status.
 */
export interface ApraDashboardSection {
  /** Number of open (non-closed) requests */
  openRequestCount: number;

  /** Number of requests due within 2 business days */
  dueSoonCount: number;

  /** Number of overdue requests */
  overdueCount: number;

  /** The next request due, if any */
  upcomingDue?: ApraRequestSummary;

  /** Recent requests for quick reference (most recent first, limited) */
  recentRequests: ApraRequestSummary[];

  /** Additional notes or alerts */
  notes?: string[];
}

// ============================================================================
// DASHBOARD BUILD OPTIONS
// ============================================================================

/**
 * Options for building a dashboard snapshot.
 */
export interface DashboardBuildOptions {
  /**
   * As-of date for the snapshot.
   * Defaults to current date/time.
   */
  asOf?: Date;

  /**
   * Key fund codes to include in the finance section.
   * If not provided, defaults to common fund codes.
   */
  keyFundCodes?: string[];

  /**
   * Maximum number of recent APRA requests to include.
   * Defaults to 10.
   */
  maxRecentApraRequests?: number;

  /**
   * Maximum number of upcoming meetings to load.
   * Defaults to 5.
   */
  maxUpcomingMeetings?: number;
}

// ============================================================================
// SERVICE INTERFACES (for optional integration points)
// ============================================================================

/**
 * Interface for meetings data access.
 * The dashboard service uses this to fetch meeting data.
 * Implementations should adapt the actual MeetingsService.
 */
export interface DashboardMeetingsProvider {
  /**
   * List upcoming meetings for a tenant.
   *
   * @param tenantId - Tenant ID
   * @param asOf - Reference date for "upcoming"
   * @param limit - Maximum number of meetings to return
   * @returns Array of upcoming meeting summaries
   */
  listUpcomingMeetings(
    tenantId: string,
    asOf: Date,
    limit: number
  ): Promise<UpcomingMeetingSummary[]>;
}

/**
 * Interface for APRA data access.
 * The dashboard service uses this to fetch APRA request data.
 * Implementations should adapt the actual ApraService.
 */
export interface DashboardApraProvider {
  /**
   * List open APRA requests for a tenant.
   *
   * @param tenantId - Tenant ID
   * @returns Array of open APRA requests with computed deadline info
   */
  listOpenRequests(tenantId: string): Promise<ApraRequestSummary[]>;
}
