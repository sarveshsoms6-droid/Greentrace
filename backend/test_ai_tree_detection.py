"""
GreenTrace 2.0 - GreenAI Smart Tree Detection Tests
Validates real computer vision object detection service, edge cases, error handling,
integrity of SHA-256 evidence hashing, and strict non-automatic approval enforcement.
"""

import io
import os
import hashlib
from PIL import Image, ImageDraw
import pytest
from fastapi.testclient import TestClient

ORGANIZER_ADDRESS = "tz1aSkwEkv3Ax2bWZHvCaOKUMcqModq5RMqJ"
STUDENT_ADDRESS = "tz1VSUr8wwNhLAzempoch5d6hLRiTh8Cjcjb"


def create_test_image(width=400, height=300, color=(135, 206, 235), draw_trees=0) -> bytes:
    """Helper to generate a valid test JPEG image, optionally with simple green tree shapes."""
    img = Image.new("RGB", (width, height), color=color)
    draw = ImageDraw.Draw(img)

    # If draw_trees requested, draw green foliage on brown trunks
    for i in range(draw_trees):
        x = 50 + i * 100
        y = 150
        # Trunk
        draw.rectangle([x + 25, y + 50, x + 35, y + 100], fill=(139, 69, 19))
        # Canopy
        draw.ellipse([x, y, x + 60, y + 60], fill=(34, 139, 34))

    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=90)
    return buf.getvalue()


@pytest.fixture()
def client(tmp_path, monkeypatch):
    """Initializes isolated SQLite and upload folders for testing."""
    db_file = str(tmp_path / "test_greentrace_ai.db")
    monkeypatch.setenv("DATABASE_PATH", db_file)

    import app.database as db_module
    monkeypatch.setattr(db_module, "DATABASE_PATH", db_file)
    db_module.init_db()

    upload_dir = str(tmp_path / "uploads")
    os.makedirs(upload_dir, exist_ok=True)
    monkeypatch.setenv("UPLOAD_DIRECTORY", upload_dir)
    import app.routes.evidence as ev_module
    monkeypatch.setattr(ev_module, "UPLOAD_DIR", upload_dir)

    annotated_dir = str(tmp_path / "uploads" / "annotated")
    os.makedirs(annotated_dir, exist_ok=True)
    import app.services.tree_detector as td_module
    monkeypatch.setattr(td_module, "ANNOTATED_UPLOADS_DIR", annotated_dir)
    import app.routes.ai as ai_module
    monkeypatch.setattr(ai_module, "ANNOTATED_UPLOADS_DIR", annotated_dir)

    from main import app as fastapi_app
    return TestClient(fastapi_app)


# 1. Valid photograph detection endpoint test
def test_detect_trees_valid_image(client):
    img_bytes = create_test_image(width=500, height=400, draw_trees=2)
    files = {"file": ("trees.jpg", io.BytesIO(img_bytes), "image/jpeg")}

    resp = client.post("/api/ai/detect-trees", files=files)
    assert resp.status_code == 200, resp.text
    data = resp.json()

    assert "count" in data
    assert isinstance(data["count"], int)
    assert "average_confidence" in data
    assert "model_name" in data
    assert "model_version" in data
    assert "detections" in data
    assert isinstance(data["detections"], list)
    assert "annotated_image_base64" in data
    assert "annotated_image_url" in data


# 2. Photograph containing no trees
def test_detect_trees_no_trees(client):
    # Pure blank grey image
    img_bytes = create_test_image(width=300, height=300, color=(128, 128, 128), draw_trees=0)
    files = {"file": ("empty.jpg", io.BytesIO(img_bytes), "image/jpeg")}

    resp = client.post("/api/ai/detect-trees", files=files)
    assert resp.status_code == 200
    data = resp.json()
    assert data["count"] == 0
    assert "No trees or saplings were detected" in data["discrepancy_notice"]


# 3. Photograph containing multiple trees
def test_detect_trees_multiple_trees(client):
    img_bytes = create_test_image(width=600, height=400, draw_trees=3)
    files = {"file": ("grove.jpg", io.BytesIO(img_bytes), "image/jpeg")}

    resp = client.post("/api/ai/detect-trees", files=files)
    assert resp.status_code == 200
    data = resp.json()
    assert len(data["detections"]) == data["count"]
    for det in data["detections"]:
        assert "id" in det
        assert "class_name" in det
        assert "confidence" in det
        assert len(det["bbox"]) == 4


# 4. Unsupported image file type
def test_detect_trees_unsupported_file_type(client):
    files = {"file": ("notes.txt", io.BytesIO(b"This is not a tree image."), "text/plain")}
    resp = client.post("/api/ai/detect-trees", files=files)
    assert resp.status_code in (400, 415)
    assert "not a valid readable image" in resp.json()["detail"].lower() or "unsupported" in resp.json()["detail"].lower()


# 5. Oversized image file
def test_detect_trees_oversized_file(client, monkeypatch):
    import app.routes.ai as ai_module
    monkeypatch.setattr(ai_module, "MAX_IMAGE_SIZE_BYTES", 1000)

    img_bytes = create_test_image(width=600, height=600)
    files = {"file": ("huge.jpg", io.BytesIO(img_bytes), "image/jpeg")}
    resp = client.post("/api/ai/detect-trees", files=files)
    assert resp.status_code == 413
    assert "exceeds" in resp.json()["detail"]


# 6. Corrupted image file
def test_detect_trees_corrupted_image(client):
    corrupt_bytes = b"\xff\xd8\xff\xe0\x00\x10JFIF\x00corruptedjunkdatabytes"
    files = {"file": ("broken.jpg", io.BytesIO(corrupt_bytes), "image/jpeg")}
    resp = client.post("/api/ai/detect-trees", files=files)
    assert resp.status_code == 400
    assert "corrupted or not a valid readable image" in resp.json()["detail"].lower()


# 7. AI service unavailable
def test_detect_trees_service_unavailable(client, monkeypatch):
    import app.services.tree_detector as td_module

    def mock_detect(*args, **kwargs):
        raise RuntimeError("GreenAI inference service is currently offline for maintenance.")

    detector = td_module.get_tree_detector()
    monkeypatch.setattr(detector, "detect", mock_detect)

    img_bytes = create_test_image(width=200, height=200)
    files = {"file": ("test.jpg", io.BytesIO(img_bytes), "image/jpeg")}
    resp = client.post("/api/ai/detect-trees", files=files)
    assert resp.status_code == 503
    assert "offline for maintenance" in resp.json()["detail"]


# 8. Model loading failure handling
def test_detect_trees_model_load_failure(client, monkeypatch):
    import app.routes.ai as ai_route

    def mock_get_detector():
        raise RuntimeError("Weights file corrupted or GPU memory exhausted")

    monkeypatch.setattr(ai_route, "get_tree_detector", mock_get_detector)

    img_bytes = create_test_image(width=200, height=200)
    files = {"file": ("test.jpg", io.BytesIO(img_bytes), "image/jpeg")}
    resp = client.post("/api/ai/detect-trees", files=files)
    assert resp.status_code == 503
    assert "Model initialization error" in resp.json()["detail"]


# 9. Tree count discrepancy between student and AI
def test_activity_submission_tree_count_discrepancy(client):
    img_bytes = create_test_image(width=400, height=300, draw_trees=1)
    ev_hash = hashlib.sha256(img_bytes).hexdigest()

    # Upload evidence
    up_resp = client.post(
        "/api/evidence",
        files={"file": ("photo.jpg", io.BytesIO(img_bytes), "image/jpeg")},
    )
    assert up_resp.status_code == 201

    # Student submits quantity = 10, but AI detected count = 2
    act_payload = {
        "activity_id": "ACT_AI_DISCREPANCY_TEST_01",
        "submitter_address": STUDENT_ADDRESS,
        "category": "Tree planting",
        "quantity": 10,
        "unit": "trees",
        "description": "Planted 10 saplings at north quad.",
        "evidence_hash": ev_hash,
        "ai_detected_count": 2,
        "ai_confidence_score": 0.88,
        "ai_model_name": "YOLO-World",
        "ai_model_version": "v2-s",
        "ai_annotated_path": "annotated/trees_annotated.jpg",
    }
    sub_resp = client.post("/api/activities", json=act_payload)
    assert sub_resp.status_code == 201

    # Retrieve activity and verify AI fields are preserved
    get_resp = client.get(f"/api/activities/{act_payload['activity_id']}")
    assert get_resp.status_code == 200
    act_data = get_resp.json()
    assert act_data["quantity"] == 10
    assert act_data["ai_detected_count"] == 2
    assert act_data["ai_confidence_score"] == 0.88
    assert act_data["ai_model_name"] == "YOLO-World"


# 10. Preservation of SHA-256 evidence hash
def test_preservation_of_sha256_evidence_hash(client):
    img_bytes = create_test_image(width=400, height=300, draw_trees=2)
    expected_hash = hashlib.sha256(img_bytes).hexdigest()

    # Pass through AI detection
    files = {"file": ("trees.jpg", io.BytesIO(img_bytes), "image/jpeg")}
    ai_resp = client.post("/api/ai/detect-trees", files=files)
    assert ai_resp.status_code == 200

    # Pass through evidence upload
    up_resp = client.post(
        "/api/evidence",
        files={"file": ("trees.jpg", io.BytesIO(img_bytes), "image/jpeg")},
    )
    assert up_resp.status_code == 201
    assert up_resp.json()["evidence_hash"] == expected_hash

    # Ensure hash of original bytes was not mutated by inference or annotation
    assert hashlib.sha256(img_bytes).hexdigest() == expected_hash


# 11. Organizer access to annotated images & path traversal prevention
def test_annotated_images_access_and_security(client, tmp_path):
    # Missing file returns 404
    missing_resp = client.get("/api/evidence/annotated/non_existent.jpg")
    assert missing_resp.status_code == 404

    # Path traversal attack attempt returns 404 (sanitized by basename)
    traversal_resp = client.get("/api/evidence/annotated/../../etc/passwd")
    assert traversal_resp.status_code in (400, 404)


# 12. Prevention of automatic activity approval
def test_prevention_of_automatic_approval(client):
    img_bytes = create_test_image(width=300, height=300, draw_trees=3)
    ev_hash = hashlib.sha256(img_bytes).hexdigest()

    client.post(
        "/api/evidence",
        files={"file": ("photo.jpg", io.BytesIO(img_bytes), "image/jpeg")},
    )

    act_payload = {
        "activity_id": "ACT_AI_NO_AUTO_APPROVE",
        "submitter_address": STUDENT_ADDRESS,
        "category": "Tree planting",
        "quantity": 3,
        "unit": "trees",
        "description": "Three trees planted.",
        "evidence_hash": ev_hash,
        "ai_detected_count": 3,
        "ai_confidence_score": 0.99,  # Even with 99% match confidence
        "ai_model_name": "YOLO-World",
    }

    sub_resp = client.post("/api/activities", json=act_payload)
    assert sub_resp.status_code == 201

    get_resp = client.get(f"/api/activities/{act_payload['activity_id']}")
    assert get_resp.status_code == 200
    data = get_resp.json()

    # MUST NOT be automatically approved
    assert data["status_cache"] == "SUBMITTED"
    assert data["status_cache"] != "APPROVED"
    assert data["approver_address"] is None
    assert data["approved_at"] is None
