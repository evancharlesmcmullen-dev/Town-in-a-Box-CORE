// Core tenancy & jurisdiction types for Town-in-a-Box Core

export type StateCode = 'IN' | string;

export type LocalGovKind =
  | 'town'
  | 'city'
  | 'township'
  | 'county'
  | 'specialDistrict';

export interface JurisdictionProfile {
  tenantId: string;
  state: StateCode;
  kind: LocalGovKind;
  name: string;             // e.g. "Town of Lapel"
  population?: number;
  countyName?: string;
  formId?: string;          // e.g. 'IN_TOWN'
  authorityTags: string[];  // e.g. ['zoningAuthority', 'utilityOperator']
}

export interface TenantContext {
  tenantId: string;
  jurisdiction: JurisdictionProfile;
  userId?: string;
  roles?: string[];
}
