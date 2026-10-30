import React, { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { truncateAddress, formatTimestamp } from '../utils/crypto';
import { api, type PublicVerificationApiResponse, ApiError } from '../services/api';
import { EXPLORER_URL } from '../services/tezos';
import {
  Search,
  CheckCircle2,
  XCircle,
  Clock,
  QrCode,
  AlertCircle,
  Lock,
  ArrowRight,
  ShieldCheck,
  Loader2,
  ExternalLink,
  Info,
} from 'lucide-react';

export const PublicVerifyPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();

  const queryId = searchParams.get('id') || '';
  const [searchId, setSearchId] = useState<string>(queryId);
  const [activeLookupId, setActiveLookupId] = useState<string>(queryId);
  const [verificationResult, setVerificationResult] = useState<PublicVerificationApiResponse | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorStatus, setErrorStatus] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (queryId) {
      setSearchId(queryId);
      setActiveLookupId(queryId);
    }
  }, [queryId]);

  useEffect(() => {
    if (!activeLookupId.trim()) {
      setVerificationResult(null);
      setErrorStatus(null);
      setErrorMessage(null);
      return;
    }

    let isCancelled = false;
    async function executeVerification() {
      setIsLoading(true);
      setErrorStatus(null);
      setErrorMessage(null);
      try {
        const res = await api.verifyPublicActivity(activeLookupId.trim());
        if (!isCancelled) {
          setVerificationResult(res);
        }
      } catch (err: unknown) {
        if (!isCancelled) {
          setVerificationResult(null);
          if (err instanceof ApiError) {
            setErrorStatus(err.status);
            setErrorMessage(err.detail);
          } else {
            setErrorStatus(0);
            const msg = err instanceof Error ? err.message : 'Unable to verify activity.';
            setErrorMessage(msg);
          }
        }
      } finally {
        if (!isCancelled) {
          setIsLoading(false);
        }
      }
    }

    executeVerification();
    return () => {
      isCancelled = true;
    };
  }, [activeLookupId]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = searchId.trim();
    if (!clean) return;
    setActiveLookupId(clean);
    setSearchParams({ id: clean });
  };

  return (
    <div className="max-w-3xl mx-auto space-y-8 pb-16">
      {/* Top Banner */}
      <div className="text-center space-y-3 pt-6">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold">
          <QrCode className="w-3.5 h-3.5" />
          <span>PUBLIC VERIFICATION PORTAL</span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
          Verify Campus Sustainability Proof
        </h1>
        <p className="text-sm text-slate-400 max-w-xl mx-auto">
          Scan any GreenTrace QR code or enter an Activity ID below to verify the authentic cryptographic proof and smart contract record directly on Tezos. No login required.
        </p>
      </div>

      {/* Search Input Box */}
      <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl">
        <form onSubmit={handleSearch} className="flex gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-3.5" />
            <input
              type="text"
              placeholder="Enter Activity ID (e.g. act-2026-001)..."
              value={searchId}
              onChange={(e) => setSearchId(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500 font-mono transition-colors"
            />
          </div>
          <button
            type="submit"
            disabled={isLoading || !searchId.trim()}
            className="px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs shadow-lg shadow-emerald-500/20 transition-all flex items-center gap-1.5 disabled:opacity-50"
          >
            {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <span>Verify Proof</span>}
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </form>
      </div>

      {/* Loading Indicator */}
      {isLoading && (
        <div className="p-12 text-center rounded-3xl bg-slate-900 border border-slate-800 space-y-3">
          <Loader2 className="w-8 h-8 animate-spin text-emerald-400 mx-auto" />
          <p className="text-sm text-slate-300 font-medium">Querying authoritative Tezos SmartPy contract state...</p>
          <p className="text-xs text-slate-500">Checking on-chain big_map storage on Tezos Shadownet</p>
        </div>
      )}

      {/* Verification Result Display */}
      {!isLoading && verificationResult && (
        <div className="rounded-3xl bg-slate-900 border border-slate-800 shadow-2xl p-6 sm:p-8 space-y-6">
          {/* Status Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-6">
            <div>
              <span className="text-xs font-mono text-slate-400">Activity Identifier</span>
              <h2 className="text-2xl font-extrabold text-white font-mono mt-0.5">
                {verificationResult.activity_id}
              </h2>
            </div>

            <div>
              {verificationResult.status_label === 'Approved' ? (
                <div className="px-4 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                  <div>
                    <div className="text-xs font-extrabold uppercase tracking-wide">VERIFIED ON-CHAIN</div>
                    <div className="text-[10px] text-emerald-300">Contract State: APPROVED</div>
                  </div>
                </div>
              ) : verificationResult.status_label === 'Pending' ? (
                <div className="px-4 py-2 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center gap-2">
                  <Clock className="w-5 h-5 text-amber-400 shrink-0" />
                  <div>
                    <div className="text-xs font-extrabold uppercase tracking-wide">PENDING VERIFICATION</div>
                    <div className="text-[10px] text-amber-300">Awaiting Organizer Review</div>
                  </div>
                </div>
              ) : verificationResult.status_label === 'Rejected' ? (
                <div className="px-4 py-2 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 flex items-center gap-2">
                  <XCircle className="w-5 h-5 text-rose-400 shrink-0" />
                  <div>
                    <div className="text-xs font-extrabold uppercase tracking-wide">REJECTED BY ORGANIZER</div>
                    <div className="text-[10px] text-rose-300">Decision Confirmed On-Chain</div>
                  </div>
                </div>
              ) : (
                <div className="px-4 py-2 rounded-xl bg-slate-800 border border-slate-700 text-slate-300 flex items-center gap-2">
                  <AlertCircle className="w-5 h-5 text-amber-400 shrink-0" />
                  <div>
                    <div className="text-xs font-extrabold uppercase tracking-wide">VERIFICATION UNAVAILABLE</div>
                    <div className="text-[10px] text-slate-400">On-Chain State Unreachable</div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Scope and Quantity Box */}
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
              <span className="text-xs text-slate-400 uppercase tracking-wider font-semibold">Sustainability Category</span>
              <div className="text-lg font-bold text-white">{verificationResult.category}</div>
              <div className="text-sm font-semibold text-emerald-400 font-mono">
                {verificationResult.quantity} {verificationResult.unit}
              </div>
            </div>

            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
              <span className="text-xs text-slate-400 uppercase tracking-wider font-semibold">Blockchain Network</span>
              <div className="text-lg font-bold text-slate-200">{verificationResult.network}</div>
              <div className="text-xs text-slate-400 font-mono">
                Contract:{' '}
                {verificationResult.contract_address ? (
                  <a
                    href={`${EXPLORER_URL}/${verificationResult.contract_address}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-teal-400 hover:underline inline-flex items-center gap-1"
                  >
                    <span>{truncateAddress(verificationResult.contract_address, 8, 6)}</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                ) : (
                  <span className="text-slate-500">Pending Deployment</span>
                )}
              </div>
            </div>
          </div>

          {/* Cryptographic Audit Trail */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-300 uppercase tracking-wider">
              <Lock className="w-3.5 h-3.5 text-emerald-400" />
              <span>Public Cryptographic Proof</span>
            </div>

            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2.5 text-xs font-mono">
              {verificationResult.submitted_at && (
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                  <span className="text-slate-400">Submission Timestamp:</span>
                  <span className="text-slate-300">{formatTimestamp(verificationResult.submitted_at)}</span>
                </div>
              )}

              {verificationResult.submission_tx_hash && (
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                  <span className="text-slate-400">Submission Operation Hash:</span>
                  <a
                    href={`${EXPLORER_URL}/${verificationResult.submission_tx_hash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-teal-400 hover:text-teal-300 inline-flex items-center gap-1"
                  >
                    <span>{truncateAddress(verificationResult.submission_tx_hash, 10, 6)}</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              )}

              {verificationResult.approver_address && (
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                  <span className="text-slate-400">Organizer Approver:</span>
                  <span className="text-indigo-300">{truncateAddress(verificationResult.approver_address, 10, 8)}</span>
                </div>
              )}

              {verificationResult.approval_tx_hash && (
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                  <span className="text-slate-400">Decision Operation Hash:</span>
                  <a
                    href={`${EXPLORER_URL}/${verificationResult.approval_tx_hash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-teal-400 hover:text-teal-300 inline-flex items-center gap-1"
                  >
                    <span>{truncateAddress(verificationResult.approval_tx_hash, 10, 6)}</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              )}

              <div className="pt-2 border-t border-slate-900 flex flex-col gap-1">
                <span className="text-slate-400">Evidence SHA-256 Digest:</span>
                <span className="text-teal-300 break-all select-all font-mono">{verificationResult.evidence_hash}</span>
              </div>
            </div>
          </div>

          {/* Verification Details Notice if Unavailable or Unmined */}
          {verificationResult.details && (
            <div className="p-3.5 bg-slate-950/80 rounded-xl border border-slate-800 text-xs text-slate-400 flex items-start gap-2">
              <Info className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <span>{verificationResult.details}</span>
            </div>
          )}

          {/* Mandatory Specification Disclaimer */}
          <div className="p-4 rounded-xl bg-slate-950/90 border border-slate-800 text-xs text-slate-400 space-y-1">
            <div className="flex items-center gap-1.5 text-slate-300 font-semibold">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>Verification Scope & Authenticity Disclaimer</span>
            </div>
            <p className="leading-relaxed text-[11px] text-slate-400 italic">
              "{verificationResult.disclaimer}"
            </p>
          </div>

          {/* Privacy Protection Notice */}
          <div className="p-3.5 rounded-xl bg-slate-950/40 border border-slate-800 text-[11px] text-slate-400 flex items-start gap-2">
            <Lock className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <span>
              <strong>Privacy Guaranteed:</strong> Raw photographic evidence and student personal identifiers are restricted off-chain to safeguard student privacy. Only the public cryptographic SHA-256 fingerprint is verified on Tezos.
            </span>
          </div>

          {/* Link to Full Activity Details */}
          <div className="pt-2 text-center">
            <Link
              to={`/activity/${verificationResult.activity_id}`}
              className="inline-flex items-center gap-1.5 text-xs text-emerald-400 hover:text-emerald-300 font-semibold underline underline-offset-4"
            >
              <span>View Complete Activity Details & Lifecycle History</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      )}

      {/* Error or Invalid ID State */}
      {!isLoading && activeLookupId && !verificationResult && (
        <div className="rounded-3xl bg-slate-900 border border-slate-800 p-8 text-center space-y-4 shadow-2xl">
          <div className="w-12 h-12 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center mx-auto">
            <AlertCircle className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <h3 className="text-lg font-bold text-white">
              {errorStatus === 404 ? 'Activity ID Not Found' : 'Verification Unavailable'}
            </h3>
            <p className="text-xs text-slate-400 max-w-md mx-auto">
              {errorMessage || `No verified sustainability record was found matching Activity ID "${activeLookupId}".`}
            </p>
          </div>
          <div className="pt-2">
            <Link
              to="/history"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold"
            >
              <span>Browse All Activities in History</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      )}
    </div>
  );
};
