"""
GreenTrace 2.0 - Phase 6 Backend Tests
Tests activities retrieval, organizer decision recording, self-approval prevention,
authorized evidence file preview, and organizer verification.
"""

import io
import pytest
from fastapi.testclient import TestClient

ORGANIZER_ADDRESS = "tz1aSkwEkv3Ax2bWZHvCaOKUMcqModq5RMqJ"
STUDENT_ADDRESS = "tz1VSUr8wwNhLAzempoch5d6hLRiTh8Cjcjb"
UNAUTHORIZED_ADDRESS = "tz1burnburnburnburnburnburnbur155rw"


@pytest.fixture()
def isolated_db(tmp_path, monkeypatch):
    """Isolates the SQLite database to a temporary file."""
    db_file = str(tmp_path / "test_greentrace_activities.db")
    monkeypatch.setenv("DATABASE_PATH", db_file)

    import app.database as db_module
    monkeypatch.setattr(db_module, "DATABASE_PATH", db_file)
    db_module.init_db()
    return db_file


@pytest.fixture()
def isolated_upload_dir(tmp_path, monkeypatch):
    """Isolates the upload directory."""
    upload_dir = str(tmp_path / "protected_evidence")
    from pathlib import Path
    Path(upload_dir).mkdir(parents=True, exist_ok=True)
    monkeypatch.setenv("UPLOAD_DIRECTORY", upload_dir)

    import app.routes.evidence as ev_module
    monkeypatch.setattr(ev_module, "UPLOAD_DIR", upload_dir)
    return upload_dir


@pytest.fixture()
def client(isolated_db, isolated_upload_dir):
    from main import app
    return TestClient(app, raise_server_exceptions=True)


def minimal_png() -> bytes:
    return b"\x89PNG\r\n\x1a\n" + b"\x00" * 50


class TestActivitiesEndpoints:
    def test_list_activities_empty(self, client):
        response = client.get("/api/activities")
        assert response.status_code == 200
        assert response.json() == []

    def test_create_and_retrieve_activity(self, client):
        payload = {
            "activity_id": "act-test-101",
            "submitter_address": STUDENT_ADDRESS,
            "category": "Recycling",
            "quantity": 12.5,
            "unit": "kg",
            "description": "Recycled cardboard at campus library sorting station.",
            "evidence_hash": "a" * 64,
            "submission_tx_hash": "op_submit_111",
        }
        res = client.post("/api/activities", json=payload)
        assert res.status_code == 201
        data = res.json()
        assert data["activity_id"] == "act-test-101"
        assert data["status_cache"] == "SUBMITTED"

        # Retrieve single activity
        get_res = client.get("/api/activities/act-test-101")
        assert get_res.status_code == 200
        assert get_res.json()["quantity"] == 12.5

    def test_filter_activities_by_status(self, client):
        # Create 2 activities
        client.post("/api/activities", json={
            "activity_id": "act-sub-1",
            "submitter_address": STUDENT_ADDRESS,
            "category": "Tree planting",
            "quantity": 3,
            "unit": "saplings",
            "evidence_hash": "b" * 64,
        })
        client.post("/api/activities", json={
            "activity_id": "act-sub-2",
            "submitter_address": STUDENT_ADDRESS,
            "category": "Water conservation",
            "quantity": 50,
            "unit": "litres",
            "evidence_hash": "c" * 64,
        })

        # Filter SUBMITTED
        res = client.get("/api/activities?status=SUBMITTED")
        assert res.status_code == 200
        items = res.json()
        assert len(items) == 2
        assert all(item["status_cache"] == "SUBMITTED" for item in items)


class TestOrganizerDecisionEndpoints:
    @pytest.fixture(autouse=True)
    def setup_pending_activity(self, client):
        client.post("/api/activities", json={
            "activity_id": "act-pending-decision",
            "submitter_address": STUDENT_ADDRESS,
            "category": "Recycling",
            "quantity": 10.0,
            "unit": "kg",
            "description": "Campus recycling",
            "evidence_hash": "d" * 64,
        })

    def test_authorized_organizer_approval(self, client):
        payload = {
            "decision": "APPROVED",
            "approver_address": ORGANIZER_ADDRESS,
            "approval_tx_hash": "op_confirmed_approval_tx_123",
        }
        res = client.post("/api/activities/act-pending-decision/decision", json=payload)
        assert res.status_code == 200
        body = res.json()
        assert body["status"] == "APPROVED"
        assert body["approval_tx_hash"] == "op_confirmed_approval_tx_123"

        # Check that activity in database reflects APPROVED
        act = client.get("/api/activities/act-pending-decision").json()
        assert act["status_cache"] == "APPROVED"
        assert act["approval_tx_hash"] == "op_confirmed_approval_tx_123"

    def test_authorized_organizer_rejection_with_reason(self, client):
        payload = {
            "decision": "REJECTED",
            "approver_address": ORGANIZER_ADDRESS,
            "approval_tx_hash": "op_confirmed_rejection_tx_456",
            "rejection_reason": "Photograph is blurry and lacks location timestamp.",
        }
        res = client.post("/api/activities/act-pending-decision/decision", json=payload)
        assert res.status_code == 200
        body = res.json()
        assert body["status"] == "REJECTED"
        assert body["rejection_reason"] == "Photograph is blurry and lacks location timestamp."

        # Check DB reflects rejection
        act = client.get("/api/activities/act-pending-decision").json()
        assert act["status_cache"] == "REJECTED"
        assert act["rejection_reason"] == "Photograph is blurry and lacks location timestamp."

    def test_unauthorized_organizer_attempt_fails(self, client):
        payload = {
            "decision": "APPROVED",
            "approver_address": UNAUTHORIZED_ADDRESS,
            "approval_tx_hash": "op_fake",
        }
        res = client.post("/api/activities/act-pending-decision/decision", json=payload)
        assert res.status_code == 403
        assert "not an authorized organizer" in res.json()["detail"]

    def test_self_approval_prevention(self, client):
        # Create activity submitted by the organizer
        client.post("/api/activities", json={
            "activity_id": "act-org-self",
            "submitter_address": ORGANIZER_ADDRESS,
            "category": "Tree planting",
            "quantity": 2,
            "unit": "saplings",
            "evidence_hash": "e" * 64,
        })

        # The organizer attempts to approve their own activity
        payload = {
            "decision": "APPROVED",
            "approver_address": ORGANIZER_ADDRESS,
            "approval_tx_hash": "op_self_attempt",
        }
        res = client.post("/api/activities/act-org-self/decision", json=payload)
        assert res.status_code == 403
        assert "Self-approval violation" in res.json()["detail"]

    def test_repeated_decision_on_finalized_activity_fails(self, client):
        # First decision: APPROVED
        client.post("/api/activities/act-pending-decision/decision", json={
            "decision": "APPROVED",
            "approver_address": ORGANIZER_ADDRESS,
            "approval_tx_hash": "op_first",
        })

        # Second attempt to change or overwrite decision
        res2 = client.post("/api/activities/act-pending-decision/decision", json={
            "decision": "REJECTED",
            "approver_address": ORGANIZER_ADDRESS,
            "approval_tx_hash": "op_second",
        })
        assert res2.status_code == 400
        assert "Invalid transition" in res2.json()["detail"]


class TestProtectedEvidencePreview:
    def test_protected_preview_with_authorized_organizer(self, client):
        # Upload evidence first
        img_bytes = minimal_png()
        up_res = client.post(
            "/api/evidence",
            files={"file": ("proof.png", io.BytesIO(img_bytes), "image/png")},
        )
        assert up_res.status_code == 201
        h = up_res.json()["evidence_hash"]

        # Request evidence preview as authorized organizer via header
        preview_res = client.get(
            f"/api/evidence/{h}/file",
            headers={"X-Organizer-Address": ORGANIZER_ADDRESS},
        )
        assert preview_res.status_code == 200
        assert preview_res.content == img_bytes

        # Request evidence preview via query param
        preview_query_res = client.get(
            f"/api/evidence/{h}/file?organizer_address={ORGANIZER_ADDRESS}"
        )
        assert preview_query_res.status_code == 200
        assert preview_query_res.content == img_bytes

    def test_protected_preview_denied_for_unauthorized_address(self, client):
        img_bytes = minimal_png()
        up_res = client.post(
            "/api/evidence",
            files={"file": ("proof2.png", io.BytesIO(img_bytes), "image/png")},
        )
        h = up_res.json()["evidence_hash"]

        # Request evidence preview with unauthorized address
        preview_res = client.get(
            f"/api/evidence/{h}/file",
            headers={"X-Organizer-Address": UNAUTHORIZED_ADDRESS},
        )
        assert preview_res.status_code == 403
        assert "Access denied" in preview_res.json()["detail"]

    def test_verify_organizer_endpoint(self, client):
        res_org = client.get(f"/api/activities/organizers/verify/{ORGANIZER_ADDRESS}")
        assert res_org.status_code == 200
        assert res_org.json()["is_organizer"] is True

        res_unauth = client.get(f"/api/activities/organizers/verify/{UNAUTHORIZED_ADDRESS}")
        assert res_unauth.status_code == 200
        assert res_unauth.json()["is_organizer"] is False
