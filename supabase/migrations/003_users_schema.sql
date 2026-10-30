-- ==============================================================================
-- GreenTrace 2.0 - Users Table & Authentication Schema
-- Migration: 003_users_schema.sql
-- ==============================================================================

CREATE TABLE IF NOT EXISTS users (
    id BIGSERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL CHECK(role IN ('STUDENT', 'ORGANIZER')),
    student_id VARCHAR(50),
    department VARCHAR(100),
    wallet_address VARCHAR(36),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_login TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(LOWER(email));
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_wallet ON users(LOWER(wallet_address));

-- Enable Row Level Security (RLS)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Public read user profiles"
    ON users FOR SELECT
    USING (true);

CREATE POLICY "Service role full access on users"
    ON users FOR ALL
    USING (auth.role() = 'service_role' OR current_user = 'postgres');

