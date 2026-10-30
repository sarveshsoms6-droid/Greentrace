"""
GreenTrace 2.0 - GreenAI: Smart Tree Detection Service
Uses Ultralytics YOLO-World open-vocabulary object detection model
configured specifically for tree and sapling recognition.
"""

import os
import io
import time
import base64
import uuid
from typing import List, Tuple, Optional
from abc import ABC, abstractmethod
from PIL import Image

try:
    from ultralytics import YOLO
    ULTRALYTICS_AVAILABLE = True
except ImportError:
    ULTRALYTICS_AVAILABLE = False


MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024  # 10MB
SUPPORTED_IMAGE_FORMATS = {"JPEG", "JPG", "PNG", "WEBP"}

_UPLOAD_BASE = os.getenv("UPLOAD_DIRECTORY", os.path.join(os.path.dirname(__file__), "..", "..", "uploads"))
ANNOTATED_UPLOADS_DIR = os.getenv(
    "ANNOTATED_UPLOADS_DIR",
    os.path.abspath(os.path.join(_UPLOAD_BASE, "annotated"))
)
os.makedirs(ANNOTATED_UPLOADS_DIR, exist_ok=True)


def resolve_yolo_model_path(custom_path: Optional[str] = None) -> str:
    """Finds the YOLO model weights file across candidate locations."""
    env_path = os.getenv("MODEL_PATH") or os.getenv("YOLO_MODEL_PATH")
    if env_path and os.path.exists(env_path):
        return os.path.abspath(env_path)

    if custom_path and os.path.exists(custom_path):
        return os.path.abspath(custom_path)

    target_name = custom_path or "yolov8s-worldv2.pt"
    candidates = [
        target_name,
        os.path.join(os.path.dirname(__file__), "..", "..", target_name),
        os.path.join(os.path.dirname(__file__), "..", "..", "..", target_name),
        os.path.join(os.path.dirname(__file__), "..", "..", "weights", target_name),
        os.path.join(os.path.dirname(__file__), "..", "..", "..", "weights", target_name),
    ]
    for cand in candidates:
        if os.path.exists(cand):
            return os.path.abspath(cand)

    return target_name


class BaseTreeDetector(ABC):
    """Abstract interface to ensure model replaceability."""

    @abstractmethod
    def detect(self, image_bytes: bytes, filename: str) -> dict:
        """Runs detection and returns structured tree detection results."""
        pass


class YOLOWorldTreeDetector(BaseTreeDetector):
    """
    Production-grade open-vocabulary tree detector utilizing YOLO-World.
    Genuinely detects trees and saplings using vision-language embeddings.
    """

    def __init__(
        self,
        model_path: Optional[str] = None,
        confidence_threshold: float = 0.20,
    ):
        self.model_path = resolve_yolo_model_path(model_path)
        self.confidence_threshold = confidence_threshold
        self.model_name = "YOLO-World v8s (Open-Vocabulary Tree Detector)"
        self.model_version = "8.4.193 / yolov8s-worldv2.pt"
        self._model = None
        self._load_error = None

        if not ULTRALYTICS_AVAILABLE:
            self._load_error = "Ultralytics YOLO library is not installed in the python environment."
            return

        try:
            self._model = YOLO(self.model_path)
            # Set target open-vocabulary categories strictly to trees and saplings
            self._model.set_classes(["tree", "sapling"])
        except Exception as exc:
            self._load_error = f"Failed to initialize YOLO-World tree detection weights: {exc}"

    def validate_image(self, image_bytes: bytes) -> Image.Image:
        """Validates image size, format, and decodability."""
        if not image_bytes:
            raise ValueError("Uploaded image file is empty (0 bytes).")

        if len(image_bytes) > MAX_IMAGE_SIZE_BYTES:
            raise ValueError(
                f"Image file size ({len(image_bytes) / (1024*1024):.1f}MB) exceeds 10MB maximum limit."
            )

        try:
            img = Image.open(io.BytesIO(image_bytes))
            img.verify()  # Verify integrity
        except Exception:
            raise ValueError("Uploaded file is corrupted or not a valid readable image.")

        # Reopen for processing after verify()
        img = Image.open(io.BytesIO(image_bytes))
        fmt = (img.format or "").upper()
        if fmt not in SUPPORTED_IMAGE_FORMATS and fmt != "JPG":
            raise ValueError(
                f"Unsupported image format '{fmt}'. Only JPEG, PNG, and WebP are supported."
            )

        return img

    def detect(self, image_bytes: bytes, filename: str = "image.jpg") -> dict:
        """
        Executes tree detection inference on image bytes.
        Returns total count, individual bounding boxes, confidence scores,
        annotated photograph, and metadata.
        """
        if self._load_error:
            raise RuntimeError(f"AI Service Unavailable: {self._load_error}")

        if self._model is None:
            raise RuntimeError("AI Service Unavailable: Tree detector model is not initialized.")

        # 1. Validate image
        img = self.validate_image(image_bytes)

        start_time = time.perf_counter()

        # 2. Convert to RGB if needed (e.g. RGBA or Grayscale)
        if img.mode != "RGB":
            img = img.convert("RGB")

        # 3. Run YOLO-World inference
        try:
            results = self._model.predict(
                source=img,
                conf=self.confidence_threshold,
                verbose=False,
            )
        except Exception as exc:
            raise RuntimeError(f"Inference execution failed on image: {exc}")

        processing_time_ms = round((time.perf_counter() - start_time) * 1000, 2)

        result = results[0]
        boxes = result.boxes

        detections = []
        confidences = []

        if boxes is not None and len(boxes) > 0:
            for i, box in enumerate(boxes):
                coords = box.xyxy[0].tolist()  # [x1, y1, x2, y2]
                conf = float(box.conf[0].item())
                cls_idx = int(box.cls[0].item())
                class_name = result.names.get(cls_idx, "tree")

                detections.append({
                    "id": f"tree-{i + 1}",
                    "bbox": [round(c, 2) for c in coords],
                    "confidence": round(conf, 4),
                    "class_name": class_name,
                })
                confidences.append(conf)

        total_detected = len(detections)
        avg_confidence = (
            round(sum(confidences) / total_detected, 4) if total_detected > 0 else 0.0
        )

        # 4. Generate annotated image with bounding boxes
        os.makedirs(ANNOTATED_UPLOADS_DIR, exist_ok=True)
        annotated_filename = f"annotated_{uuid.uuid4().hex[:12]}.jpg"
        annotated_path = os.path.join(ANNOTATED_UPLOADS_DIR, annotated_filename)

        # result.plot() returns BGR numpy array
        annotated_array = result.plot()
        annotated_pil = Image.fromarray(annotated_array[..., ::-1])  # BGR to RGB
        annotated_pil.save(annotated_path, format="JPEG", quality=90)

        # Generate base64 string for immediate preview in UI
        buffered = io.BytesIO()
        annotated_pil.save(buffered, format="JPEG", quality=85)
        base64_img = base64.b64encode(buffered.getvalue()).decode("utf-8")
        annotated_base64 = f"data:image/jpeg;base64,{base64_img}"

        discrepancy_notice = None
        if total_detected > 0:
            discrepancy_notice = (
                "Notice: GreenAI estimates tree count based on visible foliage and structure. "
                "Trees that overlap, are heavily clustered, or partially obscured may require manual confirmation by campus organizers."
            )
        else:
            discrepancy_notice = (
                "No trees or saplings were detected with sufficient confidence in this photograph. "
                "Ensure trees are clearly visible, well-lit, and not obstructed, or confirm count manually."
            )

        return {
            "count": total_detected,
            "detections": detections,
            "annotated_image_url": f"/api/evidence/annotated/{annotated_filename}",
            "annotated_image_base64": annotated_base64,
            "annotated_filename": annotated_filename,
            "model_name": self.model_name,
            "model_version": self.model_version,
            "average_confidence": avg_confidence,
            "processing_time_ms": processing_time_ms,
            "discrepancy_notice": discrepancy_notice,
        }


# Singleton instance
_tree_detector: Optional[BaseTreeDetector] = None


def get_tree_detector() -> BaseTreeDetector:
    """Provides a singleton instance of the tree detector service."""
    global _tree_detector
    if _tree_detector is None:
        _tree_detector = YOLOWorldTreeDetector()
    return _tree_detector
