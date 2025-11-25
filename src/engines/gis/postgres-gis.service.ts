// src/engines/gis/postgres-gis.service.ts

import type * as GeoJSON from 'geojson';
import { TenantContext } from '../../core/tenancy/tenancy.types';
import { TenantAwareDb } from '../../db/tenant-aware-db';
import { GisService } from './gis.service';
import {
  ParcelSearchResult,
  ParcelDetails,
  NotificationAnalysis,
  NotificationRecipient,
  AddressIssue,
} from './gis.types';

/**
 * Shape of rows returned by find_neighbors_within_radius().
 * Adjust column names to match your actual DB function.
 */
interface NeighborRow {
  parcel_id: string;
  parcel_number: string;
  owner_name: string;
  owner_address: string;
  owner_city: string;
  owner_state: string;
  owner_zip: string;
  distance_feet: string | number;
}

/**
 * Postgres/PostGIS-backed implementation of GisService.
 *
 * This class assumes the following exist in your database:
 * - parcels (id, tenant_id, jurisdiction_id, parcel_id, address, owner_name,
 *   owner_address, zoning_district, land_use, acreage, geometry, centroid)
 * - zoning_districts (id, tenant_id, jurisdiction_id, geometry, zone_code, zone_name, zone_description)
 * - cases (id, tenant_id, parcel_id, case_number, case_type, status, filed_date, hearing_date,
 *   notification_geometry, notification_radius)
 * - functions:
 *   - search_parcels_by_address(jurisdiction_id UUID, query text)
 *   - fuzzy_search_parcels(jurisdiction_id UUID, query text)
 *   - get_parcel_zoning(parcel_id UUID)
 *   - create_notification_buffer(case_id UUID, radius_feet numeric)
 *   - find_neighbors_within_radius(parcel_id UUID, radius_feet numeric)
 *   - generate_notification_recipients(case_id UUID)
 *
 * Row-level security (RLS) is enforced by TenantAwareDb via app.current_tenant_id.
 */
export class PostgresGisService implements GisService {
  constructor(private db: TenantAwareDb) {}

  /**
   * Map TenantContext → jurisdiction_id for DB.
   * For now, we use tenantId as the jurisdiction key; you can change this later
   * if you introduce a separate jurisdictions table.
   */
  private getJurisdictionId(ctx: TenantContext): string {
    return ctx.tenantId;
  }

  async getParcelsGeoJSON(
    ctx: TenantContext
  ): Promise<GeoJSON.FeatureCollection> {
    const jurisdictionId = this.getJurisdictionId(ctx);

    return this.db.withTenant(ctx.tenantId, async (client) => {
      const result = await client.query(
        `
        SELECT jsonb_build_object(
          'type', 'FeatureCollection',
          'features', jsonb_agg(
            jsonb_build_object(
              'type', 'Feature',
              'geometry', ST_AsGeoJSON(geometry)::jsonb,
              'properties', jsonb_build_object(
                'id', id::text,
                'parcelId', parcel_id,
                'address', address,
                'owner', owner_name,
                'zoning', zoning_district,
                'acreage', acreage
              )
            )
          )
        ) as geojson
        FROM parcels
        WHERE jurisdiction_id = $1
        `,
        [jurisdictionId]
      );

      return (
        result.rows[0]?.geojson || {
          type: 'FeatureCollection',
          features: [],
        }
      );
    });
  }

  async searchParcels(
    ctx: TenantContext,
    query: string
  ): Promise<ParcelSearchResult[]> {
    const jurisdictionId = this.getJurisdictionId(ctx);

    return this.db.withTenant(ctx.tenantId, async (client) => {
      // Try full-text search first
      const textSearch = await client.query(
        `SELECT * FROM search_parcels_by_address($1, $2)`,
        [jurisdictionId, query]
      );

      if (textSearch.rows.length > 0) {
        return textSearch.rows.map((row: any): ParcelSearchResult => ({
          parcelId: row.parcel_id,
          parcelNumber: row.parcel_number,
          address: row.address,
          owner: row.owner_name,
          zoning: row.zoning_district,
          location: JSON.parse(row.centroid_json),
          matchQuality: 'EXACT',
          rank: row.rank,
        }));
      }

      // Fallback to fuzzy search for typos
      const fuzzySearch = await client.query(
        `SELECT * FROM fuzzy_search_parcels($1, $2)`,
        [jurisdictionId, query]
      );

      return fuzzySearch.rows.map((row: any): ParcelSearchResult => ({
        parcelId: row.parcel_id,
        parcelNumber: row.parcel_number,
        address: row.address,
        owner: row.owner_name,
        zoning: row.zoning_district,
        location: null,
        matchQuality: 'FUZZY',
        similarity: row.similarity,
      }));
    });
  }

  async getParcelDetails(
    ctx: TenantContext,
    parcelId: string
  ): Promise<ParcelDetails> {
    return this.db.withTenant(ctx.tenantId, async (client) => {
      const parcel = await client.query(
        `
        SELECT 
          id,
          parcel_id,
          address,
          owner_name,
          owner_address,
          zoning_district,
          land_use,
          acreage,
          ST_AsGeoJSON(geometry) as geometry,
          ST_AsGeoJSON(centroid) as centroid
        FROM parcels
        WHERE id = $1
        `,
        [parcelId]
      );

      if (parcel.rows.length === 0) {
        throw new Error('Parcel not found');
      }

      const row = parcel.rows[0];

      const zoning = await client.query(
        `SELECT * FROM get_parcel_zoning($1)`,
        [parcelId]
      );

      const cases = await client.query(
        `
        SELECT case_number, case_type, status, filed_date, hearing_date
        FROM cases
        WHERE parcel_id = $1
        ORDER BY filed_date DESC
        `,
        [parcelId]
      );

      return {
        id: row.id,
        parcelNumber: row.parcel_id,
        address: row.address,
        owner: {
          name: row.owner_name,
          address: row.owner_address,
        },
        zoning: {
          district: row.zoning_district,
          ...(zoning.rows[0] || {}),
        },
        landUse: row.land_use,
        acreage: parseFloat(row.acreage),
        geometry: JSON.parse(row.geometry),
        centroid: JSON.parse(row.centroid),
        activeCases: cases.rows,
      };
    });
  }

  async findNeighborsForNotification(
    ctx: TenantContext,
    params: {
      caseId: string;
      parcelId: string;
      radiusFeet: number;
    }
  ): Promise<NotificationAnalysis> {
    return this.db.withTenant(ctx.tenantId, async (client) => {
      // Create notification buffer geometry for this case
      await client.query(
        `SELECT create_notification_buffer($1, $2)`,
        [params.caseId, params.radiusFeet]
      );

      // Find all neighbors
      const neighbors = await client.query<NeighborRow>(
        `SELECT * FROM find_neighbors_within_radius($1, $2)`,
        [params.parcelId, params.radiusFeet]
      );
      const neighborRows = neighbors.rows;

      const uniqueOwners = this.deduplicateOwners(neighborRows);
      const issues = this.detectAddressIssues(uniqueOwners);

      // Optionally persist recipients in DB for downstream engines
      await client.query(
        `SELECT generate_notification_recipients($1)`,
        [params.caseId]
      );

      // Get notification area as GeoJSON
      const notificationAreaRes = await client.query(
        `
        SELECT ST_AsGeoJSON(notification_geometry) as geometry
        FROM cases
        WHERE id = $1
        `,
        [params.caseId]
      );

      const geometryJson = notificationAreaRes.rows[0]
        ? notificationAreaRes.rows[0].geometry
        : null;

      const notificationArea: GeoJSON.Polygon | null = geometryJson
        ? JSON.parse(geometryJson)
        : null;

      return {
        caseId: params.caseId,
        subjectParcel: params.parcelId,
        notificationRadius: params.radiusFeet,
        parcelsFound: neighborRows.length,
        uniqueOwners: uniqueOwners.length,
        recipients: uniqueOwners,
        issues,
        notificationArea,
        generatedAt: new Date(),
      };
    });
  }

  private deduplicateOwners(parcels: NeighborRow[]): NotificationRecipient[] {
    const ownerMap = new Map<string, NotificationRecipient>();

    for (const parcel of parcels) {
      const addressKey = this.normalizeAddress(
        parcel.owner_address,
        parcel.owner_city,
        parcel.owner_state,
        parcel.owner_zip
      );

      const distanceFeet =
        typeof parcel.distance_feet === 'string'
          ? parseFloat(parcel.distance_feet)
          : parcel.distance_feet;

      if (!ownerMap.has(addressKey)) {
        ownerMap.set(addressKey, {
          name: parcel.owner_name,
          address: parcel.owner_address,
          city: parcel.owner_city,
          state: parcel.owner_state,
          zip: parcel.owner_zip,
          distanceFeet,
          parcelIds: [parcel.parcel_id],
          isOutOfState: parcel.owner_state !== 'IN',
          isPOBox: this.isPOBox(parcel.owner_address),
        });
      } else {
        ownerMap.get(addressKey)!.parcelIds.push(parcel.parcel_id);
      }
    }

    return Array.from(ownerMap.values()).sort(
      (a, b) => a.distanceFeet - b.distanceFeet
    );
  }

  private detectAddressIssues(
    recipients: NotificationRecipient[]
  ): AddressIssue[] {
    const issues: AddressIssue[] = [];

    for (const recipient of recipients) {
      if (!recipient.address || !recipient.city || !recipient.zip) {
        issues.push({
          type: 'INCOMPLETE_ADDRESS',
          recipient: recipient.name,
          message:
            'Address incomplete in assessor database - requires manual lookup',
          severity: 'ERROR',
          parcelIds: recipient.parcelIds,
        });
      }

      if (recipient.isPOBox) {
        issues.push({
          type: 'PO_BOX',
          recipient: recipient.name,
          message:
            'PO Box address - certified mail requires a physical address',
          severity: 'WARNING',
          parcelIds: recipient.parcelIds,
        });
      }

      if (recipient.isOutOfState) {
        issues.push({
          type: 'OUT_OF_STATE',
          recipient: recipient.name,
          message: `Out of state (${recipient.state}) - ensure adequate mailing time`,
          severity: 'INFO',
          parcelIds: recipient.parcelIds,
        });
      }

      if (this.isEntityOwner(recipient.name)) {
        issues.push({
          type: 'ENTITY_OWNER',
          recipient: recipient.name,
          message:
            'Owner appears to be an entity (LLC/Trust/etc.) - verify mailing address',
          severity: 'WARNING',
          parcelIds: recipient.parcelIds,
        });
      }
    }

    return issues;
  }

  private normalizeAddress(
    address: string,
    city: string,
    state: string,
    zip: string
  ): string {
    return `${address}|${city}|${state}|${zip}`.toUpperCase().trim();
  }

  private isPOBox(address: string): boolean {
    return /\b(P\.?O\.? BOX|PO BOX|POST OFFICE BOX)\b/i.test(address);
  }

  private isEntityOwner(name: string): boolean {
    return /\b(LLC|L\.L\.C\.|INC|CORP|TRUST|LP|LTD)\b/i.test(name);
  }

  async getZoningDistrictsGeoJSON(
    ctx: TenantContext
  ): Promise<GeoJSON.FeatureCollection> {
    const jurisdictionId = this.getJurisdictionId(ctx);

    return this.db.withTenant(ctx.tenantId, async (client) => {
      const result = await client.query(
        `
        SELECT jsonb_build_object(
          'type', 'FeatureCollection',
          'features', jsonb_agg(
            jsonb_build_object(
              'type', 'Feature',
              'geometry', ST_AsGeoJSON(geometry)::jsonb,
              'properties', jsonb_build_object(
                'id', id::text,
                'zoneCode', zone_code,
                'zoneName', zone_name,
                'description', zone_description
              )
            )
          )
        ) as geojson
        FROM zoning_districts
        WHERE jurisdiction_id = $1
        `,
        [jurisdictionId]
      );

      return (
        result.rows[0]?.geojson || {
          type: 'FeatureCollection',
          features: [],
        }
      );
    });
  }
}
