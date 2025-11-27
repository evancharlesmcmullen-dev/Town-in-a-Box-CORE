// src/core/state/unit-type.ts
//
// Canonical unit type handling for distinguishing between
// different kinds of local government units (Town vs Township vs City, etc.)

import { TenantIdentity, UnitType } from './state.types';
import { LocalGovKind, JurisdictionProfile } from '../tenancy/tenancy.types';

// Re-export UnitType from state.types for convenience
export type { UnitType } from './state.types';

/**
 * Map from LocalGovKind (lowercase) to UnitType (uppercase).
 */
const kindToUnitType: Record<LocalGovKind, UnitType> = {
  town: 'TOWN',
  township: 'TOWNSHIP',
  city: 'CITY',
  county: 'COUNTY',
  specialDistrict: 'SPECIAL_DISTRICT',
  other: 'OTHER',
};

/**
 * Map from UnitType to LocalGovKind.
 */
const unitTypeToKind: Record<UnitType, LocalGovKind> = {
  TOWN: 'town',
  TOWNSHIP: 'township',
  CITY: 'city',
  COUNTY: 'county',
  SPECIAL_DISTRICT: 'specialDistrict',
  OTHER: 'other',
};

// =============================================================================
// Unit Type Detection Helpers
// =============================================================================

/**
 * Check if a unit type is a Township.
 */
export function isTownship(unitType: UnitType): boolean {
  return unitType === 'TOWNSHIP';
}

/**
 * Check if a unit type is a Town.
 */
export function isTown(unitType: UnitType): boolean {
  return unitType === 'TOWN';
}

/**
 * Check if a unit type is a City.
 */
export function isCity(unitType: UnitType): boolean {
  return unitType === 'CITY';
}

/**
 * Check if a unit type is a County.
 */
export function isCounty(unitType: UnitType): boolean {
  return unitType === 'COUNTY';
}

/**
 * Check if a unit type is a Special District.
 */
export function isSpecialDistrict(unitType: UnitType): boolean {
  return unitType === 'SPECIAL_DISTRICT';
}

// =============================================================================
// Conversion Helpers
// =============================================================================

/**
 * Get UnitType from a TenantIdentity.
 */
export function getUnitTypeFromIdentity(identity: TenantIdentity): UnitType {
  return identity.entityClass;
}

/**
 * Get UnitType from a JurisdictionProfile.
 */
export function getUnitTypeFromJurisdiction(jurisdiction: JurisdictionProfile): UnitType {
  return kindToUnitType[jurisdiction.kind] ?? 'OTHER';
}

/**
 * Convert UnitType to LocalGovKind.
 */
export function unitTypeToLocalGovKind(unitType: UnitType): LocalGovKind {
  return unitTypeToKind[unitType] ?? 'other';
}

/**
 * Convert LocalGovKind to UnitType.
 */
export function localGovKindToUnitType(kind: LocalGovKind): UnitType {
  return kindToUnitType[kind] ?? 'OTHER';
}

// =============================================================================
// Module Availability by Unit Type
// =============================================================================

/**
 * Modules that are specific to Township units.
 */
export const TOWNSHIP_SPECIFIC_MODULES = [
  'township-assistance',
  'fence-viewer',
] as const;

/**
 * Modules available to all unit types.
 */
export const COMMON_MODULES = [
  'finance',
  'meetings',
  'apra',
  'records',
] as const;

/**
 * Modules that are commonly enabled for Townships.
 */
export const TOWNSHIP_MODULES = [
  ...COMMON_MODULES,
  'township-assistance',
  'fire-contracts',
  'cemeteries',
  'insurance-bonds',
  'fence-viewer',
  'weed-control',
  'policies',
] as const;

/**
 * Modules that are commonly enabled for Towns.
 */
export const TOWN_MODULES = [
  ...COMMON_MODULES,
  'planning',
  'utilities',
  'code-enforcement',
  'permits',
  'insurance-bonds',
  'policies',
] as const;

/**
 * Modules that are commonly enabled for Cities.
 */
export const CITY_MODULES = [
  ...COMMON_MODULES,
  'planning',
  'utilities',
  'code-enforcement',
  'permits',
  'insurance-bonds',
  'policies',
  'legislation',
] as const;

/**
 * Check if a module is available for a given unit type.
 * This is a convenience function; the actual availability should be
 * determined by the tenant's enabledModules configuration.
 */
export function isModuleTypicallyAvailable(
  moduleId: string,
  unitType: UnitType
): boolean {
  switch (unitType) {
    case 'TOWNSHIP':
      return (TOWNSHIP_MODULES as readonly string[]).includes(moduleId);
    case 'TOWN':
      return (TOWN_MODULES as readonly string[]).includes(moduleId);
    case 'CITY':
      return (CITY_MODULES as readonly string[]).includes(moduleId);
    default:
      return (COMMON_MODULES as readonly string[]).includes(moduleId);
  }
}

/**
 * Get the typical modules for a unit type.
 */
export function getTypicalModulesForUnitType(unitType: UnitType): readonly string[] {
  switch (unitType) {
    case 'TOWNSHIP':
      return TOWNSHIP_MODULES;
    case 'TOWN':
      return TOWN_MODULES;
    case 'CITY':
      return CITY_MODULES;
    default:
      return COMMON_MODULES;
  }
}

// =============================================================================
// Display Helpers
// =============================================================================

/**
 * Get a human-readable label for a unit type.
 */
export function getUnitTypeLabel(unitType: UnitType): string {
  switch (unitType) {
    case 'TOWN':
      return 'Town';
    case 'TOWNSHIP':
      return 'Township';
    case 'CITY':
      return 'City';
    case 'COUNTY':
      return 'County';
    case 'SPECIAL_DISTRICT':
      return 'Special District';
    default:
      return 'Other';
  }
}

/**
 * Get a human-readable label for a unit type with state prefix.
 * Example: "Indiana Township", "Indiana Town"
 */
export function getUnitTypeLabelWithState(unitType: UnitType, stateName: string): string {
  return `${stateName} ${getUnitTypeLabel(unitType)}`;
}
