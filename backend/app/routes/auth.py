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
    update_user_last_login,
    hash_password,
    verify_password,
)
from ..models import (
    UserSignUpRequest,
    UserLoginRequest,
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
    Saves credentials securely with salted PBKDF2-HMAC-SHA256 password hashing.
    """
    clean_email = payload.email.strip().lower()
    if "@" not in clean_email or "." not in clean_email.split("@")[-1]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid email format. Please provide a valid campus or personal email.",
        )

    # Check for existing account
    existing = get_user_by_email(clean_email)
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email address already exists. Please sign in instead.",
        )

    # Prepare wallet address
    wallet = payload.wallet_address.strip() if payload.wallet_address else None
    if not wallet:
        # Generate a deterministic mock Tezos address for seamless testing if none provided
        suffix = secrets.token_hex(10)
        wallet = f"tz1{payload.role.lower()[:3]}{suffix}"

    # Hash password securely
    hashed = hash_password(payload.password)

    try:
        user_record = create_user(
            email=clean_email,
            name=payload.name.strip(),
            password_hash=hashed,
            role=payload.role.upper(),
            student_id=payload.student_id.strip() if payload.student_id else None,
            department=payload.department.strip() if payload.department else None,
            wallet_address=wallet,
        )

        user_response = UserResponse(**user_record)
        token = generate_session_token(user_record["id"])

        return AuthResponse(
            success=True,
            message=f"Welcome to GreenTrace, {user_record['name']}! Your {payload.role.lower()} account is ready.",
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
    Authenticates an existing student or organizer using their email and password.
    Returns the user profile and session token for dashboard routing.
    """
    clean_email = payload.email.strip().lower()
    user_record = get_user_by_email(clean_email, include_password=True)

    if not user_record:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="No account found with this email. Please check your spelling or sign up.",
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

