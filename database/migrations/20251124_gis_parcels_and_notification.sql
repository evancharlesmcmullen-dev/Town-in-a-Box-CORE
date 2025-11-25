-- Migration: GIS parcels, zoning, cases, and notification helpers
-- Assumes PostgreSQL 14+ with PostGIS and pg_trgm installed.

-- ============================
-- Extensions
-- ============================
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ============================
-- Schema: parcels
-- ============================
CREATE TABLE IF NOT EXISTS parcels (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL,
  jurisdiction_id UUID NOT NULL,
  parcel_id TEXT,
  parcel_number TEXT,
  address TEXT,
  owner_name TEXT,
  owner_address TEXT,
  owner_city TEXT,
  owner_state TEXT,
  owner_zip TEXT,
  zoning_district TEXT,
  land_use TEXT,
  acreage NUMERIC,
  geom geometry(MultiPolygon, 4326),
  centroid geometry(Point, 4326)
);

CREATE INDEX IF NOT EXISTS idx_parcels_tenant_jurisdiction
  ON parcels (tenant_id, jurisdiction_id);

ALTER TABLE parcels ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS parcels_tenant_isolation ON parcels
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

-- ============================
-- Schema: zoning_districts
-- ============================
CREATE TABLE IF NOT EXISTS zoning_districts (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL,
  jurisdiction_id UUID NOT NULL,
  zone_code TEXT,
  zone_name TEXT,
  zone_description TEXT,
  geom geometry(MultiPolygon, 4326)
);

CREATE INDEX IF NOT EXISTS idx_zoning_districts_tenant_jurisdiction
  ON zoning_districts (tenant_id, jurisdiction_id);

ALTER TABLE zoning_districts ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS zoning_districts_tenant_isolation ON zoning_districts
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

-- ============================
-- Schema: cases (minimal GIS fields)
-- ============================
CREATE TABLE IF NOT EXISTS cases (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL,
  parcel_id UUID NOT NULL,
  case_number TEXT,
  case_type TEXT,
  status TEXT,
  filed_date DATE,
  hearing_date DATE,
  notification_geometry geometry(Polygon, 4326),
  notification_radius NUMERIC
);

ALTER TABLE cases ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS cases_tenant_isolation ON cases
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

-- ============================
-- Schema: notification_recipients
-- ============================
CREATE TABLE IF NOT EXISTS notification_recipients (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL,
  case_id UUID NOT NULL,
  parcel_id UUID NOT NULL,
  owner_name TEXT,
  owner_address TEXT,
  owner_city TEXT,
  owner_state TEXT,
  owner_zip TEXT,
  distance_from_subject NUMERIC
);

ALTER TABLE notification_recipients ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS notification_recipients_tenant_isolation ON notification_recipients
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

-- ============================
-- Search helpers
-- ============================
CREATE OR REPLACE FUNCTION search_parcels_by_address(jurisdiction_id UUID, query TEXT)
RETURNS TABLE (
  parcel_id UUID,
  parcel_number TEXT,
  address TEXT,
  owner_name TEXT,
  zoning TEXT,
  location TEXT
) AS $$
SELECT
  p.id AS parcel_id,
  p.parcel_number,
  p.address,
  p.owner_name,
  p.zoning_district AS zoning,
  ST_AsGeoJSON(p.centroid) AS location
FROM parcels p
WHERE p.jurisdiction_id = search_parcels_by_address.jurisdiction_id
  AND p.address ILIKE '%' || search_parcels_by_address.query || '%';
$$ LANGUAGE sql STABLE;

CREATE OR REPLACE FUNCTION fuzzy_search_parcels(jurisdiction_id UUID, query TEXT)
RETURNS TABLE (
  parcel_id UUID,
  parcel_number TEXT,
  address TEXT,
  owner_name TEXT,
  zoning TEXT,
  location TEXT,
  similarity DOUBLE PRECISION
) AS $$
SELECT
  p.id AS parcel_id,
  p.parcel_number,
  p.address,
  p.owner_name,
  p.zoning_district AS zoning,
  ST_AsGeoJSON(p.centroid) AS location,
  similarity(p.address, fuzzy_search_parcels.query) AS similarity
FROM parcels p
WHERE p.jurisdiction_id = fuzzy_search_parcels.jurisdiction_id
ORDER BY p.address <-> fuzzy_search_parcels.query
LIMIT 20;
$$ LANGUAGE sql STABLE;

CREATE OR REPLACE FUNCTION get_parcel_zoning(parcel_id UUID)
RETURNS TABLE (
  zone_code TEXT,
  zone_name TEXT,
  zone_description TEXT
) AS $$
SELECT
  z.zone_code,
  z.zone_name,
  z.zone_description
FROM parcels p
LEFT JOIN zoning_districts z
  ON p.zoning_district = z.zone_code
WHERE p.id = get_parcel_zoning.parcel_id
LIMIT 1;
$$ LANGUAGE sql STABLE;

-- ============================
-- Notification helpers
-- ============================
CREATE OR REPLACE FUNCTION create_notification_buffer(case_id UUID, radius_feet NUMERIC)
RETURNS VOID AS $$
DECLARE
  radius_meters NUMERIC := radius_feet * 0.3048;
  parcel_geom geometry;
BEGIN
  SELECT p.geom INTO parcel_geom
  FROM parcels p
  JOIN cases c ON c.parcel_id = p.id
  WHERE c.id = case_id;

  IF parcel_geom IS NOT NULL THEN
    UPDATE cases
      SET notification_geometry = ST_Buffer(parcel_geom::geography, radius_meters)::geometry,
          notification_radius = radius_feet
    WHERE id = case_id;
  END IF;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION find_neighbors_within_radius(parcel_id UUID, radius_feet NUMERIC)
RETURNS TABLE (
  parcel_id UUID,
  parcel_number TEXT,
  owner_name TEXT,
  owner_address TEXT,
  owner_city TEXT,
  owner_state TEXT,
  owner_zip TEXT,
  distance_feet NUMERIC
) AS $$
DECLARE
  subject_geom geography;
  radius_meters NUMERIC := radius_feet * 0.3048;
BEGIN
  SELECT geom::geography INTO subject_geom FROM parcels WHERE id = parcel_id;

  RETURN QUERY
  SELECT
    p.id AS parcel_id,
    p.parcel_number,
    p.owner_name,
    p.owner_address,
    p.owner_city,
    p.owner_state,
    p.owner_zip,
    ST_Distance(subject_geom, p.geom::geography) / 0.3048 AS distance_feet
  FROM parcels p
  WHERE p.id <> parcel_id
    AND ST_DWithin(subject_geom, p.geom::geography, radius_meters);
END;
$$ LANGUAGE plpgsql STABLE;

CREATE OR REPLACE FUNCTION generate_notification_recipients(case_id UUID)
RETURNS VOID AS $$
DECLARE
  radius_feet NUMERIC;
  parcel_id UUID;
BEGIN
  SELECT c.notification_radius, c.parcel_id INTO radius_feet, parcel_id
  FROM cases c
  WHERE c.id = case_id;

  IF radius_feet IS NULL OR parcel_id IS NULL THEN
    RETURN;
  END IF;

  DELETE FROM notification_recipients WHERE case_id = case_id;

  INSERT INTO notification_recipients (
    id, tenant_id, case_id, parcel_id,
    owner_name, owner_address, owner_city, owner_state, owner_zip,
    distance_from_subject
  )
  SELECT
    gen_random_uuid(),
    current_setting('app.current_tenant_id', true)::uuid,
    case_id,
    n.parcel_id,
    n.owner_name,
    n.owner_address,
    n.owner_city,
    n.owner_state,
    n.owner_zip,
    n.distance_feet
  FROM find_neighbors_within_radius(parcel_id, radius_feet) AS n;
END;
$$ LANGUAGE plpgsql;
