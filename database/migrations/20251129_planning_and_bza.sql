-- 20251129_planning_and_bza.sql
-- Planning & BZA cases, hearings, findings, conditions, notices, appeals
-- Depends on:
--   20251127_core_and_meetings.sql   (tenants, users, files, governing_bodies, meetings, notices, etc.)
--   20251124_gis_parcels_and_notification.sql (for parcel reference, if FK is added later)

BEGIN;

-- ============================================
-- PLANNING CASES (core entity)
-- ============================================

CREATE TABLE IF NOT EXISTS planning_cases (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

  case_number TEXT NOT NULL,       -- e.g. '2025-Z-03'
  case_type TEXT NOT NULL,         -- 'rezoning' | 'varianceDev' | 'varianceUse' | 'specialException' | 'platPrimary' | 'platSecondary' | 'developmentPlan' | 'annexation'
  status TEXT NOT NULL,            -- 'draft' | 'filed' | 'underReview' | 'scheduled' | 'decided' | 'appealed' | 'withdrawn'

  title TEXT,                      -- short description
  description TEXT,                -- narrative of the request

  parcel_ref TEXT,                 -- generic parcel reference (e.g. GIS parcel id, key, or PIN)
  -- Optionally later: parcel_id UUID REFERENCES parcels(id)

  applicant_name TEXT NOT NULL,
  applicant_email TEXT,
  applicant_phone TEXT,

  owner_name TEXT,
  representative_name TEXT,

  filing_date DATE,
  filed_by_user_id UUID REFERENCES users(id),

  hearing_body_id UUID REFERENCES governing_bodies(id),   -- Plan Commission or BZA
  decision_body_id UUID REFERENCES governing_bodies(id),  -- BZA or Council where applicable

  decision_date DATE,
  decision_result TEXT,            -- 'approved' | 'approvedWithConditions' | 'denied' | 'noAction' | 'continued'

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_planning_cases_tenant_casenumber
  ON planning_cases (tenant_id, case_number);

CREATE INDEX IF NOT EXISTS idx_planning_cases_tenant_status
  ON planning_cases (tenant_id, status);

ALTER TABLE planning_cases ENABLE ROW LEVEL SECURITY;
CREATE POLICY planning_cases_tenant_isolation ON planning_cases
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

-- ============================================
-- PLANNING CASE DOCUMENTS (site plans, staff reports, etc.)
-- ============================================

CREATE TABLE IF NOT EXISTS planning_case_documents (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  case_id UUID NOT NULL REFERENCES planning_cases(id) ON DELETE CASCADE,

  doc_type TEXT NOT NULL,          -- 'application' | 'sitePlan' | 'trafficStudy' | 'staffReport' | 'exhibit' | 'commitment' | etc.
  title TEXT,
  file_id UUID NOT NULL REFERENCES files(id),
  uploaded_by_user_id UUID REFERENCES users(id),
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_planning_case_docs_case
  ON planning_case_documents (case_id, doc_type);

ALTER TABLE planning_case_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY planning_case_docs_tenant_isolation ON planning_case_documents
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

-- ============================================
-- HEARINGS (link cases to specific meetings)
-- ============================================

CREATE TABLE IF NOT EXISTS planning_hearings (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

  case_id UUID NOT NULL REFERENCES planning_cases(id) ON DELETE CASCADE,
  meeting_id UUID REFERENCES meetings(id) ON DELETE SET NULL,

  hearing_date DATE NOT NULL,
  hearing_body_id UUID REFERENCES governing_bodies(id),

  result TEXT,                     -- 'approved' | 'approvedWithConditions' | 'denied' | 'continued' | 'noAction'
  notes TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_planning_hearings_case
  ON planning_hearings (case_id, hearing_date);

ALTER TABLE planning_hearings ENABLE ROW LEVEL SECURITY;
CREATE POLICY planning_hearings_tenant_isolation ON planning_hearings
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

-- ============================================
-- FINDINGS OF FACT
-- One row per statutory criterion, per case, per deciding body
-- ============================================

CREATE TABLE IF NOT EXISTS planning_findings (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

  case_id UUID NOT NULL REFERENCES planning_cases(id) ON DELETE CASCADE,
  body_id UUID NOT NULL REFERENCES governing_bodies(id), -- BZA / Plan Commission / Council

  finding_type TEXT NOT NULL,        -- 'varianceDev' | 'varianceUse' | 'specialException' | 'rezoning' | 'plat'
  criterion_key TEXT NOT NULL,       -- e.g. 'publicHealthSafety', 'adjacentProperty', 'practicalDifficulties'
  satisfied BOOLEAN NOT NULL,
  text TEXT NOT NULL,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by_user_id UUID REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_planning_findings_case_body
  ON planning_findings (case_id, body_id);

ALTER TABLE planning_findings ENABLE ROW LEVEL SECURITY;
CREATE POLICY planning_findings_tenant_isolation ON planning_findings
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

-- ============================================
-- CONDITIONS / COMMITMENTS
-- ============================================

CREATE TABLE IF NOT EXISTS planning_conditions (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

  case_id UUID NOT NULL REFERENCES planning_cases(id) ON DELETE CASCADE,
  description TEXT NOT NULL,

  imposed_by_body_id UUID REFERENCES governing_bodies(id),
  imposed_date DATE,

  is_recorded_commitment BOOLEAN NOT NULL DEFAULT false,
  recorded_at TIMESTAMPTZ,
  recorded_instrument_number TEXT,      -- county recorder info

  expires_at TIMESTAMPTZ,
  notes TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_planning_conditions_case
  ON planning_conditions (case_id);

ALTER TABLE planning_conditions ENABLE ROW LEVEL SECURITY;
CREATE POLICY planning_conditions_tenant_isolation ON planning_conditions
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

-- ============================================
-- PLANNING NOTICES (tie to the generic notices table)
-- neighbor mailings, newspaper ads, etc.
-- ============================================

CREATE TABLE IF NOT EXISTS planning_case_notices (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

  case_id UUID NOT NULL REFERENCES planning_cases(id) ON DELETE CASCADE,

  notice_type TEXT NOT NULL,           -- 'newspaper' | 'neighborMail' | 'website' | 'signPosting'
  notice_id UUID REFERENCES notices(id) ON DELETE SET NULL,  -- generic notice record

  published_at TIMESTAMPTZ,
  proof_file_id UUID REFERENCES files(id),   -- affidavit, tear sheet, mailing list, etc.

  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_planning_case_notices_case
  ON planning_case_notices (case_id, notice_type);

ALTER TABLE planning_case_notices ENABLE ROW LEVEL SECURITY;
CREATE POLICY planning_case_notices_tenant_isolation ON planning_case_notices
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

-- ============================================
-- APPEALS
-- Judicial or council appeals of planning/BZA decisions
-- ============================================

CREATE TABLE IF NOT EXISTS planning_appeals (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

  case_id UUID NOT NULL REFERENCES planning_cases(id) ON DELETE CASCADE,

  appeal_type TEXT NOT NULL,           -- 'judicial' | 'council' | 'other'
  filed_at DATE NOT NULL,
  filed_by TEXT,                        -- name of appellant (could be different from applicant)

  court_or_body TEXT,                   -- e.g. 'Madison Circuit Court', 'Town Council'
  cause_number TEXT,                    -- for judicial appeals

  result TEXT,                          -- 'pending' | 'dismissed' | 'reversed' | 'affirmed' | 'remanded'
  result_date DATE,

  notes TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_planning_appeals_case
  ON planning_appeals (case_id);

ALTER TABLE planning_appeals ENABLE ROW LEVEL SECURITY;
CREATE POLICY planning_appeals_tenant_isolation ON planning_appeals
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

COMMIT;
