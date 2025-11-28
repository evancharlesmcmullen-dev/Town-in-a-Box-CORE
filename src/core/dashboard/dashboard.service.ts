// src/core/dashboard/dashboard.service.ts
//
// Dashboard Snapshot Service
//
// Provides functions to build a tenant dashboard snapshot by aggregating
// Finance, Meetings, and APRA data into a single structured object.
//
// Design principles:
// - Pure functions where possible
// - Uses existing repositories and services, does not access storage directly
// - Graceful handling of missing/disabled modules
// - Configurable via options for different use cases

import {
  TenantDashboardSnapshot,
  FinanceDashboardSection,
  MeetingsDashboardSection,
  ApraDashboardSection,
  KeyFundBalance,
  DebtCoverageAlert,
  UpcomingMeetingSummary,
  ApraRequestSummary,
  DashboardBuildOptions,
  DashboardMeetingsProvider,
  DashboardApraProvider,
} from './dashboard.types';

import { StateTenantConfig, TenantIdentity } from '../state';
import { FinanceRepository, Fund, Transaction } from '../finance/finance.repository';
import { buildTrialBalanceReport } from '../finance/reports/reports.service';
import { buildForecast } from '../finance/forecast/forecast.service';
import { SimpleForecastScenario } from '../finance/forecast/forecast.types';
import {
  getFinanceConfig,
  getMeetingsConfig,
  getApraConfig,
} from '../tenancy/domain-config.service';
import { calculateApraDeadlines, getDaysUntilDeadline } from '../records/apra-deadlines.service';
import { isCompletedStatus } from '../records/apra-workflow.types';

// ============================================================================
// DEFAULT OPTIONS
// ============================================================================

/** Default key fund codes to show in the dashboard (Indiana common funds) */
const DEFAULT_KEY_FUND_CODES = ['101', '201', '202', '203', '401', '601'];

/** Default number of recent APRA requests to show */
const DEFAULT_MAX_RECENT_APRA = 10;

/** Default number of upcoming meetings to load */
const DEFAULT_MAX_UPCOMING_MEETINGS = 5;

// ============================================================================
// MAIN SNAPSHOT BUILDER
// ============================================================================

/**
 * Build a full dashboard snapshot for a tenant at a given point in time.
 *
 * This is the "Clerk Cockpit" data source: it pulls together finance, meetings,
 * and APRA into a single structured object for UI consumption.
 *
 * @param tenantConfig - The tenant's full configuration (StateTenantConfig)
 * @param tenantIdentity - The tenant's identity (TenantIdentity)
 * @param financeRepo - Finance repository for data access
 * @param options - Optional configuration for the snapshot
 * @returns Promise resolving to the complete dashboard snapshot
 *
 * @example
 * ```typescript
 * const snapshot = await buildTenantDashboardSnapshot(
 *   tenantConfig,
 *   tenantIdentity,
 *   financeRepo,
 *   { asOf: new Date('2024-12-31') }
 * );
 *
 * console.log('Total funds:', snapshot.finance.totalFunds);
 * console.log('Open APRA requests:', snapshot.apra.openRequestCount);
 * console.log('Next meeting:', snapshot.meetings.nextMeeting?.scheduledStart);
 * ```
 */
export async function buildTenantDashboardSnapshot(
  tenantConfig: StateTenantConfig,
  tenantIdentity: TenantIdentity,
  financeRepo: FinanceRepository,
  options?: DashboardBuildOptions
): Promise<TenantDashboardSnapshot> {
  const asOf = options?.asOf ?? new Date();

  // Build each section (finance is async due to repo, others may be too)
  const [finance, meetings, apra] = await Promise.all([
    buildFinanceDashboardSection(tenantConfig, tenantIdentity, financeRepo, asOf, options),
    buildMeetingsDashboardSection(tenantConfig, tenantIdentity, asOf, options),
    buildApraDashboardSection(tenantConfig, tenantIdentity, asOf, options),
  ]);

  return {
    tenantId: tenantIdentity.tenantId,
    tenantName: tenantIdentity.displayName,
    state: tenantIdentity.state,
    entityClass: tenantIdentity.entityClass,
    asOf,
    finance,
    meetings,
    apra,
  };
}

/**
 * Build a dashboard snapshot with external providers for meetings and APRA.
 *
 * Use this version when you have existing service implementations that can
 * provide meeting and APRA data. Falls back to stubs if providers are not given.
 *
 * @param tenantConfig - The tenant's full configuration
 * @param tenantIdentity - The tenant's identity
 * @param financeRepo - Finance repository for data access
 * @param meetingsProvider - Optional meetings data provider
 * @param apraProvider - Optional APRA data provider
 * @param options - Optional configuration for the snapshot
 * @returns Promise resolving to the complete dashboard snapshot
 */
export async function buildTenantDashboardSnapshotWithProviders(
  tenantConfig: StateTenantConfig,
  tenantIdentity: TenantIdentity,
  financeRepo: FinanceRepository,
  meetingsProvider?: DashboardMeetingsProvider,
  apraProvider?: DashboardApraProvider,
  options?: DashboardBuildOptions
): Promise<TenantDashboardSnapshot> {
  const asOf = options?.asOf ?? new Date();

  const [finance, meetings, apra] = await Promise.all([
    buildFinanceDashboardSection(tenantConfig, tenantIdentity, financeRepo, asOf, options),
    buildMeetingsDashboardSectionWithProvider(
      tenantConfig,
      tenantIdentity,
      asOf,
      meetingsProvider,
      options
    ),
    buildApraDashboardSectionWithProvider(
      tenantConfig,
      tenantIdentity,
      asOf,
      apraProvider,
      options
    ),
  ]);

  return {
    tenantId: tenantIdentity.tenantId,
    tenantName: tenantIdentity.displayName,
    state: tenantIdentity.state,
    entityClass: tenantIdentity.entityClass,
    asOf,
    finance,
    meetings,
    apra,
  };
}

// ============================================================================
// FINANCE DASHBOARD SECTION BUILDER
// ============================================================================

/**
 * Build the finance dashboard section.
 *
 * Uses the FinanceRepository to fetch funds and transactions, then:
 * 1. Builds a trial balance for key fund balances
 * 2. Runs a simple forecast to identify debt coverage concerns
 * 3. Aggregates into the dashboard section structure
 *
 * @param tenantConfig - Tenant configuration
 * @param tenantIdentity - Tenant identity
 * @param financeRepo - Finance repository
 * @param asOf - As-of date for calculations
 * @param options - Dashboard build options
 * @returns Finance dashboard section
 */
async function buildFinanceDashboardSection(
  tenantConfig: StateTenantConfig,
  tenantIdentity: TenantIdentity,
  financeRepo: FinanceRepository,
  asOf: Date,
  options?: DashboardBuildOptions
): Promise<FinanceDashboardSection> {
  // Check if finance module is enabled
  const financeConfig = getFinanceConfig(tenantConfig, tenantIdentity);
  if (!financeConfig) {
    return {
      asOf,
      totalFunds: 0,
      keyFundBalances: [],
      upcomingDebtCoverageConcerns: [],
      notes: ['Finance module not enabled for this tenant.'],
    };
  }

  // 1. Load funds & transactions from repository
  const fundsResult = await financeRepo.listFunds({ tenantId: tenantIdentity.tenantId });
  const funds: Fund[] = Array.isArray(fundsResult) ? fundsResult : fundsResult.items;

  const txResult = await financeRepo.listTransactions({
    tenantId: tenantIdentity.tenantId,
    toDate: asOf,
  });
  const transactions: Transaction[] = Array.isArray(txResult) ? txResult : txResult.items;

  // 2. Build trial balance for current balances
  const trialBalance = buildTrialBalanceReport(funds, transactions, asOf);

  // 3. Extract key fund balances
  const keyCodes = options?.keyFundCodes ?? DEFAULT_KEY_FUND_CODES;
  const keyFundBalances: KeyFundBalance[] = trialBalance.rows
    .filter((row) => keyCodes.includes(row.fundCode))
    .map((row) => ({
      fundId: row.fundId,
      fundCode: row.fundCode,
      fundName: row.fundName,
      endingBalance: row.endingBalance,
    }));

  // 4. Run a simple baseline forecast to identify debt coverage concerns
  const coverageAlerts: DebtCoverageAlert[] = [];
  const notes: string[] = [];

  try {
    // Simple scenario for dashboard - 5 year horizon, 2% growth
    const dashboardScenario: SimpleForecastScenario = {
      id: 'DASHBOARD_BASELINE',
      name: 'Dashboard Baseline',
      horizonYears: 5,
      granularity: 'annual',
      defaultRevenueGrowthRate: 0.02,
      defaultExpenseGrowthRate: 0.02,
    };

    const forecast = buildForecast(funds, transactions, asOf, dashboardScenario);

    // Extract coverage concerns from forecast
    if (forecast.coverageSummaries) {
      for (const summary of forecast.coverageSummaries) {
        for (const yearEntry of summary.coverageByYear) {
          // Skip years with no debt service
          if (yearEntry.debtService <= 0) continue;

          // Skip if we can't determine compliance
          if (yearEntry.coverageRatio === null || yearEntry.meetsRequirement === null) continue;

          // Flag years that don't meet requirements
          if (!yearEntry.meetsRequirement) {
            coverageAlerts.push({
              fundId: summary.fundId,
              fundCode: summary.fundCode,
              fundName: summary.fundName,
              year: yearEntry.year,
              coverageRatio: yearEntry.coverageRatio,
              minCoverageRatio: summary.minCoverageRatio,
              meetsRequirement: yearEntry.meetsRequirement,
            });
          }
        }
      }
    }

    // Add notes about coverage concerns
    if (coverageAlerts.length > 0) {
      notes.push(
        `There are ${coverageAlerts.length} future year(s) where debt coverage falls below the required ratio.`
      );
    }

    // Check for funds projected to go negative
    if (forecast.fundsWithNegativeBalance && forecast.fundsWithNegativeBalance.length > 0) {
      notes.push(
        `Warning: ${forecast.fundsWithNegativeBalance.length} fund(s) projected to have negative balances.`
      );
    }
  } catch (error) {
    // Forecast is optional - if it fails, just note it
    notes.push('Note: Forecast data unavailable.');
  }

  return {
    asOf,
    totalFunds: funds.length,
    keyFundBalances,
    upcomingDebtCoverageConcerns: coverageAlerts,
    notes: notes.length > 0 ? notes : undefined,
  };
}

// ============================================================================
// MEETINGS DASHBOARD SECTION BUILDER
// ============================================================================

/**
 * Build the meetings dashboard section (stub version).
 *
 * This version doesn't integrate with the meetings engine directly.
 * Use buildMeetingsDashboardSectionWithProvider for real integration.
 *
 * @param tenantConfig - Tenant configuration
 * @param tenantIdentity - Tenant identity
 * @param asOf - As-of date
 * @param options - Dashboard build options
 * @returns Meetings dashboard section
 */
async function buildMeetingsDashboardSection(
  tenantConfig: StateTenantConfig,
  tenantIdentity: TenantIdentity,
  asOf: Date,
  options?: DashboardBuildOptions
): Promise<MeetingsDashboardSection> {
  return buildMeetingsDashboardSectionWithProvider(
    tenantConfig,
    tenantIdentity,
    asOf,
    undefined,
    options
  );
}

/**
 * Build the meetings dashboard section with an optional provider.
 *
 * Uses the tenant's meetings configuration to populate compliance info,
 * and the optional provider to fetch actual meeting data.
 *
 * @param tenantConfig - Tenant configuration
 * @param tenantIdentity - Tenant identity
 * @param asOf - As-of date
 * @param provider - Optional meetings data provider
 * @param options - Dashboard build options
 * @returns Meetings dashboard section
 */
async function buildMeetingsDashboardSectionWithProvider(
  tenantConfig: StateTenantConfig,
  tenantIdentity: TenantIdentity,
  asOf: Date,
  provider?: DashboardMeetingsProvider,
  options?: DashboardBuildOptions
): Promise<MeetingsDashboardSection> {
  // Get meetings config via domain-config.service
  const meetingsConfig = getMeetingsConfig(tenantConfig, tenantIdentity);

  if (!meetingsConfig) {
    return {
      upcomingMeetingsCount: 0,
      notes: ['Meetings module not enabled for this tenant.'],
    };
  }

  // Attempt to load upcoming meetings using the provider, if available
  let upcomingMeetings: UpcomingMeetingSummary[] = [];
  const notes: string[] = [];

  if (provider) {
    try {
      const limit = options?.maxUpcomingMeetings ?? DEFAULT_MAX_UPCOMING_MEETINGS;
      upcomingMeetings = await provider.listUpcomingMeetings(
        tenantIdentity.tenantId,
        asOf,
        limit
      );
    } catch (error) {
      notes.push('Note: Unable to fetch upcoming meetings.');
    }
  } else {
    // No provider - indicate this is a stub
    // TODO: Integrate with MeetingsService when wiring is available
    notes.push('Note: Meetings data not yet integrated. Provide a DashboardMeetingsProvider.');
  }

  const nextMeeting = upcomingMeetings.length > 0 ? upcomingMeetings[0] : undefined;

  // Add note if no upcoming meetings
  if (upcomingMeetings.length === 0 && !notes.some((n) => n.includes('Unable'))) {
    notes.push('No upcoming meetings scheduled.');
  }

  return {
    upcomingMeetingsCount: upcomingMeetings.length,
    nextMeeting,
    noticeHoursRequirement: meetingsConfig.regularMeetingNoticeHours,
    supportsRemoteParticipation: meetingsConfig.supportsRemoteParticipation,
    notes: notes.length > 0 ? notes : undefined,
  };
}

// ============================================================================
// APRA DASHBOARD SECTION BUILDER
// ============================================================================

/**
 * Build the APRA dashboard section (stub version).
 *
 * This version doesn't integrate with the APRA engine directly.
 * Use buildApraDashboardSectionWithProvider for real integration.
 *
 * @param tenantConfig - Tenant configuration
 * @param tenantIdentity - Tenant identity
 * @param asOf - As-of date
 * @param options - Dashboard build options
 * @returns APRA dashboard section
 */
async function buildApraDashboardSection(
  tenantConfig: StateTenantConfig,
  tenantIdentity: TenantIdentity,
  asOf: Date,
  options?: DashboardBuildOptions
): Promise<ApraDashboardSection> {
  return buildApraDashboardSectionWithProvider(
    tenantConfig,
    tenantIdentity,
    asOf,
    undefined,
    options
  );
}

/**
 * Build the APRA dashboard section with an optional provider.
 *
 * Uses the tenant's APRA configuration to understand deadlines,
 * and the optional provider to fetch actual request data.
 *
 * @param tenantConfig - Tenant configuration
 * @param tenantIdentity - Tenant identity
 * @param asOf - As-of date
 * @param provider - Optional APRA data provider
 * @param options - Dashboard build options
 * @returns APRA dashboard section
 */
async function buildApraDashboardSectionWithProvider(
  tenantConfig: StateTenantConfig,
  tenantIdentity: TenantIdentity,
  asOf: Date,
  provider?: DashboardApraProvider,
  options?: DashboardBuildOptions
): Promise<ApraDashboardSection> {
  // Get APRA config via domain-config.service
  const apraConfig = getApraConfig(tenantConfig, tenantIdentity);

  if (!apraConfig) {
    return {
      openRequestCount: 0,
      dueSoonCount: 0,
      overdueCount: 0,
      recentRequests: [],
      notes: ['APRA module not enabled for this tenant.'],
    };
  }

  const notes: string[] = [];
  let summaries: ApraRequestSummary[] = [];

  if (provider) {
    try {
      summaries = await provider.listOpenRequests(tenantIdentity.tenantId);
    } catch (error) {
      notes.push('Note: Unable to fetch APRA requests.');
    }
  } else {
    // No provider - indicate this is a stub
    // TODO: Integrate with ApraService when wiring is available
    notes.push('Note: APRA data not yet integrated. Provide a DashboardApraProvider.');
  }

  // Calculate counts from summaries
  const openRequestCount = summaries.length;
  const dueSoon = summaries.filter((s) => !s.isOverdue && (s.daysUntilDue ?? 0) <= 2);
  const overdue = summaries.filter((s) => s.isOverdue);

  // Find the next due request (non-overdue, soonest due date)
  const upcomingDue = summaries
    .filter((s) => !s.isOverdue)
    .sort((a, b) => a.initialDueDate.getTime() - b.initialDueDate.getTime())[0];

  // Get recent requests (limited)
  const maxRecent = options?.maxRecentApraRequests ?? DEFAULT_MAX_RECENT_APRA;
  const recentRequests = summaries
    .sort((a, b) => b.receivedAt.getTime() - a.receivedAt.getTime())
    .slice(0, maxRecent);

  // Add notes for concerning statuses
  if (overdue.length > 0) {
    notes.push(`Warning: ${overdue.length} APRA request(s) are overdue.`);
  }

  if (dueSoon.length > 0) {
    notes.push(`${dueSoon.length} APRA request(s) due within 2 business days.`);
  }

  return {
    openRequestCount,
    dueSoonCount: dueSoon.length,
    overdueCount: overdue.length,
    upcomingDue,
    recentRequests,
    notes: notes.length > 0 ? notes : undefined,
  };
}

// ============================================================================
// HELPER: BUILD APRA SUMMARY FROM RAW REQUEST DATA
// ============================================================================

/**
 * Build an ApraRequestSummary from raw request data.
 *
 * This helper is useful when adapting data from the ApraService
 * to the dashboard's expected format.
 *
 * @param request - Raw request data
 * @param apraConfig - APRA configuration for deadline calculation
 * @param asOf - Reference date for calculating days until due
 * @returns ApraRequestSummary for dashboard display
 */
export function buildApraRequestSummary(
  request: {
    id: string;
    status: string;
    receivedAt: Date | string;
    statutoryDeadlineAt?: Date | string;
  },
  apraConfig: { standardResponseDays?: number; businessDaysOnly?: boolean },
  asOf: Date = new Date()
): ApraRequestSummary {
  const receivedAt =
    typeof request.receivedAt === 'string'
      ? new Date(request.receivedAt)
      : request.receivedAt;

  // Calculate deadlines using the apra-deadlines service
  const deadlines = calculateApraDeadlines(receivedAt, apraConfig);

  // Use statutory deadline from request if available, otherwise use calculated
  let initialDueDate = deadlines.initialDueDate;
  if (request.statutoryDeadlineAt) {
    initialDueDate =
      typeof request.statutoryDeadlineAt === 'string'
        ? new Date(request.statutoryDeadlineAt)
        : request.statutoryDeadlineAt;
  }

  // Calculate days until due
  const usesBusinessDays = apraConfig.businessDaysOnly ?? true;
  const daysUntilDue = getDaysUntilDeadline(initialDueDate, asOf, usesBusinessDays);

  // Determine if overdue (only for non-completed statuses)
  const isCompleted = isCompletedStatus(request.status as any);
  const isOverdue = !isCompleted && daysUntilDue < 0;

  return {
    requestId: request.id,
    status: request.status,
    receivedAt,
    initialDueDate,
    extendedDueDate: deadlines.extendedDueDate,
    daysUntilDue,
    isOverdue,
  };
}

// ============================================================================
// ADAPTER FACTORIES
// ============================================================================

/**
 * Create a DashboardMeetingsProvider from a MeetingsService.
 *
 * This adapter converts the MeetingsService interface to the simpler
 * DashboardMeetingsProvider interface expected by the dashboard builder.
 *
 * @param meetingsService - MeetingsService implementation
 * @param tenantContext - Tenant context function that creates TenantContext
 * @param governingBodies - Map of body IDs to names
 * @returns DashboardMeetingsProvider
 *
 * @example
 * ```typescript
 * const provider = createMeetingsProvider(
 *   meetingsService,
 *   (tenantId) => ({ tenantId, jurisdiction: { ... } }),
 *   bodyNameMap
 * );
 *
 * const snapshot = await buildTenantDashboardSnapshotWithProviders(
 *   config, identity, repo, provider, undefined
 * );
 * ```
 */
export function createMeetingsProvider(
  meetingsService: {
    listMeetings: (
      ctx: { tenantId: string },
      filter?: { fromDate?: Date; status?: string | string[] }
    ) => Promise<
      Array<{
        id: string;
        bodyId: string;
        scheduledStart: Date;
        location: string;
        status: string;
      }>
    >;
  },
  tenantContext: (tenantId: string) => { tenantId: string },
  governingBodies: Map<string, string>
): DashboardMeetingsProvider {
  return {
    async listUpcomingMeetings(
      tenantId: string,
      asOf: Date,
      limit: number
    ): Promise<UpcomingMeetingSummary[]> {
      const ctx = tenantContext(tenantId);

      // Fetch meetings scheduled after asOf that aren't cancelled/adjourned
      const meetings = await meetingsService.listMeetings(ctx, {
        fromDate: asOf,
      });

      // Filter to upcoming only (not cancelled, not adjourned)
      const upcoming = meetings
        .filter((m) => {
          const status = m.status.toLowerCase();
          return (
            status !== 'cancelled' &&
            status !== 'adjourned' &&
            m.scheduledStart >= asOf
          );
        })
        .sort((a, b) => a.scheduledStart.getTime() - b.scheduledStart.getTime())
        .slice(0, limit);

      return upcoming.map((m) => ({
        meetingId: m.id,
        governingBodyName: governingBodies.get(m.bodyId) ?? m.bodyId,
        scheduledStart: m.scheduledStart,
        location: m.location,
      }));
    },
  };
}

/**
 * Create a DashboardApraProvider from an ApraService.
 *
 * This adapter converts the ApraService interface to the simpler
 * DashboardApraProvider interface expected by the dashboard builder.
 *
 * @param apraService - ApraService implementation
 * @param tenantContext - Tenant context function
 * @param apraConfig - APRA configuration for deadline calculations
 * @returns DashboardApraProvider
 */
export function createApraProvider(
  apraService: {
    listRequests: (
      ctx: { tenantId: string },
      filter?: { status?: string[] }
    ) => Promise<
      Array<{
        id: string;
        status: string;
        receivedAt: string;
        statutoryDeadlineAt?: string;
      }>
    >;
  },
  tenantContext: (tenantId: string) => { tenantId: string },
  apraConfig: { standardResponseDays?: number; businessDaysOnly?: boolean }
): DashboardApraProvider {
  return {
    async listOpenRequests(tenantId: string): Promise<ApraRequestSummary[]> {
      const ctx = tenantContext(tenantId);

      // Fetch all non-closed requests
      const requests = await apraService.listRequests(ctx, {
        status: ['RECEIVED', 'ACKNOWLEDGED', 'IN_REVIEW', 'NEEDS_CLARIFICATION', 'ON_HOLD'],
      });

      const now = new Date();

      return requests.map((req) =>
        buildApraRequestSummary(
          {
            id: req.id,
            status: req.status,
            receivedAt: req.receivedAt,
            statutoryDeadlineAt: req.statutoryDeadlineAt,
          },
          apraConfig,
          now
        )
      );
    },
  };
}
