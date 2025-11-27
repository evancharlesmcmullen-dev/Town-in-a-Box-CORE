// src/lib.ts
// Main library exports for Town-in-a-Box-CORE

// Core - Tenancy
export * from './core/tenancy/tenancy.types';
export * from './core/tenancy/tenancy.service';
export * from './core/tenancy/in-memory-tenancy.service';

// Core - AI
export * from './core/ai/ai.types';
export * from './core/ai/ai.service';
export * from './core/ai/in-memory-ai.service';
export * from './core/ai/ai.bootstrap';

// Core - Legal
export * from './core/legal/legal-engine';
export * from './core/legal/types';

// Core - Compliance
export * from './core/compliance/compliance.types';
export * from './core/compliance/compliance.service';
export * from './core/compliance/in-memory-compliance.service';

// Core - Notices
export * from './core/notices/notice.types';
export * from './core/notices/notice.service';
export * from './core/notices/in-memory-notice.service';

// Engines - Meetings
export * from './engines/meetings/meeting.types';
export * from './engines/meetings/meetings.service';
export * from './engines/meetings/in-memory-meetings.service';
export {
  AiMeetingsProvider,
  MockAiMeetingsProvider,
  AiMeetingsServiceImpl,
} from './engines/meetings/ai-meetings.service';

// Engines - Records (APRA)
export * from './engines/records/apra.types';
export * from './engines/records/apra.service';
export * from './engines/records/in-memory-apra.service';

// States - Indiana
export { INLegalEngine } from './states/in/legal/in-legal-engine';

// HTTP (for programmatic server creation)
export { createServer } from './http/server';
export { buildTenantContext } from './http/context';
export { createMeetingsRouter } from './http/routes/meetings.routes';
