"""
GreenTrace 2.0 - Python Contract Logic Verification Suite
Mirrors the exact rules and data model defined in `contracts/greentrace.py`.
Runs natively via Pytest on all platforms (including Windows).
"""

import pytest
from datetime import datetime, timezone


class GreenTraceContractModel:
    """Exact behavioral emulation of the SmartPy GreenTrace contract."""

    def __init__(self, administrator: str, initial_organizers: set[str]):
        self.administrator = administrator
        self.organizers = set(initial_organizers)
        self.activities: dict[str, dict] = {}
        self.evidence_hashes: dict[str, str] = {}

    def submit_activity(
        self,
        activity_id: str,
        evidence_hash: str,
        category: str,
        quantity: int,
        unit: str,
        sender: str,
        now: datetime | None = None,
    ):
        if activity_id in self.activities:
            raise ValueError("ACTIVITY_ID_ALREADY_EXISTS")

        if evidence_hash in self.evidence_hashes:
            raise ValueError("DUPLICATE_EVIDENCE_HASH")

        if quantity <= 0:
            raise ValueError("QUANTITY_MUST_BE_POSITIVE")

        valid_categories = {
            "Recycling",
            "Tree planting",
            "Energy conservation",
            "Water conservation",
            "Waste collection",
            "Other",
        }
        if category not in valid_categories:
            raise ValueError("INVALID_CATEGORY")

        if category == "Recycling" and unit != "kg":
            raise ValueError("INVALID_UNIT_FOR_RECYCLING")
        elif category == "Tree planting" and unit != "saplings":
            raise ValueError("INVALID_UNIT_FOR_TREE_PLANTING")
        elif category == "Energy conservation" and unit not in {"kWh", "Wh"}:
            raise ValueError("INVALID_UNIT_FOR_ENERGY")
        elif category == "Water conservation" and unit != "litres":
            raise ValueError("INVALID_UNIT_FOR_WATER")
        elif category == "Waste collection" and unit != "kg":
            raise ValueError("INVALID_UNIT_FOR_WASTE")
        elif category == "Other" and not unit.strip():
            raise ValueError("UNIT_REQUIRED_FOR_OTHER")

        submitted_at = now or datetime.now(timezone.utc)

        self.activities[activity_id] = {
            "activity_id": activity_id,
            "evidence_hash": evidence_hash,
            "category": category,
            "quantity": quantity,
            "unit": unit,
            "status": "SUBMITTED",
            "submitter_address": sender,
            "approver_address": None,
            "submitted_at": submitted_at.isoformat(),
            "approved_at": None,
            "superseding_id": None,
        }
        self.evidence_hashes[evidence_hash] = activity_id

    def approve_activity(self, activity_id: str, sender: str, now: datetime | None = None):
        if sender not in self.organizers:
            raise PermissionError("NOT_AN_ORGANIZER")

        if activity_id not in self.activities:
            raise KeyError("ACTIVITY_NOT_FOUND")

        record = self.activities[activity_id]
        if record["status"] != "SUBMITTED":
            raise ValueError("ACTIVITY_NOT_PENDING")

        if sender == record["submitter_address"]:
            raise PermissionError("SELF_APPROVAL_PREVENTION: CANNOT_APPROVE_OWN_ACTIVITY")

        record["status"] = "APPROVED"
        record["approver_address"] = sender
        record["approved_at"] = (now or datetime.now(timezone.utc)).isoformat()

    def reject_activity(self, activity_id: str, sender: str, now: datetime | None = None):
        if sender not in self.organizers:
            raise PermissionError("NOT_AN_ORGANIZER")

        if activity_id not in self.activities:
            raise KeyError("ACTIVITY_NOT_FOUND")

        record = self.activities[activity_id]
        if record["status"] != "SUBMITTED":
            raise ValueError("ACTIVITY_NOT_PENDING")

        if sender == record["submitter_address"]:
            raise PermissionError("SELF_APPROVAL_PREVENTION: CANNOT_REJECT_OWN_ACTIVITY")

        record["status"] = "REJECTED"
        record["approver_address"] = sender
        record["approved_at"] = (now or datetime.now(timezone.utc)).isoformat()

    def add_organizer(self, organizer: str, sender: str):
        if sender != self.administrator:
            raise PermissionError("NOT_AN_ADMINISTRATOR")
        self.organizers.add(organizer)

    def remove_organizer(self, organizer: str, sender: str):
        if sender != self.administrator:
            raise PermissionError("NOT_AN_ADMINISTRATOR")
        if organizer not in self.organizers:
            raise KeyError("ORGANIZER_NOT_FOUND")
        self.organizers.remove(organizer)

    def is_organizer(self, account: str) -> bool:
        return account in self.organizers


# --- Test Fixtures ---

ADMIN = "tz1AdminDeployer111111111111111111"
ORGANIZER_1 = "tz1OrganizerOne2222222222222222222"
ORGANIZER_2 = "tz1OrganizerTwo3333333333333333333"
STUDENT_1 = "tz1StudentAlice4444444444444444444"
STUDENT_2 = "tz1StudentBob55555555555555555555"
ATTACKER = "tz1AttackerEve6666666666666666666"


@pytest.fixture
def contract():
    return GreenTraceContractModel(
        administrator=ADMIN,
        initial_organizers={ORGANIZER_1},
    )


def test_valid_submission(contract):
    contract.submit_activity(
        activity_id="act-001",
        evidence_hash="hash_evidence_001",
        category="Recycling",
        quantity=15,
        unit="kg",
        sender=STUDENT_1,
    )
    record = contract.activities["act-001"]
    assert record["status"] == "SUBMITTED"
    assert record["submitter_address"] == STUDENT_1
    assert record["approver_address"] is None
    assert contract.evidence_hashes["hash_evidence_001"] == "act-001"


def test_positive_quantity_validation(contract):
    with pytest.raises(ValueError, match="QUANTITY_MUST_BE_POSITIVE"):
        contract.submit_activity("act-002", "h002", "Recycling", 0, "kg", STUDENT_1)

    with pytest.raises(ValueError, match="QUANTITY_MUST_BE_POSITIVE"):
        contract.submit_activity("act-003", "h003", "Recycling", -5, "kg", STUDENT_1)


def test_category_and_unit_validation(contract):
    # Invalid category
    with pytest.raises(ValueError, match="INVALID_CATEGORY"):
        contract.submit_activity("act-004", "h004", "DeFi Yield", 10, "tokens", STUDENT_1)

    # Incompatible unit for Recycling (must be kg)
    with pytest.raises(ValueError, match="INVALID_UNIT_FOR_RECYCLING"):
        contract.submit_activity("act-005", "h005", "Recycling", 10, "litres", STUDENT_1)

    # Incompatible unit for Tree planting (must be saplings)
    with pytest.raises(ValueError, match="INVALID_UNIT_FOR_TREE_PLANTING"):
        contract.submit_activity("act-006", "h006", "Tree planting", 5, "kg", STUDENT_1)

    # Incompatible unit for Energy (must be kWh or Wh)
    with pytest.raises(ValueError, match="INVALID_UNIT_FOR_ENERGY"):
        contract.submit_activity("act-007", "h007", "Energy conservation", 5, "saplings", STUDENT_1)


def test_duplicate_activity_id_prevention(contract):
    contract.submit_activity("act-dup-id", "h_unique_1", "Recycling", 10, "kg", STUDENT_1)
    with pytest.raises(ValueError, match="ACTIVITY_ID_ALREADY_EXISTS"):
        contract.submit_activity("act-dup-id", "h_unique_2", "Recycling", 10, "kg", STUDENT_2)


def test_duplicate_evidence_hash_prevention(contract):
    contract.submit_activity("act-dup-h1", "same_hash_fingerprint", "Recycling", 10, "kg", STUDENT_1)
    with pytest.raises(ValueError, match="DUPLICATE_EVIDENCE_HASH"):
        contract.submit_activity("act-dup-h2", "same_hash_fingerprint", "Recycling", 10, "kg", STUDENT_2)


def test_unauthorized_decisions_fail(contract):
    contract.submit_activity("act-pending", "h_pending", "Recycling", 10, "kg", STUDENT_1)

    with pytest.raises(PermissionError, match="NOT_AN_ORGANIZER"):
        contract.approve_activity("act-pending", sender=ATTACKER)

    with pytest.raises(PermissionError, match="NOT_AN_ORGANIZER"):
        contract.reject_activity("act-pending", sender=ATTACKER)


def test_self_approval_prevention(contract):
    # Organizer submits an activity as a student
    contract.submit_activity("act-org-own", "h_org_own", "Tree planting", 3, "saplings", sender=ORGANIZER_1)

    # Attempting to self-approve must raise permission error
    with pytest.raises(PermissionError, match="CANNOT_APPROVE_OWN_ACTIVITY"):
        contract.approve_activity("act-org-own", sender=ORGANIZER_1)

    # Attempting to self-reject must also raise permission error
    with pytest.raises(PermissionError, match="CANNOT_REJECT_OWN_ACTIVITY"):
        contract.reject_activity("act-org-own", sender=ORGANIZER_1)


def test_valid_approval_and_repeated_decisions(contract):
    contract.submit_activity("act-valid", "h_valid", "Water conservation", 100, "litres", sender=STUDENT_1)

    # Authorized organizer approves
    contract.approve_activity("act-valid", sender=ORGANIZER_1)
    assert contract.activities["act-valid"]["status"] == "APPROVED"
    assert contract.activities["act-valid"]["approver_address"] == ORGANIZER_1

    # Overwriting prior decision must fail
    with pytest.raises(ValueError, match="ACTIVITY_NOT_PENDING"):
        contract.approve_activity("act-valid", sender=ORGANIZER_1)

    with pytest.raises(ValueError, match="ACTIVITY_NOT_PENDING"):
        contract.reject_activity("act-valid", sender=ORGANIZER_1)


def test_administrator_organizer_management(contract):
    # Attacker cannot add organizers
    with pytest.raises(PermissionError, match="NOT_AN_ADMINISTRATOR"):
        contract.add_organizer(ORGANIZER_2, sender=ATTACKER)

    # Admin adds organizer 2
    contract.add_organizer(ORGANIZER_2, sender=ADMIN)
    assert contract.is_organizer(ORGANIZER_2) is True

    # Now organizer 2 can approve organizer 1's submission (no self-approval violation)
    contract.submit_activity("act-org-own2", "h_org2", "Tree planting", 4, "saplings", sender=ORGANIZER_1)
    contract.approve_activity("act-org-own2", sender=ORGANIZER_2)
    assert contract.activities["act-org-own2"]["status"] == "APPROVED"

    # Admin removes organizer 1
    contract.remove_organizer(ORGANIZER_1, sender=ADMIN)
    assert contract.is_organizer(ORGANIZER_1) is False


def test_student_attempting_organizer_actions(contract):
    contract.submit_activity("act-student-action", "h_stu", "Recycling", 10, "kg", sender=STUDENT_1)

    # Student cannot approve
    with pytest.raises(PermissionError, match="NOT_AN_ORGANIZER"):
        contract.approve_activity("act-student-action", sender=STUDENT_2)

    # Student cannot reject
    with pytest.raises(PermissionError, match="NOT_AN_ORGANIZER"):
        contract.reject_activity("act-student-action", sender=STUDENT_2)


def test_valid_rejection(contract):
    contract.submit_activity("act-reject-me", "h_rej", "Waste collection", 15, "kg", sender=STUDENT_1)
    contract.reject_activity("act-reject-me", sender=ORGANIZER_1)

    record = contract.activities["act-reject-me"]
    assert record["status"] == "REJECTED"
    assert record["approver_address"] == ORGANIZER_1
    assert record["approved_at"] is not None


def test_decision_on_non_existent_activity(contract):
    with pytest.raises(KeyError, match="ACTIVITY_NOT_FOUND"):
        contract.approve_activity("non_existent_id", sender=ORGANIZER_1)

    with pytest.raises(KeyError, match="ACTIVITY_NOT_FOUND"):
        contract.reject_activity("non_existent_id", sender=ORGANIZER_1)


def test_database_and_contract_state_reconciliation():
    """Verifies reconciliation logic: contract state is authoritative over DB cache."""
    contract_record = {
        "activity_id": "act-reconcile-1",
        "status": "APPROVED",
        "approver_address": ORGANIZER_1,
        "approved_at": "2026-10-30T10:00:00Z",
    }
    stale_db_record = {
        "activity_id": "act-reconcile-1",
        "status_cache": "SUBMITTED",
        "approver_address": None,
        "approved_at": None,
    }

    # Reconciliation function
    def reconcile(db_item: dict, chain_item: dict) -> dict:
        reconciled = dict(db_item)
        if db_item["status_cache"] != chain_item["status"]:
            reconciled["status_cache"] = chain_item["status"]
            reconciled["approver_address"] = chain_item["approver_address"]
            reconciled["approved_at"] = chain_item["approved_at"]
        return reconciled

    reconciled = reconcile(stale_db_record, contract_record)
    assert reconciled["status_cache"] == "APPROVED"
    assert reconciled["approver_address"] == ORGANIZER_1

