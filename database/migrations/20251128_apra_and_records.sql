-- 20251128_apra_and_records.sql
-- APRA (public records) + basic records storage
-- Depends on: 20251127_core_and_meetings.sql (tenants, users, files, audit_log, etc.)
--
-- Status values align with TypeScript types in src/engines/records/apra.types.ts:
--   RECEIVED, NEEDS_CLARIFICATION, IN_REVIEW, PARTIALLY_FULFILLED, FULFILLED, DENIED, CLOSED

BEGIN;

-- ============================================
-- APRA REQUESTS
-- ============================================

CREATE TABLE IF NOT EXISTS apra_requests (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

  requester_name  TEXT NOT NULL,
  requester_email TEXT,
  requester_phone TEXT,

  received_at TIMESTAMPTZ NOT NULL,

  -- The text of the records request (aligned with ApraRequest.description)
  description TEXT NOT NULL,

  -- particularity analysis (per APRA case law IC 5-14-3-3)
  reasonably_particular BOOLEAN NOT NULL DEFAULT true,
  particularity_reason TEXT,

  -- high-level status + timing
  -- Status values: 'RECEIVED' | 'NEEDS_CLARIFICATION' | 'IN_REVIEW' | 'PARTIALLY_FULFILLED' | 'FULFILLED' | 'DENIED' | 'CLOSED'
  status TEXT NOT NULL DEFAULT 'RECEIVED',
  statutory_deadline_at TIMESTAMPTZ,    -- when initial response is due (7 business days per IC 5-14-3-9)
  closed_at TIMESTAMPTZ,

  created_by_user_id UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_apra_requests_tenant_status
  ON apra_requests (tenant_id, status);

ALTER TABLE apra_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY apra_requests_tenant_isolation ON apra_requests
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

-- ============================================
-- APRA REQUEST SCOPES
-- Breaks one request into logical "slices"
-- ============================================

CREATE TABLE IF NOT EXISTS apra_request_scopes (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  request_id UUID NOT NULL REFERENCES apra_requests(id) ON DELETE CASCADE,

  record_type TEXT,           -- 'email' | 'contract' | 'meetingMinutes' | 'policeReport' | etc.
  date_range_start DATE,      -- aligned with ApraRequestScope.dateRangeStart
  date_range_end DATE,        -- aligned with ApraRequestScope.dateRangeEnd
  keywords    TEXT[],
  custodians  TEXT[],         -- names/emails of likely record holders

  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_apra_scopes_request
  ON apra_request_scopes (request_id);

ALTER TABLE apra_request_scopes ENABLE ROW LEVEL SECURITY;
CREATE POLICY apra_scopes_tenant_isolation ON apra_request_scopes
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

-- ============================================
-- APRA STATUS HISTORY
-- Detailed status history for audit trail (aligned with ApraStatusHistoryEntry)
-- ============================================

CREATE TABLE IF NOT EXISTS apra_status_history (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  request_id UUID NOT NULL REFERENCES apra_requests(id) ON DELETE CASCADE,

  old_status TEXT,            -- previous status (NULL for initial entry)
  new_status TEXT NOT NULL,   -- new status value
  changed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  changed_by_user_id UUID REFERENCES users(id),
  note TEXT                   -- explanation for the status change
);

CREATE INDEX IF NOT EXISTS idx_apra_status_history_request
  ON apra_status_history (request_id, changed_at);

ALTER TABLE apra_status_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY apra_status_history_tenant_isolation ON apra_status_history
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

-- ============================================
-- APRA CLARIFICATIONS
-- For "not reasonably particular" or ambiguous requests (IC 5-14-3-9(b))
-- Aligned with ApraClarification type
-- ============================================

CREATE TABLE IF NOT EXISTS apra_clarifications (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  request_id UUID NOT NULL REFERENCES apra_requests(id) ON DELETE CASCADE,

  sent_at TIMESTAMPTZ NOT NULL,
  sent_by_user_id UUID REFERENCES users(id),
  message_to_requester TEXT NOT NULL,    -- message sent asking for clarification

  responded_at TIMESTAMPTZ,              -- when requester responded
  requester_response TEXT,               -- what the requester said

  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_apra_clarifications_request
  ON apra_clarifications (request_id);

ALTER TABLE apra_clarifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY apra_clarifications_tenant_isolation ON apra_clarifications
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

-- ============================================
-- APRA EXEMPTIONS
-- Specific statutory grounds for withholding/redaction (IC 5-14-3-4)
-- Aligned with ApraExemptionCitation type
-- ============================================

CREATE TABLE IF NOT EXISTS apra_exemptions (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  request_id UUID NOT NULL REFERENCES apra_requests(id) ON DELETE CASCADE,

  citation TEXT NOT NULL,             -- legal citation e.g. 'IC 5-14-3-4(a)(1)'
  description TEXT NOT NULL,          -- plain English explanation of why exemption applies
  applies_to_scope_id UUID REFERENCES apra_request_scopes(id),  -- optional: if exemption applies to specific scope

  applied_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  applied_by_user_id UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_apra_exemptions_request
  ON apra_exemptions (request_id);

ALTER TABLE apra_exemptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY apra_exemptions_tenant_isolation ON apra_exemptions
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

-- ============================================
-- APRA FULFILLMENTS
-- How the request was ultimately answered
-- Aligned with ApraFulfillment type
-- ============================================

CREATE TABLE IF NOT EXISTS apra_fulfillments (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  request_id UUID NOT NULL REFERENCES apra_requests(id) ON DELETE CASCADE,

  fulfilled_at TIMESTAMPTZ NOT NULL,
  delivery_method TEXT NOT NULL,      -- 'EMAIL' | 'PORTAL' | 'MAIL' | 'IN_PERSON'
  notes TEXT,

  total_fees_cents INTEGER DEFAULT 0, -- fees in cents (per IC 5-14-3-8)
  fee_breakdown JSONB,                -- optional structured detail

  created_by_user_id UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_apra_fulfillments_request
  ON apra_fulfillments (request_id);

ALTER TABLE apra_fulfillments ENABLE ROW LEVEL SECURITY;
CREATE POLICY apra_fulfillments_tenant_isolation ON apra_fulfillments
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

-- ============================================
-- RECORDS (stub for future integration)
-- Link actual stored files/records to APRA scopes or responses
-- ============================================

CREATE TABLE IF NOT EXISTS records (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

  source_system TEXT,                -- 'email', 'finance', 'meeting', etc.
  source_reference TEXT,             -- message-id, claim number, etc.

  title TEXT,
  description TEXT,

  file_id UUID REFERENCES files(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_records_tenant
  ON records (tenant_id);

ALTER TABLE records ENABLE ROW LEVEL SECURITY;
CREATE POLICY records_tenant_isolation ON records
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

COMMIT;
