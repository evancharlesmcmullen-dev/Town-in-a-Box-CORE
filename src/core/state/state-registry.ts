// src/core/state/state-registry.ts

import { JurisdictionProfile } from '../tenancy/tenancy.types';
import { StateMetadata, StatePack, StateDomainPack, USStateCode } from './state.types';

/**
 * Registry for state metadata and domain packs.
 *
 * Allows dynamic registration of state support and retrieval
 * of state-specific configurations and rule engines.
 */
export class StateRegistry {
  private states: Map<USStateCode, StateMetadata> = new Map();
  private packs: Map<string, StatePack[]> = new Map(); // key: `${state}:${domain}`
  private domainPacks: Map<string, StateDomainPack> = new Map(); // key: `${state}:${domain}`

  /**
   * Register a state with its metadata.
   */
  registerState(metadata: StateMetadata): void {
    this.states.set(metadata.code, metadata);
  }

  /**
   * Get metadata for a state.
   */
  getState(code: USStateCode): StateMetadata | undefined {
    return this.states.get(code);
  }

  /**
   * Get all registered states.
   */
  getAllStates(): StateMetadata[] {
    return Array.from(this.states.values());
  }

  /**
   * Check if a state is supported.
   */
  isStateSupported(code: USStateCode): boolean {
    return this.states.has(code);
  }

  /**
   * Register a domain pack for a state.
   */
  registerPack(pack: StatePack): void {
    const key = `${pack.state}:${pack.domain}`;
    const existing = this.packs.get(key) || [];
    existing.push(pack);
    this.packs.set(key, existing);
  }

  /**
   * Get all packs for a state and domain.
   */
  getPacks(state: USStateCode, domain: string): StatePack[] {
    const key = `${state}:${domain}`;
    return this.packs.get(key) || [];
  }

  /**
   * Get the applicable pack for a jurisdiction.
   */
  getPackForJurisdiction(
    domain: string,
    jurisdiction: JurisdictionProfile
  ): StatePack | undefined {
    const packs = this.getPacks(jurisdiction.state, domain);
    return packs.find((p) => p.appliesTo(jurisdiction));
  }

  /**
   * Get all domains registered for a state.
   */
  getDomainsForState(state: USStateCode): string[] {
    const domains: Set<string> = new Set();
    for (const key of this.packs.keys()) {
      if (key.startsWith(`${state}:`)) {
        domains.add(key.split(':')[1]);
      }
    }
    return Array.from(domains);
  }

  /**
   * Check if a domain is supported for a state.
   */
  isDomainSupported(state: USStateCode, domain: string): boolean {
    const key = `${state}:${domain}`;
    const hasLegacyPack = this.packs.has(key) && (this.packs.get(key)?.length ?? 0) > 0;
    const hasDomainPack = this.domainPacks.has(key);
    return hasLegacyPack || hasDomainPack;
  }

  // =========================================================================
  // StateDomainPack Registry (new "thinking" pack pattern)
  // =========================================================================

  /**
   * Register a domain pack for a state.
   *
   * Domain packs are the new pattern that "thinks" - they derive configuration
   * from tenant identity using state-specific rules.
   *
   * @param pack - The domain pack to register
   */
  registerDomainPack<TConfig = unknown>(pack: StateDomainPack<TConfig>): void {
    const key = `${pack.state}:${pack.domain}`;
    this.domainPacks.set(key, pack as StateDomainPack);
  }

  /**
   * Get the domain pack for a state and domain.
   *
   * @param state - State code (e.g., 'IN')
   * @param domain - Domain name (e.g., 'finance')
   * @returns The domain pack, or undefined if not registered
   */
  getDomainPack<TConfig = unknown>(
    state: USStateCode,
    domain: string
  ): StateDomainPack<TConfig> | undefined {
    const key = `${state}:${domain}`;
    return this.domainPacks.get(key) as StateDomainPack<TConfig> | undefined;
  }

  /**
   * Get all registered domain packs for a state.
   *
   * @param state - State code
   * @returns Array of domain packs registered for this state
   */
  getDomainPacksForState(state: USStateCode): StateDomainPack[] {
    const packs: StateDomainPack[] = [];
    for (const [key, pack] of this.domainPacks.entries()) {
      if (key.startsWith(`${state}:`)) {
        packs.push(pack);
      }
    }
    return packs;
  }

  /**
   * Get all domains with registered domain packs for a state.
   *
   * @param state - State code
   * @returns Array of domain names
   */
  getDomainPackDomainsForState(state: USStateCode): string[] {
    const domains: string[] = [];
    for (const key of this.domainPacks.keys()) {
      if (key.startsWith(`${state}:`)) {
        domains.push(key.split(':')[1]);
      }
    }
    return domains;
  }
}

/**
 * Global state registry instance.
 * Individual state modules will register themselves on import.
 */
export const stateRegistry = new StateRegistry();

// =============================================================================
// Convenience functions for domain pack registration
// =============================================================================

/**
 * Register a domain pack in the global registry.
 *
 * This should be called from state pack modules to register themselves.
 * For example, src/states/in/finance/index.ts should call:
 *   registerDomainPack(InFinancePack);
 *
 * @param pack - The domain pack to register
 */
export function registerDomainPack<TConfig = unknown>(
  pack: StateDomainPack<TConfig>
): void {
  stateRegistry.registerDomainPack(pack);
}

/**
 * Get a domain pack from the global registry.
 *
 * @param state - State code (e.g., 'IN')
 * @param domain - Domain name (e.g., 'finance')
 * @returns The domain pack, or undefined if not registered
 */
export function getDomainPack<TConfig = unknown>(
  state: USStateCode,
  domain: string
): StateDomainPack<TConfig> | undefined {
  return stateRegistry.getDomainPack<TConfig>(state, domain);
}
