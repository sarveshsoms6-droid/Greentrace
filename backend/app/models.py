"""
GreenTrace 2.0 - Pydantic Request & Response Data Models
"""

from typing import Optional, List
from pydantic import BaseModel, Field


class HealthResponse(BaseModel):
    status: str = "healthy"
    service: str = "GreenTrace 2.0 Backend"
    supported_network: str = "Shadownet (Tezos Testnet)"
    rpc: str = "https://rpc.shadownet.teztnets.com"


class EvidenceUploadResponse(BaseModel):
    evidence_hash: str = Field(..., description="64-character lowercase SHA-256 fingerprint")
    filename: str = Field(..., description="Sanitized original filename")
    file_size: int = Field(..., description="Size of file in bytes")
    mime_type: str = Field(..., description="Validated MIME type")
    is_duplicate: bool = Field(False, description="Whether identical evidence already exists")
    existing_activity_id: Optional[str] = Field(None, description="Existing activity ID if duplicate")
    message: str = Field(..., description="User-facing status message")


class DuplicateCheckResponse(BaseModel):
    is_duplicate: bool
    evidence_hash: str
    existing_activity_id: Optional[str] = None
    message: str


# =====================================================================
# GreenAI: AI-Powered Tree Detection Models
# =====================================================================

class TreeDetectionBox(BaseModel):
    id: str = Field(..., description="Unique detection ID for the bounding box")
    bbox: List[float] = Field(..., description="[x1, y1, x2, y2] pixel coordinates")
    confidence: float = Field(..., description="Detection confidence score between 0.0 and 1.0")
    class_name: str = Field(..., description="Detected class (e.g. tree, sapling)")


class TreeDetectionResponse(BaseModel):
    count: int = Field(..., description="Total estimated trees detected in photograph")
    detections: List[TreeDetectionBox] = Field(default_factory=list, description="List of detected tree bounding boxes")
    annotated_image_url: str = Field(..., description="Relative or absolute URL to view annotated image")
    annotated_image_base64: Optional[str] = Field(None, description="Base64 encoded preview of annotated image")
    model_name: str = Field(..., description="Name of computer vision detection model")
    model_version: str = Field(..., description="Model version or checkpoint identifier")
    average_confidence: float = Field(0.0, description="Average confidence score across all detections")
    processing_time_ms: float = Field(..., description="Inference time in milliseconds")
    discrepancy_notice: Optional[str] = Field(None, description="Caveat regarding obscured or clustered trees")


class ActivityCreate(BaseModel):
    activity_id: str = Field(..., min_length=3, max_length=100)
    submitter_address: str = Field(..., min_length=30, max_length=40)
    category: str
    quantity: float = Field(..., gt=0)
    unit: str
    description: Optional[str] = None
    evidence_hash: str = Field(..., min_length=64, max_length=64)
    submission_tx_hash: Optional[str] = None
    submitted_at: Optional[str] = None
    # GreenAI Tree Detection fields
    ai_detected_count: Optional[int] = None
    ai_confidence_score: Optional[float] = None
    ai_model_name: Optional[str] = None
    ai_model_version: Optional[str] = None
    ai_annotated_path: Optional[str] = None
    ai_detection_data: Optional[str] = None


class ActivityResponse(BaseModel):
    activity_id: str
    submitter_address: str
    category: str
    quantity: float
    unit: str
    description: Optional[str] = None
    evidence_hash: str
    evidence_path: Optional[str] = None
    status_cache: str
    submission_tx_hash: Optional[str] = None
    approval_tx_hash: Optional[str] = None
    rejection_tx_hash: Optional[str] = None
    approver_address: Optional[str] = None
    submitted_at: str
    approved_at: Optional[str] = None
    rejected_at: Optional[str] = None
    rejection_reason: Optional[str] = None
    blockchain_confirmed: Optional[int] = 0
    reconciled_at: Optional[str] = None
    # GreenAI Tree Detection fields
    ai_detected_count: Optional[int] = None
    ai_confidence_score: Optional[float] = None
    ai_model_name: Optional[str] = None
    ai_model_version: Optional[str] = None
    ai_annotated_path: Optional[str] = None
    ai_detection_data: Optional[str] = None


class DecisionRecordRequest(BaseModel):
    decision: str = Field(..., pattern="^(APPROVED|REJECTED)$")
    approver_address: str = Field(..., min_length=30, max_length=40)
    approval_tx_hash: Optional[str] = None
    rejection_reason: Optional[str] = None


class DecisionRecordResponse(BaseModel):
    activity_id: str
    status: str
    approver_address: str
    approval_tx_hash: Optional[str] = None
    approved_at: Optional[str] = None
    rejection_reason: Optional[str] = None
    message: str


class OrganizerCheckResponse(BaseModel):
    address: str
    is_organizer: bool
    message: str


# =====================================================================
# Phase 7: Models for Transactions, History, Reconciliation & Recovery
# =====================================================================

class TransactionRecordRequest(BaseModel):
    activity_id: str = Field(..., min_length=3, max_length=100)
    tx_hash: str = Field(..., min_length=10, max_length=100)
    tx_type: str = Field(..., pattern="^(SUBMISSION|APPROVAL|REJECTION)$")
    wallet_address: str = Field(..., min_length=30, max_length=40)
    confirmation_status: str = Field("CONFIRMED", pattern="^(PENDING|CONFIRMED|FAILED)$")
    block_level: Optional[int] = None
    error_message: Optional[str] = None


class TransactionResponse(BaseModel):
    id: int
    activity_id: str
    tx_hash: str
    tx_type: str
    wallet_address: str
    confirmation_status: str
    block_level: Optional[int] = None
    created_at: str
    confirmed_at: Optional[str] = None
    error_message: Optional[str] = None


class ActivityHistoryEvent(BaseModel):
    event_type: str
    timestamp: str
    actor_address: str
    tx_hash: Optional[str] = None
    status: str
    rejection_reason: Optional[str] = None
    description: str


class ActivityHistoryResponse(BaseModel):
    activity: ActivityResponse
    events: List[ActivityHistoryEvent]
    transactions: List[TransactionResponse]


class DiscrepancyItem(BaseModel):
    activity_id: str
    type: str
    local_status: Optional[str] = None
    on_chain_status: Optional[str] = None
    description: str


class ReconciliationStatusResponse(BaseModel):
    total_activities: int
    confirmed_activities: int
    unconfirmed_activities: int
    total_transactions: int
    contract_address: Optional[str] = None
    rpc_url: str
    last_reconciliation: Optional[dict] = None


class ReconciliationSyncRequest(BaseModel):
    contract_address: Optional[str] = None
    dry_run: bool = False


class ReconciliationSyncResponse(BaseModel):
    status: str
    message: str
    timestamp: str
    total_activities: int
    synced_count: int
    mismatched_count: int
    updated_count: int
    contract_address: Optional[str] = None
    discrepancies: List[dict]


class RecoveryRequest(BaseModel):
    activity_id: str = Field(..., min_length=3, max_length=100)
    tx_hash: str = Field(..., min_length=10, max_length=100)
    tx_type: str = Field("APPROVAL", pattern="^(SUBMISSION|APPROVAL|REJECTION)$")
    wallet_address: str = Field(..., min_length=30, max_length=40)
    approver_address: Optional[str] = None
    rejection_reason: Optional[str] = None


class RecoveryResponse(BaseModel):
    success: bool
    activity_id: str
    tx_hash: str
    tx_verified_on_chain: bool
    activity: ActivityResponse
    message: str


class CategoryImpact(BaseModel):
    category: str
    total_qty: float
    unit: str


class ActivityStatisticsResponse(BaseModel):
    total: int
    approved: int
    pending: int
    rejected: int
    impacts: List[CategoryImpact]


class PublicVerificationResponse(BaseModel):
    activity_id: str
    category: str
    quantity: float
    unit: str
    status: str
    status_label: str
    on_chain_status: Optional[str] = None
    on_chain_verified: bool
    network: str = "Shadownet (Tezos Testnet)"
    contract_address: Optional[str] = None
    submission_tx_hash: Optional[str] = None
    approval_tx_hash: Optional[str] = None
    approver_address: Optional[str] = None
    submitted_at: Optional[str] = None
    decided_at: Optional[str] = None
    evidence_hash: str
    disclaimer: str = (
        "Blockchain verification confirms that this activity record and its status were "
        "recorded by the GreenTrace smart contract. It does not independently prove that "
        "the physical activity occurred."
    )
    details: Optional[str] = None
