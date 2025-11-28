// src/core/dashboard/index.ts
//
// Dashboard Module Exports
//
// Central export point for the tenant dashboard snapshot functionality.
// This module provides types and services for building aggregated
// "Clerk Cockpit" views of Finance, Meetings, and APRA data.

// Types
export type {
  // Main snapshot types
  TenantDashboardSnapshot,

  // Finance section types
  FinanceDashboardSection,
  KeyFundBalance,
  DebtCoverageAlert,

  // Meetings section types
  MeetingsDashboardSection,
  UpcomingMeetingSummary,

  // APRA section types
  ApraDashboardSection,
  ApraRequestSummary,

  // Options and providers
  DashboardBuildOptions,
  DashboardMeetingsProvider,
  DashboardApraProvider,
} from './dashboard.types';

// Service functions
export {
  // Main builders
  buildTenantDashboardSnapshot,
  buildTenantDashboardSnapshotWithProviders,

  // Helper functions
  buildApraRequestSummary,

  // Adapter factories
  createMeetingsProvider,
  createApraProvider,
} from './dashboard.service';
