-- 20251128_apra_and_records.sql
-- APRA (public records) + basic records storage
-- Depends on: 20251127_core_and_meetings.sql (tenants, users, files, audit_log, etc.)

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
  channel TEXT NOT NULL,              -- 'email' | 'portal' | 'mail' | 'inPerson'

  raw_text TEXT NOT NULL,

  -- particularity analysis (per APRA case law)
  reasonably_particular BOOLEAN,      -- NULL until evaluated
  particularity_reason TEXT,          -- explanation tying to case law

  -- high-level status + timing
  current_status TEXT NOT NULL DEFAULT 'pending',  -- 'pending' | 'needsClarification' | 'inSearch' | 'partialDeny' | 'fulfilled' | 'closed'
  statutory_deadline TIMESTAMPTZ,    -- when initial response is due
  closed_at TIMESTAMPTZ,

  created_by_user_id UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_apra_requests_tenant_status
  ON apra_requests (tenant_id, current_status);

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
  date_from   DATE,
  date_to     DATE,
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
-- Detailed status history beyond apra_requests.current_status
-- ============================================

CREATE TABLE IF NOT EXISTS apra_status_history (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  request_id UUID NOT NULL REFERENCES apra_requests(id) ON DELETE CASCADE,

  status TEXT NOT NULL,        -- 'pending' | 'needsClarification' | 'inSearch' | 'partialDeny' | 'fulfilled' | 'closed'
  changed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  changed_by_user_id UUID REFERENCES users(id),
  notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_apra_status_history_request
  ON apra_status_history (request_id, changed_at);

ALTER TABLE apra_status_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY apra_status_history_tenant_isolation ON apra_status_history
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

-- ============================================
-- APRA CLARIFICATIONS
-- For "not reasonably particular" or ambiguous requests
-- ============================================

CREATE TABLE IF NOT EXISTS apra_clarifications (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  request_id UUID NOT NULL REFERENCES apra_requests(id) ON DELETE CASCADE,

  sent_at TIMESTAMPTZ NOT NULL,
  sent_by_user_id UUID REFERENCES users(id),
  message TEXT NOT NULL,

  response_received_at TIMESTAMPTZ,
  response_text TEXT,

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
-- Specific statutory grounds for withholding/redaction
-- ============================================

CREATE TABLE IF NOT EXISTS apra_exemptions (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  request_id UUID NOT NULL REFERENCES apra_requests(id) ON DELETE CASCADE,

  exemption_code TEXT NOT NULL,     -- e.g. 'IC 5-14-3-4(a)(1)'
  description TEXT,                 -- short label for the exemption
  justification TEXT NOT NULL,      -- fact-specific reasoning, not boilerplate

  applied_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  applied_by_user_id UUID REFERENCES users(id)
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
-- ============================================

CREATE TABLE IF NOT EXISTS apra_fulfillments (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  request_id UUID NOT NULL REFERENCES apra_requests(id) ON DELETE CASCADE,

  fulfilled_at TIMESTAMPTZ NOT NULL,
  delivery_method TEXT NOT NULL,     -- 'email' | 'portal' | 'mail' | 'pickup'
  notes TEXT,

  fees_charged NUMERIC(10,2) DEFAULT 0,
  fee_breakdown JSONB,               -- optional structured detail

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
