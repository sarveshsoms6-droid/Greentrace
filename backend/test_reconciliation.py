"""
GreenTrace 2.0 - Phase 7 Backend Tests
Tests SQLite database persistence, transaction reference tracking,
authoritative blockchain reconciliation, safe retries & failure recovery,
RPC failure resilience, idempotent operations, and private evidence security.
"""

import io
import pytest
from unittest.mock import patch, MagicMock
from fastapi.testclient import TestClient

from app.database import (
    init_db,
    get_db_connection,
    create_or_update_activity,
    get_activity_by_id,
    record_transaction,
    get_transactions_for_activity,
    get_transaction_by_hash,
    recover_failed_database_update,
    get_activity_history,
)
from app.services.reconciliation import (
    reconcile_database_with_blockchain,
    recover_activity_transaction,
    verify_on_chain_transaction,
    fetch_on_chain_activity,
)
from main import app

ORGANIZER_ADDRESS = "tz1aSkwEkv3Ax2bWZHvCaOKUMcqModq5RMqJ"
STUDENT_ADDRESS = "tz1VSUr8wwNhLAzempoch5d6hLRiTh8Cjcjb"
UNAUTHORIZED_ADDRESS = "tz1burnburnburnburnburnburnbur155rw"


@pytest.fixture()
def isolated_db(tmp_path, monkeypatch):
    """Provides an isolated SQLite database in a temporary directory."""
    db_file = str(tmp_path / "test_greentrace_reconciliation.db")
    monkeypatch.setenv("DATABASE_PATH", db_file)

    import app.database as db_module
    monkeypatch.setattr(db_module, "DATABASE_PATH", db_file)
    db_module.init_db()
    return db_file


@pytest.fixture()
def client(isolated_db):
    """TestClient fixture with isolated SQLite database."""
    return TestClient(app)


# =====================================================================
# 1. Successful Activity Persistence & Duplicate Checks
# =====================================================================

class TestActivityPersistenceAndDuplicates:
    def test_successful_activity_persistence(self, client):
        payload = {
            "activity_id": "act-persist-001",
            "submitter_address": STUDENT_ADDRESS,
            "category": "Recycling",
            "quantity": 25.5,
            "unit": "kg",
            "description": "Collected aluminum cans across campus dormitories.",
            "evidence_hash": "a" * 64,
            "submission_tx_hash": "op_submit_persist_123",
            "submitted_at": "2026-10-30T10:00:00Z",
        }
        res = client.post("/api/activities", json=payload)
        assert res.status_code == 201
        data = res.json()
        assert data["activity_id"] == "act-persist-001"
        assert data["status_cache"] == "SUBMITTED"
        assert data["submission_tx_hash"] == "op_submit_persist_123"
        assert data["blockchain_confirmed"] == 1

        # Verify lookup via GET /api/activities/{id}
        fetch_res = client.get("/api/activities/act-persist-001")
        assert fetch_res.status_code == 200
        assert fetch_res.json()["quantity"] == 25.5

    def test_duplicate_activity_ids_idempotently_updated(self, client):
        payload1 = {
            "activity_id": "act-dup-001",
            "submitter_address": STUDENT_ADDRESS,
            "category": "Tree planting",
            "quantity": 4,
            "unit": "saplings",
            "evidence_hash": "b" * 64,
            "submission_tx_hash": "op_submit_dup_1",
        }
        res1 = client.post("/api/activities", json=payload1)
        assert res1.status_code == 201

        # Resubmit with same activity_id and updated description
        payload2 = {
            "activity_id": "act-dup-001",
            "submitter_address": STUDENT_ADDRESS,
            "category": "Tree planting",
            "quantity": 4,
            "unit": "saplings",
            "description": "Updated description on same activity ID",
            "evidence_hash": "b" * 64,
            "submission_tx_hash": "op_submit_dup_1",
        }
        res2 = client.post("/api/activities", json=payload2)
        assert res2.status_code == 201
        assert res2.json()["description"] == "Updated description on same activity ID"

        # Verify no duplicate rows exist in activities table
        with get_db_connection() as conn:
            cur = conn.execute("SELECT COUNT(*) as cnt FROM activities WHERE activity_id = 'act-dup-001';")
            assert cur.fetchone()["cnt"] == 1


# =====================================================================
# 2. Transaction Reference Persistence
# =====================================================================

class TestTransactionPersistence:
    def test_transaction_reference_persistence(self, client):
        # 1. Create base activity
        client.post("/api/activities", json={
            "activity_id": "act-tx-test",
            "submitter_address": STUDENT_ADDRESS,
            "category": "Water conservation",
            "quantity": 100,
            "unit": "litres",
            "evidence_hash": "c" * 64,
        })

        # 2. Register transaction reference via POST /api/reconciliation/transactions
        tx_payload = {
            "activity_id": "act-tx-test",
            "tx_hash": "op_tezos_operation_hash_test_123",
            "tx_type": "SUBMISSION",
            "wallet_address": STUDENT_ADDRESS,
            "confirmation_status": "CONFIRMED",
            "block_level": 450123,
        }
        res = client.post("/api/reconciliation/transactions", json=tx_payload)
        assert res.status_code == 201
        tx_data = res.json()
        assert tx_data["tx_hash"] == "op_tezos_operation_hash_test_123"
        assert tx_data["confirmation_status"] == "CONFIRMED"
        assert tx_data["block_level"] == 450123

        # 3. Retrieve transactions by activity
        act_txs_res = client.get("/api/activities/act-tx-test/transactions")
        assert act_txs_res.status_code == 200
        txs = act_txs_res.json()
        assert len(txs) >= 1
        assert txs[0]["tx_hash"] == "op_tezos_operation_hash_test_123"

        # 4. Lookup by hash
        hash_res = client.get("/api/reconciliation/transactions/op_tezos_operation_hash_test_123")
        assert hash_res.status_code == 200
        assert hash_res.json()["activity_id"] == "act-tx-test"


# =====================================================================
# 3. Confirmed Blockchain Transaction with Successful DB Update
# =====================================================================

class TestConfirmedTransactionWorkflow:
    def test_confirmed_decision_persists_transaction_and_activity(self, client):
        # Create pending activity
        client.post("/api/activities", json={
            "activity_id": "act-confirm-workflow",
            "submitter_address": STUDENT_ADDRESS,
            "category": "Waste collection",
            "quantity": 12,
            "unit": "kg",
            "evidence_hash": "d" * 64,
        })

        # Record organizer approval with transaction hash
        res = client.post("/api/activities/act-confirm-workflow/decision", json={
            "decision": "APPROVED",
            "approver_address": ORGANIZER_ADDRESS,
            "approval_tx_hash": "op_confirmed_approval_tx_999",
        })
        assert res.status_code == 200
        assert res.json()["status"] == "APPROVED"

        # Verify activity reflects confirmation
        act = client.get("/api/activities/act-confirm-workflow").json()
        assert act["status_cache"] == "APPROVED"
        assert act["blockchain_confirmed"] == 1
        assert act["approval_tx_hash"] == "op_confirmed_approval_tx_999"

        # Verify transaction table contains APPROVAL record
        tx = get_transaction_by_hash("op_confirmed_approval_tx_999")
        assert tx is not None
        assert tx["tx_type"] == "APPROVAL"
        assert tx["confirmation_status"] == "CONFIRMED"
        assert tx["wallet_address"] == ORGANIZER_ADDRESS


# =====================================================================
# 4. Confirmed Transaction with Failed DB Write and Safe Retry
# =====================================================================

class TestSafeRecoveryAndRetries:
    def test_confirmed_tx_with_failed_db_update_and_successful_retry(self, client):
        """
        Scenario: An organizer approved on-chain with hash 'op_onchain_confirmed_123',
        but the backend database write failed. The activity in DB is still 'SUBMITTED'.
        Safe recovery must update the DB idempotently without re-submitting to the blockchain.
        """
        # Create initial activity in DB (status: SUBMITTED)
        client.post("/api/activities", json={
            "activity_id": "act-recovery-test-01",
            "submitter_address": STUDENT_ADDRESS,
            "category": "Energy conservation",
            "quantity": 50,
            "unit": "kWh",
            "evidence_hash": "e" * 64,
        })

        # Ensure status is SUBMITTED
        act_before = client.get("/api/activities/act-recovery-test-01").json()
        assert act_before["status_cache"] == "SUBMITTED"

        # Simulate on-chain confirmation verification mock
        mock_verify = {
            "tx_hash": "op_onchain_confirmed_123",
            "exists": True,
            "status": "applied",
            "block_level": 500100,
        }
        mock_on_chain_act = {
            "activity_id": "act-recovery-test-01",
            "status": "APPROVED",
            "approver_address": ORGANIZER_ADDRESS,
            "approved_at": "2026-10-30T10:15:00Z",
        }

        with patch("app.services.reconciliation.verify_on_chain_transaction", return_value=mock_verify), \
             patch("app.services.reconciliation.fetch_on_chain_activity", return_value=mock_on_chain_act):

            recovery_payload = {
                "activity_id": "act-recovery-test-01",
                "tx_hash": "op_onchain_confirmed_123",
                "tx_type": "APPROVAL",
                "wallet_address": ORGANIZER_ADDRESS,
                "approver_address": ORGANIZER_ADDRESS,
            }
            res = client.post("/api/reconciliation/recover", json=recovery_payload)
            assert res.status_code == 200
            data = res.json()
            assert data["success"] is True
            assert data["tx_verified_on_chain"] is True
            assert data["activity"]["status_cache"] == "APPROVED"
            assert data["activity"]["approval_tx_hash"] == "op_onchain_confirmed_123"
            assert data["activity"]["blockchain_confirmed"] == 1

        # Check activity in DB is now APPROVED
        act_after = client.get("/api/activities/act-recovery-test-01").json()
        assert act_after["status_cache"] == "APPROVED"
        assert act_after["approval_tx_hash"] == "op_onchain_confirmed_123"

    def test_idempotent_retries(self, client):
        """
        Calling recovery multiple times produces identical state without creating duplicate records.
        """
        client.post("/api/activities", json={
            "activity_id": "act-idempotent-test",
            "submitter_address": STUDENT_ADDRESS,
            "category": "Recycling",
            "quantity": 10,
            "unit": "kg",
            "evidence_hash": "f" * 64,
        })

        mock_verify = {"exists": True, "status": "applied", "tx_hash": "op_idempotent_tx"}
        with patch("app.services.reconciliation.verify_on_chain_transaction", return_value=mock_verify):
            payload = {
                "activity_id": "act-idempotent-test",
                "tx_hash": "op_idempotent_tx",
                "tx_type": "APPROVAL",
                "wallet_address": ORGANIZER_ADDRESS,
            }

            # Call 1
            res1 = client.post("/api/reconciliation/recover", json=payload)
            assert res1.status_code == 200

            # Call 2 (identical retry)
            res2 = client.post("/api/reconciliation/recover", json=payload)
            assert res2.status_code == 200
            assert res2.json()["activity"]["status_cache"] == "APPROVED"

            # Call 3 (identical retry)
            res3 = client.post("/api/reconciliation/recover", json=payload)
            assert res3.status_code == 200

        # Check only 1 transaction record exists for this hash
        with get_db_connection() as conn:
            cur = conn.execute("SELECT COUNT(*) as count FROM transactions WHERE tx_hash = 'op_idempotent_tx';")
            assert cur.fetchone()["count"] == 1


# =====================================================================
# 5. Blockchain Reconciliation & Mismatched Status Sync
# =====================================================================

class TestReconciliationService:
    def test_mismatched_database_and_contract_statuses_auto_reconciled(self, client):
        """
        Local database is 'SUBMITTED', but smart contract is 'APPROVED'.
        Reconciliation must detect mismatch and update local cache.
        """
        client.post("/api/activities", json={
            "activity_id": "act-mismatch-01",
            "submitter_address": STUDENT_ADDRESS,
            "category": "Tree planting",
            "quantity": 8,
            "unit": "saplings",
            "evidence_hash": "01" * 32,
        })

        def mock_fetch(act_id, contract_address=None):
            if act_id == "act-mismatch-01":
                return {
                    "activity_id": "act-mismatch-01",
                    "status": "APPROVED",
                    "approver_address": ORGANIZER_ADDRESS,
                    "approved_at": "2026-10-30T10:30:00Z",
                }
            return None

        with patch("app.services.reconciliation.fetch_on_chain_activity", side_effect=mock_fetch):
            sync_res = client.post("/api/reconciliation/sync", json={
                "contract_address": "KT1MockGreenTraceContractAddress123",
                "dry_run": False,
            })
            assert sync_res.status_code == 200
            data = sync_res.json()
            assert data["mismatched_count"] >= 1
            assert data["updated_count"] >= 1

            # Activity in DB should now be updated to APPROVED
            act = client.get("/api/activities/act-mismatch-01").json()
            assert act["status_cache"] == "APPROVED"
            assert act["blockchain_confirmed"] == 1

    def test_rpc_failure_during_reconciliation_handled_safely(self, client):
        """
        Network or RPC errors during reconciliation must not crash the service or corrupt state.
        """
        client.post("/api/activities", json={
            "activity_id": "act-rpc-fail-test",
            "submitter_address": STUDENT_ADDRESS,
            "category": "Recycling",
            "quantity": 5,
            "unit": "kg",
            "evidence_hash": "02" * 32,
        })

        # Simulate RPC failure (fetch raises exception or returns None)
        with patch("app.services.reconciliation.fetch_on_chain_activity", return_value=None):
            res = client.post("/api/reconciliation/sync", json={
                "contract_address": "KT1MockGreenTraceContractAddress123",
                "dry_run": False,
            })
            assert res.status_code == 200
            data = res.json()
            assert data["status"] in ["COMPLETED", "RESOLVED_MISMATCHES", "SKIPPED"]

        # Local activity must remain intact and not corrupted
        act = client.get("/api/activities/act-rpc-fail-test").json()
        assert act["activity_id"] == "act-rpc-fail-test"
        assert act["status_cache"] == "SUBMITTED"

    def test_reconciliation_status_endpoint(self, client):
        res = client.get("/api/reconciliation/status")
        assert res.status_code == 200
        data = res.json()
        assert "total_activities" in data
        assert "confirmed_activities" in data
        assert "rpc_url" in data


# =====================================================================
# 6. Audit History & Protected Evidence Access Control
# =====================================================================

class TestAuditHistoryAndEvidenceSecurity:
    def test_activity_audit_history_endpoint(self, client):
        # Create and approve an activity
        client.post("/api/activities", json={
            "activity_id": "act-history-test",
            "submitter_address": STUDENT_ADDRESS,
            "category": "Water conservation",
            "quantity": 80,
            "unit": "litres",
            "evidence_hash": "03" * 32,
            "submission_tx_hash": "op_submit_hist_1",
        })

        client.post("/api/activities/act-history-test/decision", json={
            "decision": "APPROVED",
            "approver_address": ORGANIZER_ADDRESS,
            "approval_tx_hash": "op_approve_hist_1",
        })

        res = client.get("/api/activities/act-history-test/history")
        assert res.status_code == 200
        data = res.json()
        assert data["activity"]["activity_id"] == "act-history-test"
        events = data["events"]
        assert len(events) >= 2
        event_types = [e["event_type"] for e in events]
        assert "SUBMISSION" in event_types
        assert "APPROVAL" in event_types

    def test_unauthorized_access_to_private_evidence_denied(self, client):
        """
        Section 8/10 security requirement: Unauthorized access to original evidence
        is strictly forbidden (HTTP 403).
        """
        # Upload valid image
        dummy_png = b"\x89PNG\r\n\x1a\n" + b"\x00" * 200
        upload_res = client.post(
            "/api/evidence",
            files={"file": ("test_security.png", io.BytesIO(dummy_png), "image/png")},
        )
        assert upload_res.status_code == 201
        ev_hash = upload_res.json()["evidence_hash"]

        # Public access without credentials must be 403 Forbidden
        public_res = client.get(f"/api/evidence/{ev_hash}/file")
        assert public_res.status_code == 403

        # Unauthorized wallet address must also be 403 Forbidden
        unauth_res = client.get(
            f"/api/evidence/{ev_hash}/file?organizer_address={UNAUTHORIZED_ADDRESS}"
        )
        assert unauth_res.status_code == 403

        # Authorized organizer address must be 200 OK
        auth_res = client.get(
            f"/api/evidence/{ev_hash}/file?organizer_address={ORGANIZER_ADDRESS}"
        )
        assert auth_res.status_code == 200
