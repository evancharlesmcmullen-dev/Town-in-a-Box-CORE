-- Migration: Enhanced Meetings Module
-- Purpose: Add executive sessions, agendas, quorum, recusals, media per CLAUDE.md spec
-- Depends on: 20251127_core_and_meetings.sql

BEGIN;

-- ============================================
-- LOCATIONS (for meeting venues)
-- ============================================

CREATE TABLE IF NOT EXISTS locations (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  address_line1 TEXT,
  address_line2 TEXT,
  city TEXT,
  state TEXT DEFAULT 'IN',
  zip_code TEXT,
  is_default BOOLEAN DEFAULT false,
  accessibility_info TEXT,
  capacity INTEGER,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_locations_tenant
  ON locations (tenant_id);

ALTER TABLE locations ENABLE ROW LEVEL SECURITY;
CREATE POLICY locations_tenant_isolation ON locations
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

-- ============================================
-- GOVERNING BODY MEMBERS
-- ============================================

CREATE TABLE IF NOT EXISTS governing_body_members (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  body_id UUID NOT NULL REFERENCES governing_bodies(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT,                                -- e.g., 'President', 'Vice President', 'Member'
  seat_number INTEGER,
  term_start DATE,
  term_end DATE,
  is_voting_member BOOLEAN DEFAULT true,
  is_active BOOLEAN DEFAULT true,
  appointed_at TIMESTAMPTZ,
  resigned_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(body_id, user_id, term_start)
);

CREATE INDEX IF NOT EXISTS idx_gbm_tenant_body
  ON governing_body_members (tenant_id, body_id);

CREATE INDEX IF NOT EXISTS idx_gbm_active
  ON governing_body_members (body_id, is_active);

ALTER TABLE governing_body_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY gbm_tenant_isolation ON governing_body_members
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

-- ============================================
-- ADD COLUMNS TO GOVERNING BODIES
-- ============================================

ALTER TABLE governing_bodies
  ADD COLUMN IF NOT EXISTS body_type TEXT,                    -- 'COUNCIL' | 'BOARD' | 'BZA' | 'PLAN_COMMISSION' etc.
  ADD COLUMN IF NOT EXISTS quorum_type TEXT DEFAULT 'MAJORITY', -- 'MAJORITY' | 'TWO_THIRDS' | 'SPECIFIC'
  ADD COLUMN IF NOT EXISTS quorum_number INTEGER,             -- used when quorum_type = 'SPECIFIC'
  ADD COLUMN IF NOT EXISTS total_seats INTEGER DEFAULT 5,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- ============================================
-- ADD COLUMNS TO MEETINGS
-- ============================================

ALTER TABLE meetings
  ADD COLUMN IF NOT EXISTS location_id UUID REFERENCES locations(id),
  ADD COLUMN IF NOT EXISTS is_hybrid BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS remote_meeting_link TEXT,
  ADD COLUMN IF NOT EXISTS is_emergency BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS actual_start TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS actual_end TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS recessed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS adjourned_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS adjourned_by_user_id UUID REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS cancelled_by_user_id UUID REFERENCES users(id);

-- ============================================
-- AGENDAS (separate from agenda_items)
-- ============================================

-- An Agenda represents the complete published agenda document for a meeting
CREATE TABLE IF NOT EXISTS agendas (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  meeting_id UUID NOT NULL UNIQUE REFERENCES meetings(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'DRAFT',        -- DRAFT | PENDING_APPROVAL | APPROVED | PUBLISHED | AMENDED
  version INTEGER NOT NULL DEFAULT 1,
  title TEXT,
  preamble TEXT,                               -- Opening text before items
  postamble TEXT,                              -- Closing text after items
  published_at TIMESTAMPTZ,
  published_by_user_id UUID REFERENCES users(id),
  approved_at TIMESTAMPTZ,
  approved_by_user_id UUID REFERENCES users(id),
  document_file_id UUID REFERENCES files(id),  -- PDF of the final agenda
  created_by_user_id UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_agendas_meeting
  ON agendas (meeting_id);

ALTER TABLE agendas ENABLE ROW LEVEL SECURITY;
CREATE POLICY agendas_tenant_isolation ON agendas
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

-- ============================================
-- ENHANCE AGENDA ITEMS
-- ============================================

ALTER TABLE agenda_items
  ADD COLUMN IF NOT EXISTS agenda_id UUID REFERENCES agendas(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'PENDING',     -- PENDING | DISCUSSED | TABLED | WITHDRAWN | ACTED_UPON
  ADD COLUMN IF NOT EXISTS item_type TEXT DEFAULT 'REGULAR',  -- REGULAR | CONSENT | PUBLIC_HEARING | EXECUTIVE_SESSION | CEREMONIAL
  ADD COLUMN IF NOT EXISTS parent_item_id UUID REFERENCES agenda_items(id),
  ADD COLUMN IF NOT EXISTS duration_minutes INTEGER,
  ADD COLUMN IF NOT EXISTS requires_vote BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS requires_public_hearing BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS presenter_name TEXT,
  ADD COLUMN IF NOT EXISTS presenter_user_id UUID REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS supporting_document_ids UUID[],
  ADD COLUMN IF NOT EXISTS discussion_notes TEXT,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- ============================================
-- EXECUTIVE SESSIONS (IC 5-14-1.5-6.1)
-- ============================================

CREATE TABLE IF NOT EXISTS executive_sessions (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  meeting_id UUID NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
  agenda_item_id UUID REFERENCES agenda_items(id),

  -- Session details
  status TEXT NOT NULL DEFAULT 'PENDING',      -- PENDING | IN_SESSION | ENDED | CERTIFIED | CANCELLED
  basis_code TEXT NOT NULL,                    -- PERSONNEL | COLLECTIVE_BARGAINING | LITIGATION | etc.
  basis_description TEXT,
  statutory_cite TEXT NOT NULL,                -- e.g., 'IC 5-14-1.5-6.1(b)(1)'
  subject TEXT NOT NULL,                       -- General subject (cannot reveal confidential matters)

  -- Timing
  scheduled_start TIMESTAMPTZ,
  actual_start TIMESTAMPTZ,
  actual_end TIMESTAMPTZ,

  -- Attendees (subset of body members for this session)
  attendee_user_ids UUID[],

  -- Pre-session certification (required before entering)
  pre_cert_statement TEXT,
  pre_cert_by_user_id UUID REFERENCES users(id),
  pre_cert_at TIMESTAMPTZ,

  -- Post-session certification (required after ending)
  post_cert_statement TEXT,                    -- "No subject matter other than that stated was discussed"
  post_cert_by_user_id UUID REFERENCES users(id),
  post_cert_at TIMESTAMPTZ,
  post_cert_document_id UUID REFERENCES files(id),

  created_by_user_id UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_exec_sessions_meeting
  ON executive_sessions (tenant_id, meeting_id);

CREATE INDEX IF NOT EXISTS idx_exec_sessions_status
  ON executive_sessions (tenant_id, status);

ALTER TABLE executive_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY exec_sessions_tenant_isolation ON executive_sessions
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

-- ============================================
-- MEMBER RECUSALS
-- ============================================

CREATE TABLE IF NOT EXISTS member_recusals (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  meeting_id UUID NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
  agenda_item_id UUID REFERENCES agenda_items(id),  -- NULL means recused from entire meeting
  member_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reason TEXT,
  statutory_cite TEXT,                         -- e.g., 'IC 35-44.1-1-4' (conflict of interest)
  disclosed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_recusals_meeting
  ON member_recusals (tenant_id, meeting_id);

CREATE INDEX IF NOT EXISTS idx_recusals_item
  ON member_recusals (agenda_item_id);

ALTER TABLE member_recusals ENABLE ROW LEVEL SECURITY;
CREATE POLICY recusals_tenant_isolation ON member_recusals
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

-- ============================================
-- MEETING ACTIONS (motions, resolutions, ordinances)
-- ============================================

CREATE TABLE IF NOT EXISTS meeting_actions (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  meeting_id UUID NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
  agenda_item_id UUID REFERENCES agenda_items(id),

  action_type TEXT NOT NULL,                   -- MOTION | RESOLUTION | ORDINANCE | AMENDMENT | NOMINATION
  action_number TEXT,                          -- e.g., 'Resolution 2025-001'
  title TEXT NOT NULL,
  description TEXT,

  -- Motion workflow
  moved_by_user_id UUID REFERENCES users(id),
  seconded_by_user_id UUID REFERENCES users(id),
  moved_at TIMESTAMPTZ,

  -- Result
  result TEXT,                                 -- PASSED | FAILED | TABLED | WITHDRAWN | DIED_FOR_LACK_OF_SECOND
  effective_date DATE,

  -- Document references
  document_file_id UUID REFERENCES files(id),

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_actions_meeting
  ON meeting_actions (tenant_id, meeting_id);

ALTER TABLE meeting_actions ENABLE ROW LEVEL SECURITY;
CREATE POLICY actions_tenant_isolation ON meeting_actions
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

-- ============================================
-- ENHANCE VOTE RECORDS
-- ============================================

ALTER TABLE vote_records
  ADD COLUMN IF NOT EXISTS action_id UUID REFERENCES meeting_actions(id),
  ADD COLUMN IF NOT EXISTS is_recused BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS recusal_id UUID REFERENCES member_recusals(id),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- ============================================
-- MINUTES DRAFTS (workflow for minutes approval)
-- ============================================

ALTER TABLE minutes
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'DRAFT',       -- DRAFT | PENDING_APPROVAL | APPROVED | AMENDED
  ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS approved_by_user_id UUID REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS approval_meeting_id UUID REFERENCES meetings(id),  -- Meeting where minutes were approved
  ADD COLUMN IF NOT EXISTS document_file_id UUID REFERENCES files(id),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- ============================================
-- MINUTES AMENDMENTS
-- ============================================

CREATE TABLE IF NOT EXISTS minutes_amendments (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  minutes_id UUID NOT NULL REFERENCES minutes(id) ON DELETE CASCADE,
  amendment_type TEXT NOT NULL,                -- CORRECTION | ADDITION | DELETION
  section_reference TEXT,
  original_text TEXT,
  amended_text TEXT,
  reason TEXT,
  proposed_by_user_id UUID REFERENCES users(id),
  proposed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  approved_at TIMESTAMPTZ,
  approved_at_meeting_id UUID REFERENCES meetings(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_amendments_minutes
  ON minutes_amendments (minutes_id);

ALTER TABLE minutes_amendments ENABLE ROW LEVEL SECURITY;
CREATE POLICY amendments_tenant_isolation ON minutes_amendments
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

-- ============================================
-- MEETING MEDIA (recordings, presentations)
-- ============================================

CREATE TABLE IF NOT EXISTS meeting_media (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  meeting_id UUID NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,

  media_type TEXT NOT NULL,                    -- VIDEO | AUDIO | PRESENTATION | DOCUMENT | EXHIBIT
  title TEXT NOT NULL,
  description TEXT,

  -- Storage
  file_id UUID REFERENCES files(id),
  external_url TEXT,                           -- YouTube, Vimeo, etc.
  provider TEXT,                               -- 'youtube' | 'vimeo' | 'local' | 'granicus'

  -- Duration/timing
  duration_seconds INTEGER,
  start_offset_seconds INTEGER,                -- For partial recordings

  -- Status
  status TEXT DEFAULT 'PROCESSING',            -- PROCESSING | AVAILABLE | FAILED | ARCHIVED
  is_public BOOLEAN DEFAULT true,

  uploaded_by_user_id UUID REFERENCES users(id),
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_media_meeting
  ON meeting_media (tenant_id, meeting_id);

ALTER TABLE meeting_media ENABLE ROW LEVEL SECURITY;
CREATE POLICY media_tenant_isolation ON meeting_media
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

-- ============================================
-- MEDIA TIMESTAMPS (linking agenda items to recording times)
-- ============================================

CREATE TABLE IF NOT EXISTS media_timestamps (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  media_id UUID NOT NULL REFERENCES meeting_media(id) ON DELETE CASCADE,
  agenda_item_id UUID REFERENCES agenda_items(id),
  action_id UUID REFERENCES meeting_actions(id),

  timestamp_seconds INTEGER NOT NULL,
  label TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_timestamps_media
  ON media_timestamps (media_id);

ALTER TABLE media_timestamps ENABLE ROW LEVEL SECURITY;
CREATE POLICY timestamps_tenant_isolation ON media_timestamps
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

-- ============================================
-- PUBLICATION RULES
-- ============================================

CREATE TABLE IF NOT EXISTS publication_rules (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  rule_type TEXT NOT NULL,                     -- GENERAL_HEARING | BOND_HEARING | BUDGET | ZONING | ANNEXATION

  -- Publication requirements
  required_publications INTEGER NOT NULL,       -- Number of times to publish
  required_lead_days INTEGER NOT NULL,          -- Days before hearing
  must_be_consecutive BOOLEAN DEFAULT false,

  -- Channel requirements
  required_channels TEXT[],                     -- ['NEWSPAPER', 'WEBSITE']

  -- Statutory reference
  statutory_cite TEXT NOT NULL,                -- e.g., 'IC 5-3-1-2'
  description TEXT,

  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pub_rules_tenant
  ON publication_rules (tenant_id, rule_type);

ALTER TABLE publication_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY pub_rules_tenant_isolation ON publication_rules
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

-- ============================================
-- NEWSPAPER SCHEDULES (for publication deadline calculation)
-- ============================================

CREATE TABLE IF NOT EXISTS newspaper_schedules (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,                          -- e.g., 'Herald Bulletin'
  publication_days INTEGER[] NOT NULL,         -- 0=Sunday through 6=Saturday (e.g., [0, 3, 5] for Sun, Wed, Fri)
  submission_lead_days INTEGER NOT NULL,       -- Days before publication to submit
  is_legal_publication BOOLEAN DEFAULT true,   -- Qualified for legal notices
  contact_info JSONB,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_newspapers_tenant
  ON newspaper_schedules (tenant_id);

ALTER TABLE newspaper_schedules ENABLE ROW LEVEL SECURITY;
CREATE POLICY newspapers_tenant_isolation ON newspaper_schedules
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

-- ============================================
-- APRA RECORD BUNDLES (for public records compliance)
-- ============================================

CREATE TABLE IF NOT EXISTS meeting_record_bundles (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  meeting_id UUID NOT NULL UNIQUE REFERENCES meetings(id) ON DELETE CASCADE,

  -- Bundle status
  status TEXT NOT NULL DEFAULT 'PENDING',      -- PENDING | ASSEMBLING | COMPLETE | ARCHIVED

  -- Included records
  agenda_file_id UUID REFERENCES files(id),
  minutes_file_id UUID REFERENCES files(id),
  notice_file_ids UUID[],
  supporting_document_ids UUID[],
  media_file_ids UUID[],

  -- Archive info
  archived_at TIMESTAMPTZ,
  archive_location TEXT,                       -- Path in long-term storage

  assembled_at TIMESTAMPTZ,
  assembled_by_user_id UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bundles_meeting
  ON meeting_record_bundles (tenant_id, meeting_id);

ALTER TABLE meeting_record_bundles ENABLE ROW LEVEL SECURITY;
CREATE POLICY bundles_tenant_isolation ON meeting_record_bundles
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

-- ============================================
-- MEETING ATTENDANCE
-- ============================================

CREATE TABLE IF NOT EXISTS meeting_attendance (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  meeting_id UUID NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  status TEXT NOT NULL,                        -- PRESENT | ABSENT | EXCUSED | LATE | LEFT_EARLY
  arrived_at TIMESTAMPTZ,
  departed_at TIMESTAMPTZ,
  notes TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(meeting_id, member_id)
);

CREATE INDEX IF NOT EXISTS idx_attendance_meeting
  ON meeting_attendance (tenant_id, meeting_id);

ALTER TABLE meeting_attendance ENABLE ROW LEVEL SECURITY;
CREATE POLICY attendance_tenant_isolation ON meeting_attendance
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

COMMIT;
