// src/engines/gis/postgres-gis.service.ts
import type * as GeoJSON from 'geojson';
import { PoolClient } from 'pg';
import { TenantContext } from '../../core/tenancy/tenancy.types';
import { TenantAwareDb } from '../../db/tenant-aware-db';
import {
  GisService,
} from './gis.service';
import {
  ParcelSearchResult,
  ParcelDetails,
  NotificationAnalysis,
  NotificationRecipient,
  AddressIssue,
  AddressIssueType,
} from './gis.types';

interface NeighborRow {
  parcel_id: string;
  parcel_number: string;
  owner_name: string;
  owner_address: string;
  owner_city: string;
  owner_state: string;
  owner_zip: string;
  distance_feet: number;
}

export class PostgresGisService implements GisService {
  constructor(private db: TenantAwareDb) {}

  private getJurisdictionId(ctx: TenantContext): string {
    return ctx.tenantId;
  }

  async getParcelsGeoJSON(
    ctx: TenantContext
  ): Promise<GeoJSON.FeatureCollection> {
    const jurisdictionId = this.getJurisdictionId(ctx);

    return this.db.withTenant(ctx.tenantId, async (client: PoolClient) => {
      const { rows } = await client.query(
        `
        SELECT
          COALESCE(
            json_build_object(
              'type', 'FeatureCollection',
              'features', json_agg(
                json_build_object(
                  'type', 'Feature',
                  'id', id,
                  'geometry', ST_AsGeoJSON(geom)::json,
                  'properties', json_build_object(
                    'parcel_number', parcel_number,
                    'address', address,
                    'owner', owner_name
                  )
                )
              )
            ),
            json_build_object('type','FeatureCollection','features', '[]'::json)
          ) AS fc
        FROM parcels
        WHERE jurisdiction_id = $1
        `,
        [jurisdictionId]
      );

      const fc = rows[0]?.fc as GeoJSON.FeatureCollection | undefined;
      return fc ?? { type: 'FeatureCollection', features: [] };
    });
  }

  async searchParcels(
    ctx: TenantContext,
    query: string
  ): Promise<ParcelSearchResult[]> {
    const jurisdictionId = this.getJurisdictionId(ctx);

    return this.db.withTenant(ctx.tenantId, async (client: PoolClient) => {
      const exact = await client.query(
        'SELECT * FROM search_parcels_by_address($1, $2)',
        [jurisdictionId, query]
      );

      if (exact.rows.length > 0) {
        return exact.rows.map<ParcelSearchResult>((r) => ({
          parcelId: r.parcel_id,
          parcelNumber: r.parcel_number,
          address: r.address,
          owner: r.owner_name,
          zoning: r.zoning,
          location: r.location ? (JSON.parse(r.location) as GeoJSON.Point) : null,
          matchQuality: 'EXACT',
          rank: r.rank ?? undefined,
        }));
      }

      const fuzzy = await client.query(
        'SELECT * FROM fuzzy_search_parcels($1, $2)',
        [jurisdictionId, query]
      );

      return fuzzy.rows.map<ParcelSearchResult>((r) => ({
        parcelId: r.parcel_id,
        parcelNumber: r.parcel_number,
        address: r.address,
        owner: r.owner_name,
        zoning: r.zoning,
        location: r.location ? (JSON.parse(r.location) as GeoJSON.Point) : null,
        matchQuality: 'FUZZY',
        rank: r.rank ?? undefined,
        similarity: r.similarity ?? undefined,
      }));
    });
  }

  async getParcelDetails(
    ctx: TenantContext,
    parcelId: string
  ): Promise<ParcelDetails> {
    return this.db.withTenant(ctx.tenantId, async (client: PoolClient) => {
      const parcelResult = await client.query(
        `
        SELECT
          id,
          parcel_number,
          address,
          owner_name,
          owner_address,
          zoning,
          land_use,
          acreage,
          ST_AsGeoJSON(geom)::json AS geometry,
          ST_AsGeoJSON(ST_Centroid(geom))::json AS centroid
        FROM parcels
        WHERE id = $1
        `,
        [parcelId]
      );

      const parcelRow = parcelResult.rows[0];
      if (!parcelRow) {
        throw new Error('Parcel not found');
      }

      const zoningResult = await client.query(
        'SELECT * FROM get_parcel_zoning($1)',
        [parcelId]
      );

      const zoningRow = zoningResult.rows[0] ?? {};

      const casesResult = await client.query(
        `
        SELECT id, case_type, status, filed_date
        FROM cases
        WHERE parcel_id = $1
        ORDER BY filed_date DESC
        `,
        [parcelId]
      );

      const details: ParcelDetails = {
        id: parcelRow.id,
        parcelNumber: parcelRow.parcel_number,
        address: parcelRow.address,
        owner: {
          name: parcelRow.owner_name,
          address: parcelRow.owner_address,
        },
        zoning: {
          district: parcelRow.zoning,
          zone_code: zoningRow.zone_code,
          zone_name: zoningRow.zone_name,
          zone_description: zoningRow.zone_description,
        },
        landUse: parcelRow.land_use,
        acreage: parcelRow.acreage,
        geometry: parcelRow.geometry as GeoJSON.MultiPolygon,
        centroid: parcelRow.centroid as GeoJSON.Point,
        activeCases: casesResult.rows,
      };

      return details;
    });
  }

  async findNeighborsForNotification(
    ctx: TenantContext,
    params: { caseId: string; parcelId: string; radiusFeet: number }
  ): Promise<NotificationAnalysis> {
    const { caseId, parcelId, radiusFeet } = params;

    return this.db.withTenant(ctx.tenantId, async (client: PoolClient) => {
      await client.query(
        'SELECT create_notification_buffer($1, $2)',
        [caseId, radiusFeet]
      );

      const neighborsResult = await client.query(
        'SELECT * FROM find_neighbors_within_radius($1, $2)',
        [parcelId, radiusFeet]
      );

      const recipients = this.deduplicateOwners(
        neighborsResult.rows as NeighborRow[]
      );
      const issues = this.detectAddressIssues(recipients);

      await client.query(
        'SELECT generate_notification_recipients($1)',
        [caseId]
      );

      const areaResult = await client.query(
        `
        SELECT ST_AsGeoJSON(notification_geometry) AS geojson
        FROM cases
        WHERE id = $1
        `,
        [caseId]
      );

      const notificationArea =
        areaResult.rows[0]?.geojson
          ? (JSON.parse(areaResult.rows[0].geojson) as GeoJSON.Polygon)
          : null;

      const analysis: NotificationAnalysis = {
        caseId,
        subjectParcel: parcelId,
        notificationRadius: radiusFeet,
        parcelsFound: neighborsResult.rows.length,
        uniqueOwners: recipients.length,
        recipients,
        issues,
        notificationArea,
        generatedAt: new Date(),
      };

      return analysis;
    });
  }

  async getZoningDistrictsGeoJSON(
    ctx: TenantContext
  ): Promise<GeoJSON.FeatureCollection> {
    return this.db.withTenant(ctx.tenantId, async (client: PoolClient) => {
      const { rows } = await client.query(
        `
        SELECT
          COALESCE(
            json_build_object(
              'type', 'FeatureCollection',
              'features', json_agg(
                json_build_object(
                  'type', 'Feature',
                  'id', id,
                  'geometry', ST_AsGeoJSON(geom)::json,
                  'properties', json_build_object(
                    'district', district,
                    'code', code,
                    'name', name
                  )
                )
              )
            ),
            json_build_object('type','FeatureCollection','features', '[]'::json)
          ) AS fc
        FROM zoning_districts
        `
      );

      const fc = rows[0]?.fc as GeoJSON.FeatureCollection | undefined;
      return fc ?? { type: 'FeatureCollection', features: [] };
    });
  }

  private deduplicateOwners(rows: NeighborRow[]): NotificationRecipient[] {
    const byOwner: Map<string, NotificationRecipient> = new Map();

    for (const row of rows) {
      const key = [
        row.owner_name?.toLowerCase() ?? '',
        row.owner_address?.toLowerCase() ?? '',
        row.owner_city?.toLowerCase() ?? '',
        row.owner_state?.toLowerCase() ?? '',
        row.owner_zip?.toLowerCase() ?? '',
      ].join('|');

      const existing = byOwner.get(key);
      const isPOBox = /p\.?o\.?\s*box/i.test(row.owner_address ?? '');
      const isOutOfState =
        (row.owner_state ?? '').toUpperCase() !== 'IN';

      if (existing) {
        existing.parcelIds.push(row.parcel_id);
        existing.distanceFeet = Math.min(existing.distanceFeet, row.distance_feet);
      } else {
        byOwner.set(key, {
          name: row.owner_name,
          address: row.owner_address,
          city: row.owner_city,
          state: row.owner_state,
          zip: row.owner_zip,
          distanceFeet: row.distance_feet,
          parcelIds: [row.parcel_id],
          isOutOfState,
          isPOBox,
        });
      }
    }

    return Array.from(byOwner.values()).sort(
      (a, b) => a.distanceFeet - b.distanceFeet
    );
  }

  private detectAddressIssues(
    recipients: NotificationRecipient[]
  ): AddressIssue[] {
    const issues: AddressIssue[] = [];

    for (const recipient of recipients) {
      const addressParts = [
        recipient.address,
        recipient.city,
        recipient.state,
        recipient.zip,
      ];
      const hasIncomplete = addressParts.some(
        (part) => !part || String(part).trim() === ''
      );

      if (hasIncomplete) {
        issues.push({
          type: 'INCOMPLETE_ADDRESS',
          recipient: recipient.name,
          message: 'Missing address components for recipient.',
          severity: 'WARNING',
          parcelIds: recipient.parcelIds,
        });
      }

      if (recipient.isPOBox) {
        issues.push({
          type: 'PO_BOX',
          recipient: recipient.name,
          message: 'Recipient address is a PO Box.',
          severity: 'INFO',
          parcelIds: recipient.parcelIds,
        });
      }

      if (recipient.isOutOfState) {
        issues.push({
          type: 'OUT_OF_STATE',
          recipient: recipient.name,
          message: 'Recipient is out of state.',
          severity: 'INFO',
          parcelIds: recipient.parcelIds,
        });
      }

      if (/LLC|INC|CORP|COMPANY|TRUST/i.test(recipient.name ?? '')) {
        issues.push({
          type: 'ENTITY_OWNER',
          recipient: recipient.name,
          message: 'Recipient appears to be an entity (LLC/Inc).',
          severity: 'INFO',
          parcelIds: recipient.parcelIds,
        });
      }
    }

    return issues;
  }
}
