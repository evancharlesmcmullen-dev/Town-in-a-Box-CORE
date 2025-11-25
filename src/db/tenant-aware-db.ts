// ============================================
// File: src/db/tenant-aware-db.ts
// ============================================

import { Pool, PoolClient } from 'pg';

/**
 * TenantAwareDb wraps a pg.Pool and ensures that, for every operation,
 * PostgreSQL Row Level Security (RLS) is given the correct tenant context
 * via the app.current_tenant_id setting.
 *
 * All Postgres-backed services should use this instead of using Pool directly.
 */
export class TenantAwareDb {
  constructor(private pool: Pool) {}

  /**
   * Run a callback within a transaction and a tenant context.
   * RLS policies should use `current_setting('app.current_tenant_id', true)`
   * to filter by tenant_id.
   */
  async withTenant<T>(
    tenantId: string,
    fn: (client: PoolClient) => Promise<T>
  ): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('SET LOCAL app.current_tenant_id = $1', [tenantId]);
      const result = await fn(client);
      await client.query('COMMIT');
      return result;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }
}

// ============================================
// File: src/engines/gis/gis.types.ts
// ============================================

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
  activeCases: any[]; // we can refine this when case types are formalized
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

// ============================================
// File: src/engines/gis/gis.service.ts
// ============================================

import type * as GeoJSON from 'geojson';
import { TenantContext } from '../../core/tenancy/tenancy.types';
import {
  ParcelSearchResult,
  ParcelDetails,
  NotificationAnalysis,
} from './gis.types';

/**
 * GIS engine interface for parcel/zoning and notification workflows.
 *
 * This is what Planning, Notices, etc. will depend on. Concrete implementations
 * (like Postgres/PostGIS) will live in separate files.
 */
export interface GisService {
  /**
   * Return all parcels in the jurisdiction as a GeoJSON FeatureCollection.
   */
  getParcelsGeoJSON(
    ctx: TenantContext
  ): Promise<GeoJSON.FeatureCollection>;

  /**
   * Search parcels by address text.
   */
  searchParcels(
    ctx: TenantContext,
    query: string
  ): Promise<ParcelSearchResult[]>;

  /**
   * Get detailed parcel information, including geometry, zoning, and active cases.
   */
  getParcelDetails(
    ctx: TenantContext,
    parcelId: string
  ): Promise<ParcelDetails>;

  /**
   * Find neighbors for notification (KILLER FEATURE).
   */
  findNeighborsForNotification(
    ctx: TenantContext,
    params: {
      caseId: string;
      parcelId: string;
      radiusFeet: number;
    }
  ): Promise<NotificationAnalysis>;

  /**
   * Get zoning districts as GeoJSON for map display.
   */
  getZoningDistrictsGeoJSON(
    ctx: TenantContext
  ): Promise<GeoJSON.FeatureCollection>;
}
