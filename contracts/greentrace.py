"""
GreenTrace 2.0 - Campus Sustainability Activity Verification Contract
Written in SmartPy (v0.24+ module syntax) for Tezos.

Key Specifications:
- Decentralized verification for student sustainability activities.
- Exactly two authenticated roles: STUDENT and ORGANIZER.
- Administrator authorizes/revokes organizer privileges.
- Prevents duplicate activity IDs and duplicate SHA-256 evidence fingerprints.
- Enforces self-approval prevention (organizers cannot approve their own submissions).
- Enforces strict state transitions: decisions only from SUBMITTED; decisions cannot be overwritten.
- Protects privacy: no photos, personal emails, or private notes stored on-chain.
"""

import smartpy as sp


@sp.module
def main():
    # Activity record data type definition
    activity_type: type = sp.record(
        activity_id=sp.string,
        evidence_hash=sp.string,
        category=sp.string,
        quantity=sp.nat,
        unit=sp.string,
        status=sp.string,
        submitter_address=sp.address,
        approver_address=sp.option[sp.address],
        submitted_at=sp.timestamp,
        approved_at=sp.option[sp.timestamp],
        superseding_id=sp.option[sp.string],
    )

    # Activity submission parameter type
    submit_params_type: type = sp.record(
        activity_id=sp.string,
        evidence_hash=sp.string,
        category=sp.string,
        quantity=sp.nat,
        unit=sp.string,
    )

    class GreenTrace(sp.Contract):
        def __init__(self, admin: sp.address, initial_organizers: sp.set[sp.address]):
            """
            Initializes the GreenTrace 2.0 contract.
            :param admin: Contract administrator with organizer management privileges.
            :param initial_organizers: Initial set of authorized organizer addresses.
            """
            self.data.administrator = admin
            self.data.organizers = initial_organizers
            self.data.activities = sp.cast(
                sp.big_map(), sp.big_map[sp.string, activity_type]
            )
            # Duplicate detection map: SHA-256 evidence_hash -> activity_id
            self.data.evidence_hashes = sp.cast(
                sp.big_map(), sp.big_map[sp.string, sp.string]
            )

        @sp.entrypoint
        def submit_activity(self, params: submit_params_type):
            """
            Allows a student to record an activity directly from their wallet.
            Enforces uniqueness of activity ID, SHA-256 hash, positive quantity,
            category validity, and category-to-unit pairing.
            """
            # Unique activity ID validation
            assert not self.data.activities.contains(
                params.activity_id
            ), "ACTIVITY_ID_ALREADY_EXISTS"

            # On-chain SHA-256 duplicate evidence fingerprint detection
            assert not self.data.evidence_hashes.contains(
                params.evidence_hash
            ), "DUPLICATE_EVIDENCE_HASH"

            # Quantity must be positive
            assert params.quantity > 0, "QUANTITY_MUST_BE_POSITIVE"

            # Category validation
            is_valid_category = (
                (params.category == "Recycling")
                | (params.category == "Tree planting")
                | (params.category == "Energy conservation")
                | (params.category == "Water conservation")
                | (params.category == "Waste collection")
                | (params.category == "Other")
            )
            assert is_valid_category, "INVALID_CATEGORY"

            # Category and unit pairing validation per Section 7
            if params.category == "Recycling":
                assert params.unit == "kg", "INVALID_UNIT_FOR_RECYCLING"
            elif params.category == "Tree planting":
                assert params.unit == "saplings", "INVALID_UNIT_FOR_TREE_PLANTING"
            elif params.category == "Energy conservation":
                assert (params.unit == "kWh") | (
                    params.unit == "Wh"
                ), "INVALID_UNIT_FOR_ENERGY"
            elif params.category == "Water conservation":
                assert params.unit == "litres", "INVALID_UNIT_FOR_WATER"
            elif params.category == "Waste collection":
                assert params.unit == "kg", "INVALID_UNIT_FOR_WASTE"
            else:
                # "Other" category must specify a non-empty unit
                assert sp.len(params.unit) > 0, "UNIT_REQUIRED_FOR_OTHER"

            # Create immutable activity record with SUBMITTED status
            self.data.activities[params.activity_id] = sp.record(
                activity_id=params.activity_id,
                evidence_hash=params.evidence_hash,
                category=params.category,
                quantity=params.quantity,
                unit=params.unit,
                status="SUBMITTED",
                submitter_address=sp.sender,
                approver_address=None,
                submitted_at=sp.now,
                approved_at=None,
                superseding_id=None,
            )

            # Record evidence hash mapping to prevent duplicate reuse
            self.data.evidence_hashes[params.evidence_hash] = params.activity_id

        @sp.entrypoint
        def approve_activity(self, activity_id: sp.string):
            """
            Approves a pending sustainability activity.
            Enforces:
            1. Caller is an authorized organizer.
            2. Activity exists and status is SUBMITTED.
            3. Self-approval prevention: organizer cannot approve their own submission.
            """
            assert self.data.organizers.contains(sp.sender), "NOT_AN_ORGANIZER"
            assert self.data.activities.contains(activity_id), "ACTIVITY_NOT_FOUND"

            record = self.data.activities[activity_id]
            assert record.status == "SUBMITTED", "ACTIVITY_NOT_PENDING"
            assert (
                sp.sender != record.submitter_address
            ), "SELF_APPROVAL_PREVENTION: CANNOT_APPROVE_OWN_ACTIVITY"

            # Apply state transition to APPROVED
            self.data.activities[activity_id].status = "APPROVED"
            self.data.activities[activity_id].approver_address = sp.Some(sp.sender)
            self.data.activities[activity_id].approved_at = sp.Some(sp.now)

        @sp.entrypoint
        def reject_activity(self, activity_id: sp.string):
            """
            Rejects a pending sustainability activity.
            Enforces:
            1. Caller is an authorized organizer.
            2. Activity exists and status is SUBMITTED.
            3. Organizer cannot decide on their own submission.
            """
            assert self.data.organizers.contains(sp.sender), "NOT_AN_ORGANIZER"
            assert self.data.activities.contains(activity_id), "ACTIVITY_NOT_FOUND"

            record = self.data.activities[activity_id]
            assert record.status == "SUBMITTED", "ACTIVITY_NOT_PENDING"
            assert (
                sp.sender != record.submitter_address
            ), "SELF_APPROVAL_PREVENTION: CANNOT_REJECT_OWN_ACTIVITY"

            # Apply state transition to REJECTED (cannot overwrite prior decision)
            self.data.activities[activity_id].status = "REJECTED"
            self.data.activities[activity_id].approver_address = sp.Some(sp.sender)
            self.data.activities[activity_id].approved_at = sp.Some(sp.now)

        @sp.entrypoint
        def add_organizer(self, organizer: sp.address):
            """
            Administrator-only: Grants organizer privileges to a Tezos wallet address.
            """
            assert sp.sender == self.data.administrator, "NOT_AN_ADMINISTRATOR"
            self.data.organizers.add(organizer)

        @sp.entrypoint
        def remove_organizer(self, organizer: sp.address):
            """
            Administrator-only: Revokes organizer privileges from a Tezos wallet address.
            """
            assert sp.sender == self.data.administrator, "NOT_AN_ADMINISTRATOR"
            assert self.data.organizers.contains(organizer), "ORGANIZER_NOT_FOUND"
            self.data.organizers.remove(organizer)

        # --- On-chain Views for DApps and QR Verifiers ---

        @sp.onchain_view
        def is_organizer(self, account: sp.address) -> sp.bool:
            """Checks whether an address is an authorized organizer."""
            return self.data.organizers.contains(account)

        @sp.onchain_view
        def get_activity(self, activity_id: sp.string) -> activity_type:
            """Queries a confirmed activity record by ID."""
            assert self.data.activities.contains(activity_id), "ACTIVITY_NOT_FOUND"
            return self.data.activities[activity_id]

        @sp.onchain_view
        def has_evidence_hash(self, hash: sp.string) -> sp.bool:
            """Checks if an evidence hash is already registered on-chain."""
            return self.data.evidence_hashes.contains(hash)
