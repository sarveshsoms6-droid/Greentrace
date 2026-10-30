-- ==============================================================================
-- GreenTrace 2.0 - Supabase / PostgreSQL Initial Schema
-- Migration: 001_initial_schema.sql
-- ==============================================================================

-- Enable UUID extension if needed in future
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ------------------------------------------------------------------------------
-- 1. Evidence Table
-- Off-chain SHA-256 fingerprint registry for uploaded media
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS evidence (
    id BIGSERIAL PRIMARY KEY,
    evidence_hash VARCHAR(64) UNIQUE NOT NULL,
    filename TEXT NOT NULL,
    stored_path TEXT NOT NULL,
    file_size BIGINT NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_evidence_hash ON evidence(LOWER(evidence_hash));
CREATE INDEX IF NOT EXISTS idx_evidence_uploaded_at ON evidence(uploaded_at DESC);

-- ------------------------------------------------------------------------------
-- 2. Activities Table
-- Cache and off-chain metadata for Tezos on-chain sustainability records
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS activities (
    activity_id VARCHAR(64) PRIMARY KEY,
    submitter_address VARCHAR(36) NOT NULL,
    category VARCHAR(50) NOT NULL,
    quantity DOUBLE PRECISION NOT NULL,
    unit VARCHAR(20) NOT NULL,
    description TEXT,
    evidence_hash VARCHAR(64) UNIQUE NOT NULL,
    evidence_path TEXT,
    status_cache VARCHAR(20) NOT NULL DEFAULT 'SUBMITTED',
    submission_tx_hash VARCHAR(66),
    approval_tx_hash VARCHAR(66),
    rejection_tx_hash VARCHAR(66),
    approver_address VARCHAR(36),
    submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    approved_at TIMESTAMPTZ,
    rejected_at TIMESTAMPTZ,
    rejection_reason TEXT,
    blockchain_confirmed BOOLEAN NOT NULL DEFAULT FALSE,
    reconciled_at TIMESTAMPTZ,
    -- AI Verification Metadata
    ai_detected_count INTEGER,
    ai_confidence_score DOUBLE PRECISION,
    ai_model_name VARCHAR(100),
    ai_model_version VARCHAR(50),
    ai_annotated_path TEXT,
    ai_detection_data TEXT
);

CREATE INDEX IF NOT EXISTS idx_activities_hash ON activities(LOWER(evidence_hash));
CREATE INDEX IF NOT EXISTS idx_activities_submitter ON activities(LOWER(submitter_address));
CREATE INDEX IF NOT EXISTS idx_activities_status ON activities(status_cache);
CREATE INDEX IF NOT EXISTS idx_activities_sub_tx ON activities(submission_tx_hash);
CREATE INDEX IF NOT EXISTS idx_activities_app_tx ON activities(approval_tx_hash);
CREATE INDEX IF NOT EXISTS idx_activities_rej_tx ON activities(rejection_tx_hash);
CREATE INDEX IF NOT EXISTS idx_activities_submitted_at ON activities(submitted_at DESC);

-- ------------------------------------------------------------------------------
-- 3. Transactions Table
-- Tracks lifecycle of Tezos blockchain transactions
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS transactions (
    id BIGSERIAL PRIMARY KEY,
    activity_id VARCHAR(64) NOT NULL REFERENCES activities(activity_id) ON DELETE CASCADE,
    tx_hash VARCHAR(66) UNIQUE NOT NULL,
    tx_type VARCHAR(20) NOT NULL CHECK(tx_type IN ('SUBMISSION', 'APPROVAL', 'REJECTION')),
    wallet_address VARCHAR(36) NOT NULL,
    confirmation_status VARCHAR(20) NOT NULL DEFAULT 'PENDING' CHECK(confirmation_status IN ('PENDING', 'CONFIRMED', 'FAILED')),
    block_level BIGINT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    confirmed_at TIMESTAMPTZ,
    error_message TEXT
);

CREATE INDEX IF NOT EXISTS idx_transactions_activity ON transactions(activity_id);
CREATE INDEX IF NOT EXISTS idx_transactions_hash ON transactions(tx_hash);
CREATE INDEX IF NOT EXISTS idx_transactions_status ON transactions(confirmation_status);
CREATE INDEX IF NOT EXISTS idx_transactions_wallet ON transactions(LOWER(wallet_address));

-- ------------------------------------------------------------------------------
-- 4. Reconciliation Log Table
-- Audit trail of background synchronization runs with Tezos Shadownet Indexer
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS reconciliation_log (
    id BIGSERIAL PRIMARY KEY,
    run_timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    status VARCHAR(50) NOT NULL,
    total_records INTEGER NOT NULL DEFAULT 0,
    synced_records INTEGER NOT NULL DEFAULT 0,
    mismatched_records INTEGER NOT NULL DEFAULT 0,
    error_message TEXT,
    details TEXT
);

CREATE INDEX IF NOT EXISTS idx_reconciliation_timestamp ON reconciliation_log(run_timestamp DESC);

