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
            const msg = err instanceof Error ? err.message : 'Unable to verify activity record.';
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
    <div className="max-w-3xl mx-auto space-y-10 pb-20">
      {/* Top Masthead Header */}
      <div className="text-center space-y-4 pt-4 border-b border-stone-300 dark:border-stone-800 pb-8 font-mono-code">
        <div className="inline-flex items-center gap-2 stamp-badge border-stone-400 dark:border-stone-700 text-stone-800 dark:text-stone-300">
          <QrCode className="w-3.5 h-3.5 text-stone-600 dark:text-stone-400" />
          <span>CHRONICLE ATTESTATION // PUBLIC AUDIT REGISTER</span>
        </div>
        <h1 className="font-serif-editorial text-4xl sm:text-5xl font-normal text-stone-900 dark:text-stone-100 tracking-tight">
          Public Sustainability Certificate{' '}
          <span className="italic font-normal">& Attestation.</span>
        </h1>
        <p className="text-base text-stone-600 dark:text-stone-400 max-w-xl mx-auto font-sans font-light leading-relaxed">
          Inspect campus environmental impact attestations notarized on the Tezos decentralized ledger.
          Examine SHA-256 fingerprints, dual-key council ratifications, and state consensus proofs with zero authentication barrier.
        </p>
      </div>

      {/* Search Input Box */}
      <div className="p-4 rounded-lg bg-stone-50 dark:bg-stone-900 border border-stone-300 dark:border-stone-800 shadow-sm font-mono-code">
        <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-3.5" />
            <input
              type="text"
              placeholder="Enter Folio ID (e.g. act-2026-001 or act-mxyz)..."
              value={searchId}
              onChange={(e) => setSearchId(e.target.value)}
              className="w-full bg-white dark:bg-stone-950 border border-stone-300 dark:border-stone-700 rounded pl-10 pr-4 py-2.5 text-xs text-stone-900 dark:text-stone-100 focus:outline-none focus:border-stone-900 dark:focus:border-stone-100 transition-colors uppercase"
            />
          </div>
          <button
            type="submit"
            disabled={isLoading || !searchId.trim()}
            className="px-5 py-2.5 rounded bg-stone-900 hover:bg-black text-white dark:bg-stone-100 dark:hover:bg-white dark:text-stone-950 font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 shadow-sm disabled:opacity-50"
          >
            {isLoading ? <Loader2 className="w-4 h-4 animate-spin text-emerald-400" /> : <span>[ Verify Folio ]</span>}
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </form>
      </div>

      {/* Loading Indicator */}
      {isLoading && (
        <div className="p-16 text-center rounded-lg bg-stone-50 dark:bg-stone-900/40 border border-stone-300 dark:border-stone-800 space-y-3 font-mono-code">
          <Loader2 className="w-6 h-6 animate-spin text-stone-800 dark:text-stone-200 mx-auto" />
          <p className="text-xs text-stone-700 dark:text-stone-300 font-bold uppercase tracking-wider">
            Querying Tezos SmartPy contract big_map storage…
          </p>
          <p className="text-[11px] text-stone-500">Checking cryptographic ledger state on Tezos Shadownet</p>
        </div>
      )}

      {/* Verification Result Display: Archival Certificate */}
      {!isLoading && verificationResult && (
        <div className="rounded-lg bg-white dark:bg-stone-900 border border-stone-300 dark:border-stone-800 shadow-md p-6 sm:p-8 space-y-6 font-mono-code relative">
          {/* Certificate Masthead Status */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-stone-300 dark:border-stone-800 pb-6">
            <div>
              <span className="text-[11px] text-stone-500 uppercase tracking-widest">[ FOLIO SPECIMEN ]</span>
              <h2 className="font-serif-editorial text-2xl sm:text-3xl font-normal text-stone-900 dark:text-stone-100 mt-0.5">
                {verificationResult.activity_id}
              </h2>
            </div>

            <div>
              {verificationResult.status_label === 'Approved' ? (
                <span className="stamp-badge border-emerald-600 text-emerald-700 dark:text-emerald-400 bg-emerald-500/5 text-xs">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  VERIFIED PROTOCOL RECORD
                </span>
              ) : verificationResult.status_label === 'Pending' ? (
                <span className="stamp-badge border-amber-600 text-amber-700 dark:text-amber-400 bg-amber-500/5 text-xs">
                  <Clock className="w-3.5 h-3.5" />
                  IN ADJUDICATION // PENDING
                </span>
              ) : verificationResult.status_label === 'Rejected' ? (
                <span className="stamp-badge border-rose-600 text-rose-700 dark:text-rose-400 bg-rose-500/5 text-xs">
                  <XCircle className="w-3.5 h-3.5" />
                  DECLINED SPECIMEN
                </span>
              ) : (
                <span className="stamp-badge border-stone-400 text-stone-600 dark:text-stone-400 text-xs">
                  <AlertCircle className="w-3.5 h-3.5" />
                  STATUS UNMINED
                </span>
              )}
            </div>
          </div>

          {/* Scope and Quantity Box */}
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="p-4 rounded bg-stone-50 dark:bg-stone-950 border border-stone-200 dark:border-stone-800 space-y-1">
              <span className="text-[10px] text-stone-500 uppercase tracking-widest block">Action Category</span>
              <div className="font-serif-editorial text-xl text-stone-900 dark:text-stone-100">{verificationResult.category}</div>
              <div className="text-xs font-bold text-stone-700 dark:text-stone-300">
                {verificationResult.quantity} {verificationResult.unit}
              </div>
            </div>

            <div className="p-4 rounded bg-stone-50 dark:bg-stone-950 border border-stone-200 dark:border-stone-800 space-y-1">
              <span className="text-[10px] text-stone-500 uppercase tracking-widest block">Cryptographic Network</span>
              <div className="font-serif-editorial text-xl text-stone-900 dark:text-stone-100">{verificationResult.network}</div>
              <div className="text-xs text-stone-500">
                Contract:{' '}
                {verificationResult.contract_address ? (
                  <a
                    href={`${EXPLORER_URL}/${verificationResult.contract_address}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-stone-800 dark:text-stone-200 underline decoration-stone-300 inline-flex items-center gap-1"
                  >
                    <span>{truncateAddress(verificationResult.contract_address, 8, 6)}</span>
                    <ExternalLink className="w-3 h-3 text-stone-400" />
                  </a>
                ) : (
                  <span className="italic">SmartPy Shadownet Deployment</span>
                )}
              </div>
            </div>
          </div>

          {/* Cryptographic Proof Ledger */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-xs font-bold text-stone-700 dark:text-stone-300 uppercase tracking-wider">
              <Lock className="w-3.5 h-3.5 text-stone-500" />
              <span>Public Cryptographic Ledger Attestation</span>
            </div>

            <div className="p-5 rounded bg-stone-50 dark:bg-stone-950 border border-stone-200 dark:border-stone-800 space-y-2.5 text-xs">
              {verificationResult.submitted_at && (
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 border-b border-stone-200 dark:border-stone-800/80 pb-2">
                  <span className="text-stone-500 uppercase">SUBMISSION TIMESTAMP:</span>
                  <span className="text-stone-800 dark:text-stone-200">{formatTimestamp(verificationResult.submitted_at)}</span>
                </div>
              )}

              {verificationResult.submission_tx_hash && (
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 border-b border-stone-200 dark:border-stone-800/80 pb-2">
                  <span className="text-stone-500 uppercase">SUBMISSION OP HASH:</span>
                  <a
                    href={`${EXPLORER_URL}/${verificationResult.submission_tx_hash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-stone-800 dark:text-stone-200 hover:underline inline-flex items-center gap-1 font-bold"
                  >
                    <span>{truncateAddress(verificationResult.submission_tx_hash, 10, 6)}</span>
                    <ExternalLink className="w-3 h-3 text-stone-400" />
                  </a>
                </div>
              )}

              {verificationResult.approver_address && (
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 border-b border-stone-200 dark:border-stone-800/80 pb-2">
                  <span className="text-stone-500 uppercase">SIGNING COUNCIL ARBITRATOR:</span>
                  <span className="text-stone-800 dark:text-stone-200 font-bold">
                    {truncateAddress(verificationResult.approver_address, 10, 8)}
                  </span>
                </div>
              )}

              {verificationResult.approval_tx_hash && (
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 border-b border-stone-200 dark:border-stone-800/80 pb-2">
                  <span className="text-stone-500 uppercase">RATIFICATION OP HASH:</span>
                  <a
                    href={`${EXPLORER_URL}/${verificationResult.approval_tx_hash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-stone-800 dark:text-stone-200 hover:underline inline-flex items-center gap-1 font-bold"
                  >
                    <span>{truncateAddress(verificationResult.approval_tx_hash, 10, 6)}</span>
                    <ExternalLink className="w-3 h-3 text-stone-400" />
                  </a>
                </div>
              )}

              <div className="pt-1 flex flex-col gap-1">
                <span className="text-stone-500 uppercase">EVIDENTIARY SHA-256 FINGERPRINT:</span>
                <span className="text-stone-900 dark:text-stone-100 break-all select-all font-bold">
                  {verificationResult.evidence_hash}
                </span>
              </div>
            </div>
          </div>

          {/* Verification Details Notice if specified */}
          {verificationResult.details && (
            <div className="p-3.5 bg-stone-50 dark:bg-stone-950 rounded border border-stone-200 dark:border-stone-800 text-xs text-stone-600 dark:text-stone-400 flex items-start gap-2">
              <Info className="w-4 h-4 text-stone-500 shrink-0 mt-0.5" />
              <span>{verificationResult.details}</span>
            </div>
          )}

          {/* Privacy Protection Notice */}
          <div className="p-4 rounded bg-stone-50 dark:bg-stone-950 border border-stone-200 dark:border-stone-800 text-[11px] text-stone-500 flex items-start gap-2">
            <Lock className="w-4 h-4 text-stone-600 shrink-0 mt-0.5" />
            <span>
              <strong>Cryptographic Privacy Enforced:</strong> Raw photographic proofs and personal student details remain
              strictly protected in secure off-chain storage. Only the cryptographic SHA-256 fingerprint and dual-signoff
              state transitions are permanently inscribed into Tezos big_map storage.
            </span>
          </div>

          {/* Link to Full Activity Details */}
          <div className="pt-2 text-center">
            <Link
              to={`/activity/${verificationResult.activity_id}`}
              className="inline-flex items-center gap-2 text-xs font-bold text-stone-900 dark:text-stone-100 hover:underline uppercase tracking-wider"
            >
              <span>[ Inspect Full Evidentiary Dossier & Lifecycle History ]</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      )}

      {/* Error or Invalid ID State */}
      {!isLoading && activeLookupId && !verificationResult && (
        <div className="rounded-lg bg-stone-50 dark:bg-stone-900 border border-stone-300 dark:border-stone-800 p-8 text-center space-y-4 shadow-sm font-mono-code">
          <div className="stamp-badge border-rose-600 text-rose-700 dark:text-rose-400 mx-auto">
            <AlertCircle className="w-3.5 h-3.5" />
            SPECIMEN NOT FOUND
          </div>
          <div className="space-y-1">
            <h3 className="font-serif-editorial text-2xl text-stone-900 dark:text-stone-100">
              {errorStatus === 404 ? 'No Folio Record on File' : 'Verification Ledger Unavailable'}
            </h3>
            <p className="text-xs text-stone-500 max-w-md mx-auto font-sans">
              {errorMessage || `No verified campus sustainability record corresponds to identifier "${activeLookupId}".`}
            </p>
          </div>
          <div className="pt-2">
            <Link
              to="/history"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded bg-stone-900 hover:bg-black text-white dark:bg-stone-100 dark:hover:bg-white dark:text-stone-950 text-xs uppercase tracking-wider font-bold"
            >
              <span>[ Browse Archival Register ]</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      )}
    </div>
  );
};
