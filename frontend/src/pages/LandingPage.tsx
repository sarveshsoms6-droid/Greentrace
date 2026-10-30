import React from 'react';
import { Link } from 'react-router-dom';
import { 
  ShieldCheck, 
  Leaf, 
  Hash, 
  QrCode, 
  ArrowRight, 
  Lock, 
  CheckCircle, 
  AlertCircle,
  User,
} from 'lucide-react';

export const LandingPage: React.FC = () => {
  return (
    <div className="space-y-16 pb-16">
      {/* Hero Section */}
      <section className="relative overflow-hidden pt-12 sm:pt-20">
        <div className="max-w-4xl mx-auto text-center space-y-6">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold tracking-wide">
            <Leaf className="w-3.5 h-3.5" />
            <span>TEZOS CAMPUS SUSTAINABILITY PROTOCOL 2.0</span>
          </div>

          <h1 className="text-4xl sm:text-6xl font-extrabold text-white tracking-tight leading-tight">
            Decentralized Proof for <br />
            <span className="bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400 bg-clip-text text-transparent">
              Campus Environmental Impact
            </span>
          </h1>

          <p className="text-lg text-slate-300 max-w-2xl mx-auto leading-relaxed">
            Students sign sustainability submissions directly from their Tezos wallets. Authorized organizers review evidence and enforce state transitions on-chain with SHA-256 duplicate detection.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-4 pt-4">
            <Link
              to="/login"
              className="px-6 py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-400 text-slate-950 font-bold text-sm shadow-xl shadow-emerald-500/25 hover:from-emerald-400 hover:to-teal-300 transition-all flex items-center gap-2 hover:translate-y-[-1px]"
            >
              <User className="w-4 h-4" />
              <span>Campus Portal Login</span>
              <ArrowRight className="w-4 h-4" />
            </Link>

            <Link
              to="/submit"
              className="px-6 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-sm border border-slate-700 transition-all flex items-center gap-2"
            >
              <span>Submit Activity</span>
            </Link>

            <Link
              to="/organizer"
              className="px-6 py-3 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-indigo-300 font-semibold text-sm border border-indigo-500/30 transition-all flex items-center gap-2"
            >
              <ShieldCheck className="w-4 h-4 text-indigo-400" />
              <span>Organizer Portal</span>
            </Link>

            <Link
              to="/verify"
              className="px-6 py-3 rounded-xl bg-slate-900/80 hover:bg-slate-800 text-slate-300 font-medium text-sm border border-slate-800 transition-all flex items-center gap-2"
            >
              <QrCode className="w-4 h-4 text-emerald-400" />
              <span>Verify by QR</span>
            </Link>
          </div>
        </div>
      </section>

      {/* Trust Model & Limitation Section per Specification */}
      <section className="max-w-4xl mx-auto">
        <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-6 h-6 text-amber-400 shrink-0 mt-0.5" />
            <div className="space-y-2">
              <h3 className="text-base font-bold text-white">
                GreenTrace Trust Model & System Boundary
              </h3>
              <p className="text-sm text-slate-300 leading-relaxed">
                The Tezos blockchain guarantees that a record was cryptographically signed by a verified student wallet, verified by an authorized organizer wallet, and stored with an immutable timestamp and SHA-256 evidence fingerprint.
              </p>
              <p className="text-xs text-amber-300/90 font-medium bg-amber-950/40 p-3 rounded-lg border border-amber-800/30">
                ⚠️ <strong>Important Constraint:</strong> Blockchain proves recorded contract state and transaction history; it does not physically verify that tree saplings were watered or plastic was recycled in real life. Physical verification relies on organizer review of photographic evidence.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Three Pillars Grid */}
      <section className="max-w-6xl mx-auto grid md:grid-cols-3 gap-6">
        <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-3 hover:border-emerald-500/40 transition-colors">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
            <Lock className="w-5 h-5" />
          </div>
          <h3 className="text-lg font-bold text-white">Wallet-Signed Submissions</h3>
          <p className="text-sm text-slate-400 leading-relaxed">
            Every submission originates directly from a student’s Tezos wallet (e.g. Temple, Kukai). No relayer backend or mock college login can spoof student identity.
          </p>
        </div>

        <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-3 hover:border-teal-500/40 transition-colors">
          <div className="w-10 h-10 rounded-xl bg-teal-500/10 border border-teal-500/20 flex items-center justify-center text-teal-400">
            <Hash className="w-5 h-5" />
          </div>
          <h3 className="text-lg font-bold text-white">SHA-256 Fingerprints</h3>
          <p className="text-sm text-slate-400 leading-relaxed">
            Evidence images are hashed with SHA-256 client-side and verified server-side. Exact duplicate submissions of previously reviewed files are flagged instantly.
          </p>
        </div>

        <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-3 hover:border-indigo-500/40 transition-colors">
          <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <h3 className="text-lg font-bold text-white">Smart Contract Access Control</h3>
          <p className="text-sm text-slate-400 leading-relaxed">
            SmartPy contract enforces organizer-only decisions, valid state transitions (SUBMITTED → APPROVED / REJECTED), and strict self-approval prevention on-chain.
          </p>
        </div>
      </section>

      {/* Role Navigation Cards */}
      <section className="max-w-5xl mx-auto space-y-6">
        <div className="text-center space-y-2">
          <h2 className="text-2xl font-bold text-white">Select Your Workflow</h2>
          <p className="text-sm text-slate-400">GreenTrace operates under two distinct authenticated roles</p>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {/* Student Card */}
          <div className="p-8 rounded-2xl bg-gradient-to-b from-slate-900 to-slate-900/50 border border-slate-800 hover:border-emerald-500/50 transition-all flex flex-col justify-between space-y-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-full">
                  Student Portal
                </span>
                <span className="text-xs text-slate-500">Requires Tezos Wallet</span>
              </div>
              <h3 className="text-xl font-bold text-white">Log Sustainability Actions</h3>
              <ul className="text-sm text-slate-300 space-y-2.5">
                <li className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Submit tree planting, recycling, water & energy efforts</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Upload photo evidence & generate cryptographic SHA-256</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Track submission status and view personal QR badges</span>
                </li>
              </ul>
            </div>
            <Link
              to="/student"
              className="w-full py-2.5 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 border border-emerald-500/30 font-semibold text-sm text-center transition-colors block"
            >
              Go to Student Dashboard
            </Link>
          </div>

          {/* Organizer Card */}
          <div className="p-8 rounded-2xl bg-gradient-to-b from-slate-900 to-slate-900/50 border border-slate-800 hover:border-indigo-500/50 transition-all flex flex-col justify-between space-y-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 px-2.5 py-1 rounded-full">
                  Organizer Review
                </span>
                <span className="text-xs text-slate-500">Authorized Wallets Only</span>
              </div>
              <h3 className="text-xl font-bold text-white">Verify & Sign Decisions</h3>
              <ul className="text-sm text-slate-300 space-y-2.5">
                <li className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-indigo-400 shrink-0" />
                  <span>Inspect pending queue with duplicate hash warning checks</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-indigo-400 shrink-0" />
                  <span>Sign on-chain approvals and rejections via wallet</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-indigo-400 shrink-0" />
                  <span>Enforce zero self-approval and immutable contract states</span>
                </li>
              </ul>
            </div>
            <Link
              to="/organizer"
              className="w-full py-2.5 rounded-xl bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-400 border border-indigo-500/30 font-semibold text-sm text-center transition-colors block"
            >
              Open Organizer Queue
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
};
