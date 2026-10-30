"""
GreenTrace 2.0 - Activities and Organizer Decision Router
Handles activity query, caching, off-chain decision metadata (rejection reasons),
and organizer authorization verification.
"""

from typing import List, Optional
from fastapi import APIRouter, HTTPException, Query, status

from ..database import (
    create_or_update_activity,
    get_activities,
    get_activity_by_id,
    record_activity_decision,
    is_authorized_organizer,
    get_transactions_for_activity,
    get_activity_history,
    get_activity_statistics,
)
from ..services.reconciliation import (
    fetch_on_chain_activity,
    reconcile_activity_status,
)
from ..models import (
    ActivityCreate,
    ActivityResponse,
    DecisionRecordRequest,
    DecisionRecordResponse,
    OrganizerCheckResponse,
    TransactionResponse,
    ActivityHistoryResponse,
    ActivityStatisticsResponse,
)

router = APIRouter(prefix="/api/activities", tags=["activities"])


@router.get("", response_model=List[ActivityResponse])
def list_activities(
    status_filter: Optional[str] = Query(None, alias="status"),
    submitter_address: Optional[str] = Query(None, alias="submitter_address"),
    category: Optional[str] = Query(None, alias="category"),
    limit: Optional[int] = Query(None, ge=1, le=100),
    offset: Optional[int] = Query(None, ge=0),
):
    """
    Retrieves activities from SQLite cache, with optional filters for status, submitter address,
    category, and pagination (limit & offset).
    """
    activities = get_activities(
        status=status_filter,
        submitter_address=submitter_address,
        category=category,
        limit=limit,
        offset=offset,
    )
    return activities


@router.get("/stats/summary", response_model=ActivityStatisticsResponse)
def get_stats_summary(submitter_address: Optional[str] = Query(None)):
    """
    Returns aggregated KPI statistics (total, approved, pending, rejected, and category impacts),
    optionally scoped to a specific student wallet address.
    """
    return get_activity_statistics(submitter_address=submitter_address)


@router.get("/{activity_id}", response_model=ActivityResponse)
def get_single_activity(activity_id: str):
    """
    Retrieves a single activity record by ID.
    """
    activity = get_activity_by_id(activity_id)
    if not activity:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Activity with ID '{activity_id}' not found.",
        )
    return activity


@router.post("", response_model=ActivityResponse, status_code=status.HTTP_201_CREATED)
def record_activity_submission(payload: ActivityCreate):
    """
    Records a student's submission metadata in SQLite off-chain cache,
    including any GreenAI tree detection analysis.
    """
    activity = create_or_update_activity(
        activity_id=payload.activity_id,
        submitter_address=payload.submitter_address,
        category=payload.category,
        quantity=payload.quantity,
        unit=payload.unit,
        description=payload.description,
        evidence_hash=payload.evidence_hash,
        submission_tx_hash=payload.submission_tx_hash,
        submitted_at=payload.submitted_at,
        ai_detected_count=payload.ai_detected_count,
        ai_confidence_score=payload.ai_confidence_score,
        ai_model_name=payload.ai_model_name,
        ai_model_version=payload.ai_model_version,
        ai_annotated_path=payload.ai_annotated_path,
        ai_detection_data=payload.ai_detection_data,
    )
    return activity


@router.post("/{activity_id}/decision", response_model=DecisionRecordResponse)
def record_organizer_decision(activity_id: str, payload: DecisionRecordRequest):
    """
    Records an authorized organizer's confirmed blockchain decision off-chain.
    Stores rejection reason, approver address, transaction hash, and timestamp.
    NOTE: The backend does not sign transactions for organizers.
    """
    # 1. Authoritative organizer permission check
    if not is_authorized_organizer(payload.approver_address):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Unauthorized: Address '{payload.approver_address}' is not an authorized organizer.",
        )

    # 2. Activity existence check
    activity = get_activity_by_id(activity_id)
    if not activity:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Activity with ID '{activity_id}' not found.",
        )

    # 3. Status transition check: only pending activities can be decided
    if activity["status_cache"] != "SUBMITTED":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid transition: Activity is already {activity['status_cache']}. Decisions cannot be overwritten.",
        )

    # 4. Self-approval prevention
    if activity["submitter_address"].lower() == payload.approver_address.lower():
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Self-approval violation: Organizers are prohibited from approving or rejecting their own activities.",
        )

    # 5. Record decision in SQLite
    try:
        updated = record_activity_decision(
            activity_id=activity_id,
            decision=payload.decision,
            approver_address=payload.approver_address,
            approval_tx_hash=payload.approval_tx_hash,
            rejection_reason=payload.rejection_reason,
        )
        return DecisionRecordResponse(
            activity_id=activity_id,
            status=updated["status_cache"],
            approver_address=updated.get("approver_address") or payload.approver_address,
            approval_tx_hash=updated["approval_tx_hash"],
            approved_at=updated["approved_at"],
            rejection_reason=updated.get("rejection_reason"),
            message=f"Decision '{payload.decision}' successfully recorded off-chain.",
        )
    except (ValueError, KeyError, PermissionError) as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))


@router.get("/organizers/verify/{address}", response_model=OrganizerCheckResponse)
def verify_organizer_status(address: str):
    """
    Authoritative check whether a given Tezos wallet address is an authorized organizer.
    """
    is_org = is_authorized_organizer(address)
    return OrganizerCheckResponse(
        address=address,
        is_organizer=is_org,
        message="Address is an authorized organizer." if is_org else "Address is not an authorized organizer.",
    )


# =====================================================================
# Phase 7: History, Transactions & Activity-level Safe Retry
# =====================================================================

@router.get("/{activity_id}/history", response_model=ActivityHistoryResponse)
def get_activity_audit_history(activity_id: str):
    """
    Returns full chronological audit trail and history of an activity,
    including on-chain submission, decisions, and confirmed transaction references.
    """
    history = get_activity_history(activity_id)
    if not history:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Activity with ID '{activity_id}' not found.",
        )
    return history


@router.get("/{activity_id}/transactions", response_model=List[TransactionResponse])
def get_activity_transactions(activity_id: str):
    """
    Retrieves all recorded blockchain transactions for a given activity.
    """
    activity = get_activity_by_id(activity_id)
    if not activity:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Activity with ID '{activity_id}' not found.",
        )
    return get_transactions_for_activity(activity_id)


@router.post("/{activity_id}/retry-sync", response_model=ActivityResponse)
def retry_activity_synchronization(activity_id: str):
    """
    Safe retry for a specific activity:
    Checks authoritative on-chain state for this activity and idempotently reconciles
    the local database record without requiring a new blockchain transaction.
    """
    activity = get_activity_by_id(activity_id)
    if not activity:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Activity with ID '{activity_id}' not found.",
        )

    on_chain = fetch_on_chain_activity(activity_id)
    if on_chain:
        updated = reconcile_activity_status(
            activity_id=activity_id,
            on_chain_status=on_chain["status"],
            approver_address=on_chain.get("approver_address"),
            confirmed_at=on_chain.get("approved_at"),
        )
        return updated
    else:
        # If not yet mined or contract unavailable, return current record
        return activity
