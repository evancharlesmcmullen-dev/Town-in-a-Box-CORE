-- Migration: Core tables (tenants, users, files, audit) + Meetings + Notices
-- Depends on: 20251124_gis_parcels_and_notification.sql

BEGIN;

-- ============================================
-- CORE: tenants
-- ============================================

CREATE TABLE IF NOT EXISTS tenants (
  id UUID PRIMARY KEY,                    -- RLS key (UUID, not slug)
  slug TEXT NOT NULL UNIQUE,              -- human-friendly: 'lapel-in'
  name TEXT NOT NULL,                     -- 'Town of Lapel'
  kind TEXT NOT NULL,                     -- 'town' | 'city' | 'township'
  state TEXT NOT NULL DEFAULT 'IN',
  population INTEGER,
  county_name TEXT,
  modules_enabled TEXT[] NOT NULL DEFAULT '{}',
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================
-- CORE: users
-- ============================================

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================
-- CORE: user_tenant_memberships
-- ============================================

CREATE TABLE IF NOT EXISTS user_tenant_memberships (
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL,
  PRIMARY KEY (tenant_id, user_id)
);

-- ============================================
-- CORE: files (for document storage references)
-- ============================================

CREATE TABLE IF NOT EXISTS files (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  filename TEXT NOT NULL,
  mime_type TEXT,
  size_bytes BIGINT,
  storage_path TEXT NOT NULL,             -- S3 key, local path, etc.
  checksum TEXT,                          -- SHA-256 or similar
  uploaded_by_user_id UUID REFERENCES users(id),
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  metadata JSONB
);

CREATE INDEX IF NOT EXISTS idx_files_tenant
  ON files (tenant_id);

ALTER TABLE files ENABLE ROW LEVEL SECURITY;
CREATE POLICY files_tenant_isolation ON files
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

-- ============================================
-- CORE: audit_log
-- ============================================

CREATE TABLE IF NOT EXISTS audit_log (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  actor_user_id UUID REFERENCES users(id),
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  action TEXT NOT NULL,
  payload JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_tenant_entity
  ON audit_log (tenant_id, entity_type, entity_id);

ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY audit_log_tenant_isolation ON audit_log
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

-- ============================================
-- GOVERNING BODIES
-- ============================================

CREATE TABLE IF NOT EXISTS governing_bodies (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  code TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_governing_bodies_tenant
  ON governing_bodies (tenant_id);

ALTER TABLE governing_bodies ENABLE ROW LEVEL SECURITY;
CREATE POLICY governing_bodies_tenant_isolation ON governing_bodies
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

-- ============================================
-- NOTICES (Open Door Law + general notices)
-- Maps to Notice type: relatedType='Meeting', relatedId=meeting.id
-- ============================================

CREATE TABLE IF NOT EXISTS notices (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  type TEXT NOT NULL,                     -- 'meeting' | 'budget' | 'hearing' | etc.
  title TEXT NOT NULL,
  body TEXT,
  channels TEXT[] NOT NULL DEFAULT '{}',  -- ['website', 'officePosting']
  related_type TEXT,                      -- 'Meeting', 'CodeCase', etc.
  related_id TEXT,                        -- UUID as text for flexibility
  effective_date TIMESTAMPTZ,
  created_by_user_id UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notices_tenant
  ON notices (tenant_id);

CREATE INDEX IF NOT EXISTS idx_notices_related
  ON notices (tenant_id, related_type, related_id);

ALTER TABLE notices ENABLE ROW LEVEL SECURITY;
CREATE POLICY notices_tenant_isolation ON notices
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

-- ============================================
-- NOTICE DELIVERIES (proof of posting)
-- ============================================

CREATE TABLE IF NOT EXISTS notice_deliveries (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  notice_id UUID NOT NULL REFERENCES notices(id) ON DELETE CASCADE,
  channel TEXT NOT NULL,
  delivered_at TIMESTAMPTZ NOT NULL,
  delivered_by_user_id UUID REFERENCES users(id),
  proof_record_id UUID,                   -- FK to records table (later)
  details JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notice_deliveries_notice
  ON notice_deliveries (notice_id);

ALTER TABLE notice_deliveries ENABLE ROW LEVEL SECURITY;
CREATE POLICY notice_deliveries_tenant_isolation ON notice_deliveries
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

-- ============================================
-- MEETINGS
-- ============================================

CREATE TABLE IF NOT EXISTS meetings (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  body_id UUID NOT NULL REFERENCES governing_bodies(id) ON DELETE CASCADE,
  type TEXT NOT NULL,                     -- 'regular' | 'special' | 'emergency' | 'executiveSession'
  status TEXT NOT NULL,                   -- 'planned' | 'noticed' | 'inSession' | 'adjourned' | 'cancelled'
  scheduled_start TIMESTAMPTZ NOT NULL,
  scheduled_end TIMESTAMPTZ,
  location TEXT NOT NULL,

  -- Notice lifecycle
  notice_posted_at TIMESTAMPTZ,           -- when first notice was posted
  last_notice_posted_at TIMESTAMPTZ,      -- most recent notice posting (for amendments)

  -- Cancellation lifecycle
  cancelled_at TIMESTAMPTZ,
  cancellation_reason TEXT,

  created_by_user_id UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_meetings_tenant_date
  ON meetings (tenant_id, scheduled_start);

CREATE INDEX IF NOT EXISTS idx_meetings_body
  ON meetings (tenant_id, body_id);

ALTER TABLE meetings ENABLE ROW LEVEL SECURITY;
CREATE POLICY meetings_tenant_isolation ON meetings
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

-- ============================================
-- AGENDA ITEMS
-- ============================================

CREATE TABLE IF NOT EXISTS agenda_items (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  meeting_id UUID NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
  order_index INTEGER NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  related_type TEXT,
  related_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_agenda_meeting
  ON agenda_items (meeting_id, order_index);

ALTER TABLE agenda_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY agenda_items_tenant_isolation ON agenda_items
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

-- ============================================
-- MINUTES
-- ============================================

CREATE TABLE IF NOT EXISTS minutes (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  meeting_id UUID NOT NULL UNIQUE REFERENCES meetings(id) ON DELETE CASCADE,
  prepared_by_user_id UUID REFERENCES users(id),
  prepared_at TIMESTAMPTZ,
  approved_at TIMESTAMPTZ,
  body TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE minutes ENABLE ROW LEVEL SECURITY;
CREATE POLICY minutes_tenant_isolation ON minutes
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

-- ============================================
-- VOTE RECORDS
-- ============================================

CREATE TABLE IF NOT EXISTS vote_records (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  meeting_id UUID NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
  agenda_item_id UUID REFERENCES agenda_items(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES users(id),
  vote TEXT NOT NULL,
  voted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_votes_meeting
  ON vote_records (meeting_id);

ALTER TABLE vote_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY vote_records_tenant_isolation ON vote_records
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

COMMIT;
