# GreenTrace 2.0 Smart Contracts

This directory contains the smart contract implementation, automated tests, and deployment preparation for the GreenTrace 2.0 campus sustainability verification protocol.

---

## 1. Files & Responsibilities

- `greentrace.py`: The official SmartPy contract implementing:
  - Role-based permissions (`ADMINISTRATOR`, `ORGANIZER`, `STUDENT`)
  - Entrypoint `submit_activity`: student activity submission with on-chain SHA-256 duplicate detection, category/unit pairing validation, and positive quantity enforcement.
  - Entrypoint `approve_activity`: organizer approval with strict self-approval prevention and valid state transition checks.
  - Entrypoint `reject_activity`: organizer rejection without overwriting prior decisions.
  - Entrypoints `add_organizer` / `remove_organizer`: administrator-only organizer management.
  - On-chain views: `is_organizer`, `get_activity`, `has_evidence_hash`.
- `tests/test_greentrace.py`: The official SmartPy scenario test suite (`@sp.add_test()`) testing all permission boundaries, invalid inputs, duplicate IDs/hashes, repeated decisions, and self-approval prevention.
- `tests/test_contract_logic.py`: Pytest contract logic test suite that verifies the identical data model and rules natively.

---

## 2. On-Chain Data Model

### Record Structure (`activity_type`)
```python
{
    "activity_id": sp.string,           # Unique activity ID (e.g. "act-2026-001")
    "evidence_hash": sp.string,         # Lowercase 64-char SHA-256 evidence fingerprint
    "category": sp.string,              # Recycling, Tree planting, Energy conservation, etc.
    "quantity": sp.nat,                 # Positive quantity > 0
    "unit": sp.string,                  # Compatible unit (kg, saplings, kWh, Wh, litres)
    "status": sp.string,                # SUBMITTED, APPROVED, or REJECTED
    "submitter_address": sp.address,    # Tezos address derived from sp.sender
    "approver_address": sp.option[sp.address],  # Set when approved or rejected
    "submitted_at": sp.timestamp,       # Contract timestamp from sp.now
    "approved_at": sp.option[sp.timestamp],     # Timestamp when decision was confirmed
    "superseding_id": sp.option[sp.string]      # Optional superseding-record reference
}
```

### Storage
- `administrator`: `sp.address` — Contract deployer who controls organizer authorizations.
- `organizers`: `sp.set[sp.address]` — Set of authorized organizer addresses.
- `activities`: `sp.big_map[sp.string, activity_type]` — Primary storage of activities keyed by `activity_id`.
- `evidence_hashes`: `sp.big_map[sp.string, sp.string]` — Secondary index mapping `evidence_hash -> activity_id` to enforce exact duplicate prevention on-chain.

---

## 3. Platform Compilation & Test Execution Notice

`smartpy-tezos 0.24.2` bundles pre-compiled OCaml ELF binaries (`smartpy-oasis-linux.exe` and `smartpy-canopy-linux.exe`) built exclusively for Linux x86_64 and Darwin/macOS. When executing native SmartPy on Windows (`Windows-AMD64`), the runtime raises:
```
Exception: Platform Windows-AMD64 not supported.
```

### Supported Execution Paths for SmartPy Compilation & Tests:
1. **Docker (Recommended for CI & Windows)**:
   ```bash
   docker run --rm -v $(pwd):/workspace -w /workspace smartpy/smartpy-cli:latest test contracts/tests/test_greentrace.py
   ```
2. **Windows Subsystem for Linux (WSL2)**:
   ```bash
   wsl -d Ubuntu
   python3 -m pip install smartpy-tezos
   python3 contracts/tests/test_greentrace.py
   ```
3. **SmartPy Web IDE**:
   - Open [SmartPy Web IDE](https://smartpy.io/ide).
   - Paste `contracts/greentrace.py` and `contracts/tests/test_greentrace.py`.
   - Click **Run Scenario** to view interactive execution traces and compile to Michelson `.tz`.

### Local Automated Test Suite (Windows Compatible):
To test the contract rules, self-approval prevention, input validation, and state machine transitions locally on Windows without requiring Linux binaries:
```powershell
.\backend\.venv\Scripts\pytest.exe .\contracts\tests\test_contract_logic.py
```

---

## 4. Tezos Shadownet Deployment Preparation

- **Verified Testnet**: **Tezos Shadownet** (RPC: `https://rpc.shadownet.teztnets.com`)
- **Block Explorer**: `https://shadownet.tzkt.io`
- **Faucet**: `https://teztnets.com/shadownet-about`

### Deployment Steps:
1. Obtain testnet ꜩ for the deployer wallet from the Shadownet faucet.
2. Compile `greentrace.py` to Michelson using SmartPy CLI or the SmartPy Web IDE.
3. Originate the contract using Taquito or Octez client with initial storage:
   - `administrator`: `<DEPLOYER_PUBLIC_KEY_HASH>`
   - `organizers`: `["<INITIAL_ORGANIZER_PUBLIC_KEY_HASH>"]`
   - `activities`: `{}` (empty big map)
   - `evidence_hashes`: `{}` (empty big map)
4. Record the returned `KT1...` address and set it in `.env` as `VITE_CONTRACT_ADDRESS`.
