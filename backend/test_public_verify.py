"""
GreenTrace 2.0 - Phase 9 Public Verification Tests
Covers QR verification endpoints, on-chain contract state verification,
privacy guarantees, error handling, and method restrictions.
"""

import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent))

import pytest
from unittest.mock import patch
from fastapi.testclient import TestClient

from app.database import (
    init_db,
    save_evidence,
    create_or_update_activity,
    record_activity_decision,
)
import app.database as db_module
from main import app


MANDATORY_DISCLAIMER = (
    "Blockchain verification confirms that this activity record and its status were "
    "recorded by the GreenTrace smart contract. It does not independently prove that "
    "the physical activity occurred."
)


@pytest.fixture()
def isolated_db(tmp_path, monkeypatch):
    """Provides an isolated SQLite database in a temporary directory."""
    db_file = str(tmp_path / "test_greentrace_public.db")
    monkeypatch.setenv("DATABASE_PATH", db_file)
    monkeypatch.setattr(db_module, "DATABASE_PATH", db_file)
    db_module.init_db()
    return db_file


@pytest.fixture()
def client(isolated_db):
    """TestClient fixture with isolated database."""
    return TestClient(app)


class TestPublicVerificationEndpoints:
    def test_verify_approved_activity_with_authoritative_contract_state(self, client):
        act_id = "act-2026-public-001"
        evidence_hash = "a" * 64

        save_evidence(
            evidence_hash=evidence_hash,
            filename="secret_photo.jpg",
            stored_path="/private/uploads/secret_photo.jpg",
            file_size=12345,
            mime_type="image/jpeg",
        )

        create_or_update_activity(
            activity_id=act_id,
            submitter_address="tz1StudentWalletAddress1111111111",
            category="Tree Planting",
            quantity=10.0,
            unit="trees planted",
            description="Planted ten indigenous saplings near campus library.",
            evidence_hash=evidence_hash,
            submission_tx_hash="opSub1111111111111111111111111111111111111111111",
            submitted_at="2026-03-20T10:00:00Z",
        )

        record_activity_decision(
            activity_id=act_id,
            decision="APPROVED",
            approver_address="tz1OrganizerWalletAddress2222222222",
            approval_tx_hash="opApp2222222222222222222222222222222222222222222",
        )

        mock_contract_state = {
            "submitter": "tz1StudentWalletAddress1111111111",
            "category": "Tree Planting",
            "quantity": 10.0,
            "unit": "trees planted",
            "description": "Planted ten indigenous saplings near campus library.",
            "evidence_hash": evidence_hash,
            "status": "APPROVED",
            "timestamp": 1711200000,
            "approver_address": "tz1OrganizerWalletAddress2222222222",
            "approved_at": "2026-03-21T12:00:00Z",
        }

        with patch("app.routes.public.get_configured_contract_address", return_value="KT1SampleContractAddress111111111111"), \
             patch("app.routes.public.fetch_on_chain_activity", return_value=mock_contract_state):
            resp = client.get(f"/api/public/verify/{act_id}")

        assert resp.status_code == 200
        data = resp.json()

        assert data["activity_id"] == act_id
        assert data["category"] == "Tree Planting"
        assert data["quantity"] == 10.0
        assert data["unit"] == "trees planted"
        assert data["status"] == "APPROVED"
        assert data["status_label"] == "Approved"
        assert data["network"] == "Shadownet (Tezos Testnet)"
        assert data["contract_address"] == "KT1SampleContractAddress111111111111"
        assert data["evidence_hash"] == evidence_hash
        assert data["submission_tx_hash"] == "opSub1111111111111111111111111111111111111111111"
        assert data["approval_tx_hash"] == "opApp2222222222222222222222222222222222222222222"
        assert data["approver_address"] == "tz1OrganizerWalletAddress2222222222"
        assert data["disclaimer"] == MANDATORY_DISCLAIMER

    def test_verify_pending_activity(self, client):
        act_id = "act-2026-pending-002"
        evidence_hash = "b" * 64

        create_or_update_activity(
            activity_id=act_id,
            submitter_address="tz1StudentWalletAddress1111111111",
            category="Energy Conservation",
            quantity=50.0,
            unit="kWh saved",
            description="Turned off dorm AC units.",
            evidence_hash=evidence_hash,
            submission_tx_hash="opSubPending111111111111111111111111111111111",
            submitted_at="2026-03-22T10:00:00Z",
        )

        mock_contract_state = {
            "submitter": "tz1StudentWalletAddress1111111111",
            "category": "Energy Conservation",
            "quantity": 50.0,
            "unit": "kWh saved",
            "description": "Turned off dorm AC units.",
            "evidence_hash": evidence_hash,
            "status": "SUBMITTED",
            "submitted_at": "2026-03-22T10:00:00Z",
            "approver_address": None,
        }

        with patch("app.routes.public.get_configured_contract_address", return_value="KT1SampleContractAddress111111111111"), \
             patch("app.routes.public.fetch_on_chain_activity", return_value=mock_contract_state):
            resp = client.get(f"/api/public/verify/{act_id}")

        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "SUBMITTED"
        assert data["status_label"] == "Pending"

    def test_verify_rejected_activity(self, client):
        act_id = "act-2026-rejected-003"
        evidence_hash = "c" * 64

        create_or_update_activity(
            activity_id=act_id,
            submitter_address="tz1StudentWalletAddress1111111111",
            category="Recycling",
            quantity=2.0,
            unit="kg plastic",
            description="Recycled plastic bottles.",
            evidence_hash=evidence_hash,
            submitted_at="2026-03-23T10:00:00Z",
        )

        record_activity_decision(
            activity_id=act_id,
            decision="REJECTED",
            approver_address="tz1OrganizerWalletAddress2222222222",
            approval_tx_hash="opRej3333333333333333333333333333333333333333333",
            rejection_reason="Blurry photo, cannot verify timestamp",
        )

        mock_contract_state = {
            "submitter": "tz1StudentWalletAddress1111111111",
            "category": "Recycling",
            "quantity": 2.0,
            "unit": "kg plastic",
            "description": "Recycled plastic bottles.",
            "evidence_hash": evidence_hash,
            "status": "REJECTED",
            "approver_address": "tz1OrganizerWalletAddress2222222222",
            "approval_tx_hash": "opRej3333333333333333333333333333333333333333333",
        }

        with patch("app.routes.public.get_configured_contract_address", return_value="KT1SampleContractAddress111111111111"), \
             patch("app.routes.public.fetch_on_chain_activity", return_value=mock_contract_state):
            resp = client.get(f"/api/public/verify/{act_id}")

        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "REJECTED"
        assert data["status_label"] == "Rejected"
        # Privacy guarantee: rejection reason should NOT be leaked in public API
        assert "rejection_reason" not in data

    def test_missing_contract_configuration_yields_unavailable_status(self, client):
        """When smart contract is unconfigured, verification returns status UNAVAILABLE gracefully."""
        act_id = "act-2026-noconfig-004"
        evidence_hash = "d" * 64

        create_or_update_activity(
            activity_id=act_id,
            submitter_address="tz1StudentWalletAddress1111111111",
            category="Tree Planting",
            quantity=3.0,
            unit="trees",
            description="Planted trees",
            evidence_hash=evidence_hash,
            submitted_at="2026-03-24T10:00:00Z",
        )

        with patch("app.routes.public.get_configured_contract_address", return_value=""):
            resp = client.get(f"/api/public/verify/{act_id}")

        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "UNAVAILABLE"
        assert data["status_label"] == "Verification unavailable"
        assert "Contract address is not configured" in data["details"]

    def test_rpc_failure_yields_unavailable_status(self, client):
        """When Tezos RPC network call fails, verification returns status UNAVAILABLE gracefully."""
        act_id = "act-2026-rpcerr-005"
        evidence_hash = "e" * 64

        create_or_update_activity(
            activity_id=act_id,
            submitter_address="tz1StudentWalletAddress1111111111",
            category="Campus Clean-up",
            quantity=20.0,
            unit="kg trash",
            description="Cleaned shoreline",
            evidence_hash=evidence_hash,
            submitted_at="2026-03-25T10:00:00Z",
        )

        with patch("app.routes.public.get_configured_contract_address", return_value="KT1SampleContractAddress111111111111"), \
             patch("app.routes.public.fetch_on_chain_activity", side_effect=Exception("Connection refused by Tezos RPC")):
            resp = client.get(f"/api/public/verify/{act_id}")

        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "UNAVAILABLE"
        assert data["status_label"] == "Verification unavailable"
        assert "Activity is not recorded on the smart contract or RPC node was unreachable" in data["details"]

    def test_nonexistent_activity_returns_404(self, client):
        with patch("app.routes.public.get_configured_contract_address", return_value="KT1SampleContractAddress111111111111"), \
             patch("app.routes.public.fetch_on_chain_activity", return_value=None):
            resp = client.get("/api/public/verify/act-nonexistent-999")
        assert resp.status_code == 404
        assert "not found" in resp.json()["detail"].lower()

    def test_invalid_activity_id_format_returns_400(self, client):
        resp = client.get("/api/public/verify/invalid%20id%20with%20spaces!")
        assert resp.status_code == 400
        assert "Invalid Activity ID" in resp.json()["detail"]

    def test_read_only_enforcement_on_public_endpoint(self, client):
        """Public verification endpoint must be strictly read-only."""
        act_id = "act-2026-readonly-001"

        post_resp = client.post(f"/api/public/verify/{act_id}", json={"status": "APPROVED"})
        assert post_resp.status_code == 405

        put_resp = client.put(f"/api/public/verify/{act_id}", json={"status": "APPROVED"})
        assert put_resp.status_code == 405

        del_resp = client.delete(f"/api/public/verify/{act_id}")
        assert del_resp.status_code == 405

    def test_public_verification_privacy_guarantees(self, client):
        """Public response must strictly protect sensitive student data and server paths."""
        act_id = "act-2026-privacy-001"
        evidence_hash = "f" * 64

        save_evidence(
            evidence_hash=evidence_hash,
            filename="secret_evidence.jpg",
            stored_path="C:\\Secret\\Path\\secret_evidence.jpg",
            file_size=54321,
            mime_type="image/jpeg",
        )

        create_or_update_activity(
            activity_id=act_id,
            submitter_address="tz1StudentWalletAddress1111111111",
            category="Energy",
            quantity=15.0,
            unit="hours",
            description="Turned off campus lab computers",
            evidence_hash=evidence_hash,
            submitted_at="2026-03-26T10:00:00Z",
        )

        mock_contract = {
            "submitter": "tz1StudentWalletAddress1111111111",
            "category": "Energy",
            "quantity": 15.0,
            "unit": "hours",
            "description": "Turned off campus lab computers",
            "evidence_hash": evidence_hash,
            "status": "APPROVED",
            "timestamp": 1711200000,
            "approver_address": "tz1OrganizerWalletAddress2222222222",
            "approval_tx_hash": "opApp1111111111111111111111111111111111111111111",
        }

        with patch("app.routes.public.get_configured_contract_address", return_value="KT1SampleContractAddress111111111111"), \
             patch("app.routes.public.fetch_on_chain_activity", return_value=mock_contract):
            resp = client.get(f"/api/public/verify/{act_id}")

        assert resp.status_code == 200
        data = resp.json()

        # Strict checks that private paths or student PII never appear in public response
        assert "evidence_path" not in data
        assert "stored_path" not in data
        assert "submitter_name" not in data
        assert "submitter_email" not in data
        assert "student_id" not in data
        assert "rejection_reason" not in data
        assert "C:\\Secret\\Path" not in str(data)

    def test_alias_endpoint_returns_identical_verification(self, client):
        """Test GET /api/public/activities/{id} alias."""
        act_id = "act-2026-alias-001"
        evidence_hash = "1" * 64

        create_or_update_activity(
            activity_id=act_id,
            submitter_address="tz1StudentWalletAddress1111111111",
            category="Clean-up",
            quantity=5.0,
            unit="kg",
            description="Beach clean-up",
            evidence_hash=evidence_hash,
            submitted_at="2026-03-27T10:00:00Z",
        )

        mock_contract = {
            "submitter": "tz1StudentWalletAddress1111111111",
            "category": "Clean-up",
            "quantity": 5.0,
            "unit": "kg",
            "evidence_hash": evidence_hash,
            "status": "APPROVED",
        }

        with patch("app.routes.public.get_configured_contract_address", return_value="KT1SampleContractAddress111111111111"), \
             patch("app.routes.public.fetch_on_chain_activity", return_value=mock_contract):
            resp1 = client.get(f"/api/public/verify/{act_id}")
            resp2 = client.get(f"/api/public/activities/{act_id}")

        assert resp1.status_code == 200
        assert resp2.status_code == 200
        assert resp1.json() == resp2.json()
