-- Migration: Findings of Fact Engine
-- Purpose: Add tables to support BZA/Plan Commission findings of fact per Indiana statutory requirements.
-- Depends on: 20251128_enhanced_meetings_module.sql

BEGIN;

-- ============================================
-- FINDINGS OF FACT
-- ============================================

-- Main findings record linked to an agenda item (BZA/PC case)
CREATE TABLE IF NOT EXISTS findings_of_fact (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  meeting_id UUID NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
  agenda_item_id UUID REFERENCES agenda_items(id) ON DELETE CASCADE,

  -- Case type determines which criteria template to use
  case_type TEXT NOT NULL,                       -- DEVELOPMENT_VARIANCE | USE_VARIANCE | SPECIAL_EXCEPTION | SUBDIVISION_WAIVER

  -- Statutory reference
  statutory_cite TEXT NOT NULL,                  -- e.g., 'IC 36-7-4-918.5'

  -- Status tracking
  status TEXT NOT NULL DEFAULT 'DRAFT',          -- DRAFT | PENDING_REVIEW | ADOPTED | REJECTED

  -- Adoption details
  vote_record_id UUID REFERENCES vote_records(id),
  adopted_at TIMESTAMPTZ,
  adopted_by_user_id UUID REFERENCES users(id),

  -- Document generation
  generated_document_id UUID REFERENCES files(id),
  generated_at TIMESTAMPTZ,

  -- Lock prevents modifications after adoption
  is_locked BOOLEAN DEFAULT false,

  -- Audit fields
  created_by_user_id UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_findings_tenant_meeting
  ON findings_of_fact (tenant_id, meeting_id);

CREATE INDEX IF NOT EXISTS idx_findings_agenda_item
  ON findings_of_fact (agenda_item_id);

CREATE INDEX IF NOT EXISTS idx_findings_status
  ON findings_of_fact (tenant_id, status);

ALTER TABLE findings_of_fact ENABLE ROW LEVEL SECURITY;
CREATE POLICY findings_tenant_isolation ON findings_of_fact
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

-- ============================================
-- FINDINGS CRITERIA
-- ============================================

-- Individual criterion within a findings record
CREATE TABLE IF NOT EXISTS findings_criteria (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  findings_id UUID NOT NULL REFERENCES findings_of_fact(id) ON DELETE CASCADE,

  -- Criterion details
  criterion_number INTEGER NOT NULL,             -- 1, 2, 3, etc.
  criterion_text TEXT NOT NULL,                  -- The statutory criterion text
  statutory_cite TEXT,                           -- Sub-citation for this criterion

  -- Is this criterion required for approval?
  is_required BOOLEAN DEFAULT true,

  -- Staff analysis (pre-hearing)
  staff_recommendation TEXT,                     -- MET | NOT_MET | UNABLE_TO_DETERMINE
  staff_rationale TEXT,                          -- Staff's "because" statement
  staff_updated_at TIMESTAMPTZ,
  staff_updated_by_user_id UUID REFERENCES users(id),

  -- Board determination (during/after hearing)
  board_determination TEXT,                      -- MET | NOT_MET | UNABLE_TO_DETERMINE
  board_rationale TEXT,                          -- Board's "because" statement
  board_updated_at TIMESTAMPTZ,
  board_updated_by_user_id UUID REFERENCES users(id),

  -- Guidance notes for staff (from template)
  guidance_notes TEXT,

  -- Ordering
  order_index INTEGER NOT NULL,

  -- Audit fields
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE(findings_id, criterion_number)
);

CREATE INDEX IF NOT EXISTS idx_criteria_findings
  ON findings_criteria (findings_id);

CREATE INDEX IF NOT EXISTS idx_criteria_tenant
  ON findings_criteria (tenant_id);

ALTER TABLE findings_criteria ENABLE ROW LEVEL SECURITY;
CREATE POLICY criteria_tenant_isolation ON findings_criteria
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

-- ============================================
-- FINDINGS TEMPLATES (for tenant customization)
-- ============================================

-- Optional: Tenants can customize criteria templates
CREATE TABLE IF NOT EXISTS findings_templates (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

  -- Template identification
  case_type TEXT NOT NULL,                       -- DEVELOPMENT_VARIANCE | USE_VARIANCE | SPECIAL_EXCEPTION | etc.
  template_name TEXT NOT NULL,
  statutory_cite TEXT NOT NULL,

  -- Criteria as JSON array
  -- Structure: [{ criterionNumber, criterionText, statutoryCite, isRequired, guidanceNotes }]
  criteria_template JSONB NOT NULL,

  -- Status
  is_active BOOLEAN DEFAULT true,
  is_default BOOLEAN DEFAULT false,

  -- Audit fields
  created_by_user_id UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE(tenant_id, case_type, is_default)
);

CREATE INDEX IF NOT EXISTS idx_templates_tenant
  ON findings_templates (tenant_id, case_type);

ALTER TABLE findings_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY templates_tenant_isolation ON findings_templates
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

-- ============================================
-- CONDITIONS OF APPROVAL
-- ============================================

-- Conditions attached to approved cases
CREATE TABLE IF NOT EXISTS findings_conditions (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  findings_id UUID NOT NULL REFERENCES findings_of_fact(id) ON DELETE CASCADE,

  -- Condition details
  condition_number INTEGER NOT NULL,
  condition_text TEXT NOT NULL,

  -- Ordering
  order_index INTEGER NOT NULL,

  -- Audit fields
  created_by_user_id UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE(findings_id, condition_number)
);

CREATE INDEX IF NOT EXISTS idx_conditions_findings
  ON findings_conditions (findings_id);

ALTER TABLE findings_conditions ENABLE ROW LEVEL SECURITY;
CREATE POLICY conditions_tenant_isolation ON findings_conditions
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

-- ============================================
-- ADD COLUMN TO AGENDA_ITEMS
-- ============================================

-- Track whether agenda item requires findings of fact
ALTER TABLE agenda_items
  ADD COLUMN IF NOT EXISTS requires_findings_of_fact BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS case_type TEXT,                         -- For BZA/PC items
  ADD COLUMN IF NOT EXISTS case_reference_number TEXT,             -- e.g., "V-2025-001"
  ADD COLUMN IF NOT EXISTS case_reference_type TEXT;               -- e.g., "VARIANCE", "SPECIAL_EXCEPTION"

COMMIT;
