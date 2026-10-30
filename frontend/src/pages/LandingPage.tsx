import React from 'react';
import { Link } from 'react-router-dom';
import {
  ShieldCheck,
  Hash,
  QrCode,
  ArrowRight,
  Sparkles,
  Cpu,
  UserPlus,
  LogIn,
} from 'lucide-react';

export const LandingPage: React.FC = () => {
  return (
    <div className="space-y-24 pb-24 animate-fadeIn">
      {/* =========================================================================
          HERO MASTHEAD: THE ON-CHAIN ECOLOGICAL GAZETTE
          ========================================================================= */}
      <section className="relative pt-6 sm:pt-12">
        <div className="max-w-5xl mx-auto space-y-8">
          {/* Top Archival Tagline */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-300 dark:border-stone-800 pb-3 text-[11px] font-mono tracking-widest text-stone-600 dark:text-stone-400">
            <div className="flex items-center gap-2">
              <span className="font-bold text-stone-900 dark:text-stone-100">THE ON-CHAIN ECOLOGICAL CHRONICLE</span>
              <span>//</span>
              <span className="uppercase">INSTITUTIONAL CONSENSUS PROTOCOL</span>
            </div>
            <div className="flex items-center gap-2 text-stone-500">
              <span>VOL. XXIV</span>
              <span>•</span>
              <span>AUTUMN 2026 EDITION</span>
            </div>
          </div>

          {/* Main Editorial Headline */}
          <div className="space-y-6 text-center sm:text-left">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-xs bg-stone-200/80 dark:bg-stone-800/80 border border-stone-400/80 dark:border-stone-700 text-stone-800 dark:text-stone-200 text-xs font-mono font-bold tracking-wider uppercase">
              <Sparkles className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
              <span>TEZOS SMART CONTRACT ARCHIVAL ENGINE</span>
            </div>

            <h1 className="text-4xl sm:text-6xl lg:text-7xl font-display-serif font-bold text-stone-950 dark:text-stone-100 tracking-tight leading-[1.08]">
              The Truth Machine for <br />
              <span className="font-serif-editorial italic font-normal text-emerald-800 dark:text-emerald-400">
                Institutional Environmental Impact.
              </span>
            </h1>

            <p className="text-base sm:text-xl text-stone-700 dark:text-stone-300 max-w-3xl leading-relaxed font-sans font-normal">
              A peer-reviewed consensus protocol unifying <strong>GreenAI Computer Vision</strong>, deterministic <strong>SHA-256 evidence fingerprinting</strong>, and <strong>Tezos Smart Contracts</strong> into an immutable campus sustainability register. Designed to permanently eliminate unverified self-reporting, photo recycling fraud, and administrative opacity.
            </p>
          </div>

          {/* Primary Action Modules */}
          <div className="flex flex-wrap items-center gap-4 pt-2">
            <Link
              to="/login?mode=signup"
              className="px-6 py-3.5 rounded-xs bg-stone-950 hover:bg-stone-800 dark:bg-stone-100 dark:hover:bg-white text-stone-50 dark:text-stone-950 font-mono font-bold text-xs tracking-wider uppercase shadow-md transition-all flex items-center gap-2.5 hover:translate-y-[-1px]"
            >
              <UserPlus className="w-4 h-4" />
              <span>ENROLL IN ARCHIVE</span>
              <ArrowRight className="w-4 h-4" />
            </Link>

            <Link
              to="/login?mode=signin"
              className="px-6 py-3.5 rounded-xs bg-white dark:bg-[#141312] border border-stone-300 dark:border-stone-700 hover:border-stone-500 dark:hover:border-stone-500 text-stone-900 dark:text-stone-100 font-mono font-bold text-xs tracking-wider uppercase shadow-sm transition-all flex items-center gap-2"
            >
              <LogIn className="w-4 h-4 text-stone-600 dark:text-stone-400" />
              <span>SIGN IN TO PORTAL</span>
            </Link>

            <Link
              to="/verify"
              className="px-6 py-3.5 rounded-xs bg-stone-100 hover:bg-stone-200/80 dark:bg-stone-900/80 dark:hover:bg-stone-800 border border-stone-300 dark:border-stone-800 text-stone-700 dark:text-stone-300 font-mono font-semibold text-xs tracking-wider uppercase transition-all flex items-center gap-2"
            >
              <QrCode className="w-4 h-4 text-emerald-700 dark:text-emerald-400" />
              <span>PUBLIC AUDIT SCANNER</span>
            </Link>
          </div>

          {/* Archival Metrics Ribbon (Editorial Front-Page Stats) */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t border-b border-stone-300 dark:border-stone-800 py-4 font-mono">
            <div className="border-r border-stone-200 dark:border-stone-800 pr-3">
              <div className="text-2xl font-bold text-stone-900 dark:text-stone-100 font-serif-editorial">0.00%</div>
              <div className="text-[10px] text-stone-500 uppercase tracking-widest mt-0.5">Duplicate Evidence Tolerance</div>
            </div>
            <div className="border-r border-stone-200 dark:border-stone-800 pr-3">
              <div className="text-2xl font-bold text-emerald-800 dark:text-emerald-400 font-serif-editorial">100%</div>
              <div className="text-[10px] text-stone-500 uppercase tracking-widest mt-0.5">Zero Self-Approval Contract</div>
            </div>
            <div className="border-r border-stone-200 dark:border-stone-800 pr-3">
              <div className="text-2xl font-bold text-stone-900 dark:text-stone-100 font-serif-editorial">YOLOv8</div>
              <div className="text-[10px] text-stone-500 uppercase tracking-widest mt-0.5">GreenAI Detection Model</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-amber-700 dark:text-amber-400 font-serif-editorial">INSTANT</div>
              <div className="text-[10px] text-stone-500 uppercase tracking-widest mt-0.5">Scannable Public QR Badges</div>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================================
          SECTION I: THE INVESTIGATIVE DOSSIER (THE GREENWASHING CRISIS)
          ========================================================================= */}
      <section className="max-w-5xl mx-auto space-y-10">
        <div className="border-b border-stone-300 dark:border-stone-800 pb-4 flex flex-col sm:flex-row sm:items-end justify-between gap-2">
          <div>
            <div className="text-xs font-mono text-rose-700 dark:text-rose-400 tracking-widest font-bold uppercase mb-1">
              [ DOSSIER 01 // INVESTIGATION ]
            </div>
            <h2 className="text-3xl sm:text-4xl font-display-serif font-bold text-stone-950 dark:text-stone-100">
              The Evidentiary Breakdown in Institutional Sustainability
            </h2>
          </div>
          <p className="text-xs font-mono text-stone-500 uppercase tracking-wider">
            Critical analysis of legacy reporting mechanisms
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {/* Case 01 */}
          <div className="p-6 rounded-xs bg-white dark:bg-[#141312] border border-stone-300 dark:border-stone-800 space-y-3 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs font-bold text-rose-700 dark:text-rose-400 tracking-wider">
                ITEM 01 / VULNERABILITY
              </span>
              <span className="text-[10px] font-mono text-stone-400">[ UNVERIFIED METRICS ]</span>
            </div>
            <h3 className="text-lg font-display-serif font-bold text-stone-900 dark:text-stone-100">
              Unverified Self-Reporting & Spreadsheet Inflation
            </h3>
            <p className="text-xs text-stone-600 dark:text-stone-400 leading-relaxed font-sans">
              Traditional campus sustainability initiatives rely on unauthenticated spreadsheets and honor-system forms. Because there is no cryptographic linkage to verifiable evidence, claims of trees planted or plastics recycled are frequently exaggerated without algorithmic oversight.
            </p>
          </div>

          {/* Case 02 */}
          <div className="p-6 rounded-xs bg-white dark:bg-[#141312] border border-stone-300 dark:border-stone-800 space-y-3 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs font-bold text-rose-700 dark:text-rose-400 tracking-wider">
                ITEM 02 / VULNERABILITY
              </span>
              <span className="text-[10px] font-mono text-stone-400">[ PROVENANCE REUSE ]</span>
            </div>
            <h3 className="text-lg font-display-serif font-bold text-stone-900 dark:text-stone-100">
              Evidence Recycling & Duplicate Photographic Fraud
            </h3>
            <p className="text-xs text-stone-600 dark:text-stone-400 leading-relaxed font-sans">
              Without deterministic byte-level fingerprinting, participants routinely re-upload identical event photographs across successive semesters or borrow imagery from third-party sources. Legacy campus systems cannot detect duplicate binary fingerprints.
            </p>
          </div>

          {/* Case 03 */}
          <div className="p-6 rounded-xs bg-white dark:bg-[#141312] border border-stone-300 dark:border-stone-800 space-y-3 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs font-bold text-rose-700 dark:text-rose-400 tracking-wider">
                ITEM 03 / VULNERABILITY
              </span>
              <span className="text-[10px] font-mono text-stone-400">[ REVIEWER COLLAPSE ]</span>
            </div>
            <h3 className="text-lg font-display-serif font-bold text-stone-900 dark:text-stone-100">
              Administrative Verification Bottlenecks & Self-Approval
            </h3>
            <p className="text-xs text-stone-600 dark:text-stone-400 leading-relaxed font-sans">
              Volunteer faculty advisors are overwhelmed by unstructured submissions, leading to prolonged backlogs. Worse, standard databases permit organizers to ratify their own submissions, destroying audit integrity and introducing irreconcilable conflicts of interest.
            </p>
          </div>

          {/* Case 04 */}
          <div className="p-6 rounded-xs bg-white dark:bg-[#141312] border border-stone-300 dark:border-stone-800 space-y-3 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs font-bold text-rose-700 dark:text-rose-400 tracking-wider">
                ITEM 04 / VULNERABILITY
              </span>
              <span className="text-[10px] font-mono text-stone-400">[ AUDIT OBSCURITY ]</span>
            </div>
            <h3 className="text-lg font-display-serif font-bold text-stone-900 dark:text-stone-100">
              Siloed Records & Inability to Publicly Audit
            </h3>
            <p className="text-xs text-stone-600 dark:text-stone-400 leading-relaxed font-sans">
              Institutional sustainability disclosures remain buried in static annual PDF reports. Grant funders, accreditation boards, and students possess zero decentralized mechanisms to independently inspect transaction receipts, timestamps, or raw photographic proof.
            </p>
          </div>
        </div>
      </section>

      {/* =========================================================================
          SECTION II: THE PROTOCOL ARCHITECTURE (THE GREENTRACE SOLUTION)
          ========================================================================= */}
      <section className="max-w-5xl mx-auto space-y-10">
        <div className="border-b border-stone-300 dark:border-stone-800 pb-4 flex flex-col sm:flex-row sm:items-end justify-between gap-2">
          <div>
            <div className="text-xs font-mono text-emerald-800 dark:text-emerald-400 tracking-widest font-bold uppercase mb-1">
              [ DOSSIER 02 // TECHNICAL BLUEPRINT ]
            </div>
            <h2 className="text-3xl sm:text-4xl font-display-serif font-bold text-stone-950 dark:text-stone-100">
              The Quad-Layer Cryptographic Architecture
            </h2>
          </div>
          <p className="text-xs font-mono text-stone-500 uppercase tracking-wider">
            Engineered consensus across off-chain vision and on-chain state
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {/* Pillar 01 */}
          <div className="p-6 rounded-xs bg-stone-50/80 dark:bg-[#121110] border border-stone-300 dark:border-stone-800 space-y-3 shadow-xs">
            <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-400 font-mono text-xs font-bold tracking-wider">
              <Cpu className="w-4 h-4" />
              <span>LAYER 01 // COGNITIVE COMPUTER VISION</span>
            </div>
            <h3 className="text-xl font-display-serif font-bold text-stone-900 dark:text-stone-100">
              GreenAI Automated Tree & Recycling Inspection
            </h3>
            <p className="text-xs text-stone-600 dark:text-stone-400 leading-relaxed font-sans">
              Upon evidence ingestion, client-side neural vision models inspect image geometry, count saplings, classify recycling receptacles, and calculate an unbiased confidence score. Discrepancy flags alert organizers before on-chain signature.
            </p>
          </div>

          {/* Pillar 02 */}
          <div className="p-6 rounded-xs bg-stone-50/80 dark:bg-[#121110] border border-stone-300 dark:border-stone-800 space-y-3 shadow-xs">
            <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-400 font-mono text-xs font-bold tracking-wider">
              <Hash className="w-4 h-4" />
              <span>LAYER 02 // DETERMINISTIC PROVENANCE</span>
            </div>
            <h3 className="text-xl font-display-serif font-bold text-stone-900 dark:text-stone-100">
              SHA-256 Digital Fingerprint Registry
            </h3>
            <p className="text-xs text-stone-600 dark:text-stone-400 leading-relaxed font-sans">
              Every uploaded photograph is computed into a 64-character SHA-256 digest client-side and verified server-side. Exact duplicate submissions across the entire historical record are caught immediately, blocking cross-semester photo recycling.
            </p>
          </div>

          {/* Pillar 03 */}
          <div className="p-6 rounded-xs bg-stone-50/80 dark:bg-[#121110] border border-stone-300 dark:border-stone-800 space-y-3 shadow-xs">
            <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-400 font-mono text-xs font-bold tracking-wider">
              <ShieldCheck className="w-4 h-4" />
              <span>LAYER 03 // ON-CHAIN GOVERNANCE</span>
            </div>
            <h3 className="text-xl font-display-serif font-bold text-stone-900 dark:text-stone-100">
              Tezos Smart Contract State Enforcement
            </h3>
            <p className="text-xs text-stone-600 dark:text-stone-400 leading-relaxed font-sans">
              The SmartPy smart contract enforces role-based state transitions (<code>SUBMITTED &rarr; APPROVED / REJECTED</code>). Crucially, the contract mathematically forbids organizers from approving their own entries, guaranteeing immutable institutional integrity.
            </p>
          </div>

          {/* Pillar 04 */}
          <div className="p-6 rounded-xs bg-stone-50/80 dark:bg-[#121110] border border-stone-300 dark:border-stone-800 space-y-3 shadow-xs">
            <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-400 font-mono text-xs font-bold tracking-wider">
              <QrCode className="w-4 h-4" />
              <span>LAYER 04 // PUBLIC DISCLOSURE</span>
            </div>
            <h3 className="text-xl font-display-serif font-bold text-stone-900 dark:text-stone-100">
              Decentralized QR Certificates & Public Auditing
            </h3>
            <p className="text-xs text-stone-600 dark:text-stone-400 leading-relaxed font-sans">
              Every approved activity generates an authoritative QR badge linking directly to the immutable Tezos transaction hash. Any member of the public, auditor, or collegiate board can scan the badge to inspect timestamp, evidence hash, and participant identity.
            </p>
          </div>
        </div>
      </section>

      {/* =========================================================================
          SECTION III: THE OPERATIONAL CODEX (PIPELINE)
          ========================================================================= */}
      <section className="max-w-5xl mx-auto space-y-8">
        <div className="border-b border-stone-300 dark:border-stone-800 pb-4">
          <div className="text-xs font-mono text-stone-500 tracking-widest uppercase mb-1">
            [ OPERATIONAL CODEX ]
          </div>
          <h2 className="text-2xl sm:text-3xl font-display-serif font-bold text-stone-950 dark:text-stone-100">
            The Lifecycle of a Certified Sustainability Claim
          </h2>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 font-mono text-xs">
          {/* Phase 01 */}
          <div className="p-5 rounded-xs bg-white dark:bg-[#141312] border border-stone-300 dark:border-stone-800 space-y-2.5">
            <div className="text-[11px] font-bold text-emerald-800 dark:text-emerald-400">[ PHASE 01 ]</div>
            <div className="font-sans font-bold text-sm text-stone-900 dark:text-stone-100">Cadre Enrollment</div>
            <p className="text-stone-600 dark:text-stone-400 leading-relaxed font-sans text-xs">
              Participant registers with campus credentials. Students achieve immediate portal activation; faculty organizers unlock cryptographic signing privileges.
            </p>
          </div>

          {/* Phase 02 */}
          <div className="p-5 rounded-xs bg-white dark:bg-[#141312] border border-stone-300 dark:border-stone-800 space-y-2.5">
            <div className="text-[11px] font-bold text-emerald-800 dark:text-emerald-400">[ PHASE 02 ]</div>
            <div className="font-sans font-bold text-sm text-stone-900 dark:text-stone-100">Proof Deposition</div>
            <p className="text-stone-600 dark:text-stone-400 leading-relaxed font-sans text-xs">
              Student logs impact metrics with photographic evidence. The system computes SHA-256 digests and triggers GreenAI tree detection models.
            </p>
          </div>

          {/* Phase 03 */}
          <div className="p-5 rounded-xs bg-white dark:bg-[#141312] border border-stone-300 dark:border-stone-800 space-y-2.5">
            <div className="text-[11px] font-bold text-emerald-800 dark:text-emerald-400">[ PHASE 03 ]</div>
            <div className="font-sans font-bold text-sm text-stone-900 dark:text-stone-100">Council Ratification</div>
            <p className="text-stone-600 dark:text-stone-400 leading-relaxed font-sans text-xs">
              Authorized faculty organizers inspect the submission queue, review GreenAI confidence data, and sign the state transition on Tezos with zero self-approval.
            </p>
          </div>

          {/* Phase 04 */}
          <div className="p-5 rounded-xs bg-white dark:bg-[#141312] border border-stone-300 dark:border-stone-800 space-y-2.5">
            <div className="text-[11px] font-bold text-emerald-800 dark:text-emerald-400">[ PHASE 04 ]</div>
            <div className="font-sans font-bold text-sm text-stone-900 dark:text-stone-100">Ledger Seal & QR</div>
            <p className="text-stone-600 dark:text-stone-400 leading-relaxed font-sans text-xs">
              Transaction is permanently sealed on Tezos and cached in Supabase. A verifiable QR certificate is issued for institutional sustainability accreditation.
            </p>
          </div>
        </div>
      </section>

      {/* =========================================================================
          SECTION IV: DUAL CADRE WORKSPACES
          ========================================================================= */}
      <section className="max-w-5xl mx-auto space-y-6">
        <div className="border-b border-stone-300 dark:border-stone-800 pb-4">
          <div className="text-xs font-mono text-stone-500 tracking-widest uppercase mb-1">
            [ PARTICIPANT WORKSPACES ]
          </div>
          <h2 className="text-2xl sm:text-3xl font-display-serif font-bold text-stone-950 dark:text-stone-100">
            Select Your Archival Portal
          </h2>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {/* Student Researcher Portal */}
          <div className="p-8 rounded-xs bg-white dark:bg-[#141312] border border-stone-300 dark:border-stone-800 hover:border-emerald-700/60 dark:hover:border-emerald-500/60 transition-all flex flex-col justify-between space-y-6 shadow-sm">
            <div className="space-y-4">
              <div className="flex items-center justify-between font-mono text-xs">
                <span className="font-bold text-emerald-800 dark:text-emerald-400 px-2 py-0.5 border border-emerald-800/30 dark:border-emerald-500/30 uppercase tracking-wider">
                  STUDENT RESEARCH CADRE
                </span>
                <span className="text-stone-400">[ IMMEDIATE ACTIVATION ]</span>
              </div>
              <h3 className="text-2xl font-display-serif font-bold text-stone-900 dark:text-stone-100">
                Deposit Proofs & Earn Verified Badges
              </h3>
              <p className="text-xs text-stone-600 dark:text-stone-400 leading-relaxed font-sans">
                Record your real-world campus sustainability actions—tree saplings, sorted recyclables, energy conservation, and water management. Obtain verifiable on-chain certificates for your environmental portfolio.
              </p>
              <ul className="text-xs text-stone-600 dark:text-stone-400 space-y-2 font-sans">
                <li className="flex items-center gap-2">
                  <span className="font-mono text-emerald-700 font-bold">&bull;</span>
                  <span>Direct photographic upload with instant SHA-256 fingerprinting</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="font-mono text-emerald-700 font-bold">&bull;</span>
                  <span>Automated GreenAI computer vision analysis and confidence rating</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="font-mono text-emerald-700 font-bold">&bull;</span>
                  <span>Downloadable, audit-grade public QR certificates with Tezos hashes</span>
                </li>
              </ul>
            </div>
            <div className="space-y-2 pt-2 font-mono">
              <Link
                to="/login?mode=signup&role=STUDENT"
                className="w-full py-3 text-center bg-stone-900 hover:bg-stone-800 dark:bg-stone-100 dark:hover:bg-white text-stone-50 dark:text-stone-950 font-bold text-xs tracking-wider uppercase transition-colors block"
              >
                [ ENROLL AS STUDENT CADRE ]
              </Link>
              <Link
                to="/login?mode=signin"
                className="w-full py-2 text-center text-[11px] text-stone-500 hover:text-stone-900 dark:hover:text-stone-200 block uppercase"
              >
                Existing participant? Sign In here
              </Link>
            </div>
          </div>

          {/* Faculty Organizer Portal */}
          <div className="p-8 rounded-xs bg-white dark:bg-[#141312] border border-stone-300 dark:border-stone-800 hover:border-amber-700/60 dark:hover:border-amber-500/60 transition-all flex flex-col justify-between space-y-6 shadow-sm">
            <div className="space-y-4">
              <div className="flex items-center justify-between font-mono text-xs">
                <span className="font-bold text-amber-800 dark:text-amber-400 px-2 py-0.5 border border-amber-800/30 dark:border-amber-500/30 uppercase tracking-wider">
                  FACULTY COORDINATOR
                </span>
                <span className="text-stone-400">[ RATIFICATION PRIVILEGES ]</span>
              </div>
              <h3 className="text-2xl font-display-serif font-bold text-stone-900 dark:text-stone-100">
                Audit Submissions & Seal On-Chain
              </h3>
              <p className="text-xs text-stone-600 dark:text-stone-400 leading-relaxed font-sans">
                Review pending evidence queues, evaluate GreenAI computer vision detection data, verify duplicate image flags, and cryptographically sign approvals directly onto the Tezos ledger.
              </p>
              <ul className="text-xs text-stone-600 dark:text-stone-400 space-y-2 font-sans">
                <li className="flex items-center gap-2">
                  <span className="font-mono text-amber-700 font-bold">&bull;</span>
                  <span>Inspect pending claims with client-server duplicate hash alarms</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="font-mono text-amber-700 font-bold">&bull;</span>
                  <span>Sign on-chain approvals and rejections via Temple/Kukai or portal</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="font-mono text-amber-700 font-bold">&bull;</span>
                  <span>Enforce zero self-approval rule and maintain audit reconciliation</span>
                </li>
              </ul>
            </div>
            <div className="space-y-2 pt-2 font-mono">
              <Link
                to="/login?mode=signup&role=ORGANIZER"
                className="w-full py-3 text-center bg-amber-700 hover:bg-amber-600 text-stone-50 font-bold text-xs tracking-wider uppercase transition-colors block"
              >
                [ REGISTER AS ORGANIZER ]
              </Link>
              <Link
                to="/login?mode=signin"
                className="w-full py-2 text-center text-[11px] text-stone-500 hover:text-stone-900 dark:hover:text-stone-200 block uppercase"
              >
                Existing coordinator? Sign In here
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================================
          SECTION V: EDITORIAL COLOPHON (FOOTER SUMMARY)
          ========================================================================= */}
      <section className="max-w-5xl mx-auto border-t border-stone-300 dark:border-stone-800 pt-8 font-mono text-[11px] text-stone-500 dark:text-stone-400">
        <div className="grid sm:grid-cols-3 gap-6">
          <div>
            <div className="font-bold text-stone-900 dark:text-stone-100 uppercase tracking-wider mb-1.5">
              [ PROTOCOL CONSENSUS ]
            </div>
            <p className="leading-relaxed">
              GreenTrace 2.0 operates as an open, auditable ecological chronicle. State transitions are verified by authorized smart contract signatures on Tezos testnet and replicated to Supabase PostgreSQL.
            </p>
          </div>
          <div>
            <div className="font-bold text-stone-900 dark:text-stone-100 uppercase tracking-wider mb-1.5">
              [ CRYPTOGRAPHIC VERIFIABILITY ]
            </div>
            <p className="leading-relaxed">
              Every evidence submission is stamped with a deterministic SHA-256 hash. Proof certificates are public and non-custodial, allowing external audit by educational boards and carbon registries.
            </p>
          </div>
          <div>
            <div className="font-bold text-stone-900 dark:text-stone-100 uppercase tracking-wider mb-1.5">
              [ EDITION COLOPHON ]
            </div>
            <p className="leading-relaxed">
              Typeset in Fraunces, Instrument Serif, and JetBrains Mono. Published under collegiate sustainability open standards. All rights reserved &copy; 2026.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
};
