// src/states/in/finance/index.ts

import { registerDomainPack } from '../../../core/state/state-registry';
import { InFinancePack } from './in-finance.pack';

// Register the Indiana Finance Pack on module import
// This makes it available through the generic config resolver
registerDomainPack(InFinancePack);

// Export all finance-related types and utilities
export * from './in-financial-rules.engine';
export * from './in-finance.pack';
export * from './in-finance.config';
export * from './in-lit-rules.config';
export * from './in-fund-structure.config';
