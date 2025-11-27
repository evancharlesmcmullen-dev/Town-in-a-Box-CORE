// src/states/in/township/in-township.config.ts

import { DomainConfig } from '../../../core/state/state.types';

/**
 * Township-specific engine module identifiers.
 */
export type TownshipModuleId =
  | 'township-assistance'
  | 'fire-contracts'
  | 'cemeteries'
  | 'insurance-bonds'
  | 'fence-viewer'
  | 'weed-control'
  | 'policies';

/**
 * Township fire service delivery model.
 * Townships typically contract for fire service or participate in territories.
 */
export type TownshipFireModel =
  | 'CONTRACT'              // Contract with external provider
  | 'TERRITORY'             // Member of fire protection territory
  | 'DEPARTMENT'            // Township operates own department (rare)
  | 'MUTUAL_AID';           // Mutual aid agreements only

/**
 * Configuration for an Indiana Township tenant.
 *
 * This extends base domain config with township-specific settings.
 * The pack will derive sensible defaults based on tenant identity.
 */
export interface INTownshipConfig extends DomainConfig {
  domain: 'township';

  //
  // ASSISTANCE PROGRAM
  //

  /** Whether township assistance is enabled (default: true for townships) */
  assistanceEnabled: boolean;

  /** Maximum days for initial investigation per IC 12-20-6-8.5 */
  assistanceInvestigationDays: number;

  /** Whether assistance case files are confidential (APRA exempt) */
  assistanceCasesConfidential: boolean;

  //
  // FIRE SERVICE
  //

  /** Fire service delivery model */
  fireModel: TownshipFireModel;

  /** Fire territory ID if using TERRITORY model */
  fireTerritoryId?: string;

  /** Contracting provider name if using CONTRACT model */
  fireContractProvider?: string;

  //
  // CEMETERY
  //

  /** Whether cemetery management is enabled */
  cemeteryEnabled: boolean;

  /** Number of cemeteries managed by the township */
  cemeteryCount?: number;

  //
  // FENCE VIEWER
  //

  /** Whether fence viewer services are enabled */
  fenceViewerEnabled: boolean;

  /** Default appeal deadline days per IC 32-26-9-7 */
  fenceViewerAppealDays: number;

  //
  // WEED CONTROL
  //

  /** Whether weed control enforcement is enabled */
  weedControlEnabled: boolean;

  /** Default notice compliance deadline (days) */
  weedControlNoticeDays: number;

  //
  // INSURANCE & BONDS
  //

  /** Whether insurance/bonds tracking is enabled */
  insuranceBondsEnabled: boolean;

  /** Trustee bond required per IC 5-4-1 */
  trusteeBondRequired: boolean;

  /** Clerk bond required per IC 5-4-1 */
  clerkBondRequired: boolean;

  //
  // POLICIES
  //

  /** Whether policy registry is enabled */
  policiesEnabled: boolean;

  //
  // GOVERNANCE
  //

  /** Township trustee is chief fiscal officer */
  trusteeIsFiscalOfficer: boolean;

  /** Board meets to approve claims */
  boardApprovesClaims: boolean;

  /** Number of board members */
  boardMemberCount: number;

  //
  // TOWNSHIP-SPECIFIC MODULES LIST
  //

  /** Which township modules are enabled */
  enabledModules: TownshipModuleId[];
}

/**
 * Default configuration for Indiana townships.
 * These values follow Indiana statute and common practice.
 */
export const DEFAULT_IN_TOWNSHIP_CONFIG: INTownshipConfig = {
  domain: 'township',
  enabled: true,

  // Assistance - enabled by default for townships
  assistanceEnabled: true,
  assistanceInvestigationDays: 3,  // 72 hours per IC 12-20-6-8.5
  assistanceCasesConfidential: true,

  // Fire - most townships contract
  fireModel: 'CONTRACT',

  // Cemetery - many townships manage cemeteries
  cemeteryEnabled: true,

  // Fence viewer - all townships have this duty
  fenceViewerEnabled: true,
  fenceViewerAppealDays: 10,  // per IC 32-26-9-7

  // Weed control - townships can enforce
  weedControlEnabled: true,
  weedControlNoticeDays: 10,

  // Insurance & bonds
  insuranceBondsEnabled: true,
  trusteeBondRequired: true,
  clerkBondRequired: true,

  // Policies
  policiesEnabled: true,

  // Governance
  trusteeIsFiscalOfficer: true,
  boardApprovesClaims: true,
  boardMemberCount: 3,

  // All modules enabled by default
  enabledModules: [
    'township-assistance',
    'fire-contracts',
    'cemeteries',
    'insurance-bonds',
    'fence-viewer',
    'weed-control',
    'policies',
  ],
};
