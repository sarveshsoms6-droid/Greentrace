"""
GreenTrace 2.0 - Phase 8 Tests: Dashboards & Activity History
Tests student dashboard data isolation, organizer metrics, activity history filtering,
pagination, activity details retrieval, missing transaction reference handling,
and unauthorized evidence access prevention.
"""

import io
import pytest
from fastapi.testclient import TestClient

from app.database import (
    init_db,
    get_db_connection,
    create_or_update_activity,
    record_activity_decision,
)
from main import app

ORGANIZER_ADDRESS = "tz1aSkwEkv3Ax2bWZHvCaOKUMcqModq5RMqJ"
STUDENT_A_ADDRESS = "tz1VSUr8wwNhLAzempoch5d6hLRiTh8Cjcjb"
STUDENT_B_ADDRESS = "tz1burnburnburnburnburnburnbur155rw"


@pytest.fixture()
def isolated_db(tmp_path, monkeypatch):
    """Provides an isolated SQLite database in a temporary directory."""
    db_file = str(tmp_path / "test_greentrace_dashboards.db")
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
# 1. Student Dashboard Data & Data Isolation
# =====================================================================

class TestStudentDashboard:
    def test_student_data_isolation(self, client):
        """
        Ensures that filtering by submitter_address returns strictly that student's records,
        preventing Student B from seeing Student A's dashboard submissions.
        """
        # Create activities for Student A
        client.post("/api/activities", json={
            "activity_id": "act-student-a-1",
            "submitter_address": STUDENT_A_ADDRESS,
            "category": "Recycling",
            "quantity": 10.0,
            "unit": "kg",
            "evidence_hash": "a" * 64,
            "submission_tx_hash": "op_sub_a1",
        })
        client.post("/api/activities", json={
            "activity_id": "act-student-a-2",
            "submitter_address": STUDENT_A_ADDRESS,
            "category": "Tree planting",
            "quantity": 3.0,
            "unit": "saplings",
            "evidence_hash": "b" * 64,
            "submission_tx_hash": "op_sub_a2",
        })

        # Create activity for Student B
        client.post("/api/activities", json={
            "activity_id": "act-student-b-1",
            "submitter_address": STUDENT_B_ADDRESS,
            "category": "Water conservation",
            "quantity": 50.0,
            "unit": "litres",
            "evidence_hash": "c" * 64,
            "submission_tx_hash": "op_sub_b1",
        })

        # Query Student A's activities
        res_a = client.get(f"/api/activities?submitter_address={STUDENT_A_ADDRESS}")
        assert res_a.status_code == 200
        data_a = res_a.json()
        assert len(data_a) == 2
        for item in data_a:
            assert item["submitter_address"] == STUDENT_A_ADDRESS
            assert item["activity_id"] != "act-student-b-1"

        # Query Student B's activities
        res_b = client.get(f"/api/activities?submitter_address={STUDENT_B_ADDRESS}")
        assert res_b.status_code == 200
        data_b = res_b.json()
        assert len(data_b) == 1
        assert data_b[0]["activity_id"] == "act-student-b-1"

    def test_student_dashboard_kpi_statistics(self, client):
        """
        Verifies student-scoped KPI statistics (/api/activities/stats/summary).
        """
        # Create 1 pending and 1 approved for Student A
        client.post("/api/activities", json={
            "activity_id": "act-stats-a1",
            "submitter_address": STUDENT_A_ADDRESS,
            "category": "Tree planting",
            "quantity": 5.0,
            "unit": "saplings",
            "evidence_hash": "d" * 64,
            "submission_tx_hash": "op_stats_sub_1",
        })
        client.post("/api/activities", json={
            "activity_id": "act-stats-a2",
            "submitter_address": STUDENT_A_ADDRESS,
            "category": "Recycling",
            "quantity": 15.0,
            "unit": "kg",
            "evidence_hash": "e" * 64,
            "submission_tx_hash": "op_stats_sub_2",
        })

        # Approve act-stats-a1
        client.post("/api/activities/act-stats-a1/decision", json={
            "decision": "APPROVED",
            "approver_address": ORGANIZER_ADDRESS,
            "approval_tx_hash": "op_app_stats_1",
        })

        # Fetch stats scoped to Student A
        res = client.get(f"/api/activities/stats/summary?submitter_address={STUDENT_A_ADDRESS}")
        assert res.status_code == 200
        stats = res.json()
        assert stats["total"] == 2
        assert stats["approved"] == 1
        assert stats["pending"] == 1
        assert stats["rejected"] == 0

        # Verified impact calculation
        impacts = stats["impacts"]
        tree_impact = next((i for i in impacts if i["category"] == "Tree planting"), None)
        assert tree_impact is not None
        assert tree_impact["total_qty"] == 5.0


# =====================================================================
# 2. Organizer Dashboard & Authorization
# =====================================================================

class TestOrganizerDashboard:
    def test_campus_wide_kpi_summary(self, client):
        # Create submissions across different students
        client.post("/api/activities", json={
            "activity_id": "act-org-kpi-1",
            "submitter_address": STUDENT_A_ADDRESS,
            "category": "Energy conservation",
            "quantity": 100.0,
            "unit": "kWh",
            "evidence_hash": "f" * 64,
        })
        client.post("/api/activities", json={
            "activity_id": "act-org-kpi-2",
            "submitter_address": STUDENT_B_ADDRESS,
            "category": "Water conservation",
            "quantity": 200.0,
            "unit": "litres",
            "evidence_hash": "1" * 64,
        })

        # Global stats (without submitter filter)
        res = client.get("/api/activities/stats/summary")
        assert res.status_code == 200
        stats = res.json()
        assert stats["total"] >= 2
        assert stats["pending"] >= 2

    def test_organizer_only_decision_enforcement(self, client):
        # Activity submitted
        client.post("/api/activities", json={
            "activity_id": "act-auth-check",
            "submitter_address": STUDENT_A_ADDRESS,
            "category": "Waste collection",
            "quantity": 8.0,
            "unit": "kg",
            "evidence_hash": "2" * 64,
        })

        # Unauthorized wallet attempts approval -> must return 403 Forbidden
        unauth_res = client.post("/api/activities/act-auth-check/decision", json={
            "decision": "APPROVED",
            "approver_address": STUDENT_B_ADDRESS,
            "approval_tx_hash": "op_unauth_fake",
        })
        assert unauth_res.status_code == 403

        # Authorized organizer approves -> 200 OK
        auth_res = client.post("/api/activities/act-auth-check/decision", json={
            "decision": "APPROVED",
            "approver_address": ORGANIZER_ADDRESS,
            "approval_tx_hash": "op_valid_approval_tx",
        })
        assert auth_res.status_code == 200
        assert auth_res.json()["status"] == "APPROVED"


# =====================================================================
# 3. Activity History: Filtering & Pagination
# =====================================================================

class TestActivityHistoryAndPagination:
    def test_history_status_and_category_filtering(self, client):
        # Insert 3 activities with different categories and statuses
        client.post("/api/activities", json={
            "activity_id": "act-hist-filter-1",
            "submitter_address": STUDENT_A_ADDRESS,
            "category": "Recycling",
            "quantity": 20.0,
            "unit": "kg",
            "evidence_hash": "3" * 64,
        })
        client.post("/api/activities", json={
            "activity_id": "act-hist-filter-2",
            "submitter_address": STUDENT_A_ADDRESS,
            "category": "Tree planting",
            "quantity": 2.0,
            "unit": "saplings",
            "evidence_hash": "4" * 64,
        })
        # Approve the tree planting activity
        client.post("/api/activities/act-hist-filter-2/decision", json={
            "decision": "APPROVED",
            "approver_address": ORGANIZER_ADDRESS,
            "approval_tx_hash": "op_app_filter_2",
        })

        # Filter by status=APPROVED
        res_approved = client.get("/api/activities?status=APPROVED")
        assert res_approved.status_code == 200
        for act in res_approved.json():
            assert act["status_cache"] == "APPROVED"

        # Filter by status=SUBMITTED
        res_submitted = client.get("/api/activities?status=SUBMITTED")
        assert res_submitted.status_code == 200
        for act in res_submitted.json():
            assert act["status_cache"] == "SUBMITTED"

        # Filter by category=Tree planting
        res_category = client.get("/api/activities?category=Tree%20planting")
        assert res_category.status_code == 200
        for act in res_category.json():
            assert act["category"] == "Tree planting"

    def test_history_pagination(self, client):
        # Insert 15 items
        for i in range(15):
            client.post("/api/activities", json={
                "activity_id": f"act-page-item-{i:02d}",
                "submitter_address": STUDENT_A_ADDRESS,
                "category": "Recycling",
                "quantity": float(i + 1),
                "unit": "kg",
                "evidence_hash": f"{i:02d}" + "0" * 62,
            })

        # Page 1: limit 10, offset 0
        p1 = client.get("/api/activities?limit=10&offset=0")
        assert p1.status_code == 200
        assert len(p1.json()) == 10

        # Page 2: limit 10, offset 10
        p2 = client.get("/api/activities?limit=10&offset=10")
        assert p2.status_code == 200
        assert len(p2.json()) == 5


# =====================================================================
# 4. Activity Details & Missing Transaction References
# =====================================================================

class TestActivityDetailsAndMissingTx:
    def test_activity_details_complete_fields(self, client):
        client.post("/api/activities", json={
            "activity_id": "act-detail-full-1",
            "submitter_address": STUDENT_A_ADDRESS,
            "category": "Water conservation",
            "quantity": 150.0,
            "unit": "litres",
            "description": "Fixed leaking dorm tap and logged liters saved.",
            "evidence_hash": "5" * 64,
            "submission_tx_hash": "op_submit_detail_tx",
            "submitted_at": "2026-10-30T10:00:00Z",
        })

        res = client.get("/api/activities/act-detail-full-1")
        assert res.status_code == 200
        act = res.json()
        assert act["activity_id"] == "act-detail-full-1"
        assert act["submitter_address"] == STUDENT_A_ADDRESS
        assert act["category"] == "Water conservation"
        assert act["quantity"] == 150.0
        assert act["unit"] == "litres"
        assert act["description"] == "Fixed leaking dorm tap and logged liters saved."
        assert act["evidence_hash"] == "5" * 64
        assert act["submission_tx_hash"] == "op_submit_detail_tx"
        assert act["blockchain_confirmed"] == 1

    def test_missing_transaction_reference_handled_gracefully(self, client):
        # Create activity without submission_tx_hash
        client.post("/api/activities", json={
            "activity_id": "act-missing-tx",
            "submitter_address": STUDENT_A_ADDRESS,
            "category": "Recycling",
            "quantity": 10.0,
            "unit": "kg",
            "evidence_hash": "6" * 64,
            # no submission_tx_hash
        })

        res = client.get("/api/activities/act-missing-tx")
        assert res.status_code == 200
        act = res.json()
        assert act["submission_tx_hash"] is None
        assert act["blockchain_confirmed"] == 0

    def test_nonexistent_activity_returns_404(self, client):
        res = client.get("/api/activities/non-existent-activity-id-999")
        assert res.status_code == 404
        assert "not found" in res.json()["detail"].lower()


# =====================================================================
# 5. Private Evidence Access Security
# =====================================================================

class TestEvidenceAccessSecurity:
    def test_unauthorized_student_cannot_access_private_evidence_file(self, client):
        # Upload valid image
        dummy_png = b"\x89PNG\r\n\x1a\n" + b"\x00" * 150
        upload_res = client.post(
            "/api/evidence",
            files={"file": ("dorm_recycling.png", io.BytesIO(dummy_png), "image/png")},
        )
        assert upload_res.status_code == 201
        ev_hash = upload_res.json()["evidence_hash"]

        # Student B attempts to download the file -> 403 Forbidden
        student_res = client.get(f"/api/evidence/{ev_hash}/file?organizer_address={STUDENT_B_ADDRESS}")
        assert student_res.status_code == 403

        # Public access without any address -> 403 Forbidden
        public_res = client.get(f"/api/evidence/{ev_hash}/file")
        assert public_res.status_code == 403

        # Authorized organizer -> 200 OK
        org_res = client.get(f"/api/evidence/{ev_hash}/file?organizer_address={ORGANIZER_ADDRESS}")
        assert org_res.status_code == 200
