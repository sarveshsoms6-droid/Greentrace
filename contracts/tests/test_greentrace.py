"""
SmartPy Contract Scenario Test Suite for GreenTrace 2.0
Covers all non-negotiable specifications:
1. Valid student submission
2. Input validation: positive quantity, valid category, compatible units
3. Duplicate prevention: unique activity ID and SHA-256 hash
4. Access control: unauthorized approval/rejection
5. Self-approval prevention: organizer cannot approve their own activity
6. State transitions: decisions only from SUBMITTED; repeated decisions fail
7. Administrator permissions: add/remove organizers
"""

import pytest

try:
    import smartpy as sp
    from contracts.greentrace import main
except Exception as e:
    pytest.skip(
        f"SmartPy native runtime is not supported on this platform ({e}). Use WSL, Docker, or contracts/tests/test_contract_logic.py.",
        allow_module_level=True,
    )


if "main" in __name__:
    admin = sp.test_account("admin")
    organizer1 = sp.test_account("organizer1")
    organizer2 = sp.test_account("organizer2")
    student1 = sp.test_account("student1")
    student2 = sp.test_account("student2")
    attacker = sp.test_account("attacker")

    @sp.add_test()
    def test_greentrace_full_lifecycle():
        scenario = sp.test_scenario("GreenTrace 2.0 Full Specification Test")
        scenario.h1("GreenTrace 2.0 - Core Contract Tests")

        # 1. Origination
        scenario.h2("1. Contract Origination")
        contract = main.GreenTrace(
            admin=admin.address,
            initial_organizers=sp.set([organizer1.address]),
        )
        scenario += contract

        # 2. Valid Student Submission
        scenario.h2("2. Valid Student Submission")
        contract.submit_activity(
            activity_id="act-2026-001",
            evidence_hash="e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
            category="Recycling",
            quantity=sp.nat(15),
            unit="kg",
            _sender=student1,
            _now=sp.timestamp(1700000000),
        )
        # Verify status is SUBMITTED
        scenario.verify(contract.data.activities["act-2026-001"].status == "SUBMITTED")
        scenario.verify(
            contract.data.activities["act-2026-001"].submitter_address
            == student1.address
        )

        # 3. Input Validation Failures
        scenario.h2("3. Input Validation Failures")
        # Zero quantity fails
        contract.submit_activity(
            activity_id="act-zero-qty",
            evidence_hash="hash_zero_qty",
            category="Recycling",
            quantity=sp.nat(0),
            unit="kg",
            _sender=student1,
            _valid=False,
            _exception="QUANTITY_MUST_BE_POSITIVE",
        )

        # Invalid category fails
        contract.submit_activity(
            activity_id="act-bad-cat",
            evidence_hash="hash_bad_cat",
            category="InvalidCategory",
            quantity=sp.nat(10),
            unit="kg",
            _sender=student1,
            _valid=False,
            _exception="INVALID_CATEGORY",
        )

        # Incompatible unit fails (e.g. litres for Recycling)
        contract.submit_activity(
            activity_id="act-bad-unit",
            evidence_hash="hash_bad_unit",
            category="Recycling",
            quantity=sp.nat(10),
            unit="litres",
            _sender=student1,
            _valid=False,
            _exception="INVALID_UNIT_FOR_RECYCLING",
        )

        # 4. Duplicate ID and SHA-256 Prevention
        scenario.h2("4. Duplicate Prevention")
        # Duplicate activity ID
        contract.submit_activity(
            activity_id="act-2026-001",
            evidence_hash="different_hash_1111",
            category="Recycling",
            quantity=sp.nat(5),
            unit="kg",
            _sender=student2,
            _valid=False,
            _exception="ACTIVITY_ID_ALREADY_EXISTS",
        )

        # Duplicate SHA-256 evidence fingerprint
        contract.submit_activity(
            activity_id="act-2026-duplicate-evidence",
            evidence_hash="e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
            category="Recycling",
            quantity=sp.nat(5),
            unit="kg",
            _sender=student2,
            _valid=False,
            _exception="DUPLICATE_EVIDENCE_HASH",
        )

        # 5. Access Control: Unauthorized Decisions Fail
        scenario.h2("5. Access Control")
        # Non-organizer attempts approval
        contract.approve_activity(
            "act-2026-001",
            _sender=attacker,
            _valid=False,
            _exception="NOT_AN_ORGANIZER",
        )

        # Non-organizer attempts rejection
        contract.reject_activity(
            "act-2026-001",
            _sender=attacker,
            _valid=False,
            _exception="NOT_AN_ORGANIZER",
        )

        # 6. Self-Approval Prevention
        scenario.h2("6. Self-Approval Prevention")
        # Organizer submits an activity as a student
        contract.submit_activity(
            activity_id="act-organizer-own",
            evidence_hash="hash_organizer_own_evidence",
            category="Tree planting",
            quantity=sp.nat(3),
            unit="saplings",
            _sender=organizer1,
            _now=sp.timestamp(1700000100),
        )

        # Organizer attempts to approve their own activity -> MUST FAIL
        contract.approve_activity(
            "act-organizer-own",
            _sender=organizer1,
            _valid=False,
            _exception="SELF_APPROVAL_PREVENTION: CANNOT_APPROVE_OWN_ACTIVITY",
        )

        # Organizer attempts to reject their own activity -> MUST FAIL
        contract.reject_activity(
            "act-organizer-own",
            _sender=organizer1,
            _valid=False,
            _exception="SELF_APPROVAL_PREVENTION: CANNOT_REJECT_OWN_ACTIVITY",
        )

        # 7. Valid Approval by Independent Organizer
        scenario.h2("7. Valid Approval")
        contract.approve_activity(
            "act-2026-001",
            _sender=organizer1,
            _now=sp.timestamp(1700000200),
        )
        scenario.verify(contract.data.activities["act-2026-001"].status == "APPROVED")
        scenario.verify(
            contract.data.activities["act-2026-001"].approver_address
            == sp.Some(organizer1.address)
        )

        # 8. Repeated Decisions Fail (Cannot overwrite APPROVED or REJECTED)
        scenario.h2("8. Repeated Decisions Fail")
        contract.approve_activity(
            "act-2026-001",
            _sender=organizer1,
            _valid=False,
            _exception="ACTIVITY_NOT_PENDING",
        )
        contract.reject_activity(
            "act-2026-001",
            _sender=organizer1,
            _valid=False,
            _exception="ACTIVITY_NOT_PENDING",
        )

        # 9. Administrator-Only Organizer Management
        scenario.h2("9. Organizer Management")
        # Non-admin cannot add organizer
        contract.add_organizer(
            organizer2.address,
            _sender=attacker,
            _valid=False,
            _exception="NOT_AN_ADMINISTRATOR",
        )

        # Admin adds organizer2
        contract.add_organizer(organizer2.address, _sender=admin)
        scenario.verify(contract.data.organizers.contains(organizer2.address))

        # Independent organizer2 can now approve organizer1's activity
        contract.approve_activity(
            "act-organizer-own",
            _sender=organizer2,
            _now=sp.timestamp(1700000300),
        )
        scenario.verify(
            contract.data.activities["act-organizer-own"].status == "APPROVED"
        )

        # Admin removes organizer1
        contract.remove_organizer(organizer1.address, _sender=admin)
        scenario.verify(not contract.data.organizers.contains(organizer1.address))
