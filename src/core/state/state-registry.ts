// src/core/state/state-registry.ts

import { JurisdictionProfile } from '../tenancy/tenancy.types';
import { StateMetadata, StatePack, USStateCode } from './state.types';

/**
 * Registry for state metadata and domain packs.
 *
 * Allows dynamic registration of state support and retrieval
 * of state-specific configurations and rule engines.
 */
export class StateRegistry {
  private states: Map<USStateCode, StateMetadata> = new Map();
  private packs: Map<string, StatePack[]> = new Map(); // key: `${state}:${domain}`

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
    return this.packs.has(key) && (this.packs.get(key)?.length ?? 0) > 0;
  }
}

/**
 * Global state registry instance.
 * Individual state modules will register themselves on import.
 */
export const stateRegistry = new StateRegistry();
