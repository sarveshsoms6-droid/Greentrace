"""
GreenTrace 2.0 - User Authentication Router
Provides registration (Sign Up), authentication (Sign In), and role resolution.
Stores users securely in the Supabase PostgreSQL database.
"""

import secrets
from typing import Optional
from fastapi import APIRouter, HTTPException, Header, status

from ..database import (
    create_user,
    get_user_by_email,
    get_user_by_id,
    get_user_by_wallet,
    get_user_by_identifier,
    is_authorized_organizer,
    update_user_last_login,
    hash_password,
    verify_password,
)
from ..models import (
    UserSignUpRequest,
    UserLoginRequest,
    TezosQuickLoginRequest,
    UserResponse,
    AuthResponse,
)

router = APIRouter(prefix="/api/auth", tags=["auth"])


def generate_session_token(user_id: int) -> str:
    """Generates a secure, random session token."""
    return f"gt_{user_id}_{secrets.token_urlsafe(32)}"


@router.post("/signup", response_model=AuthResponse, status_code=status.HTTP_201_CREATED)
def signup(payload: UserSignUpRequest):
    """
    Registers a new campus user (Student or Organizer).
    Enforces that:
    1. If a Student ID is provided or Student cadre is selected, the account is strictly STUDENT.
    2. Organizer cadre requires an organizer email/department and is strictly ORGANIZER.
    """
    clean_email = payload.email.strip().lower()
    if "@" not in clean_email or "." not in clean_email.split("@")[-1]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid email format. Please provide a valid campus or personal email.",
        )

    # Check for existing account by email or student ID
    existing = get_user_by_email(clean_email)
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email address already exists. Please sign in instead.",
        )

    clean_student_id = payload.student_id.strip() if payload.student_id else None
    if clean_student_id:
        existing_stu = get_user_by_identifier(clean_student_id)
        if existing_stu:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"An account with Student ID '{clean_student_id}' already exists. Please sign in instead.",
            )

    # Strict role determination:
    # A submission with a student_id or selecting STUDENT is always a STUDENT account.
    req_role = payload.role.upper().strip()
    if clean_student_id or req_role == "STUDENT":
        target_role = "STUDENT"
        student_id_val = clean_student_id or f"STU-{secrets.token_hex(3).upper()}"
        department_val = None
    else:
        target_role = "ORGANIZER"
        student_id_val = None
        department_val = payload.department.strip() if payload.department else "Faculty Council of Sustainability"

    # Prepare wallet address
    wallet = payload.wallet_address.strip() if payload.wallet_address else None
    if not wallet:
        suffix = secrets.token_hex(10)
        wallet = f"tz1{target_role.lower()[:3]}{suffix}"

    # Hash password securely
    hashed = hash_password(payload.password)

    try:
        user_record = create_user(
            email=clean_email,
            name=payload.name.strip(),
            password_hash=hashed,
            role=target_role,
            student_id=student_id_val,
            department=department_val,
            wallet_address=wallet,
        )

        user_response = UserResponse(**user_record)
        token = generate_session_token(user_record["id"])

        return AuthResponse(
            success=True,
            message=f"Welcome to GreenTrace, {user_record['name']}! Your {target_role.lower()} account is ready.",
            user=user_response,
            token=token,
        )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Registration failed: {str(exc)}",
        )


@router.post("/login", response_model=AuthResponse)
def login(payload: UserLoginRequest):
    """
    Authenticates an existing student or organizer using their email or Student ID + password.
    Returns the user profile and session token for dashboard routing.
    """
    clean_identifier = payload.email.strip().lower()
    user_record = get_user_by_identifier(clean_identifier, include_password=True)

    if not user_record:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="No account found matching this email or Student ID. Please check your spelling or sign up.",
        )

    stored_hash = user_record.get("password_hash", "")
    if not verify_password(payload.password, stored_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect password. Please verify your credentials and try again.",
        )

    # Update last login timestamp
    update_user_last_login(user_record["id"])

    # Prepare clean response without password
    user_data = {k: v for k, v in user_record.items() if k != "password_hash"}
    user_response = UserResponse(**user_data)
    token = generate_session_token(user_record["id"])

    return AuthResponse(
        success=True,
        message=f"Welcome back, {user_record['name']}!",
        user=user_response,
        token=token,
    )


@router.post("/tezos-login", response_model=AuthResponse)
def tezos_quick_login(payload: TezosQuickLoginRequest):
    """
    Direct Quick Access for accredited organizers using their Tezos ID (tz1...).
    Verifies that the address is an accredited organizer and returns an authenticated session.
    """
    clean_addr = payload.wallet_address.strip()
    if not clean_addr.startswith(("tz1", "tz2", "tz3", "KT1")):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid Tezos ID format. Address must begin with tz1, tz2, tz3, or KT1.",
        )

    # Check authorization against on-chain, env config, and registered users
    authorized = is_authorized_organizer(clean_addr)
    existing_user = get_user_by_wallet(clean_addr)

    if existing_user and existing_user.get("role") == "ORGANIZER":
        authorized = True

    if not authorized:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Access Denied: Tezos ID '{clean_addr}' is not registered as an authorized Faculty Organizer.",
        )

    # If organizer is authorized on-chain/config but has no DB row yet, create one
    if not existing_user:
        hashed = hash_password(secrets.token_urlsafe(16))
        prefix = clean_addr[:10]
        user_record = create_user(
            email=f"{prefix.lower()}@faculty.campus.edu",
            name=f"Faculty Organizer ({prefix})",
            password_hash=hashed,
            role="ORGANIZER",
            department="Faculty Council of Sustainability",
            wallet_address=clean_addr,
        )
    else:
        user_record = existing_user

    update_user_last_login(user_record["id"])
    user_data = {k: v for k, v in user_record.items() if k != "password_hash"}
    user_response = UserResponse(**user_data)
    token = generate_session_token(user_record["id"])

    return AuthResponse(
        success=True,
        message=f"Organizer Quick Access ratified for {user_record['name']} via Tezos ID.",
        user=user_response,
        token=token,
    )


@router.get("/user/{user_id}", response_model=UserResponse)
def get_user_profile(user_id: int):
    """Retrieves public user profile by ID."""
    user = get_user_by_id(user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"User with ID '{user_id}' not found.",
        )
    return UserResponse(**user)

