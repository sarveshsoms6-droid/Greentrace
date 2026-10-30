"""
GreenTrace 2.0 - Blockchain Reconciliation and Recovery Router
Endpoints for database-to-blockchain synchronization, transaction tracking,
and safe retry/recovery of confirmed transactions with failed database writes.
"""

from typing import List, Optional
from fastapi import APIRouter, HTTPException, status

from ..database import (
    record_transaction,
    get_transaction_by_hash,
    get_reconciliation_statistics,
)
from ..services.reconciliation import (
    reconcile_database_with_blockchain,
    recover_activity_transaction,
    get_configured_contract_address,
    TEZOS_RPC_URL,
)
from ..models import (
    TransactionRecordRequest,
    TransactionResponse,
    ReconciliationStatusResponse,
    ReconciliationSyncRequest,
    ReconciliationSyncResponse,
    RecoveryRequest,
    RecoveryResponse,
)

router = APIRouter(prefix="/api/reconciliation", tags=["reconciliation"])


@router.get("/status", response_model=ReconciliationStatusResponse)
def get_reconciliation_status():
    """
    Returns the current database reconciliation status, counts of confirmed vs unconfirmed
    records, configured contract address, and last reconciliation run details.
    """
    stats = get_reconciliation_statistics()
    return ReconciliationStatusResponse(
        total_activities=stats["total_activities"],
        confirmed_activities=stats["confirmed_activities"],
        unconfirmed_activities=stats["unconfirmed_activities"],
        total_transactions=stats["total_transactions"],
        contract_address=get_configured_contract_address() or None,
        rpc_url=TEZOS_RPC_URL,
        last_reconciliation=stats["last_reconciliation"],
    )


@router.post("/sync", response_model=ReconciliationSyncResponse)
def trigger_reconciliation(payload: Optional[ReconciliationSyncRequest] = None):
    """
    Triggers on-demand reconciliation between SQLite activity cache and Tezos SmartPy contract.
    Never treats SQLite cache as proof; authoritative on-chain state updates local records.
    """
    contract_addr = payload.contract_address if payload else None
    dry_run = payload.dry_run if payload else False

    result = reconcile_database_with_blockchain(
        contract_address=contract_addr,
        dry_run=dry_run,
    )

    return ReconciliationSyncResponse(
        status=result["status"],
        message=result["message"],
        timestamp=result["timestamp"],
        total_activities=result["total_activities"],
        synced_count=result["synced_count"],
        mismatched_count=result["mismatched_count"],
        updated_count=result["updated_count"],
        contract_address=result.get("contract_address"),
        discrepancies=result.get("discrepancies", []),
    )


@router.post("/recover", response_model=RecoveryResponse)
def recover_failed_update(payload: RecoveryRequest):
    """
    Safe Retries and Failure Recovery:
    Handles the case where a blockchain transaction confirmed successfully on Tezos,
    but the database update failed.

    Idempotently reconciles the database using the existing confirmed transaction and
    activity ID without submitting another blockchain transaction.
    """
    try:
        res = recover_activity_transaction(
            activity_id=payload.activity_id,
            tx_hash=payload.tx_hash,
            tx_type=payload.tx_type,
            wallet_address=payload.wallet_address,
            approver_address=payload.approver_address,
            rejection_reason=payload.rejection_reason,
        )
        return RecoveryResponse(
            success=res["success"],
            activity_id=res["activity_id"],
            tx_hash=res["tx_hash"],
            tx_verified_on_chain=res["tx_verified_on_chain"],
            activity=res["activity"],
            message=res["message"],
        )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to recover transaction: {str(exc)}",
        )


@router.post("/transactions", response_model=TransactionResponse, status_code=status.HTTP_201_CREATED)
def record_blockchain_transaction(payload: TransactionRecordRequest):
    """
    Explicitly registers or updates a Tezos transaction reference for an activity.
    Idempotent on transaction hash.
    """
    try:
        tx = record_transaction(
            activity_id=payload.activity_id,
            tx_hash=payload.tx_hash,
            tx_type=payload.tx_type,
            wallet_address=payload.wallet_address,
            confirmation_status=payload.confirmation_status,
            block_level=payload.block_level,
            error_message=payload.error_message,
        )
        return tx
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unable to record transaction: {str(exc)}",
        )


@router.get("/transactions/{tx_hash}", response_model=TransactionResponse)
def get_transaction_details(tx_hash: str):
    """
    Retrieves transaction metadata by hash.
    """
    tx = get_transaction_by_hash(tx_hash)
    if not tx:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Transaction with hash '{tx_hash}' not found.",
        )
    return tx
