# GreenTrace 2.0: Tezos Campus Sustainability Verification Protocol with GreenAI

GreenTrace 2.0 is a decentralized campus sustainability verification platform built on the **Tezos** blockchain (Shadownet testnet) integrated with **GreenAI Smart Tree Detection** (YOLO-World computer vision). Students record real-world environmental actions directly from their Tezos wallets (Temple, Kukai, Umami). Photographic evidence is fingerprinted with cryptographic SHA-256 digests and preserved in protected off-chain storage to safeguard student privacy. Authorized campus organizers review submissions and sign on-chain approvals or rejections via Beacon SDK, with strict self-approval prevention. Anyone can scan a student's public QR badge to verify authentic, immutable proof directly on Tezos without logging in.

---

## 1. Core Platform Features

- **Decentralized Student Submissions:** Students connect their Tezos wallet and sign activity records directly to the SmartPy smart contract.
- **GreenAI Smart Tree Detection:** Integrated YOLO-World open-vocabulary computer vision detector that analyzes tree planting photographs, identifies individual trees/saplings with bounding boxes, calculates confidence scores, and detects quantity discrepancies.
- **Cryptographic Evidence Fingerprinting (SHA-256):** Every piece of photographic evidence is hashed client-side and verified server-side. Exact duplicate photos are immediately flagged across both the database and the on-chain registry.
- **Privacy-Preserving Off-Chain Storage:** Raw student photos, detailed notes, and student PII are never placed on-chain. Private images are restricted to authorized organizers.
- **Role-Based Authorization:** Exactly two authenticated roles (**STUDENT** and **ORGANIZER**) derived directly from Tezos wallet signatures and smart contract storage.
- **Self-Approval Prevention:** Organizers are prohibited by both the smart contract and the backend from approving or rejecting their own submissions.
- **Irreversible State Machine:** Activities progress from `SUBMITTED` to `APPROVED` or `REJECTED`. Decisions cannot be overwritten or repeatedly triggered.
- **SQLite Persistence & Blockchain Reconciliation:** Off-chain cache maintains local indexing and syncs authoritatively with Tezos big_maps.
- **Zero-Authentication Public QR Verification:** Generates downloadable (PNG) and printable QR badges. Public verification portal queries smart contract state without requiring wallet connection.
- **Strict Non-Automatic Approval Guarantee:** AI analysis is strictly advisory; only authorized human organizers with active Tezos wallets possess cryptographic decision authority.
- **Mandatory Verification Disclaimer:** Verification proves that an activity and its cryptographic fingerprint were recorded on the GreenTrace contract; it does not independently prove physical occurrence without organizer review.

---

## 2. Technology Stack

- **Frontend:** React 19, TypeScript 5.9, Vite 8, Tailwind CSS v4, Lucide React, `@airgap/beacon-dapp`, `@taquito/taquito`, `@taquito/beacon-wallet`, `qrcode.react`, Vitest.
- **Backend:** Python 3.12, FastAPI, Uvicorn, SQLite, Pydantic v2, HTTPX, Pytest.
- **Computer Vision & AI:** Ultralytics YOLO-World (`yolov8s-worldv2.pt`), PyTorch, Torchvision, Pillow, OpenCV.
- **Blockchain:** Tezos (Shadownet testnet), SmartPy v0.24+ module syntax, Michelson, TzKT Shadownet API.

---

## 3. Project Directory Structure

```
green trace/
├── contracts/                        # Tezos SmartPy Smart Contracts
│   ├── greentrace.py                 # SmartPy contract (v0.24+ module syntax)
│   ├── originate.py                  # Tezos Shadownet deployment helper
│   ├── README.md                     # Smart contract specification & storage guide
│   └── tests/
│       ├── test_greentrace.py        # SmartPy native scenario test suite
│       └── test_contract_logic.py    # Pytest native contract logic test suite
├── backend/                          # FastAPI Backend Service
│   ├── main.py                       # Application entrypoint & CORS middleware
│   ├── requirements.txt              # Backend & AI dependencies
│   ├── test_activities.py            # Activities router tests
│   ├── test_ai_tree_detection.py     # GreenAI YOLO-World tree detection tests (12 cases)
│   ├── test_dashboards_history.py    # Dashboard metrics & privacy tests
│   ├── test_e2e_scenarios.py         # End-to-end integration scenarios (A-D)
│   ├── test_evidence.py              # Evidence upload & SHA-256 hashing tests
│   ├── test_health.py                # Health endpoint test
│   ├── test_public_verify.py         # Public QR verification & disclaimer tests
│   ├── test_reconciliation.py        # SQLite / Tezos reconciliation tests
│   └── app/
│       ├── database.py               # SQLite schema, transactions & queries
│       ├── models.py                 # Pydantic v2 validation models
│       ├── routes/
│       │   ├── activities.py         # Activity creation, history & decisions
│       │   ├── ai.py                 # GreenAI tree detection & annotated image serving
│       │   ├── evidence.py           # Evidence upload & duplicate checks
│       │   ├── public.py             # Public zero-auth verification endpoints
│       │   └── reconciliation.py     # State reconciliation & recovery endpoints
│       └── services/
│           ├── hashing.py            # SHA-256 computation & MIME validation
│           ├── reconciliation.py     # On-chain bigmap query & TzKT sync
│           └── tree_detector.py      # YOLO-World vision model detector service
├── frontend/                         # React 19 + TypeScript + Vite Client
│   ├── src/
│   │   ├── context/WalletContext.tsx # Wallet state & Beacon connection
│   │   ├── context/ThemeContext.tsx  # Light/Dark mode state
│   │   ├── services/tezos.ts         # Taquito toolkit, Beacon wallet & calls
│   │   ├── services/api.ts           # Fetch API client for backend & GreenAI
│   │   ├── pages/
│   │   │   ├── LandingPage.tsx       # Campus sustainability welcome page
│   │   │   ├── LoginPage.tsx         # Role-based login & permission request
│   │   │   ├── SubmitActivityPage.tsx# Student activity submission with GreenAI
│   │   │   ├── StudentDashboard.tsx  # Student metrics & personal submission history
│   │   │   ├── OrganizerDashboard.tsx# Organizer review queue & decision buttons
│   │   │   ├── ActivityDetailsPage.tsx# Full lifecycle audit, AI check & QR code badge
│   │   │   └── PublicVerifyPage.tsx  # Zero-login public verification portal
│   │   └── __tests__/frontend.test.ts# Vitest frontend unit test suite
├── protected_evidence/               # Off-chain protected photo storage (gitignored)
├── .env.example                      # Environment variables template
├── .gitignore                        # Comprehensive Git ignore rules
├── ARCHITECTURE.md                   # Full system architecture with Mermaid diagrams
├── TESTING.md                        # Automated test results & QA report
├── DEMO_GUIDE.md                     # Step-by-step mentor demonstration guide
└── README.md                         # Main documentation
```

---

## 4. Prerequisites

- **Node.js:** v18.0.0 or later (v20+ recommended)
- **Python:** v3.11 or v3.12 (with `venv` and `pip`)
- **Tezos Wallet:** Browser extension such as [Temple Wallet](https://templewallet.com/) or [Kukai](https://kukai.app/) configured for **Tezos Shadownet**.
- **Operating System:** Windows 10/11, macOS, or Linux.

---

## 5. Installation & Setup Instructions

### Step 1: Clone the Repository
```bash
git clone https://github.com/<your-username>/greentrace-2.0.git
cd greentrace-2.0
```

### Step 2: Configure Environment Variables
Copy `.env.example` to `.env` in the root, backend, and frontend:
```bash
# On Linux/macOS
cp .env.example .env
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env

# On Windows PowerShell
Copy-Item .env.example .env
Copy-Item backend\.env.example backend\.env
Copy-Item frontend\.env.example frontend\.env
```

### Step 3: Set Up the Backend Environment
```bash
cd backend
python -m venv .venv

# Activate virtual environment
# Windows PowerShell:
.\.venv\Scripts\Activate.ps1
# Linux/macOS:
source .venv/bin/activate

# Install dependencies (FastAPI, PyTorch, YOLO-World, OpenCV)
pip install -r requirements.txt
pip install git+https://github.com/ultralytics/CLIP.git

cd ..
```

*Note: On first startup, the backend automatically downloads the YOLO-World model checkpoint (`yolov8s-worldv2.pt`).*

### Step 4: Set Up the Frontend Environment
```bash
cd frontend
npm install
cd ..
```

---

## 6. Running the Complete Application

Open two separate terminal windows:

### Terminal 1: Start Backend (FastAPI on Port 8000)
```bash
cd backend
# Windows:
.\.venv\Scripts\Activate.ps1
python -m uvicorn main:app --reload --port 8000 --host 127.0.0.1

# Linux/macOS:
source .venv/bin/activate
uvicorn main:app --reload --port 8000 --host 127.0.0.1
```
- **Backend API:** [http://127.0.0.1:8000](http://127.0.0.1:8000)
- **Interactive Swagger Docs:** [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)
- **Health Check:** [http://127.0.0.1:8000/health](http://127.0.0.1:8000/health)

### Terminal 2: Start Frontend (Vite on Port 5173)
```bash
cd frontend
npm run dev
```
- **Web Portal:** [http://localhost:5173](http://localhost:5173)

---

## 7. Running Automated Tests

### A. Run All Backend & AI Tests (Pytest)
```bash
# From workspace root
.\backend\.venv\Scripts\python.exe -m pytest -v
```
*Current result: 108 tests passed, 1 skipped (0 failures), covering activities, evidence, reconciliation, and all 12 GreenAI tree detection scenarios.*

### B. Run Frontend Unit Tests (Vitest)
```bash
npm --prefix frontend test -- --run
```
*Current result: 49 tests passed (0 failures).*

### C. Run Production Build Verification
```bash
npm --prefix frontend run build
```
*Current result: Compiled clean production bundle with code 0.*

---

## 8. Smart Contract Deployment (Tezos Shadownet)

1. **Testnet Endpoints:**
   - **RPC:** `https://rpc.shadownet.teztnets.com`
   - **Explorer:** `https://shadownet.tzkt.io`
   - **Faucet:** Request free testnet Tez at [https://teztnets.com/shadownet-about](https://teztnets.com/shadownet-about).
2. **Compile with SmartPy:**
   - Open [SmartPy Web IDE](https://smartpy.io/ide).
   - Paste `contracts/greentrace.py` and compile to generate Michelson `.tz` bytecode.
3. **Originate:**
   - Execute deployment using `contracts/originate.py` or the SmartPy origination button.
   - Set `administrator` to your deployer address and `initial_organizers` to your organizer wallet address.
4. **Update Configuration:**
   - Paste the originated `KT1...` contract address into `.env` as `VITE_CONTRACT_ADDRESS` and `CONTRACT_ADDRESS`.

---

## 9. Public QR Verification Instructions

1. Any activity card in **Activity History** (`/history`) or **Student Dashboard** (`/student`) has a **"View Details"** page (`/activity/:id`).
2. The page renders an SVG QR code encoding:
   ```
   https://<your-domain>/verify?id=<activity_id>
   ```
3. Click **"Download QR (PNG)"** to save the badge or **"Print Badge"** to open a print dialog.
4. Scan or navigate to the URL directly. The verification portal queries the Tezos SmartPy contract and displays the authoritative on-chain state, public cryptographic fingerprint, and disclaimer. No login or wallet is required.

---

## 10. Security & Responsible Disclosure

While GreenTrace 2.0 incorporates defense-in-depth protections (magic-byte image inspection, SHA-256 fingerprint matching, self-approval prevention, role enforcement, and input sanitization), users should note:
- **Physical Boundary Limitation:** On-chain verification proves that a verified student wallet submitted a specific cryptographic hash and that an authorized organizer signed approval. It does not independently guarantee the physical event occurred without honest organizer review.
- **Testnet RPC Availability:** Public testnet RPC nodes can occasionally experience rate limits or downtime. In such cases, GreenTrace reports `Verification unavailable` rather than fabricating false confirmations.
- **Privacy Assurance:** Raw student evidence photographs are stored in protected off-chain storage and restricted to authorized campus organizers. Sensitive biometric data, personal names, and raw photos are never broadcast to the Tezos blockchain.
