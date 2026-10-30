# GreenTrace 2.0 — Live Demonstration Guide

This guide is designed for presenting the GreenTrace 2.0 campus sustainability verification platform to mentors, evaluators, and hackathon judges.

---

## 1. Pre-Demo Setup Checklist (2 Minutes)

Open two Windows PowerShell terminals in the project root:

### Terminal 1 — Start the Backend Server
```powershell
cd "C:\Users\Peria Durai\Downloads\green trace\backend"
.\.venv\Scripts\Activate.ps1
uvicorn main:app --reload --port 8000
```
*Expected Console Output:* `Uvicorn running on http://127.0.0.1:8000 (Press CTRL+C to quit)`

### Terminal 2 — Start the Frontend Application
```powershell
cd "C:\Users\Peria Durai\Downloads\green trace\frontend"
npm run dev
```
*Expected Console Output:* `VITE v8.3.5 ready in ... ms ➜ Local: http://localhost:5173/`

### Open Your Browser:
Navigate to: **[http://localhost:5173](http://localhost:5173)**

---

## 2. Step-by-Step Demonstration Script

### Step 1: Landing Page & Architectural Introduction (1 Minute)
1. **Show the Hero Section:** Explain that GreenTrace 2.0 provides tamper-evident, decentralized verification for student climate action on Tezos.
2. **Highlight Key Protocol Features:** Point out the four pillars on the landing page:
   - *Decentralized Student Submissions*
   - *Cryptographic Evidence Fingerprinting (SHA-256)*
   - *Role-Enforced Organizer Review & Self-Approval Prevention*
   - *Zero-Auth Public Verification Portal with QR Badges*

---

### Step 2: Student Activity Submission (3 Minutes)
1. **Connect Student Wallet:**
   - In the top navigation bar, click **"Connect Wallet"**.
   - Select your Beacon-compatible wallet (e.g., Temple, Kukai).
   - Once connected, show that the navbar displays your truncated address and your role as **`STUDENT`**.
2. **Open Submission Form:**
   - Click **"Submit Activity"** in the navigation bar.
3. **Fill out Sustainability Details:**
   - **Category:** Select `Tree planting`.
   - **Quantity:** Enter `5`. Notice the unit automatically adjusts to `saplings` (enforced category-unit pairing).
   - **Description:** Enter `Planted five flowering cherry saplings near the campus science centre`.
4. **Demonstrate Instant SHA-256 Hashing:**
   - Click to upload an evidence photo (select any `.jpg` or `.png`).
   - Point out the **Client-Side SHA-256 Fingerprint** displayed immediately on screen.
   - Mention: *"The raw photographic evidence is kept off-chain in protected storage to safeguard student privacy. Only this 64-character cryptographic hash is stored on Tezos."*
5. **Submit & Sign:**
   - Click **"Submit Activity Record"**.
   - Watch the multi-stage progress indicator:
     - *Uploading evidence and verifying SHA-256 fingerprint server-side...*
     - *Checking for duplicate submissions...*
     - *Requesting signature from connected Tezos wallet...*
   - Upon completion, view the **Submission Success Card** showing the generated unique Activity ID (e.g. `act-XXXX-YYYY`).

---

### Step 3: Student Dashboard & Data Privacy (1.5 Minutes)
1. **Navigate to Student Dashboard:**
   - Click **"Dashboard"** in the navigation bar.
2. **Review Metrics & Status:**
   - Show the summary statistics cards: *Total Activities*, *Pending*, *Approved*, *Rejected*.
   - Point out your newly submitted activity in the list with the amber **`PENDING`** badge.
3. **Emphasize Data Isolation:**
   - Point out: *"Students can only see their own submissions and cannot alter approval statuses."*

---

### Step 4: Organizer Review & Wallet-Signed Decision (3 Minutes)
1. **Connect Authorized Organizer Wallet:**
   - Switch wallet account to the configured organizer address (`tz1aSkwEkv3Ax2bWZHvCaOKUMcqModq5RMqJ`).
   - Notice the role pill updates automatically to **`ORGANIZER`** in the top navbar.
2. **Access Organizer Dashboard:**
   - Click **"Organizer Dashboard"**.
   - Show the campus-wide KPI overview: Total Submissions, Pending Review, Approved, and Rejected.
3. **Inspect the Pending Submission:**
   - Locate the student's submission in the **"Pending Review"** table.
   - Click **"Review Evidence"** or **"View Details"**.
   - Show that authorized organizers can securely view the photographic evidence preview served from protected off-chain storage.
4. **Approve Activity:**
   - Click the green **"Approve"** button.
   - A confirmation dialog appears reminding the organizer of on-chain state finality.
   - Confirm the decision. The connected wallet prompts for signature.
   - Show the status update in real-time to green **`APPROVED`**.
5. *(Optional)* **Demonstrate Self-Approval Prevention:**
   - Attempt to review an activity submitted by the organizer's own address.
   - Point out that the approval button is disabled with the warning: *"Organizers are prohibited from approving their own submissions."*

---

### Step 5: QR Code Badge & Public Verification (2 Minutes)
1. **Open Activity Details:**
   - From the Activity History or Dashboard, click on the approved activity.
2. **Demonstrate QR Code Capabilities:**
   - Scroll to the **Public Verification QR Code** section.
   - Click **"Download QR (PNG)"** — show that high-resolution PNG downloads locally.
   - Click **"Print Badge"** — show browser print preview.
   - Click **"Open Public Verification Page"**.
3. **Showcase Zero-Authentication Public Portal:**
   - Point out that this page requires **no wallet connection and no login**. Any student, employer, campus dean, or community member can access it.
   - Point out the status badge: **`VERIFIED ON-CHAIN — Contract State: APPROVED`**.
   - Point out the **Cryptographic Audit Trail**:
     - *Evidence SHA-256 Digest*
     - *Operation Hash* with link to Tezos block explorer (TzKT)
     - *Contract Address*
   - Read the mandatory specification disclaimer:
     > *"Blockchain verification confirms that this activity record and its status were recorded by the GreenTrace smart contract. It does not independently prove that the physical activity occurred."*
   - Highlight privacy: *"Notice that the raw student photograph and personal identity are completely shielded."*

---

## 3. Evaluator Q&A Highlights

- **Q: Where is data stored?**
  *A:* On-chain on Tezos: Activity ID, SHA-256 evidence fingerprint, category, quantity, unit, status, and actor wallet addresses. Off-chain in SQLite and protected directories: raw photos, text descriptions, and private rejection notes.
- **Q: How does GreenTrace prevent fraudulent evidence?**
  *A:* Three layers: (1) Instant client and server SHA-256 duplicate detection preventing identical image re-use; (2) Magic-byte image inspection blocking malicious payloads; (3) Authorized organizer review before any record is marked `APPROVED`.
- **Q: Can an organizer approve their own actions?**
  *A:* No. Both the SmartPy contract (`assert sp.sender != record.submitter_address`) and the FastAPI backend enforce strict self-approval prevention.
