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
 * Planning, Notices, etc. should depend on this, not on pg/SQL directly.
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
