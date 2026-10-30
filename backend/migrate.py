"""
GreenTrace 2.0 - Supabase Migration Runner
Applies all SQL migration files in order to the configured Supabase PostgreSQL database.
Run from the backend/ directory: python migrate.py
"""
import os
import sys
import glob

sys.path.insert(0, '.')
from dotenv import load_dotenv
load_dotenv('.env')

import psycopg2
from psycopg2 import sql

DATABASE_URL = os.getenv('DATABASE_URL')
if not DATABASE_URL or '[YOUR-' in DATABASE_URL:
    print("ERROR: DATABASE_URL is not configured in backend/.env")
    sys.exit(1)

# Migrations directory is at ../supabase/migrations relative to backend/
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MIGRATIONS_DIR = os.path.join(BASE_DIR, '..', 'supabase', 'migrations')

def run_migrations():
    print(f"Connecting to Supabase PostgreSQL...")
    conn = psycopg2.connect(DATABASE_URL, connect_timeout=20)
    conn.autocommit = True
    cur = conn.cursor()

    # Create migration tracking table
    cur.execute("""
        CREATE TABLE IF NOT EXISTS _schema_migrations (
            id SERIAL PRIMARY KEY,
            filename VARCHAR(255) UNIQUE NOT NULL,
            applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
    """)
    print("Migration tracking table ready.")

    # Get already applied migrations
    cur.execute("SELECT filename FROM _schema_migrations ORDER BY filename;")
    applied = {row[0] for row in cur.fetchall()}
    print(f"Already applied: {applied if applied else 'none'}")

    # Find migration files sorted by name
    pattern = os.path.join(MIGRATIONS_DIR, '*.sql')
    migration_files = sorted(glob.glob(pattern))

    if not migration_files:
        print(f"No migration files found in: {MIGRATIONS_DIR}")
        sys.exit(1)

    new_count = 0
    for filepath in migration_files:
        filename = os.path.basename(filepath)
        if filename in applied:
            print(f"  SKIP: {filename} (already applied)")
            continue

        print(f"  APPLY: {filename} ...")
        with open(filepath, 'r', encoding='utf-8') as f:
            sql_content = f.read()

        try:
            cur.execute(sql_content)
            cur.execute(
                "INSERT INTO _schema_migrations (filename) VALUES (%s);",
                (filename,)
            )
            print(f"  OK: {filename}")
            new_count += 1
        except Exception as e:
            print(f"  ERROR in {filename}: {e}")
            conn.close()
            sys.exit(1)

    conn.close()
    print(f"\nMigration complete. {new_count} new migration(s) applied.")

if __name__ == '__main__':
    run_migrations()

