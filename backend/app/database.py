"""
GreenTrace 2.0 - SQLite Database & Persistence Service
Provides safe connection handling, WAL mode, unique constraints, and duplicate detection.
"""

import os
import sqlite3
from contextlib import contextmanager
from datetime import datetime, timezone
from typing import Generator, Optional, Tuple

DATABASE_URL = os.getenv("DATABASE_PATH", "greentrace.db")
if DATABASE_URL.startswith("sqlite:///"):
    DATABASE_PATH = DATABASE_URL.replace("sqlite:///", "")
else:
    DATABASE_PATH = DATABASE_URL

DEFAULT_ORGANIZERS = {
    "tz1aSkwEkv3Ax2bWZHvCaOKUMcqModq5RMqJ".lower(),
}


def get_authorized_organizers() -> set[str]:
    """Retrieves authorized organizer addresses from env or defaults."""
    env_orgs = os.getenv("ORGANIZER_ADDRESSES")
    if env_orgs:
        custom = {addr.strip().lower() for addr in env_orgs.split(",") if addr.strip()}
        if custom:
            return custom
    return DEFAULT_ORGANIZERS


def is_authorized_organizer(address: Optional[str]) -> bool:
    """Verifies if an address is an authorized organizer."""
    if not address or not isinstance(address, str):
        return False
    return address.strip().lower() in get_authorized_organizers()


def get_db_path() -> str:
    return os.path.abspath(DATABASE_PATH)


@contextmanager
def get_db_connection() -> Generator[sqlite3.Connection, None, None]:
    """Provides a thread-safe SQLite connection with WAL mode and row factory."""
    conn = sqlite3.connect(
        get_db_path(),
        timeout=15.0,
        check_same_thread=False,
    )
    conn.row_factory = sqlite3.Row
    try:
        # Enable WAL mode and busy timeout for concurrent safety
        conn.execute("PRAGMA journal_mode=WAL;")
        conn.execute("PRAGMA busy_timeout=5000;")
        conn.execute("PRAGMA foreign_keys=ON;")
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def init_db():
    """Initializes database schema with unique constraints, indexes, and tables for Phase 7."""
    with get_db_connection() as conn:
        conn.executescript("""
        CREATE TABLE IF NOT EXISTS evidence (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            evidence_hash TEXT UNIQUE NOT NULL,
            filename TEXT NOT NULL,
            stored_path TEXT NOT NULL,
            file_size INTEGER NOT NULL,
            mime_type TEXT NOT NULL,
            uploaded_at TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_evidence_hash ON evidence(evidence_hash);

        CREATE TABLE IF NOT EXISTS activities (
            activity_id TEXT PRIMARY KEY,
            submitter_address TEXT NOT NULL,
            category TEXT NOT NULL,
            quantity REAL NOT NULL,
            unit TEXT NOT NULL,
            description TEXT,
            evidence_hash TEXT UNIQUE NOT NULL,
            evidence_path TEXT,
            status_cache TEXT DEFAULT 'SUBMITTED',
            submission_tx_hash TEXT,
            approval_tx_hash TEXT,
            rejection_tx_hash TEXT,
            approver_address TEXT,
            submitted_at TEXT NOT NULL,
            approved_at TEXT,
            rejected_at TEXT,
            rejection_reason TEXT,
            blockchain_confirmed INTEGER DEFAULT 0,
            reconciled_at TEXT
        );
        CREATE INDEX IF NOT EXISTS idx_activities_hash ON activities(evidence_hash);
        CREATE INDEX IF NOT EXISTS idx_activities_submitter ON activities(submitter_address);
        CREATE INDEX IF NOT EXISTS idx_activities_status ON activities(status_cache);
        CREATE INDEX IF NOT EXISTS idx_activities_sub_tx ON activities(submission_tx_hash);
        CREATE INDEX IF NOT EXISTS idx_activities_app_tx ON activities(approval_tx_hash);
        CREATE INDEX IF NOT EXISTS idx_activities_rej_tx ON activities(rejection_tx_hash);

        CREATE TABLE IF NOT EXISTS transactions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            activity_id TEXT NOT NULL,
            tx_hash TEXT UNIQUE NOT NULL,
            tx_type TEXT NOT NULL CHECK(tx_type IN ('SUBMISSION', 'APPROVAL', 'REJECTION')),
            wallet_address TEXT NOT NULL,
            confirmation_status TEXT NOT NULL DEFAULT 'PENDING' CHECK(confirmation_status IN ('PENDING', 'CONFIRMED', 'FAILED')),
            block_level INTEGER,
            created_at TEXT NOT NULL,
            confirmed_at TEXT,
            error_message TEXT,
            FOREIGN KEY(activity_id) REFERENCES activities(activity_id) ON DELETE CASCADE
        );
        CREATE INDEX IF NOT EXISTS idx_transactions_activity ON transactions(activity_id);
        CREATE INDEX IF NOT EXISTS idx_transactions_hash ON transactions(tx_hash);
        CREATE INDEX IF NOT EXISTS idx_transactions_status ON transactions(confirmation_status);

        CREATE TABLE IF NOT EXISTS reconciliation_log (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            run_timestamp TEXT NOT NULL,
            status TEXT NOT NULL,
            total_records INTEGER NOT NULL,
            synced_records INTEGER NOT NULL,
            mismatched_records INTEGER NOT NULL,
            error_message TEXT,
            details TEXT
        );
        """)

        # Safely migrate existing databases that might lack new columns
        cursor = conn.execute("PRAGMA table_info(activities);")
        existing_cols = {row["name"] for row in cursor.fetchall()}
        columns_to_add = [
            ("rejection_tx_hash", "TEXT"),
            ("approver_address", "TEXT"),
            ("rejected_at", "TEXT"),
            ("blockchain_confirmed", "INTEGER DEFAULT 0"),
            ("reconciled_at", "TEXT"),
            ("ai_detected_count", "INTEGER"),
            ("ai_confidence_score", "REAL"),
            ("ai_model_name", "TEXT"),
            ("ai_model_version", "TEXT"),
            ("ai_annotated_path", "TEXT"),
            ("ai_detection_data", "TEXT"),
        ]
        for col_name, col_type in columns_to_add:
            if col_name not in existing_cols:
                conn.execute(f"ALTER TABLE activities ADD COLUMN {col_name} {col_type};")


def check_duplicate_hash(evidence_hash: str) -> Tuple[bool, Optional[str]]:
    """
    Checks if a SHA-256 evidence fingerprint already exists in activities or evidence.
    Returns (is_duplicate, existing_activity_id).
    """
    normalized = evidence_hash.lower().strip()
    with get_db_connection() as conn:
        # Check confirmed / cached activities first
        cursor = conn.execute(
            "SELECT activity_id FROM activities WHERE LOWER(evidence_hash) = ? LIMIT 1;",
            (normalized,),
        )
        row = cursor.fetchone()
        if row:
            return True, row["activity_id"]

        # Check existing evidence uploads
        cursor = conn.execute(
            "SELECT id FROM evidence WHERE LOWER(evidence_hash) = ? LIMIT 1;",
            (normalized,),
        )
        row = cursor.fetchone()
        if row:
            return True, None

    return False, None


def save_evidence(
    evidence_hash: str,
    filename: str,
    stored_path: str,
    file_size: int,
    mime_type: str,
) -> dict:
    """
    Persists evidence metadata. Handles concurrency and unique constraint safely.
    """
    normalized_hash = evidence_hash.lower().strip()
    now_iso = datetime.now(timezone.utc).isoformat()

    with get_db_connection() as conn:
        try:
            cursor = conn.execute(
                """
                INSERT INTO evidence (evidence_hash, filename, stored_path, file_size, mime_type, uploaded_at)
                VALUES (?, ?, ?, ?, ?, ?);
                """,
                (normalized_hash, filename, stored_path, file_size, mime_type, now_iso),
            )
            return {
                "id": cursor.lastrowid,
                "evidence_hash": normalized_hash,
                "filename": filename,
                "stored_path": stored_path,
                "file_size": file_size,
                "mime_type": mime_type,
                "uploaded_at": now_iso,
                "is_duplicate": False,
            }
        except sqlite3.IntegrityError:
            # Hash already exists due to concurrent request
            cursor = conn.execute(
                "SELECT * FROM evidence WHERE evidence_hash = ? LIMIT 1;",
                (normalized_hash,),
            )
            existing = cursor.fetchone()
            return {
                "id": existing["id"] if existing else None,
                "evidence_hash": normalized_hash,
                "filename": filename,
                "stored_path": stored_path,
                "file_size": file_size,
                "mime_type": mime_type,
                "uploaded_at": existing["uploaded_at"] if existing else now_iso,
                "is_duplicate": True,
            }


def get_evidence_by_hash(evidence_hash: str) -> Optional[dict]:
    """Retrieves evidence record by hash."""
    normalized = evidence_hash.lower().strip()
    with get_db_connection() as conn:
        cursor = conn.execute(
            "SELECT * FROM evidence WHERE LOWER(evidence_hash) = ? LIMIT 1;",
            (normalized,),
        )
        row = cursor.fetchone()
        if row:
            return dict(row)
    return None


def create_or_update_activity(
    activity_id: str,
    submitter_address: str,
    category: str,
    quantity: float,
    unit: str,
    description: Optional[str],
    evidence_hash: str,
    submission_tx_hash: Optional[str] = None,
    submitted_at: Optional[str] = None,
    ai_detected_count: Optional[int] = None,
    ai_confidence_score: Optional[float] = None,
    ai_model_name: Optional[str] = None,
    ai_model_version: Optional[str] = None,
    ai_annotated_path: Optional[str] = None,
    ai_detection_data: Optional[str] = None,
) -> dict:
    """Inserts a new activity or updates submission references and records transactions."""
    normalized_hash = evidence_hash.lower().strip()
    now_iso = submitted_at or datetime.now(timezone.utc).isoformat()

    with get_db_connection() as conn:
        # Check if evidence has a stored file path
        cur_ev = conn.execute(
            "SELECT stored_path FROM evidence WHERE LOWER(evidence_hash) = ? LIMIT 1;",
            (normalized_hash,),
        )
        ev_row = cur_ev.fetchone()
        evidence_path = ev_row["stored_path"] if ev_row else None

        conn.execute(
            """
            INSERT INTO activities (
                activity_id, submitter_address, category, quantity, unit,
                description, evidence_hash, evidence_path, status_cache,
                submission_tx_hash, submitted_at, blockchain_confirmed,
                ai_detected_count, ai_confidence_score, ai_model_name,
                ai_model_version, ai_annotated_path, ai_detection_data
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'SUBMITTED', ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(activity_id) DO UPDATE SET
                submitter_address=excluded.submitter_address,
                category=excluded.category,
                quantity=excluded.quantity,
                unit=excluded.unit,
                description=excluded.description,
                submission_tx_hash=COALESCE(excluded.submission_tx_hash, activities.submission_tx_hash),
                blockchain_confirmed=CASE
                    WHEN excluded.submission_tx_hash IS NOT NULL THEN 1
                    ELSE activities.blockchain_confirmed
                END,
                ai_detected_count=COALESCE(excluded.ai_detected_count, activities.ai_detected_count),
                ai_confidence_score=COALESCE(excluded.ai_confidence_score, activities.ai_confidence_score),
                ai_model_name=COALESCE(excluded.ai_model_name, activities.ai_model_name),
                ai_model_version=COALESCE(excluded.ai_model_version, activities.ai_model_version),
                ai_annotated_path=COALESCE(excluded.ai_annotated_path, activities.ai_annotated_path),
                ai_detection_data=COALESCE(excluded.ai_detection_data, activities.ai_detection_data);
            """,
            (
                activity_id,
                submitter_address,
                category,
                quantity,
                unit,
                description,
                normalized_hash,
                evidence_path,
                submission_tx_hash,
                now_iso,
                1 if submission_tx_hash else 0,
                ai_detected_count,
                ai_confidence_score,
                ai_model_name,
                ai_model_version,
                ai_annotated_path,
                ai_detection_data,
            ),
        )

        # Track transaction if hash provided
        if submission_tx_hash:
            conn.execute(
                """
                INSERT INTO transactions (
                    activity_id, tx_hash, tx_type, wallet_address,
                    confirmation_status, created_at, confirmed_at
                ) VALUES (?, ?, 'SUBMISSION', ?, 'CONFIRMED', ?, ?)
                ON CONFLICT(tx_hash) DO UPDATE SET
                    confirmation_status='CONFIRMED',
                    confirmed_at=excluded.confirmed_at;
                """,
                (activity_id, submission_tx_hash, submitter_address, now_iso, now_iso),
            )

        cur = conn.execute(
            "SELECT * FROM activities WHERE activity_id = ? LIMIT 1;",
            (activity_id,),
        )
        return dict(cur.fetchone())


def get_activities(
    status: Optional[str] = None,
    submitter_address: Optional[str] = None,
    category: Optional[str] = None,
    limit: Optional[int] = None,
    offset: Optional[int] = None,
) -> list[dict]:
    """Retrieves activities, optionally filtered by status, submitter, category, and paginated."""
    query = "SELECT * FROM activities WHERE 1=1"
    params = []

    if status:
        query += " AND UPPER(status_cache) = ?"
        params.append(status.upper().strip())

    if submitter_address:
        query += " AND LOWER(submitter_address) = ?"
        params.append(submitter_address.lower().strip())

    if category:
        query += " AND category = ?"
        params.append(category.strip())

    query += " ORDER BY submitted_at DESC"

    if limit is not None and limit > 0:
        query += " LIMIT ?"
        params.append(limit)
        if offset is not None and offset >= 0:
            query += " OFFSET ?"
            params.append(offset)

    with get_db_connection() as conn:
        cursor = conn.execute(query, params)
        return [dict(row) for row in cursor.fetchall()]


def get_activity_statistics(submitter_address: Optional[str] = None) -> dict:
    """Computes summary statistics (total, pending, approved, rejected, impacts)."""
    with get_db_connection() as conn:
        base_where = "WHERE 1=1"
        params = []
        if submitter_address:
            base_where += " AND LOWER(submitter_address) = ?"
            params.append(submitter_address.lower().strip())

        cur_total = conn.execute(f"SELECT COUNT(*) as cnt FROM activities {base_where};", params)
        total = cur_total.fetchone()["cnt"]

        cur_approved = conn.execute(f"SELECT COUNT(*) as cnt FROM activities {base_where} AND status_cache = 'APPROVED';", params)
        approved = cur_approved.fetchone()["cnt"]

        cur_pending = conn.execute(f"SELECT COUNT(*) as cnt FROM activities {base_where} AND status_cache = 'SUBMITTED';", params)
        pending = cur_pending.fetchone()["cnt"]

        cur_rejected = conn.execute(f"SELECT COUNT(*) as cnt FROM activities {base_where} AND status_cache = 'REJECTED';", params)
        rejected = cur_rejected.fetchone()["cnt"]

        # Category impacts for approved activities
        cur_impacts = conn.execute(
            f"""
            SELECT category, SUM(quantity) as total_qty, unit
            FROM activities {base_where} AND status_cache = 'APPROVED'
            GROUP BY category, unit;
            """,
            params,
        )
        impacts = [dict(row) for row in cur_impacts.fetchall()]

        return {
            "total": total,
            "approved": approved,
            "pending": pending,
            "rejected": rejected,
            "impacts": impacts,
        }


def get_activity_by_id(activity_id: str) -> Optional[dict]:
    """Retrieves a single activity record by ID."""
    with get_db_connection() as conn:
        cursor = conn.execute(
            "SELECT * FROM activities WHERE activity_id = ? LIMIT 1;",
            (activity_id,),
        )
        row = cursor.fetchone()
        if row:
            return dict(row)
    return None


def record_activity_decision(
    activity_id: str,
    decision: str,
    approver_address: str,
    approval_tx_hash: Optional[str] = None,
    rejection_reason: Optional[str] = None,
) -> dict:
    """
    Records an organizer decision (APPROVED or REJECTED) off-chain.
    Enforces that:
    1. Activity exists.
    2. Activity is currently pending (status_cache == 'SUBMITTED').
    3. Self-approval is rejected.
    4. Automatically records confirmed transaction entry.
    """
    decision = decision.upper()
    if decision not in {"APPROVED", "REJECTED"}:
        raise ValueError("Invalid decision. Must be APPROVED or REJECTED.")

    with get_db_connection() as conn:
        cursor = conn.execute(
            "SELECT * FROM activities WHERE activity_id = ? LIMIT 1;",
            (activity_id,),
        )
        row = cursor.fetchone()
        if not row:
            raise KeyError("ACTIVITY_NOT_FOUND")

        activity = dict(row)

        if activity["status_cache"] != "SUBMITTED":
            raise ValueError(f"ACTIVITY_NOT_PENDING: Record is already {activity['status_cache']}.")

        if activity["submitter_address"].lower() == approver_address.lower():
            raise PermissionError("SELF_APPROVAL_PREVENTION: Organizers cannot approve/reject their own activities.")

        now_iso = datetime.now(timezone.utc).isoformat()
        is_approval = decision == "APPROVED"

        conn.execute(
            """
            UPDATE activities SET
                status_cache = ?,
                approval_tx_hash = ?,
                rejection_tx_hash = ?,
                approver_address = ?,
                approved_at = ?,
                rejected_at = ?,
                rejection_reason = ?,
                blockchain_confirmed = 1
            WHERE activity_id = ?;
            """,
            (
                decision,
                approval_tx_hash,
                approval_tx_hash if not is_approval else None,
                approver_address,
                now_iso if is_approval else None,
                now_iso if not is_approval else None,
                rejection_reason if not is_approval else None,
                activity_id,
            ),
        )

        if approval_tx_hash:
            tx_type = "APPROVAL" if is_approval else "REJECTION"
            conn.execute(
                """
                INSERT INTO transactions (
                    activity_id, tx_hash, tx_type, wallet_address,
                    confirmation_status, created_at, confirmed_at
                ) VALUES (?, ?, ?, ?, 'CONFIRMED', ?, ?)
                ON CONFLICT(tx_hash) DO UPDATE SET
                    confirmation_status='CONFIRMED',
                    confirmed_at=excluded.confirmed_at;
                """,
                (activity_id, approval_tx_hash, tx_type, approver_address, now_iso, now_iso),
            )

        cursor = conn.execute(
            "SELECT * FROM activities WHERE activity_id = ? LIMIT 1;",
            (activity_id,),
        )
        return dict(cursor.fetchone())


# =====================================================================
# Phase 7: Transaction Tracking & Persistence
# =====================================================================

def record_transaction(
    activity_id: str,
    tx_hash: str,
    tx_type: str,
    wallet_address: str,
    confirmation_status: str = "CONFIRMED",
    block_level: Optional[int] = None,
    error_message: Optional[str] = None,
) -> dict:
    """
    Idempotently records or updates a transaction in the transactions table.
    tx_type: SUBMISSION, APPROVAL, REJECTION
    confirmation_status: PENDING, CONFIRMED, FAILED
    """
    tx_type = tx_type.upper()
    confirmation_status = confirmation_status.upper()
    now_iso = datetime.now(timezone.utc).isoformat()
    confirmed_at = now_iso if confirmation_status == "CONFIRMED" else None

    with get_db_connection() as conn:
        conn.execute(
            """
            INSERT INTO transactions (
                activity_id, tx_hash, tx_type, wallet_address,
                confirmation_status, block_level, created_at, confirmed_at, error_message
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(tx_hash) DO UPDATE SET
                confirmation_status=excluded.confirmation_status,
                block_level=COALESCE(excluded.block_level, transactions.block_level),
                confirmed_at=COALESCE(excluded.confirmed_at, transactions.confirmed_at),
                error_message=excluded.error_message;
            """,
            (
                activity_id,
                tx_hash,
                tx_type,
                wallet_address,
                confirmation_status,
                block_level,
                now_iso,
                confirmed_at,
                error_message,
            ),
        )

        cur = conn.execute(
            "SELECT * FROM transactions WHERE tx_hash = ? LIMIT 1;",
            (tx_hash,),
        )
        return dict(cur.fetchone())


def get_transactions_for_activity(activity_id: str) -> list[dict]:
    """Retrieves all tracked transactions for a given activity."""
    with get_db_connection() as conn:
        cursor = conn.execute(
            "SELECT * FROM transactions WHERE activity_id = ? ORDER BY id ASC;",
            (activity_id,),
        )
        return [dict(row) for row in cursor.fetchall()]


def get_transaction_by_hash(tx_hash: str) -> Optional[dict]:
    """Retrieves a transaction record by hash."""
    with get_db_connection() as conn:
        cursor = conn.execute(
            "SELECT * FROM transactions WHERE tx_hash = ? LIMIT 1;",
            (tx_hash,),
        )
        row = cursor.fetchone()
        if row:
            return dict(row)
    return None


def update_transaction_status(
    tx_hash: str,
    confirmation_status: str,
    block_level: Optional[int] = None,
    error_message: Optional[str] = None,
) -> Optional[dict]:
    """Updates status of a pending transaction once confirmed or failed."""
    status_upper = confirmation_status.upper()
    now_iso = datetime.now(timezone.utc).isoformat()
    confirmed_at = now_iso if status_upper == "CONFIRMED" else None

    with get_db_connection() as conn:
        conn.execute(
            """
            UPDATE transactions SET
                confirmation_status = ?,
                block_level = COALESCE(?, block_level),
                confirmed_at = COALESCE(?, confirmed_at),
                error_message = ?
            WHERE tx_hash = ?;
            """,
            (status_upper, block_level, confirmed_at, error_message, tx_hash),
        )
        cur = conn.execute(
            "SELECT * FROM transactions WHERE tx_hash = ? LIMIT 1;",
            (tx_hash,),
        )
        row = cur.fetchone()
        return dict(row) if row else None


# =====================================================================
# Phase 7: Blockchain Reconciliation & Safe Recovery
# =====================================================================

def reconcile_activity_status(
    activity_id: str,
    on_chain_status: str,
    approver_address: Optional[str] = None,
    approval_tx_hash: Optional[str] = None,
    rejection_tx_hash: Optional[str] = None,
    block_level: Optional[int] = None,
    confirmed_at: Optional[str] = None,
) -> dict:
    """
    Updates cached activity status from authoritative on-chain contract state.
    Sets blockchain_confirmed = 1 and records timestamp.
    """
    status_upper = on_chain_status.upper()
    now_iso = confirmed_at or datetime.now(timezone.utc).isoformat()

    with get_db_connection() as conn:
        cursor = conn.execute(
            "SELECT * FROM activities WHERE activity_id = ? LIMIT 1;",
            (activity_id,),
        )
        row = cursor.fetchone()
        if not row:
            raise KeyError(f"Activity '{activity_id}' not found in database.")

        is_approved = status_upper == "APPROVED"
        is_rejected = status_upper == "REJECTED"

        conn.execute(
            """
            UPDATE activities SET
                status_cache = ?,
                approver_address = COALESCE(?, approver_address),
                approval_tx_hash = COALESCE(?, approval_tx_hash),
                rejection_tx_hash = COALESCE(?, rejection_tx_hash),
                approved_at = CASE WHEN ? THEN COALESCE(approved_at, ?) ELSE approved_at END,
                rejected_at = CASE WHEN ? THEN COALESCE(rejected_at, ?) ELSE rejected_at END,
                blockchain_confirmed = 1,
                reconciled_at = ?
            WHERE activity_id = ?;
            """,
            (
                status_upper,
                approver_address,
                approval_tx_hash,
                rejection_tx_hash,
                1 if is_approved else 0,
                now_iso,
                1 if is_rejected else 0,
                now_iso,
                now_iso,
                activity_id,
            ),
        )

        cur = conn.execute(
            "SELECT * FROM activities WHERE activity_id = ? LIMIT 1;",
            (activity_id,),
        )
        return dict(cur.fetchone())


def recover_failed_database_update(
    activity_id: str,
    tx_hash: str,
    tx_type: str,
    wallet_address: str,
    on_chain_status: Optional[str] = None,
    approver_address: Optional[str] = None,
    rejection_reason: Optional[str] = None,
) -> dict:
    """
    Safe Retry / Failure Recovery:
    Handles the critical scenario where a blockchain transaction confirmed on-chain,
    but the database write originally failed (e.g. network timeout or server crash).

    Idempotently reconciles the database using the confirmed transaction without
    submitting another blockchain transaction.
    """
    tx_type_upper = tx_type.upper()
    now_iso = datetime.now(timezone.utc).isoformat()

    # Determine status from on_chain_status or tx_type
    target_status = on_chain_status.upper() if on_chain_status else (
        "APPROVED" if tx_type_upper == "APPROVAL" else
        "REJECTED" if tx_type_upper == "REJECTION" else
        "SUBMITTED"
    )

    with get_db_connection() as conn:
        # 1. Ensure transaction is recorded idempotently
        conn.execute(
            """
            INSERT INTO transactions (
                activity_id, tx_hash, tx_type, wallet_address,
                confirmation_status, created_at, confirmed_at
            ) VALUES (?, ?, ?, ?, 'CONFIRMED', ?, ?)
            ON CONFLICT(tx_hash) DO UPDATE SET
                confirmation_status='CONFIRMED',
                confirmed_at=excluded.confirmed_at;
            """,
            (activity_id, tx_hash, tx_type_upper, wallet_address, now_iso, now_iso),
        )

        # 2. Check existing activity
        cursor = conn.execute(
            "SELECT * FROM activities WHERE activity_id = ? LIMIT 1;",
            (activity_id,),
        )
        row = cursor.fetchone()

        if row:
            # Activity exists, reconcile status and transaction references
            conn.execute(
                """
                UPDATE activities SET
                    status_cache = ?,
                    approval_tx_hash = CASE WHEN ? = 'APPROVED' THEN ? ELSE approval_tx_hash END,
                    rejection_tx_hash = CASE WHEN ? = 'REJECTED' THEN ? ELSE rejection_tx_hash END,
                    approver_address = COALESCE(?, approver_address),
                    approved_at = CASE WHEN ? = 'APPROVED' THEN COALESCE(approved_at, ?) ELSE approved_at END,
                    rejected_at = CASE WHEN ? = 'REJECTED' THEN COALESCE(rejected_at, ?) ELSE rejected_at END,
                    rejection_reason = COALESCE(?, rejection_reason),
                    blockchain_confirmed = 1,
                    reconciled_at = ?
                WHERE activity_id = ?;
                """,
                (
                    target_status,
                    target_status,
                    tx_hash,
                    target_status,
                    tx_hash,
                    approver_address or wallet_address,
                    target_status,
                    now_iso,
                    target_status,
                    now_iso,
                    rejection_reason,
                    now_iso,
                    activity_id,
                ),
            )
        else:
            # Activity was not created in DB at all; create stub record to link transaction
            conn.execute(
                """
                INSERT INTO activities (
                    activity_id, submitter_address, category, quantity, unit,
                    description, evidence_hash, status_cache, submission_tx_hash,
                    approval_tx_hash, rejection_tx_hash, approver_address,
                    submitted_at, approved_at, rejected_at, rejection_reason,
                    blockchain_confirmed, reconciled_at
                ) VALUES (?, ?, 'Recovered Activity', 1.0, 'unit', 'Recovered from confirmed on-chain transaction',
                          ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?);
                """,
                (
                    activity_id,
                    wallet_address,
                    f"recovered_hash_{tx_hash[:16]}",
                    target_status,
                    tx_hash if tx_type_upper == "SUBMISSION" else None,
                    tx_hash if target_status == "APPROVED" else None,
                    tx_hash if target_status == "REJECTED" else None,
                    approver_address,
                    now_iso,
                    now_iso if target_status == "APPROVED" else None,
                    now_iso if target_status == "REJECTED" else None,
                    rejection_reason,
                    now_iso,
                ),
            )

        cur = conn.execute(
            "SELECT * FROM activities WHERE activity_id = ? LIMIT 1;",
            (activity_id,),
        )
        return dict(cur.fetchone())


def get_activity_history(activity_id: str) -> Optional[dict]:
    """
    Builds a full chronological audit trail and history of an activity,
    combining activity state transitions and confirmed transaction logs.
    """
    activity = get_activity_by_id(activity_id)
    if not activity:
        return None

    transactions = get_transactions_for_activity(activity_id)

    # Compile chronological events
    events = []

    # 1. Submission Event
    events.append({
        "event_type": "SUBMISSION",
        "timestamp": activity["submitted_at"],
        "actor_address": activity["submitter_address"],
        "tx_hash": activity.get("submission_tx_hash"),
        "status": "SUBMITTED",
        "description": "Activity submitted by student wallet.",
    })

    # 2. Decision Event (if approved or rejected)
    if activity["status_cache"] == "APPROVED" and activity.get("approved_at"):
        events.append({
            "event_type": "APPROVAL",
            "timestamp": activity["approved_at"],
            "actor_address": activity.get("approver_address") or "Authorized Organizer",
            "tx_hash": activity.get("approval_tx_hash"),
            "status": "APPROVED",
            "description": "Activity approved by authorized organizer on Tezos.",
        })
    elif activity["status_cache"] == "REJECTED" and activity.get("rejected_at"):
        events.append({
            "event_type": "REJECTION",
            "timestamp": activity["rejected_at"],
            "actor_address": activity.get("approver_address") or "Authorized Organizer",
            "tx_hash": activity.get("rejection_tx_hash") or activity.get("approval_tx_hash"),
            "status": "REJECTED",
            "rejection_reason": activity.get("rejection_reason"),
            "description": "Activity rejected by authorized organizer.",
        })

    # 3. Reconciliation Event (if reconciled)
    if activity.get("reconciled_at"):
        events.append({
            "event_type": "RECONCILIATION",
            "timestamp": activity["reconciled_at"],
            "actor_address": "Reconciliation Engine",
            "status": activity["status_cache"],
            "description": "Record verified against authoritative on-chain contract state.",
        })

    return {
        "activity": activity,
        "events": events,
        "transactions": transactions,
    }


def log_reconciliation_run(
    status: str,
    total_records: int,
    synced_records: int,
    mismatched_records: int,
    details: Optional[str] = None,
    error_message: Optional[str] = None,
) -> dict:
    """Logs a completed reconciliation execution."""
    now_iso = datetime.now(timezone.utc).isoformat()
    with get_db_connection() as conn:
        cur = conn.execute(
            """
            INSERT INTO reconciliation_log (
                run_timestamp, status, total_records, synced_records,
                mismatched_records, error_message, details
            ) VALUES (?, ?, ?, ?, ?, ?, ?);
            """,
            (now_iso, status, total_records, synced_records, mismatched_records, error_message, details),
        )
        return {
            "id": cur.lastrowid,
            "run_timestamp": now_iso,
            "status": status,
            "total_records": total_records,
            "synced_records": synced_records,
            "mismatched_records": mismatched_records,
            "details": details,
            "error_message": error_message,
        }


def get_reconciliation_statistics() -> dict:
    """Returns database summary statistics for reconciliation dashboard."""
    with get_db_connection() as conn:
        cur_total = conn.execute("SELECT COUNT(*) as count FROM activities;")
        total_activities = cur_total.fetchone()["count"]

        cur_conf = conn.execute("SELECT COUNT(*) as count FROM activities WHERE blockchain_confirmed = 1;")
        confirmed = cur_conf.fetchone()["count"]

        cur_unconf = conn.execute("SELECT COUNT(*) as count FROM activities WHERE blockchain_confirmed = 0;")
        unconfirmed = cur_unconf.fetchone()["count"]

        cur_tx = conn.execute("SELECT COUNT(*) as count FROM transactions;")
        total_transactions = cur_tx.fetchone()["count"]

        cur_log = conn.execute(
            "SELECT * FROM reconciliation_log ORDER BY id DESC LIMIT 1;"
        )
        last_log = cur_log.fetchone()

        return {
            "total_activities": total_activities,
            "confirmed_activities": confirmed,
            "unconfirmed_activities": unconfirmed,
            "total_transactions": total_transactions,
            "last_reconciliation": dict(last_log) if last_log else None,
        }

