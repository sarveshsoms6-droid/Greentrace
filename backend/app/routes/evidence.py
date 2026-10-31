"""
GreenTrace 2.0 - Protected Evidence Upload & Duplicate Detection Router
Enforces strict file type validation, magic byte content inspection, size limits,
path traversal protection, and private evidence shielding.
"""

import os
import re
from pathlib import Path
from typing import Optional, List

from fastapi import APIRouter, File, HTTPException, UploadFile, status, Header, Query
from fastapi.responses import FileResponse, JSONResponse

from ..database import (
    check_duplicate_hash,
    save_evidence,
    get_evidence_by_hash,
    is_authorized_organizer,
)
from ..models import DuplicateCheckResponse, EvidenceUploadResponse
from ..services.hashing import calculate_sha256, is_valid_sha256

router = APIRouter(prefix="/api/evidence", tags=["evidence"])

# Storage configuration
UPLOAD_DIR = os.getenv("UPLOAD_DIRECTORY", "./protected_evidence")
MAX_FILE_SIZE_BYTES = int(os.getenv("MAX_UPLOAD_SIZE_BYTES", str(10 * 1024 * 1024)))  # 10MB default

ALLOWED_MIME_TYPES = {
    "image/jpeg": [b"\xff\xd8\xff"],
    "image/png": [b"\x89PNG\r\n\x1a\n"],
    "image/webp": [b"RIFF"],  # RIFF....WEBP
}

ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp"}

# Ensure protected directory exists
Path(UPLOAD_DIR).mkdir(parents=True, exist_ok=True)


def sanitize_filename(filename: Optional[str]) -> str:
    """Sanitizes filename against path traversal and unwanted characters."""
    if not filename:
        return "evidence_image.jpg"
    base = os.path.basename(filename)
    clean = re.sub(r"[^a-zA-Z0-9_.-]", "_", base)
    return clean[:100] or "evidence_image.jpg"


def validate_image_content(content: bytes, declared_mime: str) -> str:
    """
    Validates magic bytes against allowed image formats to prevent
    executable or malicious content masquerading as images.
    """
    if len(content) == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Uploaded file is empty.",
        )

    # Check PNG magic bytes
    if content.startswith(b"\x89PNG\r\n\x1a\n"):
        return "image/png"

    # Check JPEG magic bytes
    if content.startswith(b"\xff\xd8\xff"):
        return "image/jpeg"

    # Check WebP magic bytes
    if content.startswith(b"RIFF") and len(content) > 12 and content[8:12] == b"WEBP":
        return "image/webp"

    raise HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail="Invalid file content. Evidence must be a valid PNG, JPEG, or WebP image.",
    )


def process_single_evidence_content(
    filename: Optional[str],
    declared_type: Optional[str],
    content: bytes,
) -> EvidenceUploadResponse:
    """Validates, fingerprints, stores, and records an individual photographic proof."""
    # 1. Enforce file size limit
    if len(content) > MAX_FILE_SIZE_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_CONTENT_TOO_LARGE,
            detail=f"File exceeds maximum allowed size of {MAX_FILE_SIZE_BYTES // (1024 * 1024)}MB.",
        )

    # 2. Enforce file extension and declared content type
    file_ext = Path(filename or "").suffix.lower()
    if file_ext and file_ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported file extension '{file_ext}'. Allowed extensions are: {', '.join(sorted(ALLOWED_EXTENSIONS))}.",
        )

    d_type = (declared_type or "").lower()
    if d_type not in ALLOWED_MIME_TYPES and not any(
        d_type.startswith(t) for t in ["image/jpeg", "image/png", "image/webp", "image/jpg"]
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Unsupported file type. Only JPEG, PNG, and WebP images are permitted.",
        )

    validated_mime = validate_image_content(content, d_type)

    # 3. Calculate server-side SHA-256 fingerprint from actual bytes
    evidence_hash = calculate_sha256(content)
    clean_name = sanitize_filename(filename)

    # 4. Check for duplicates against database
    is_dup, existing_activity_id = check_duplicate_hash(evidence_hash)

    # 5. Store file securely with hash-based filename in protected directory
    ext = ".jpg" if "jpeg" in validated_mime else ".png" if "png" in validated_mime else ".webp"
    safe_disk_filename = f"{evidence_hash}{ext}"
    destination_path = Path(UPLOAD_DIR) / safe_disk_filename

    # If new file, write to protected storage
    if not destination_path.exists():
        with open(destination_path, "wb") as f:
            f.write(content)

    # 6. Record metadata in database
    save_evidence(
        evidence_hash=evidence_hash,
        filename=clean_name,
        stored_path=str(destination_path),
        file_size=len(content),
        mime_type=validated_mime,
    )

    if is_dup:
        msg = (
            f"Duplicate evidence detected. This exact image fingerprint is already registered "
            f"on-chain (Activity: {existing_activity_id or 'pending upload'})."
        )
    else:
        msg = "Evidence verified and stored. SHA-256 fingerprint ready for wallet signature."

    return EvidenceUploadResponse(
        evidence_hash=evidence_hash,
        filename=clean_name,
        file_size=len(content),
        mime_type=validated_mime,
        is_duplicate=is_dup,
        existing_activity_id=existing_activity_id,
        message=msg,
    )


@router.post("", response_model=EvidenceUploadResponse, status_code=status.HTTP_201_CREATED)
async def upload_evidence(file: UploadFile = File(...)):
    """
    Uploads and fingerprints photographic evidence.
    Calculates server-side SHA-256 hash from exact bytes, detects duplicates,
    and stores the file in protected off-chain storage.
    """
    content = await file.read()
    return process_single_evidence_content(file.filename, file.content_type, content)


@router.post("/batch", response_model=List[EvidenceUploadResponse], status_code=status.HTTP_201_CREATED)
async def upload_evidence_batch(files: List[UploadFile] = File(...)):
    """
    Batch uploads up to 25 photographic evidence files.
    Validates each file, computes SHA-256 fingerprint, checks duplicates,
    and stores each in protected evidence storage.
    """
    if len(files) == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No files provided in batch upload.",
        )
    if len(files) > 25:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Exceeded maximum batch limit of 25 files. Received {len(files)} files.",
        )

    results = []
    for f in files:
        content = await f.read()
        res = process_single_evidence_content(f.filename, f.content_type, content)
        results.append(res)
    return results


@router.get("/{evidence_hash}/duplicate-check", response_model=DuplicateCheckResponse)
def duplicate_check(evidence_hash: str):
    """
    Checks whether a specific SHA-256 evidence fingerprint already exists.
    Returns duplicate status and associated activity reference if present.
    """
    if not is_valid_sha256(evidence_hash):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid evidence hash format. Must be a 64-character lowercase hex string.",
        )

    is_dup, existing_activity_id = check_duplicate_hash(evidence_hash)

    if is_dup:
        msg = f"Duplicate evidence found matching existing record {existing_activity_id or 'in storage'}."
    else:
        msg = "Fingerprint is unique. No prior submission matches this evidence hash."

    return DuplicateCheckResponse(
        is_duplicate=is_dup,
        evidence_hash=evidence_hash.lower(),
        existing_activity_id=existing_activity_id,
        message=msg,
    )


@router.get("/{evidence_hash}/file")
def get_protected_evidence_file(
    evidence_hash: str,
    x_organizer_address: Optional[str] = Header(None, alias="X-Organizer-Address"),
    organizer_address: Optional[str] = Query(None, alias="organizer_address"),
):
    """
    Protected evidence file endpoint.
    Public access to raw photographic evidence is strictly restricted.
    Access is granted exclusively to authorized organizers.
    Public QR verification routes MUST NOT expose private student photos.
    """
    requester = x_organizer_address or organizer_address
    if not is_authorized_organizer(requester):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied: Raw student photographic evidence is restricted to authorized organizers.",
        )

    record = get_evidence_by_hash(evidence_hash)
    if not record or not record.get("stored_path"):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Evidence file not found in storage.",
        )

    file_path = Path(record["stored_path"])
    if not file_path.exists():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Stored evidence file is missing from disk.",
        )

    return FileResponse(
        path=str(file_path),
        media_type=record.get("mime_type", "application/octet-stream"),
        filename=record.get("filename", "evidence.jpg"),
    )
