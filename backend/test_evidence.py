"""
GreenTrace 2.0 - Phase 5 Backend Tests
Tests evidence upload, SHA-256 hashing, duplicate detection, and access restrictions.

All tests use isolated temporary databases via monkeypatching so the real greentrace.db
is never written to during test runs.
"""

import hashlib
import io
import os
import sqlite3
import tempfile
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

# ──────────────────────────────────────────────────
# Fixtures
# ──────────────────────────────────────────────────

@pytest.fixture()
def isolated_db(tmp_path, monkeypatch):
    """
    Patches DATABASE_PATH in app.database to a temp file so every test
    gets a fresh, empty database that is deleted after the test.
    """
    db_file = str(tmp_path / "test_greentrace.db")
    monkeypatch.setenv("DATABASE_PATH", db_file)

    import app.database as db_module
    monkeypatch.setattr(db_module, "DATABASE_PATH", db_file)

    # Re-initialise so the temp DB has the schema
    db_module.init_db()
    return db_file


@pytest.fixture()
def isolated_upload_dir(tmp_path, monkeypatch):
    """Redirects UPLOAD_DIRECTORY to a temp folder so evidence files are isolated."""
    upload_dir = str(tmp_path / "protected_evidence")
    Path(upload_dir).mkdir(parents=True, exist_ok=True)
    monkeypatch.setenv("UPLOAD_DIRECTORY", upload_dir)

    import app.routes.evidence as ev_module
    monkeypatch.setattr(ev_module, "UPLOAD_DIR", upload_dir)
    return upload_dir


@pytest.fixture()
def client(isolated_db, isolated_upload_dir):
    """FastAPI TestClient with isolated DB and upload directory."""
    from main import app
    return TestClient(app, raise_server_exceptions=True)


# ──────────────────────────────────────────────────
# Helpers: minimal valid image magic bytes
# ──────────────────────────────────────────────────

def minimal_jpeg() -> bytes:
    """Smallest bytes that pass JPEG magic-byte check (FF D8 FF E0 + short body)."""
    return (
        b"\xff\xd8\xff\xe0"  # JPEG SOI + APP0 marker
        b"\x00\x10JFIF\x00"  # JFIF identifier
        b"\x01\x01\x00\x00\x01\x00\x01\x00\x00"  # minimal JFIF header
        b"\xff\xd9"  # EOI
    )


def minimal_png() -> bytes:
    """Smallest bytes that pass PNG magic-byte check."""
    return b"\x89PNG\r\n\x1a\n" + b"\x00" * 50


def minimal_webp(size: int = 100) -> bytes:
    """Minimal WebP magic bytes (RIFF....WEBP)."""
    payload = b"\x00" * max(size - 12, 0)
    return b"RIFF" + len(payload + b"WEBP").to_bytes(4, "little") + b"WEBP" + payload


def sha256_of(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest().lower()


# ──────────────────────────────────────────────────
# Unit tests: hashing.py
# ──────────────────────────────────────────────────

class TestHashingService:
    def test_empty_string_nist_vector(self):
        """SHA-256 of empty bytes must match NIST standard vector."""
        from app.services.hashing import calculate_sha256
        result = calculate_sha256(b"")
        assert result == "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"

    def test_known_bytes_vector(self):
        """SHA-256 of b'hello world' must match known vector."""
        from app.services.hashing import calculate_sha256
        result = calculate_sha256(b"hello world")
        assert result == "b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9"

    def test_returns_lowercase_hex(self):
        from app.services.hashing import calculate_sha256
        result = calculate_sha256(b"GreenTrace")
        assert result == result.lower()
        assert len(result) == 64
        assert all(c in "0123456789abcdef" for c in result)

    def test_is_valid_sha256_accepts_valid(self):
        from app.services.hashing import is_valid_sha256
        assert is_valid_sha256("a" * 64) is True
        assert is_valid_sha256("0" * 64) is True
        assert is_valid_sha256("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855") is True

    def test_is_valid_sha256_rejects_invalid(self):
        from app.services.hashing import is_valid_sha256
        assert is_valid_sha256("") is False
        assert is_valid_sha256("g" * 64) is False     # invalid hex char
        assert is_valid_sha256("a" * 63) is False     # too short
        assert is_valid_sha256("a" * 65) is False     # too long
        # Uppercase is accepted (is_valid_sha256 lowercases before regex) — correct behavior
        assert is_valid_sha256("A" * 64) is True
        assert is_valid_sha256(123) is False           # non-string

    def test_verify_hash_correct(self):
        from app.services.hashing import verify_hash
        data = b"test evidence data"
        h = sha256_of(data)
        assert verify_hash(data, h) is True

    def test_verify_hash_wrong(self):
        from app.services.hashing import verify_hash
        assert verify_hash(b"data", "a" * 64) is False


# ──────────────────────────────────────────────────
# Unit tests: database.py
# ──────────────────────────────────────────────────

class TestDatabase:
    def test_init_creates_tables(self, isolated_db):
        import app.database as db_module
        conn = sqlite3.connect(isolated_db)
        tables = {r[0] for r in conn.execute("SELECT name FROM sqlite_master WHERE type='table';")}
        conn.close()
        assert "evidence" in tables
        assert "activities" in tables

    def test_check_duplicate_hash_not_found(self, isolated_db):
        from app.database import check_duplicate_hash
        is_dup, existing_id = check_duplicate_hash("a" * 64)
        assert is_dup is False
        assert existing_id is None

    def test_save_evidence_and_detect_duplicate(self, isolated_db):
        from app.database import save_evidence, check_duplicate_hash
        h = sha256_of(b"unique image bytes")
        save_evidence(h, "photo.jpg", "/protected/photo.jpg", 1024, "image/jpeg")

        is_dup, existing_id = check_duplicate_hash(h)
        assert is_dup is True
        assert existing_id is None  # only in evidence table, no linked activity

    def test_save_evidence_concurrent_safe(self, isolated_db):
        """Second save of same hash must not raise — returns existing record."""
        from app.database import save_evidence
        h = sha256_of(b"concurrent bytes")
        r1 = save_evidence(h, "f1.jpg", "/p/f1.jpg", 500, "image/jpeg")
        r2 = save_evidence(h, "f1.jpg", "/p/f1.jpg", 500, "image/jpeg")
        assert r1["evidence_hash"] == r2["evidence_hash"]
        assert r2["is_duplicate"] is True

    def test_get_evidence_by_hash(self, isolated_db):
        from app.database import save_evidence, get_evidence_by_hash
        h = sha256_of(b"lookup test")
        save_evidence(h, "lookup.jpg", "/p/lookup.jpg", 200, "image/png")
        record = get_evidence_by_hash(h)
        assert record is not None
        assert record["evidence_hash"] == h
        assert record["filename"] == "lookup.jpg"


# ──────────────────────────────────────────────────
# Integration tests: POST /api/evidence
# ──────────────────────────────────────────────────

class TestUploadEndpoint:
    def test_valid_jpeg_upload(self, client):
        data = minimal_jpeg()
        response = client.post(
            "/api/evidence",
            files={"file": ("photo.jpg", io.BytesIO(data), "image/jpeg")},
        )
        assert response.status_code == 201, response.text
        body = response.json()
        assert body["evidence_hash"] == sha256_of(data)
        assert len(body["evidence_hash"]) == 64
        assert body["evidence_hash"] == body["evidence_hash"].lower()
        assert body["is_duplicate"] is False
        assert body["mime_type"] == "image/jpeg"

    def test_valid_png_upload(self, client):
        data = minimal_png()
        response = client.post(
            "/api/evidence",
            files={"file": ("evidence.png", io.BytesIO(data), "image/png")},
        )
        assert response.status_code == 201, response.text
        body = response.json()
        assert body["mime_type"] == "image/png"
        assert body["is_duplicate"] is False

    def test_valid_webp_upload(self, client):
        data = minimal_webp()
        response = client.post(
            "/api/evidence",
            files={"file": ("img.webp", io.BytesIO(data), "image/webp")},
        )
        assert response.status_code == 201, response.text
        assert response.json()["mime_type"] == "image/webp"

    def test_duplicate_upload_returns_is_duplicate_true(self, client):
        data = minimal_jpeg()
        # First upload
        r1 = client.post(
            "/api/evidence",
            files={"file": ("a.jpg", io.BytesIO(data), "image/jpeg")},
        )
        assert r1.status_code == 201
        # Second upload of identical bytes
        r2 = client.post(
            "/api/evidence",
            files={"file": ("a_copy.jpg", io.BytesIO(data), "image/jpeg")},
        )
        assert r2.status_code == 201
        body2 = r2.json()
        assert body2["is_duplicate"] is True
        assert body2["evidence_hash"] == sha256_of(data)

    def test_invalid_file_type_text_rejected(self, client):
        response = client.post(
            "/api/evidence",
            files={"file": ("script.html", io.BytesIO(b"<html>hack</html>"), "text/html")},
        )
        assert response.status_code == 400

    def test_invalid_file_type_gif_rejected(self, client):
        """GIF starts with GIF89a — not in allowed types."""
        response = client.post(
            "/api/evidence",
            files={"file": ("animation.gif", io.BytesIO(b"GIF89a" + b"\x00" * 50), "image/gif")},
        )
        assert response.status_code == 400

    def test_empty_file_rejected(self, client):
        response = client.post(
            "/api/evidence",
            files={"file": ("empty.jpg", io.BytesIO(b""), "image/jpeg")},
        )
        assert response.status_code == 400

    def test_oversized_file_rejected(self, client, monkeypatch):
        import app.routes.evidence as ev_module
        # Temporarily set max size to 100 bytes so we can test without uploading 10MB
        monkeypatch.setattr(ev_module, "MAX_FILE_SIZE_BYTES", 100)
        big_data = b"\xff\xd8\xff" + b"\x00" * 200  # 203 bytes > 100
        response = client.post(
            "/api/evidence",
            files={"file": ("big.jpg", io.BytesIO(big_data), "image/jpeg")},
        )
        assert response.status_code == 413

    def test_hash_consistency_server_matches_client(self, client):
        """Server SHA-256 must equal hashlib.sha256 of the same raw bytes."""
        data = minimal_png()
        expected = sha256_of(data)
        response = client.post(
            "/api/evidence",
            files={"file": ("consistency.png", io.BytesIO(data), "image/png")},
        )
        assert response.status_code == 201
        assert response.json()["evidence_hash"] == expected

    def test_filename_sanitized(self, client):
        """Path traversal filenames must be sanitised."""
        data = minimal_jpeg()
        response = client.post(
            "/api/evidence",
            files={"file": ("../../etc/passwd", io.BytesIO(data), "image/jpeg")},
        )
        assert response.status_code == 201
        body = response.json()
        assert ".." not in body["filename"]
        assert "/" not in body["filename"]
        assert "\\" not in body["filename"]

    def test_unsupported_extension_rejected(self, client):
        """Disallowed extensions must be rejected even with image MIME headers."""
        data = minimal_jpeg()
        response = client.post(
            "/api/evidence",
            files={"file": ("malicious.exe", io.BytesIO(data), "image/jpeg")},
        )
        assert response.status_code == 400
        assert "Unsupported file extension" in response.json()["detail"]

    def test_duplicate_detected_from_activities_table(self, client, isolated_db):
        """Evidence matching an existing on-chain activity must return duplicate with activity ID."""
        import app.database as db_module
        data = minimal_jpeg()
        h = sha256_of(data)
        with db_module.get_db_connection() as conn:
            conn.execute(
                """
                INSERT INTO activities (activity_id, submitter_address, category, quantity, unit, evidence_hash, submitted_at)
                VALUES (?, ?, ?, ?, ?, ?, ?);
                """,
                ("act-existing-123", "tz1VSUr8wwNhLAzempoch5d6hLRiTh8Cjcjb", "Tree planting", 5, "saplings", h, "2026-10-30T00:00:00Z"),
            )

        response = client.post(
            "/api/evidence",
            files={"file": ("tree.jpg", io.BytesIO(data), "image/jpeg")},
        )
        assert response.status_code == 201
        body = response.json()
        assert body["is_duplicate"] is True
        assert body["existing_activity_id"] == "act-existing-123"

    def test_concurrent_duplicate_upload_handling(self, client):
        """Simultaneous duplicate uploads must succeed without SQLite integrity crashes."""
        data = minimal_png()
        r1 = client.post(
            "/api/evidence",
            files={"file": ("file1.png", io.BytesIO(data), "image/png")},
        )
        r2 = client.post(
            "/api/evidence",
            files={"file": ("file2.png", io.BytesIO(data), "image/png")},
        )
        assert r1.status_code == 201
        assert r2.status_code == 201
        assert r1.json()["evidence_hash"] == r2.json()["evidence_hash"]
        assert r2.json()["is_duplicate"] is True


# ──────────────────────────────────────────────────
# Integration tests: GET /api/evidence/{hash}/duplicate-check
# ──────────────────────────────────────────────────

class TestDuplicateCheckEndpoint:
    def test_no_duplicate_when_hash_not_stored(self, client):
        hash_val = "b" * 64
        response = client.get(f"/api/evidence/{hash_val}/duplicate-check")
        assert response.status_code == 200
        body = response.json()
        assert body["is_duplicate"] is False
        assert body["evidence_hash"] == hash_val

    def test_duplicate_detected_after_upload(self, client):
        data = minimal_jpeg()
        # Upload first
        client.post(
            "/api/evidence",
            files={"file": ("dup_test.jpg", io.BytesIO(data), "image/jpeg")},
        )
        h = sha256_of(data)
        response = client.get(f"/api/evidence/{h}/duplicate-check")
        assert response.status_code == 200
        assert response.json()["is_duplicate"] is True

    def test_invalid_hash_format_rejected(self, client):
        # Not 64 hex chars
        response = client.get("/api/evidence/not-a-valid-hash/duplicate-check")
        assert response.status_code == 400

    def test_uppercase_hash_still_valid(self, client):
        """is_valid_sha256 lowercases before regex match, so uppercase should be accepted."""
        data = minimal_png()
        client.post(
            "/api/evidence",
            files={"file": ("upper.png", io.BytesIO(data), "image/png")},
        )
        h_upper = sha256_of(data).upper()
        response = client.get(f"/api/evidence/{h_upper}/duplicate-check")
        # The endpoint accepts uppercase (is_valid_sha256 lowercases internally)
        assert response.status_code == 200
        assert response.json()["is_duplicate"] is True


# ──────────────────────────────────────────────────
# Integration tests: GET /api/evidence/{hash}/file (always 403)
# ──────────────────────────────────────────────────

class TestEvidenceFileAccessRestriction:
    def test_file_endpoint_always_returns_403(self, client):
        """Raw evidence files must never be publicly accessible."""
        h = "c" * 64
        response = client.get(f"/api/evidence/{h}/file")
        assert response.status_code == 403

    def test_file_endpoint_returns_403_for_existing_evidence(self, client):
        """Even after upload, the file endpoint still returns 403."""
        data = minimal_jpeg()
        client.post(
            "/api/evidence",
            files={"file": ("secret.jpg", io.BytesIO(data), "image/jpeg")},
        )
        h = sha256_of(data)
        response = client.get(f"/api/evidence/{h}/file")
        assert response.status_code == 403


# ──────────────────────────────────────────────────
# Existing health check (preserve Phase 1 test)
# ──────────────────────────────────────────────────

class TestHealthEndpoint:
    def test_health_endpoint(self, client):
        response = client.get("/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
        assert "Shadownet" in data["supported_network"]


# ──────────────────────────────────────────────────
# Batch Upload (up to 25 files) & ID Resolution Tests
# ──────────────────────────────────────────────────

class TestEvidenceBatchUpload:
    def test_upload_evidence_batch_success(self, client):
        """Batch upload supports multiple photos (up to 25) with individual SHA-256 digests."""
        files = [
            ("files", (f"img_{i}.png", io.BytesIO(minimal_png() + f"var_{i}".encode()), "image/png"))
            for i in range(3)
        ]
        response = client.post("/api/evidence/batch", files=files)
        assert response.status_code == 201
        data = response.json()
        assert len(data) == 3
        for item in data:
            assert "evidence_hash" in item
            assert len(item["evidence_hash"]) == 64
            assert item["is_duplicate"] is False

    def test_upload_evidence_batch_limit_exceeded(self, client):
        """Batch upload exceeding 25 images is rejected with 400 Bad Request."""
        files = [
            ("files", (f"img_{i}.png", io.BytesIO(minimal_png() + f"var_{i}".encode()), "image/png"))
            for i in range(26)
        ]
        response = client.post("/api/evidence/batch", files=files)
        assert response.status_code == 400
        assert "25 files" in response.json()["detail"]


class TestActivityResolution:
    def test_activity_lookup_case_insensitive_and_trimmed(self, client):
        """Chronicle archive lookups resolve cleanly regardless of whitespace or casing."""
        from app.database import create_or_update_activity, get_activity_by_id

        act_id = "act-2026-test-alpha"
        create_or_update_activity(
            activity_id=act_id,
            submitter_address="tz1StudentWalletAddressAlpha",
            category="Tree planting",
            quantity=15.0,
            unit="trees",
            description="North quad planting",
            evidence_hash="a" * 64,
        )

        # Lookup with uppercase
        res_upper = get_activity_by_id("ACT-2026-TEST-ALPHA")
        assert res_upper is not None
        assert res_upper["activity_id"] == act_id

        # Lookup with spaces
        res_spaces = get_activity_by_id("   act-2026-test-alpha   ")
        assert res_spaces is not None
        assert res_spaces["activity_id"] == act_id

        # Via API route
        api_res = client.get("/api/activities/ACT-2026-TEST-ALPHA")
        assert api_res.status_code == 200
        assert api_res.json()["activity_id"] == act_id

