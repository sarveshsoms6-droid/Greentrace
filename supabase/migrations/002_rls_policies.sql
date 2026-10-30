-- ==============================================================================
-- GreenTrace 2.0 - Supabase Row Level Security (RLS) Policies
-- Migration: 002_rls_policies.sql
-- ==============================================================================

-- Enable RLS on all GreenTrace tables
ALTER TABLE evidence ENABLE ROW LEVEL SECURITY;
ALTER TABLE activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE reconciliation_log ENABLE ROW LEVEL SECURITY;

-- ------------------------------------------------------------------------------
-- 1. Evidence Policies
-- Public can view evidence metadata by SHA-256 hash for verification
-- Only backend service_role can insert / update
-- ------------------------------------------------------------------------------
CREATE POLICY "Public read evidence metadata"
    ON evidence FOR SELECT
    USING (true);

CREATE POLICY "Service role full access on evidence"
    ON evidence FOR ALL
    USING (auth.role() = 'service_role' OR current_user = 'postgres');

-- ------------------------------------------------------------------------------
-- 2. Activities Policies
-- Public can read activities for public verification portal and student dashboard
-- Only backend service_role can insert / update
-- ------------------------------------------------------------------------------
CREATE POLICY "Public read activities"
    ON activities FOR SELECT
    USING (true);

CREATE POLICY "Service role full access on activities"
    ON activities FOR ALL
    USING (auth.role() = 'service_role' OR current_user = 'postgres');

-- ------------------------------------------------------------------------------
-- 3. Transactions Policies
-- Blockchain transactions are public on Tezos, so public read is permitted
-- Only backend service_role can insert / update
-- ------------------------------------------------------------------------------
CREATE POLICY "Public read transactions"
    ON transactions FOR SELECT
    USING (true);

CREATE POLICY "Service role full access on transactions"
    ON transactions FOR ALL
    USING (auth.role() = 'service_role' OR current_user = 'postgres');

-- ------------------------------------------------------------------------------
-- 4. Reconciliation Log Policies
-- Internal audit trail: restricted strictly to backend service_role
-- ------------------------------------------------------------------------------
CREATE POLICY "Service role full access on reconciliation_log"
    ON reconciliation_log FOR ALL
    USING (auth.role() = 'service_role' OR current_user = 'postgres');

