// src/core/assets/asset.types.ts

export type AssetTypeCode =
  | 'street'
  | 'vehicle'
  | 'facility'
  | 'park'
  | 'cemetery'
  | 'utilityInfrastructure'
  | 'equipment'
  | 'other';

export interface Asset {
  id: string;
  tenantId: string;

  type: AssetTypeCode;
  name: string;
  description?: string;

  locationDescription?: string;
  latitude?: number;
  longitude?: number;
}