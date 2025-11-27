// src/states/in/apra/index.ts

import { registerDomainPack } from '../../../core/state/state-registry';
import { InApraPack } from './in-apra.pack';

// Register the Indiana APRA Pack on module import
// This makes it available through the generic config resolver
registerDomainPack(InApraPack);

// Export all APRA-related types and utilities
export * from './in-apra.pack';
export * from './in-apra.config';
