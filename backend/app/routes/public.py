"""
GreenTrace 2.0 - Public Verification Router
Publicly accessible read-only verification endpoints that require no authentication.
Directly verifies authoritative on-chain SmartPy contract state on Tezos Shadownet.
Never exposes private evidence files, internal file paths, or student personal information.
"""

import re
from typing import Optional
from fastapi import APIRouter, HTTPException, status

from ..database import get_activity_by_id
from ..services.reconciliation import (
    fetch_on_chain_activity,
    get_configured_contract_address,
)
from ..models import PublicVerificationResponse

router = APIRouter(prefix="/api/public", tags=["public"])

DISCLAIMER_TEXT = (
    "Blockchain verification confirms that this activity record and its status were "
    "recorded by the GreenTrace smart contract. It does not independently prove that "
    "the physical activity occurred."
)


def validate_activity_id(activity_id: str) -> str:
    """Validates activity ID format, rejecting path traversal and malformed inputs."""
    cleaned = activity_id.strip()
    if not cleaned or len(cleaned) < 3 or len(cleaned) > 100:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid Activity ID: Must be between 3 and 100 characters.",
        )
    if not re.match(r"^[a-zA-Z0-9_\-]+$", cleaned):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid Activity ID: Only alphanumeric characters, hyphens, and underscores are permitted.",
        )
    return cleaned


@router.get("/verify/{activity_id}", response_model=PublicVerificationResponse)
def verify_activity_publicly(activity_id: str):
    """
    Public verification endpoint called when a QR code is scanned.
    Verifies the authoritative state directly against the SmartPy contract on Tezos.
    Does not trust backend database flags alone.
    """
    clean_id = validate_activity_id(activity_id)

    # 1. Fetch local cached activity metadata
    activity = get_activity_by_id(clean_id)

    # 2. Check on-chain state
    contract_addr = get_configured_contract_address()
    on_chain_data = None

    if contract_addr:
        try:
            on_chain_data = fetch_on_chain_activity(clean_id, contract_address=contract_addr)
        except Exception:
            on_chain_data = None

    # If activity does not exist in DB and not found on-chain
    if not activity and not on_chain_data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Activity with ID '{clean_id}' was not found.",
        )

    # If record only exists on-chain, create base representation
    category = on_chain_data.get("category", "Sustainability Activity") if on_chain_data else activity.get("category")
    quantity = float(on_chain_data.get("quantity", 1.0)) if on_chain_data else float(activity.get("quantity", 1.0))
    unit = on_chain_data.get("unit", "units") if on_chain_data else activity.get("unit")
    evidence_hash = on_chain_data.get("evidence_hash") if on_chain_data else activity.get("evidence_hash")
    submission_tx_hash = activity.get("submission_tx_hash") if activity else None
    approval_tx_hash = activity.get("approval_tx_hash") or activity.get("rejection_tx_hash") if activity else None
    approver_address = on_chain_data.get("approver_address") if on_chain_data else (activity.get("approver_address") if activity else None)
    submitted_at = on_chain_data.get("submitted_at") if on_chain_data else (activity.get("submitted_at") if activity else None)
    decided_at = on_chain_data.get("approved_at") if on_chain_data else (activity.get("approved_at") or activity.get("rejected_at") if activity else None)

    # Determine status authoritatively
    if not contract_addr:
        # Contract not configured in environment
        return PublicVerificationResponse(
            activity_id=clean_id,
            category=category,
            quantity=quantity,
            unit=unit,
            status="UNAVAILABLE",
            status_label="Verification unavailable",
            on_chain_status=None,
            on_chain_verified=False,
            network="Shadownet (Tezos Testnet)",
            contract_address=None,
            submission_tx_hash=submission_tx_hash,
            approval_tx_hash=approval_tx_hash,
            approver_address=approver_address,
            submitted_at=submitted_at,
            decided_at=decided_at,
            evidence_hash=evidence_hash or "",
            disclaimer=DISCLAIMER_TEXT,
            details="Contract address is not configured. Authoritative on-chain verification is unavailable.",
        )

    if on_chain_data is None:
        # Contract configured, but query failed or key not found in storage
        return PublicVerificationResponse(
            activity_id=clean_id,
            category=category,
            quantity=quantity,
            unit=unit,
            status="UNAVAILABLE",
            status_label="Verification unavailable",
            on_chain_status=None,
            on_chain_verified=False,
            network="Shadownet (Tezos Testnet)",
            contract_address=contract_addr,
            submission_tx_hash=submission_tx_hash,
            approval_tx_hash=approval_tx_hash,
            approver_address=approver_address,
            submitted_at=submitted_at,
            decided_at=decided_at,
            evidence_hash=evidence_hash or "",
            disclaimer=DISCLAIMER_TEXT,
            details="Activity is not recorded on the smart contract or RPC node was unreachable.",
        )

    # Authoritative contract state resolved
    on_chain_status = on_chain_data.get("status", "SUBMITTED").upper()

    if on_chain_status == "APPROVED":
        status_label = "Approved"
    elif on_chain_status == "REJECTED":
        status_label = "Rejected"
    else:
        status_label = "Pending"

    return PublicVerificationResponse(
        activity_id=clean_id,
        category=category,
        quantity=quantity,
        unit=unit,
        status=on_chain_status,
        status_label=status_label,
        on_chain_status=on_chain_status,
        on_chain_verified=True,
        network="Shadownet (Tezos Testnet)",
        contract_address=contract_addr,
        submission_tx_hash=submission_tx_hash,
        approval_tx_hash=approval_tx_hash,
        approver_address=approver_address,
        submitted_at=submitted_at,
        decided_at=decided_at,
        evidence_hash=evidence_hash or "",
        disclaimer=DISCLAIMER_TEXT,
        details=f"Status confirmed by Tezos SmartPy contract at {contract_addr}.",
    )


@router.get("/activities/{activity_id}", response_model=PublicVerificationResponse)
def get_public_activity_by_id(activity_id: str):
    """Alias for /verify/{activity_id} ensuring backward compatibility."""
    return verify_activity_publicly(activity_id)
