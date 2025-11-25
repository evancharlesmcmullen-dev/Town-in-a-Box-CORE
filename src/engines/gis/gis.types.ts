// src/engines/gis/gis.types.ts

import type * as GeoJSON from 'geojson';

export interface ParcelSearchResult {
  parcelId: string;
  parcelNumber: string;
  address: string;
  owner: string;
  zoning?: string;
  location: GeoJSON.Point | null;
  matchQuality: 'EXACT' | 'FUZZY';
  rank?: number;
  similarity?: number;
}

export interface ParcelDetails {
  id: string;
  parcelNumber: string;
  address: string;
  owner: {
    name: string;
    address: string;
  };
  zoning: {
    district: string;
    zone_code?: string;
    zone_name?: string;
    zone_description?: string;
  };
  landUse: string;
  acreage: number;
  geometry: GeoJSON.MultiPolygon;
  centroid: GeoJSON.Point;
  activeCases: any[]; // later we can type this to CaseSummary[]
}

export interface NotificationRecipient {
  name: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  distanceFeet: number;
  parcelIds: string[];
  isOutOfState: boolean;
  isPOBox: boolean;
}

export type AddressIssueType =
  | 'INCOMPLETE_ADDRESS'
  | 'PO_BOX'
  | 'OUT_OF_STATE'
  | 'ENTITY_OWNER';

export type AddressIssueSeverity =
  | 'ERROR'
  | 'WARNING'
  | 'INFO';

export interface AddressIssue {
  type: AddressIssueType;
  recipient: string;
  message: string;
  severity: AddressIssueSeverity;
  parcelIds: string[];
}

export interface NotificationAnalysis {
  caseId: string;
  subjectParcel: string;
  notificationRadius: number;
  parcelsFound: number;
  uniqueOwners: number;
  recipients: NotificationRecipient[];
  issues: AddressIssue[];
  notificationArea: GeoJSON.Polygon | null;
  generatedAt: Date;
}
