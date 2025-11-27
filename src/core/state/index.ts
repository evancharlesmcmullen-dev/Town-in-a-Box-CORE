// src/core/state/index.ts

export * from './state.types';
export * from './tenant-config.types';
export {
  StateRegistry,
  stateRegistry,
  registerDomainPack,
  getDomainPack,
} from './state-registry';
export {
  buildDomainConfig,
  buildDomainConfigWithMetadata,
  isDomainAvailable,
  getAvailableDomains,
  type DomainConfigResult,
} from './config-resolver';
