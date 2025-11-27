// src/index.ts
//
// Public API exports for Town-in-a-Box-CORE.
//
// This is the official entry point for external code (CLI, API, UI).
// Everything else is internal and may change without notice.

// =============================================================================
// CORE: TENANCY
// =============================================================================

export type {
  StateCode,
  LocalGovKind,
  JurisdictionProfile,
  TenantContext,
  Tenant,
  DataStoreVendor,
  DataStoreConfig,
  TenantConfig,
} from './core/tenancy/tenancy.types';

// =============================================================================
// CORE: AI LAYER
// =============================================================================

// Service interfaces
export type {
  AiCoreService,
  AiExtractionService,
  AiMessageRole,
  AiMessage,
  AiToolDefinition,
  AiToolCall,
  AiChatOptions,
  AiChatResponse,
  AiCompleteOptions,
  ExtractedDeadline,
  MatterClassification,
} from './core/ai/ai.service';

// Provider abstraction
export type { AiProviderClient, AiProviderConfig, AiErrorCode } from './core/ai/ai.provider';
export { AiError } from './core/ai/ai.provider';

// Bootstrap and config
export type { AiBootstrap } from './core/ai/ai.bootstrap';
export { createAiBootstrap, createAiBootstrapWithConfig } from './core/ai/ai.bootstrap';
export type { AiProviderName, AiRuntimeConfig } from './core/ai/ai.config';
export { loadAiConfig } from './core/ai/ai.config';

// Mock client for testing
export { MockAiClient } from './core/ai/mock-ai.client';

// =============================================================================
// ENGINE: MEETINGS
// =============================================================================

// Service interfaces
export type {
  MeetingsService,
  AiMeetingsService,
  ScheduleMeetingInput,
  MeetingFilter,
  MarkNoticePostedInput,
} from './engines/meetings/meetings.service';

// Types
export type {
  GoverningBody,
  MeetingType,
  MeetingStatus,
  AgendaItem,
  Minutes,
  VoteValue,
  VoteRecord,
  NoticeMethod,
  MeetingNotice,
  OpenDoorTimeliness,
  OpenDoorCompliance,
  Meeting,
  MeetingDeadline,
  MeetingSummary,
} from './engines/meetings/meeting.types';

// Implementations
export { InMemoryMeetingsService } from './engines/meetings/in-memory-meetings.service';
export type { InMemoryMeetingsSeedData } from './engines/meetings/in-memory-meetings.service';
export { AiMeetingsServiceImpl } from './engines/meetings/ai-meetings.service.impl';

// Calendar utilities (for custom compliance checks)
export {
  computeRequiredPostedBy,
  checkOpenDoorCompliance,
  countBusinessHours,
  getIndianaStateHolidays,
} from './core/calendar/open-door.calendar';
export type {
  OpenDoorCalendarOptions,
  OpenDoorComplianceResult,
} from './core/calendar/open-door.calendar';

// =============================================================================
// ENGINE: FEES
// =============================================================================

// Service interface
export type { FeeService } from './engines/fees/fee.service';

// Types
export type {
  FeeCategory,
  FeeItem,
  FeeSchedule,
  FeeCalculationParameter,
  FeeCalculationContext,
  FeeCalculationInput,
  FeeCalculationLine,
  FeeDiscountLine,
  FeeCalculationResult,
} from './engines/fees/fee.types';

// Implementation
export { InMemoryFeeService } from './engines/fees/in-memory-fee.service';
export type { InMemoryFeeSeedData } from './engines/fees/in-memory-fee.service';

// =============================================================================
// ENGINE: TOWNSHIP ASSISTANCE
// =============================================================================

// Service interface
export type { TownshipAssistanceService } from './engines/township-assistance/assistance.service';

// Core types
export type {
  AssistanceCaseStatus,
  AssistanceBenefitType,
  AssistanceProgramPolicy,
  HouseholdMember,
  AssistanceApplication,
  AssistanceCase,
  AssistanceBenefit,
  AssistanceCaseSummary,
} from './engines/township-assistance/assistance.types';

// Reporting types
export type {
  AssistanceStatsRange,
  AssistanceCaseStats,
  AssistanceBenefitBreakdown,
  HouseholdSizeBucketStats,
  AssistanceStatsSummary,
  AssistanceStatsSummaryLite,
} from './engines/township-assistance/assistance.reporting.types';

// Reporting service
export type { TownshipAssistanceReportingService } from './engines/township-assistance/assistance.reporting.service';
export { InMemoryAssistanceReportingService } from './engines/township-assistance/in-memory-assistance.reporting.service';

// =============================================================================
// ENGINE: RECORDS (APRA)
// =============================================================================

// Service interface
export type {
  ApraService,
  CreateApraRequestInput,
  ApraRequestFilter,
  AddExemptionInput,
  RecordFulfillmentInput,
} from './engines/records/apra.service';

// Types
export type {
  ApraRequestStatus,
  ApraRequester,
  ApraRequest,
  ApraRequestScope,
  ApraStatusHistoryEntry,
  ApraClarification,
  ApraExemptionCitation,
  ApraFulfillment,
  ApraRequestSummary,
} from './engines/records/apra.types';

// Implementation
export { InMemoryApraService } from './engines/records/in-memory-apra.service';
export type { InMemoryApraSeedData } from './engines/records/in-memory-apra.service';

// APRA Calendar utilities (for deadline calculations)
export {
  computeApraDeadline,
  addBusinessDays,
} from './core/calendar/open-door.calendar';
export type { ApraCalendarOptions } from './core/calendar/open-door.calendar';

// =============================================================================
// LEGAL ENGINE (Indiana)
// =============================================================================

export { INLegalEngine } from './states/in/legal/in-legal-engine';
