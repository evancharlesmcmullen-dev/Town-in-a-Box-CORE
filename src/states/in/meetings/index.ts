// src/states/in/meetings/index.ts

import { registerDomainPack } from '../../../core/state/state-registry';
import { InMeetingsPack } from './in-meetings.pack';

// Register the Indiana Meetings Pack on module import
// This makes it available through the generic config resolver
registerDomainPack(InMeetingsPack);

// Export all meetings-related types and utilities
export * from './in-meetings.pack';
export * from './in-meetings.config';
