// src/tenants/lapel-in/index.ts

export {
  lapelTenantConfig,
  createLapelConfig,
  lapelIdentity,
  lapelFinanceOverrides,
} from './tenant.config';

export {
  lapelFinanceConfig,
  getLapelFinanceDefaults,
  buildLapelFinanceConfig,
  getLapelLitStatus,
  compareLitEligibility,
  fireModelExamples,
} from './finance.wiring';
