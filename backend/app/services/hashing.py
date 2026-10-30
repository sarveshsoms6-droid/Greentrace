"""
GreenTrace 2.0 - Server-Side SHA-256 Hashing Service
Calculates and verifies lowercase hexadecimal SHA-256 cryptographic fingerprints
from actual evidence bytes.

Note on Scope:
SHA-256 is an exact cryptographic hash of file bytes. It reliably detects identical
files. It does NOT detect resized, recompressed, re-encoded, or visually similar images.
"""

import hashlib
import re

SHA256_HEX_REGEX = re.compile(r"^[0-9a-f]{64}$")


def calculate_sha256(data: bytes) -> str:
    """Calculates the lowercase hexadecimal SHA-256 hash of raw bytes."""
    hasher = hashlib.sha256(data)
    return hasher.hexdigest().lower()


def is_valid_sha256(hex_str: str) -> bool:
    """Validates that a string is a 64-character lowercase hexadecimal SHA-256 hash."""
    if not isinstance(hex_str, str):
        return False
    return bool(SHA256_HEX_REGEX.match(hex_str.lower()))


def verify_hash(data: bytes, expected_hash: str) -> bool:
    """Verifies that the SHA-256 hash of data matches the expected lowercase hash."""
    if not is_valid_sha256(expected_hash):
        return False
    actual_hash = calculate_sha256(data)
    return actual_hash == expected_hash.lower()
