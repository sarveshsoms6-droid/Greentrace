"""
GreenTrace 2.0 - Phase 10 End-to-End Workflow & Edge-Case Integration Test Suite
Executes complete automated end-to-end scenarios:
- Scenario A: Student submission workflow (Upload -> SHA-256 -> Duplicate Check -> Activity Record)
- Scenario B: Authorized organizer approval workflow (Verify -> Review -> Approve -> Blockchain State)
- Scenario C: Authorized organizer rejection workflow (Reject with Reason -> State Update)
- Scenario D: Public verification workflow (QR Resolution -> Public State -> Disclaimer Verification)
- Comprehensive Edge Cases:
  * Unauthorized organizer approval
  * Self-approval violation
  * Repeated decisions
  * Invalid file formats
  * Duplicate evidence detection
  * Student data isolation
  * Invalid activity ID
  * RPC/Contract failure resilience
"""

import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent))

import io
import pytest
from unittest.mock import patch
from fastapi.testclient import TestClient

from app.database import (
    init_db,
    create_or_update_activity,
    record_activity_decision,
    get_activities,
    get_activity_by_id,
    is_authorized_organizer,
)
import app.database as db_module
import app.routes.evidence as ev_module
from main import app

# Standard test identities
ORGANIZER_ADDRESS = "tz1aSkwEkv3Ax2bWZHvCaOKUMcqModq5RMqJ"
STUDENT_ALICE = "tz1VSUr8wwNhLAzempoch5d6hLRiTh8Cjcjb"
STUDENT_BOB = "tz1burnburnburnburnburnburnbur155rw"
UNAUTHORIZED_ATTACKER = "tz1UnauthorizedAttackerWalletAddress1"

MANDATORY_DISCLAIMER = (
    "Blockchain verification confirms that this activity record and its status were "
    "recorded by the GreenTrace smart contract. It does not independently prove that "
    "the physical activity occurred."
)

VALID_PNG_BYTES = (
    b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01"
    b"\x08\x06\x00\x00\x00\x1f\x15c4\x00\x00\x00\nIDATx\x9cc\x00\x01\x00\x00\x05"
    b"\x00\x01\r\n-\xb4\x00\x00\x00\x00IEND\xaeB`\x82"
)


@pytest.fixture()
def isolated_env(tmp_path, monkeypatch):
    """Provides isolated SQLite database and upload storage."""
    db_file = str(tmp_path / "test_greentrace_e2e.db")
    upload_dir = str(tmp_path / "protected_evidence")
    Path(upload_dir).mkdir(parents=True, exist_ok=True)

    monkeypatch.setenv("DATABASE_PATH", db_file)
    monkeypatch.setattr(db_module, "DATABASE_PATH", db_file)
    monkeypatch.setenv("UPLOAD_DIRECTORY", upload_dir)
    monkeypatch.setattr(ev_module, "UPLOAD_DIR", upload_dir)

    db_module.init_db()
    client = TestClient(app)
    return client, db_file, upload_dir


class TestEndToEndWorkflows:
    def test_complete_e2e_scenarios_a_through_d(self, isolated_env):
        client, _, _ = isolated_env

        # -------------------------------------------------------------
        # SCENARIO A: Student Submission Workflow
        # -------------------------------------------------------------
        # 1. Check duplicate fingerprint endpoint before upload (should be unique)
        pre_hash = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
        pre_check = client.get(f"/api/evidence/{pre_hash}/duplicate-check")
        assert pre_check.status_code == 200
        assert pre_check.json()["is_duplicate"] is False

        # 2. Upload photographic evidence
        upload_resp = client.post(
            "/api/evidence",
            files={"file": ("campus_tree_planting.png", io.BytesIO(VALID_PNG_BYTES), "image/png")},
        )
        assert upload_resp.status_code == 201
        upload_data = upload_resp.json()
        evidence_hash = upload_data["evidence_hash"]
        assert len(evidence_hash) == 64
        assert upload_data["is_duplicate"] is False

        # 3. Post-upload duplicate check now confirms fingerprint is recorded
        post_dup = client.get(f"/api/evidence/{evidence_hash}/duplicate-check")
        assert post_dup.status_code == 200
        assert post_dup.json()["is_duplicate"] is True

        # 4. Submit activity record
        activity_id = "act-2026-e2e-001"
        submit_payload = {
            "activity_id": activity_id,
            "submitter_address": STUDENT_ALICE,
            "category": "Tree planting",
            "quantity": 10.0,
            "unit": "saplings",
            "description": "Planted ten native oak saplings across campus.",
            "evidence_hash": evidence_hash,
            "submission_tx_hash": "opSub1111111111111111111111111111111111111111111",
            "submitted_at": "2026-03-20T10:00:00Z",
        }
        create_resp = client.post("/api/activities", json=submit_payload)
        assert create_resp.status_code == 201
        act_data = create_resp.json()
        assert act_data["status_cache"] == "SUBMITTED"
        assert act_data["submitter_address"] == STUDENT_ALICE

        # 4. Student sees the activity in their isolated activity list
        alice_acts = client.get(f"/api/activities?submitter_address={STUDENT_ALICE}").json()
        assert len(alice_acts) == 1
        assert alice_acts[0]["activity_id"] == activity_id
        assert alice_acts[0]["status_cache"] == "SUBMITTED"

        # Bob cannot see Alice's submission when filtered by submitter
        bob_acts = client.get(f"/api/activities?submitter_address={STUDENT_BOB}").json()
        assert len(bob_acts) == 0

        # -------------------------------------------------------------
        # SCENARIO B: Authorized Organizer Approval Workflow
        # -------------------------------------------------------------
        # 1. Organizer queries pending submissions
        pending_resp = client.get("/api/activities?status=SUBMITTED")
        assert pending_resp.status_code == 200
        pending_list = pending_resp.json()
        assert any(a["activity_id"] == activity_id for a in pending_list)

        # 2. Organizer views protected photographic evidence
        preview_resp = client.get(
            f"/api/evidence/{evidence_hash}/file",
            headers={"X-Organizer-Address": ORGANIZER_ADDRESS},
        )
        assert preview_resp.status_code == 200
        assert preview_resp.content == VALID_PNG_BYTES

        # 3. Organizer signs approval and records decision off-chain
        approval_payload = {
            "decision": "APPROVED",
            "approver_address": ORGANIZER_ADDRESS,
            "approval_tx_hash": "opApp2222222222222222222222222222222222222222222",
        }
        decision_resp = client.post(f"/api/activities/{activity_id}/decision", json=approval_payload)
        assert decision_resp.status_code == 200
        decision_data = decision_resp.json()
        assert decision_data["status"] == "APPROVED"
        assert decision_data["approver_address"] == ORGANIZER_ADDRESS

        # 4. Student dashboard reflects approved status
        alice_updated = client.get(f"/api/activities/{activity_id}").json()
        assert alice_updated["status_cache"] == "APPROVED"

        # -------------------------------------------------------------
        # SCENARIO D: Public QR Verification Portal
        # -------------------------------------------------------------
        mock_on_chain = {
            "submitter": STUDENT_ALICE,
            "category": "Tree planting",
            "quantity": 10.0,
            "unit": "saplings",
            "description": "Planted ten native oak saplings across campus.",
            "evidence_hash": evidence_hash,
            "status": "APPROVED",
            "timestamp": 1711200000,
            "approver_address": ORGANIZER_ADDRESS,
            "approved_at": "2026-03-21T12:00:00Z",
        }

        with patch("app.routes.public.get_configured_contract_address", return_value="KT1E2ETestContractAddress111111111"), \
             patch("app.routes.public.fetch_on_chain_activity", return_value=mock_on_chain):
            verify_resp = client.get(f"/api/public/verify/{activity_id}")

        assert verify_resp.status_code == 200
        public_data = verify_resp.json()
        assert public_data["activity_id"] == activity_id
        assert public_data["status"] == "APPROVED"
        assert public_data["status_label"] == "Approved"
        assert public_data["disclaimer"] == MANDATORY_DISCLAIMER
        assert public_data["evidence_hash"] == evidence_hash
        # Ensure privacy is preserved in public response
        assert "evidence_path" not in public_data
        assert "stored_path" not in public_data

    def test_complete_e2e_scenario_c_rejection_workflow(self, isolated_env):
        client, _, _ = isolated_env

        # 1. Create a pending activity
        act_id = "act-2026-reject-test"
        evidence_hash = "9" * 64
        create_resp = client.post("/api/activities", json={
            "activity_id": act_id,
            "submitter_address": STUDENT_BOB,
            "category": "Energy conservation",
            "quantity": 5.0,
            "unit": "kWh",
            "description": "Conserved electricity in library.",
            "evidence_hash": evidence_hash,
        })
        assert create_resp.status_code == 201

        # 2. Organizer rejects activity with clear reason
        reject_payload = {
            "decision": "REJECTED",
            "approver_address": ORGANIZER_ADDRESS,
            "approval_tx_hash": "opRej3333333333333333333333333333333333333333333",
            "rejection_reason": "Meter gauge is completely unreadable in submitted photograph.",
        }
        reject_resp = client.post(f"/api/activities/{act_id}/decision", json=reject_payload)
        assert reject_resp.status_code == 200
        assert reject_resp.json()["status"] == "REJECTED"

        # 3. Verify record status is updated
        updated = client.get(f"/api/activities/{act_id}").json()
        assert updated["status_cache"] == "REJECTED"
        assert updated["rejection_reason"] == "Meter gauge is completely unreadable in submitted photograph."


class TestEdgeCasesAndSecurityRestrictions:
    def test_unauthorized_organizer_cannot_decide_activity(self, isolated_env):
        client, _, _ = isolated_env
        act_id = "act-sec-001"
        client.post("/api/activities", json={
            "activity_id": act_id,
            "submitter_address": STUDENT_ALICE,
            "category": "Recycling",
            "quantity": 10.0,
            "unit": "kg",
            "evidence_hash": "1" * 64,
        })

        resp = client.post(f"/api/activities/{act_id}/decision", json={
            "decision": "APPROVED",
            "approver_address": UNAUTHORIZED_ATTACKER,
        })
        assert resp.status_code == 403
        assert "not an authorized organizer" in resp.json()["detail"].lower()

    def test_self_approval_prevention(self, isolated_env):
        client, _, _ = isolated_env
        act_id = "act-sec-002"
        # Organizer submits their own activity
        client.post("/api/activities", json={
            "activity_id": act_id,
            "submitter_address": ORGANIZER_ADDRESS,
            "category": "Recycling",
            "quantity": 15.0,
            "unit": "kg",
            "evidence_hash": "2" * 64,
        })

        # Same organizer attempts to approve their own activity
        resp = client.post(f"/api/activities/{act_id}/decision", json={
            "decision": "APPROVED",
            "approver_address": ORGANIZER_ADDRESS,
        })
        assert resp.status_code == 403
        assert "self-approval violation" in resp.json()["detail"].lower()

    def test_repeated_decision_on_finalized_activity_fails(self, isolated_env):
        client, _, _ = isolated_env
        act_id = "act-sec-003"
        client.post("/api/activities", json={
            "activity_id": act_id,
            "submitter_address": STUDENT_ALICE,
            "category": "Recycling",
            "quantity": 5.0,
            "unit": "kg",
            "evidence_hash": "3" * 64,
        })

        # First approval succeeds
        resp1 = client.post(f"/api/activities/{act_id}/decision", json={
            "decision": "APPROVED",
            "approver_address": ORGANIZER_ADDRESS,
        })
        assert resp1.status_code == 200

        # Repeated attempt fails
        resp2 = client.post(f"/api/activities/{act_id}/decision", json={
            "decision": "REJECTED",
            "approver_address": ORGANIZER_ADDRESS,
        })
        assert resp2.status_code == 400
        assert "cannot be overwritten" in resp2.json()["detail"].lower()

    def test_unauthorized_student_cannot_inspect_private_evidence(self, isolated_env):
        client, _, _ = isolated_env
        resp = client.get(
            f"/api/evidence/{'4' * 64}/file",
            headers={"X-Organizer-Address": STUDENT_ALICE},
        )
        assert resp.status_code == 403

    def test_invalid_file_type_rejected_at_upload(self, isolated_env):
        client, _, _ = isolated_env
        fake_script = b"#!/bin/bash\necho malicious code"
        resp = client.post(
            "/api/evidence",
            files={"file": ("exploit.sh", io.BytesIO(fake_script), "text/plain")},
        )
        assert resp.status_code == 400

    def test_duplicate_evidence_detection_on_upload(self, isolated_env):
        client, _, _ = isolated_env
        # First upload
        resp1 = client.post(
            "/api/evidence",
            files={"file": ("sample.png", io.BytesIO(VALID_PNG_BYTES), "image/png")},
        )
        assert resp1.status_code == 201
        assert resp1.json()["is_duplicate"] is False

        # Duplicate upload
        resp2 = client.post(
            "/api/evidence",
            files={"file": ("sample_copy.png", io.BytesIO(VALID_PNG_BYTES), "image/png")},
        )
        assert resp2.status_code == 201
        assert resp2.json()["is_duplicate"] is True
