"""
GreenTrace 2.0 - GreenAI Tree Detection Router
Provides AI inference endpoints for tree and sapling detection on student activity photographs.
"""

import os
from fastapi import APIRouter, UploadFile, File, HTTPException, status
from fastapi.responses import FileResponse

from ..models import TreeDetectionResponse
from ..services.tree_detector import (
    get_tree_detector,
    ANNOTATED_UPLOADS_DIR,
    MAX_IMAGE_SIZE_BYTES,
)

router = APIRouter(prefix="/api", tags=["ai"])


@router.post("/ai/detect-trees", response_model=TreeDetectionResponse)
async def detect_trees_in_photograph(file: UploadFile = File(...)):
    """
    Analyzes an uploaded photograph using the GreenAI YOLO-World tree detector.
    Returns detected tree bounding boxes, confidence scores, and an annotated photograph.
    """
    if not file.filename:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No filename provided for uploaded image.",
        )

    # Read image contents
    contents = await file.read()
    if not contents:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Uploaded file is empty.",
        )

    if len(contents) > MAX_IMAGE_SIZE_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_CONTENT_TOO_LARGE,
            detail=f"Image size exceeds 10MB limit ({len(contents) / (1024*1024):.1f}MB).",
        )

    try:
        detector = get_tree_detector()
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Model initialization error: {exc}",
        )

    try:
        detection_result = detector.detect(contents, filename=file.filename)
        return TreeDetectionResponse(
            count=detection_result["count"],
            detections=detection_result["detections"],
            annotated_image_url=detection_result["annotated_image_url"],
            annotated_image_base64=detection_result.get("annotated_image_base64"),
            model_name=detection_result["model_name"],
            model_version=detection_result["model_version"],
            average_confidence=detection_result["average_confidence"],
            processing_time_ms=detection_result["processing_time_ms"],
            discrepancy_notice=detection_result.get("discrepancy_notice"),
        )
    except ValueError as val_err:
        err_msg = str(val_err)
        status_code = status.HTTP_415_UNSUPPORTED_MEDIA_TYPE if "Unsupported image format" in err_msg else status.HTTP_400_BAD_REQUEST
        raise HTTPException(
            status_code=status_code,
            detail=err_msg,
        )
    except RuntimeError as run_err:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=str(run_err),
        )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"An unexpected error occurred during tree detection: {exc}",
        )


@router.get("/evidence/annotated/{filename}")
def get_annotated_evidence_file(filename: str):
    """
    Serves the annotated evidence photograph containing bounding boxes around detected trees.
    """
    # Sanitize filename to prevent directory traversal
    safe_filename = os.path.basename(filename)
    file_path = os.path.join(ANNOTATED_UPLOADS_DIR, safe_filename)

    if not os.path.exists(file_path):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Annotated evidence photograph '{safe_filename}' not found.",
        )

    return FileResponse(file_path, media_type="image/jpeg")
