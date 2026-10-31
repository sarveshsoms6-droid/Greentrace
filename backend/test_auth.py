import pytest
from fastapi.testclient import TestClient
from main import app
import app.database as db_module

client = TestClient(app)

@pytest.fixture(autouse=True)
def setup_test_db(tmp_path, monkeypatch):
    """Ensure tests run against a clean isolated sqlite db."""
    test_db = str(tmp_path / "test_auth.db")
    monkeypatch.setenv("DATABASE_PATH", test_db)
    monkeypatch.setattr(db_module, "DATABASE_PATH", test_db)
    db_module.init_db()


def test_student_signup_and_login_success():
    # 1. Sign up
    signup_payload = {
        "email": "test.student@campus.edu",
        "name": "Jane Doe",
        "password": "securepassword123",
        "role": "STUDENT",
        "student_id": "STU-2026-1234",
    }
    signup_res = client.post("/api/auth/signup", json=signup_payload)
    assert signup_res.status_code == 201
    signup_data = signup_res.json()
    assert signup_data["success"] is True
    assert signup_data["user"]["email"] == "test.student@campus.edu"
    assert signup_data["user"]["name"] == "Jane Doe"
    assert signup_data["user"]["role"] == "STUDENT"
    assert signup_data["user"]["student_id"] == "STU-2026-1234"
    assert "password_hash" not in signup_data["user"]
    assert signup_data["token"].startswith("gt_")

    # 2. Login
    login_payload = {
        "email": "test.student@campus.edu",
        "password": "securepassword123",
    }
    login_res = client.post("/api/auth/login", json=login_payload)
    assert login_res.status_code == 200
    login_data = login_res.json()
    assert login_data["success"] is True
    assert login_data["user"]["id"] == signup_data["user"]["id"]
    assert login_data["token"].startswith("gt_")


def test_organizer_signup_success():
    payload = {
        "email": "faculty.organizer@campus.edu",
        "name": "Prof. Smith",
        "password": "organizerpass456",
        "role": "ORGANIZER",
        "department": "Environmental Sciences",
        "wallet_address": "tz1aSkwEkv3Ax2bWZHvCaOKUMcqModq5RMqJ",
    }
    res = client.post("/api/auth/signup", json=payload)
    assert res.status_code == 201
    data = res.json()
    assert data["user"]["role"] == "ORGANIZER"
    assert data["user"]["department"] == "Environmental Sciences"
    assert data["user"]["wallet_address"] == "tz1aSkwEkv3Ax2bWZHvCaOKUMcqModq5RMqJ"


def test_duplicate_email_rejected():
    payload = {
        "email": "duplicate@campus.edu",
        "name": "User One",
        "password": "password123",
        "role": "STUDENT",
    }
    res1 = client.post("/api/auth/signup", json=payload)
    assert res1.status_code == 201

    res2 = client.post("/api/auth/signup", json=payload)
    assert res2.status_code == 409
    assert "already exists" in res2.json()["detail"].lower()


def test_invalid_email_format_rejected():
    payload = {
        "email": "not-an-email",
        "name": "Invalid User",
        "password": "password123",
        "role": "STUDENT",
    }
    res = client.post("/api/auth/signup", json=payload)
    assert res.status_code == 400
    assert "invalid email format" in res.json()["detail"].lower()


def test_wrong_password_rejected():
    payload = {
        "email": "wrongpw@campus.edu",
        "name": "User",
        "password": "correctpassword",
        "role": "STUDENT",
    }
    client.post("/api/auth/signup", json=payload)

    login_res = client.post("/api/auth/login", json={
        "email": "wrongpw@campus.edu",
        "password": "incorrectpassword",
    })
    assert login_res.status_code == 401
    assert "incorrect password" in login_res.json()["detail"].lower()


def test_nonexistent_email_login_rejected():
    login_res = client.post("/api/auth/login", json={
        "email": "doesnotexist@campus.edu",
        "password": "anyPassword123",
    })
    assert login_res.status_code == 401
    assert "no account found" in login_res.json()["detail"].lower()


def test_get_user_profile():
    signup_res = client.post("/api/auth/signup", json={
        "email": "profile@campus.edu",
        "name": "Profile User",
        "password": "password123",
        "role": "STUDENT",
    })
    user_id = signup_res.json()["user"]["id"]

    res = client.get(f"/api/auth/user/{user_id}")
    assert res.status_code == 200
    assert res.json()["name"] == "Profile User"
    assert "password_hash" not in res.json()


def test_login_with_student_id_identifier():
    # 1. Sign up student
    signup_res = client.post("/api/auth/signup", json={
        "email": "sid.student@campus.edu",
        "name": "Alex Rivera",
        "password": "Password@123",
        "role": "STUDENT",
        "student_id": "STU-2026-9999",
    })
    assert signup_res.status_code == 201

    # 2. Log in using Student ID in identifier field
    login_res = client.post("/api/auth/login", json={
        "email": "STU-2026-9999",
        "password": "Password@123",
    })
    assert login_res.status_code == 200
    data = login_res.json()
    assert data["success"] is True
    assert data["user"]["role"] == "STUDENT"
    assert data["user"]["student_id"] == "STU-2026-9999"


def test_student_id_guarantees_student_role():
    # Having a student_id strictly forces STUDENT role
    signup_res = client.post("/api/auth/signup", json={
        "email": "matriculated@campus.edu",
        "name": "Strict Student",
        "password": "Password@123",
        "role": "STUDENT",
        "student_id": "STU-2026-7777",
    })
    assert signup_res.status_code == 201
    assert signup_res.json()["user"]["role"] == "STUDENT"


def test_organizer_tezos_quick_login():
    # 1. Authorized organizer Tezos quick login (Sample Organizer)
    auth_res = client.post("/api/auth/tezos-login", json={
        "wallet_address": "tz1aSkwEkv3Ax2bWZHvCaOKUMcqModq5RMqJ",
    })
    assert auth_res.status_code == 200
    auth_data = auth_res.json()
    assert auth_data["success"] is True
    assert auth_data["user"]["role"] == "ORGANIZER"
    assert auth_data["token"].startswith("gt_")

    # 2. Newly authorized organizer Tezos quick login (User requested wallet code)
    auth_res2 = client.post("/api/auth/tezos-login", json={
        "wallet_address": "tz1eJkP2sfw6LnrvijT4u3UcBXKpJxXmAQxw",
    })
    assert auth_res2.status_code == 200
    auth_data2 = auth_res2.json()
    assert auth_data2["success"] is True
    assert auth_data2["user"]["role"] == "ORGANIZER"
    assert auth_data2["token"].startswith("gt_")

    # 3. Unauthorized address returns 403
    unauth_res = client.post("/api/auth/tezos-login", json={
        "wallet_address": "tz1RandomUnauthorizedAddress1234567890",
    })
    assert unauth_res.status_code == 403
    assert "not registered as an authorized faculty organizer" in unauth_res.json()["detail"].lower()


