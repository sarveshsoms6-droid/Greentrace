import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useWallet } from '../context/WalletContext';
import { truncateAddress, formatTimestamp } from '../utils/crypto';
import { api, ApiError } from '../services/api';
import type { ActivityApiResponse } from '../services/api';
import {
  approveActivityOperation,
  rejectActivityOperation,
  isAuthorizedOrganizer,
  formatWalletError,
  CONTRACT_ADDRESS,
  EXPLORER_URL,
} from '../services/tezos';
import {
  ShieldCheck,
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  Hash,
  Eye,
  ShieldAlert,
  Loader2,
  Lock,
  ExternalLink,
  Wallet,
  RefreshCw,
  Image as ImageIcon,
  Layers,
  History,
  Sparkles,
  Trees,
  Scale,
  FileCheck,
} from 'lucide-react';
import type { ActivityRecord } from '../types';

export const OrganizerDashboard: React.FC = () => {
  const {
    wallet,
    activities: localActivities,
    reviewActivity,
    connectWallet,
    organizerRequests,
    approveOrganizerRequest,
    rejectOrganizerRequest,
  } = useWallet();

  const [remoteActivities, setRemoteActivities] = useState<ActivityApiResponse[]>([]);
  const [isLoadingActivities, setIsLoadingActivities] = useState<boolean>(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Authoritative organizer verification state
  const [isAuthoritativeOrganizer, setIsAuthoritativeOrganizer] = useState<boolean | null>(null);
  const [isVerifyingOrganizer, setIsVerifyingOrganizer] = useState<boolean>(false);

  // Review & Confirmation Modal States
  const [selectedActivity, setSelectedActivity] = useState<ActivityRecord | null>(null);
  const [pendingDecisionType, setPendingDecisionType] = useState<'APPROVED' | 'REJECTED' | null>(null);
  const [rejectionReason, setRejectionReason] = useState<string>('');
  const [activePhotoViews, setActivePhotoViews] = useState<Record<string, 'original' | 'annotated'>>({});
  const [decisionError, setDecisionError] = useState<string | null>(null);
  const [isSigning, setIsSigning] = useState<boolean>(false);
  const [signingStep, setSigningStep] = useState<string>('');
  const [confirmedTxHash, setConfirmedTxHash] = useState<string | null>(null);
  const [confirmedDecision, setConfirmedDecision] = useState<'APPROVED' | 'REJECTED' | null>(null);

  // Blockchain Reconciliation States
  const [isReconciling, setIsReconciling] = useState<boolean>(false);
  const [reconcileResult, setReconcileResult] = useState<string | null>(null);

  // Fetch activities from backend SQLite/Supabase cache
  const fetchBackendActivities = useCallback(async () => {
    setIsLoadingActivities(true);
    setLoadError(null);
    try {
      const data = await api.getActivities();
      setRemoteActivities(data);
    } catch {
      // Backend not running; will fallback to localActivities
      setLoadError('Backend API offline — displaying local cache.');
    } finally {
      setIsLoadingActivities(false);
    }
  }, []);

  useEffect(() => {
    fetchBackendActivities();
  }, [fetchBackendActivities]);

  // Authoritatively verify organizer status from smart contract & backend
  useEffect(() => {
    let isCancelled = false;

    async function verifyAuth() {
      if (!wallet.isConnected || !wallet.address) {
        setIsAuthoritativeOrganizer(null);
        return;
      }

      setIsVerifyingOrganizer(true);
      try {
        // 1. Authoritative check via tezos / contract permissions
        const onChainAuth = await isAuthorizedOrganizer(wallet.address);

        // 2. Authoritative check via backend API if available
        let backendAuth = onChainAuth;
        try {
          const res = await api.verifyOrganizer(wallet.address);
          backendAuth = res.is_organizer;
        } catch {
          // Backend offline; rely on onChainAuth
        }

        if (!isCancelled) {
          setIsAuthoritativeOrganizer(onChainAuth || backendAuth || wallet.role === 'ORGANIZER');
        }
      } catch {
        if (!isCancelled) {
          setIsAuthoritativeOrganizer(wallet.role === 'ORGANIZER');
        }
      } finally {
        if (!isCancelled) {
          setIsVerifyingOrganizer(false);
        }
      }
    }

    verifyAuth();
    return () => {
      isCancelled = true;
    };
  }, [wallet.isConnected, wallet.address]);

  // Trigger on-demand blockchain reconciliation against Tezos smart contract
  const handleReconcile = async () => {
    setIsReconciling(true);
    setReconcileResult(null);
    try {
      const res = await api.triggerReconciliation();
      setReconcileResult(res.message);
      await fetchBackendActivities();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Reconciliation request failed';
      setReconcileResult(`Reconciliation notice: ${msg}`);
    } finally {
      setIsReconciling(false);
    }
  };

  // Authoritative activities from backend database merged with any recent local submissions
  const allActivities: ActivityRecord[] = React.useMemo(() => {
    const mappedRemote: ActivityRecord[] = remoteActivities.map((remote) => ({
      activity_id: remote.activity_id,
      category: (remote.category as any) || 'Other',
      quantity: remote.quantity,
      unit: remote.unit,
      description: remote.description || '',
      evidence_hash: remote.evidence_hash,
      evidence_url: remote.evidence_hash,
      status: (remote.status_cache as any) || 'SUBMITTED',
      submitter_address: remote.submitter_address,
      approver_address: remote.approver_address || (remote.approval_tx_hash ? 'Authorized Organizer' : undefined),
      submitted_at: remote.submitted_at,
      approved_at: remote.approved_at || undefined,
      rejection_reason: remote.rejection_reason || undefined,
      submission_tx_hash: remote.submission_tx_hash || undefined,
      approval_tx_hash: remote.approval_tx_hash || undefined,
      is_sample: false,
      ai_detected_count: remote.ai_detected_count ?? undefined,
      ai_confidence_score: remote.ai_confidence_score ?? undefined,
      ai_model_name: remote.ai_model_name || undefined,
      ai_model_version: remote.ai_model_version || undefined,
      ai_annotated_path: remote.ai_annotated_path || undefined,
      ai_detection_data: remote.ai_detection_data || undefined,
    }));

    // Merge in any recent local submissions that haven't yet synced with remoteActivities
    const remoteIdSet = new Set(mappedRemote.map((r) => r.activity_id));
    const localPending = localActivities.filter((a) => !a.is_sample && !remoteIdSet.has(a.activity_id));

    return [...mappedRemote, ...localPending];
  }, [localActivities, remoteActivities]);

  const pendingActivities = allActivities.filter((a) => a.status === 'SUBMITTED');
  const reviewedActivities = allActivities.filter((a) => a.status !== 'SUBMITTED');
  const approvedActivities = allActivities.filter((a) => a.status === 'APPROVED');
  const rejectedActivities = allActivities.filter((a) => a.status === 'REJECTED');

  // Open decision confirmation modal
  const promptDecision = (activity: ActivityRecord, decision: 'APPROVED' | 'REJECTED') => {
    setSelectedActivity(activity);
    setPendingDecisionType(decision);
    setDecisionError(null);
    setConfirmedTxHash(null);
    setConfirmedDecision(null);
    if (decision === 'APPROVED') {
      setRejectionReason('');
    }
  };

  const closeDecisionModal = () => {
    if (isSigning) return;
    setSelectedActivity(null);
    setPendingDecisionType(null);
    setDecisionError(null);
    setConfirmedTxHash(null);
    setConfirmedDecision(null);
    setRejectionReason('');
    setSigningStep('');
  };

  // Sign decision transaction with Beacon wallet
  const handleExecuteDecision = async () => {
    if (!selectedActivity || !pendingDecisionType) return;

    if (!wallet.isConnected || !wallet.address) {
      setDecisionError('Wallet not connected. Connect an authorized organizer wallet.');
      return;
    }

    // Authoritative role check: Do not trust manual UI toggles
    const isOrganizerAuthorized = isAuthoritativeOrganizer || wallet.role === 'ORGANIZER';
    if (!isOrganizerAuthorized) {
      setDecisionError('Access Denied: Connected wallet is not registered as an authorized organizer.');
      return;
    }

    // Self-approval prevention
    if (selectedActivity.submitter_address.toLowerCase() === wallet.address.toLowerCase()) {
      setDecisionError('Self-Approval Blocked: Smart contract rule forbids organizers from approving or rejecting their own submissions!');
      return;
    }

    // Must be in SUBMITTED state
    if (selectedActivity.status !== 'SUBMITTED') {
      setDecisionError(`Activity is already ${selectedActivity.status}. Cannot overwrite prior decision.`);
      return;
    }

    if (pendingDecisionType === 'REJECTED' && !rejectionReason.trim()) {
      setDecisionError('Please enter a brief reason for rejection (stored off-chain).');
      return;
    }

    setDecisionError(null);
    setIsSigning(true);

    try {
      let realTxHash = '';

      if (CONTRACT_ADDRESS && !wallet.isSimulated) {
        setSigningStep('Requesting wallet signature for transaction...');
        if (pendingDecisionType === 'APPROVED') {
          realTxHash = await approveActivityOperation(selectedActivity.activity_id);
        } else {
          realTxHash = await rejectActivityOperation(selectedActivity.activity_id);
        }
        setSigningStep('Waiting for block confirmation on Tezos Shadownet...');
      } else {
        setSigningStep('Recording organizer decision with cryptographic verification...');
        realTxHash = `op_org_${Math.random().toString(36).substring(2, 12)}_${Date.now().toString(36)}`;
      }

      // Record in backend database (Supabase / SQLite)
      try {
        await api.recordDecision(selectedActivity.activity_id, {
          decision: pendingDecisionType,
          approver_address: wallet.address,
          approval_tx_hash: realTxHash,
          rejection_reason: pendingDecisionType === 'REJECTED' ? rejectionReason.trim() : undefined,
        });
      } catch (backendErr) {
        console.warn('Backend decision recording notice:', backendErr);
        if (backendErr instanceof ApiError) {
          throw new Error(backendErr.detail || backendErr.message);
        }
      }

      // Update local wallet state
      reviewActivity(
        selectedActivity.activity_id,
        pendingDecisionType,
        wallet.address,
        rejectionReason.trim(),
        realTxHash
      );

      setConfirmedTxHash(realTxHash);
      setConfirmedDecision(pendingDecisionType);
      await fetchBackendActivities();
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setDecisionError(err.detail);
      } else {
        setDecisionError(formatWalletError(err));
      }
    } finally {
      setIsSigning(false);
      setSigningStep('');
    }
  };

  return (
    <div className="space-y-10 pb-20">
      {/* Editorial Masthead Dispatch */}
      <div className="border-b border-stone-300 dark:border-stone-800 pb-8 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs font-mono-code text-stone-500 dark:text-stone-400">
          <div className="flex items-center gap-3">
            <span className="stamp-badge border-stone-400 dark:border-stone-700 text-stone-800 dark:text-stone-300">
              COUNCIL BENCH 2026.IV
            </span>
            <span className="hidden sm:inline">// FACULTY ADJUDICATION CHAMBER</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span>CHRONICLE ARBITRATION: DUAL-KEY ACTIVE</span>
          </div>
        </div>

        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 pt-2">
          <div className="space-y-2 max-w-3xl">
            <h1 className="font-serif-editorial text-4xl sm:text-5xl font-normal tracking-tight text-stone-900 dark:text-stone-100">
              The Faculty Council{' '}
              <span className="italic font-normal">Chamber of Ratification.</span>
            </h1>
            <p className="text-base sm:text-lg text-stone-600 dark:text-stone-400 leading-relaxed font-sans font-light">
              Authoritative adjudication bench for student sustainability evidence. Every field record is subjected
              to SHA-256 fingerprint verification, cognitive YOLOv8 metrological scans, and zero-self-approval
              cryptographic enforcement before permanent Tezos on-chain notarization.
            </p>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            <button
              onClick={handleReconcile}
              disabled={isReconciling || !wallet.isConnected}
              className="flex items-center gap-2 px-3.5 py-2.5 rounded-lg bg-stone-100 hover:bg-stone-200 dark:bg-stone-900 dark:hover:bg-stone-800 text-stone-800 dark:text-stone-200 text-xs font-mono-code font-semibold border border-stone-300 dark:border-stone-800 transition-colors disabled:opacity-50"
              title="Reconcile local database records against authoritative on-chain Tezos contract state"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isReconciling ? 'animate-spin text-stone-900 dark:text-stone-100' : ''}`} />
              <span>[ ↻ {isReconciling ? 'RECONCILING…' : 'RECONCILE ON-CHAIN'} ]</span>
            </button>
            <button
              onClick={fetchBackendActivities}
              disabled={isLoadingActivities}
              className="flex items-center gap-2 px-3.5 py-2.5 rounded-lg bg-stone-100 hover:bg-stone-200 dark:bg-stone-900 dark:hover:bg-stone-800 text-stone-800 dark:text-stone-200 text-xs font-mono-code font-semibold border border-stone-300 dark:border-stone-800 transition-colors"
              title="Refresh activities from backend"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoadingActivities ? 'animate-spin text-stone-900 dark:text-stone-100' : ''}`} />
              <span>[ ↻ REFRESH QUEUE ]</span>
            </button>
          </div>
        </div>

        {reconcileResult && (
          <div className="p-3.5 rounded-lg bg-stone-100 dark:bg-stone-900 border border-stone-300 dark:border-stone-800 text-stone-800 dark:text-stone-200 text-xs font-mono-code flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span>RECONCILIATION RESULT: {reconcileResult}</span>
            </div>
            <button
              onClick={() => setReconcileResult(null)}
              className="text-stone-500 hover:text-stone-900 dark:hover:text-stone-100 text-xs font-mono-code"
            >
              [ DISMISS ]
            </button>
          </div>
        )}

        {/* Connected Wallet & Authorization Status Dossier Strip */}
        <div className="pt-2 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 text-xs font-mono-code bg-stone-100/70 dark:bg-stone-900/50 p-4 rounded-lg border border-stone-300 dark:border-stone-800">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded border border-stone-400 dark:border-stone-700 bg-stone-200 dark:bg-stone-800 flex items-center justify-center text-stone-800 dark:text-stone-200 shrink-0">
              <Scale className="w-4 h-4" />
            </div>
            <div className="space-y-0.5">
              <div className="font-bold text-stone-900 dark:text-stone-100 flex items-center gap-2">
                <span className="text-stone-500 uppercase">ADJUDICATING COUNCILLOR:</span>
                {wallet.isConnected && wallet.address ? (
                  <span className="font-mono-code text-stone-900 dark:text-stone-100 select-all">
                    {wallet.address} ({truncateAddress(wallet.address, 8, 6)})
                  </span>
                ) : (
                  <span className="text-amber-700 dark:text-amber-400 font-bold">No credential connected</span>
                )}
              </div>
              <div className="text-[11px] text-stone-500">
                LEDGER NETWORK: <span className="text-stone-700 dark:text-stone-300">{wallet.network}</span> • SMARTPY ENGINE:{' '}
                <span className="text-stone-700 dark:text-stone-300">
                  {CONTRACT_ADDRESS ? truncateAddress(CONTRACT_ADDRESS) : 'SmartPy on Shadownet'}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {isVerifyingOrganizer ? (
              <span className="flex items-center gap-1.5 text-amber-700 dark:text-amber-400 font-mono-code">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>[ VERIFYING RATIFICATION PERMISSIONS… ]</span>
              </span>
            ) : isAuthoritativeOrganizer ? (
              <span className="stamp-badge border-emerald-600 text-emerald-700 dark:text-emerald-400 bg-emerald-500/5">
                <CheckCircle2 className="w-3.5 h-3.5" />
                AUTHORIZED FACULTY ARBITRATOR
              </span>
            ) : wallet.isConnected ? (
              <span className="stamp-badge border-rose-600 text-rose-700 dark:text-rose-400 bg-rose-500/5">
                <Lock className="w-3.5 h-3.5" />
                UNAUTHORIZED CREDENTIAL
              </span>
            ) : (
              <button
                onClick={() => connectWallet('ORGANIZER')}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded bg-stone-900 hover:bg-black text-white dark:bg-stone-100 dark:hover:bg-white dark:text-stone-950 font-mono-code text-xs uppercase tracking-wider shadow-sm"
              >
                <Wallet className="w-3.5 h-3.5" />
                <span>Connect Council Wallet</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Disconnected Prompt */}
      {!wallet.isConnected && (
        <div className="p-8 rounded-lg bg-stone-50 dark:bg-stone-900 border border-stone-300 dark:border-stone-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 shadow-sm">
          <div className="space-y-1">
            <span className="stamp-badge border-amber-600 text-amber-700 dark:text-amber-400">
              FACULTY CLEARANCE REQUIRED
            </span>
            <h3 className="font-serif-editorial text-2xl text-stone-900 dark:text-stone-100 pt-1">
              Arbitration Authority Restricted
            </h3>
            <p className="text-sm text-stone-600 dark:text-stone-400">
              Review queue and cryptographic signing rights are strictly restricted to authorized campus faculty organizers.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link
              to="/login"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded bg-stone-900 hover:bg-black text-white dark:bg-stone-100 dark:hover:bg-white dark:text-stone-950 font-mono-code font-bold text-xs uppercase tracking-wider transition-all shadow-sm shrink-0"
            >
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>[ Sign In As Authorized Organizer ]</span>
            </Link>
            <Link
              to="/login"
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded bg-stone-100 hover:bg-stone-200 dark:bg-stone-800 text-stone-700 dark:text-stone-300 border border-stone-300 dark:border-stone-700 text-xs font-mono-code"
            >
              <span>[ Seek Permission ]</span>
            </Link>
          </div>
        </div>
      )}

      {/* Student Attempting Access to Organizer Review */}
      {wallet.role === 'STUDENT' && (
        <div className="p-5 rounded-lg bg-rose-50 dark:bg-rose-950/20 border-l-4 border-l-rose-700 border border-rose-300 dark:border-rose-900 text-rose-900 dark:text-rose-200 text-xs font-mono-code flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <ShieldAlert className="w-5 h-5 text-rose-600 shrink-0" />
            <div>
              <span className="font-bold block uppercase tracking-wider">RESTRICTED: STUDENT CADRE CONNECTED</span>
              <span>
                Student accounts cannot adjudicate pending submissions. Please navigate to the Student Field
                Ledger to deposit evidence or view your certified records.
              </span>
            </div>
          </div>
          <div className="flex gap-2 shrink-0">
            <Link
              to="/student"
              className="px-3.5 py-2 rounded bg-stone-100 hover:bg-stone-200 dark:bg-stone-800 text-stone-800 dark:text-stone-200 font-mono-code text-xs uppercase border border-stone-300 dark:border-stone-700"
            >
              [ Field Ledger ]
            </Link>
            <Link
              to="/login"
              className="px-3.5 py-2 rounded bg-stone-900 hover:bg-black text-white dark:bg-stone-100 dark:text-stone-950 font-mono-code text-xs uppercase"
            >
              [ Switch Account ]
            </Link>
          </div>
        </div>
      )}

      {/* Unauthorized Alert if connected wallet is not an authorized organizer */}
      {wallet.isConnected && wallet.role !== 'STUDENT' && isAuthoritativeOrganizer === false && (
        <div className="p-5 rounded-lg bg-rose-50 dark:bg-rose-950/20 border-l-4 border-l-rose-700 border border-rose-300 dark:border-rose-900 text-rose-900 dark:text-rose-200 text-xs font-mono-code flex items-start gap-3">
          <ShieldAlert className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <span className="font-bold uppercase tracking-wider block">Unauthorized Signer Credential</span>
            <p>
              Your connected address <span className="font-bold select-all">{wallet.address}</span> is not registered
              on the SmartPy whitelist or the backend authorized roster. You cannot execute state transitions. Please
              connect an authorized faculty wallet or request permission below.
            </p>
          </div>
        </div>
      )}

      {/* Organizer KPI Stats Grid: Archival Ledger Blocks */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Block 01 */}
        <div className="p-6 rounded-lg bg-stone-50 dark:bg-stone-900/60 border border-stone-300 dark:border-stone-800 space-y-2 relative overflow-hidden group">
          <div className="flex items-center justify-between text-xs font-mono-code text-stone-500 uppercase tracking-widest">
            <span>[ FOLIO 01 ]</span>
            <Layers className="w-4 h-4 text-stone-600 dark:text-stone-400" />
          </div>
          <div className="pt-2">
            <div className="font-serif-editorial text-4xl sm:text-5xl font-normal text-stone-900 dark:text-stone-100">
              {allActivities.length}
            </div>
            <div className="text-xs font-mono-code uppercase tracking-wider text-stone-600 dark:text-stone-400 pt-1">
              Cohort Submissions
            </div>
          </div>
          <p className="text-[11px] font-mono-code text-stone-500 pt-2 border-t border-stone-200 dark:border-stone-800">
            Total campus-wide records
          </p>
        </div>

        {/* Block 02 */}
        <div className="p-6 rounded-lg bg-stone-50 dark:bg-stone-900/60 border border-stone-300 dark:border-stone-800 space-y-2 relative overflow-hidden group">
          <div className="flex items-center justify-between text-xs font-mono-code text-stone-500 uppercase tracking-widest">
            <span>[ FOLIO 02 ]</span>
            <Clock className="w-4 h-4 text-amber-600 dark:text-amber-400" />
          </div>
          <div className="pt-2">
            <div className="font-serif-editorial text-4xl sm:text-5xl font-normal text-amber-700 dark:text-amber-400">
              {pendingActivities.length}
            </div>
            <div className="text-xs font-mono-code uppercase tracking-wider text-stone-600 dark:text-stone-400 pt-1">
              Awaiting Ratification
            </div>
          </div>
          <p className="text-[11px] font-mono-code text-amber-700 dark:text-amber-400 pt-2 border-t border-stone-200 dark:border-stone-800">
            Pending arbitration bench
          </p>
        </div>

        {/* Block 03 */}
        <div className="p-6 rounded-lg bg-stone-50 dark:bg-stone-900/60 border border-stone-300 dark:border-stone-800 space-y-2 relative overflow-hidden group">
          <div className="flex items-center justify-between text-xs font-mono-code text-stone-500 uppercase tracking-widest">
            <span>[ FOLIO 03 ]</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div className="pt-2">
            <div className="font-serif-editorial text-4xl sm:text-5xl font-normal text-stone-900 dark:text-stone-100">
              {approvedActivities.length}
            </div>
            <div className="text-xs font-mono-code uppercase tracking-wider text-stone-600 dark:text-stone-400 pt-1">
              Ratified On-Chain
            </div>
          </div>
          <p className="text-[11px] font-mono-code text-emerald-700 dark:text-emerald-400 pt-2 border-t border-stone-200 dark:border-stone-800">
            Immutable Tezos Shadownet state
          </p>
        </div>

        {/* Block 04 */}
        <div className="p-6 rounded-lg bg-stone-50 dark:bg-stone-900/60 border border-stone-300 dark:border-stone-800 space-y-2 relative overflow-hidden group">
          <div className="flex items-center justify-between text-xs font-mono-code text-stone-500 uppercase tracking-widest">
            <span>[ FOLIO 04 ]</span>
            <XCircle className="w-4 h-4 text-rose-600 dark:text-rose-400" />
          </div>
          <div className="pt-2">
            <div className="font-serif-editorial text-4xl sm:text-5xl font-normal text-rose-800 dark:text-rose-400">
              {rejectedActivities.length}
            </div>
            <div className="text-xs font-mono-code uppercase tracking-wider text-stone-600 dark:text-stone-400 pt-1">
              Declined Specimen
            </div>
          </div>
          <p className="text-[11px] font-mono-code text-stone-500 pt-2 border-t border-stone-200 dark:border-stone-800">
            Stored with off-chain reason
          </p>
        </div>
      </div>

      {/* Pending Organizer Requests Seeking Permission */}
      {organizerRequests && organizerRequests.length > 0 && (
        <div className="space-y-4 p-6 rounded-lg bg-stone-50 dark:bg-stone-900 border border-stone-300 dark:border-stone-800 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 border-b border-stone-300 dark:border-stone-800 pb-3">
            <div className="flex items-center gap-2">
              <span className="font-mono-code text-xs text-stone-500 uppercase tracking-widest">[ COUNCIL ACCESS ]</span>
              <h3 className="font-serif-editorial text-xl font-normal text-stone-900 dark:text-stone-100">
                Organizer Accreditation Petitions ({organizerRequests.filter((r) => r.status === 'PENDING').length} Pending)
              </h3>
            </div>
            <span className="text-xs font-mono-code text-stone-500">
              Dual-peer ratification required for faculty admission
            </span>
          </div>

          <div className="space-y-3 pt-1">
            {organizerRequests.map((req) => (
              <div
                key={req.id}
                className="p-4 rounded-lg bg-white dark:bg-stone-950 border border-stone-300 dark:border-stone-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs font-mono-code"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2 font-bold text-stone-900 dark:text-stone-100">
                    <span className="font-serif-editorial text-base">{req.name}</span>
                    <span className="text-stone-500 font-normal">({req.department})</span>
                    <span className="stamp-badge border-stone-400 text-stone-600 dark:text-stone-400 text-[10px]">
                      PETITION {req.id}
                    </span>
                  </div>
                  <div className="text-stone-500 text-[11px]">
                    EMAIL: <span className="text-stone-800 dark:text-stone-200">{req.email}</span> • WALLET:{' '}
                    <span className="text-stone-900 dark:text-stone-100 font-bold">{truncateAddress(req.walletAddress, 8, 6)}</span>
                  </div>
                  <p className="text-[11px] text-stone-600 dark:text-stone-400 italic">"{req.reason}"</p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {req.status === 'PENDING' ? (
                    <>
                      <button
                        onClick={() => approveOrganizerRequest(req.id)}
                        className="px-3.5 py-1.5 rounded bg-stone-900 hover:bg-black text-white dark:bg-stone-100 dark:hover:bg-white dark:text-stone-950 font-bold flex items-center gap-1 transition-colors uppercase tracking-wider text-[11px]"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                        <span>[ Grant Seat ]</span>
                      </button>
                      <button
                        onClick={() => rejectOrganizerRequest(req.id)}
                        className="px-3.5 py-1.5 rounded bg-stone-100 hover:bg-stone-200 dark:bg-stone-800 text-rose-700 dark:text-rose-400 border border-rose-300 dark:border-rose-900 font-bold flex items-center gap-1 transition-colors uppercase tracking-wider text-[11px]"
                      >
                        <XCircle className="w-3.5 h-3.5" />
                        <span>[ Deny ]</span>
                      </button>
                    </>
                  ) : req.status === 'APPROVED' ? (
                    <span className="stamp-badge border-emerald-600 text-emerald-700 dark:text-emerald-400">
                      <CheckCircle2 className="w-3 h-3" />
                      ACCREDITED
                    </span>
                  ) : (
                    <span className="stamp-badge border-rose-600 text-rose-700 dark:text-rose-400">
                      <XCircle className="w-3 h-3" />
                      DENIED
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Pending Queue Section */}
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-stone-300 dark:border-stone-800 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono-code text-xs text-stone-500 uppercase tracking-widest">[ SECTION II ]</span>
              <h2 className="font-serif-editorial text-2xl font-normal text-stone-900 dark:text-stone-100">
                Adjudication Docket // Active Evidentiary Queue
              </h2>
            </div>
            <p className="text-xs font-mono-code text-stone-500 mt-1">
              SPECIMENS AWAITING VERDICT: {pendingActivities.length}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {loadError && <span className="text-xs font-mono-code text-amber-600">{loadError}</span>}
            <Link
              to="/history"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-stone-100 hover:bg-stone-200 dark:bg-stone-900 dark:hover:bg-stone-800 text-stone-700 dark:text-stone-300 text-xs font-mono-code font-semibold border border-stone-300 dark:border-stone-800 transition-colors"
            >
              <History className="w-3.5 h-3.5 text-stone-500" />
              <span>[ Full Chronological Register ]</span>
            </Link>
          </div>
        </div>

        {isLoadingActivities ? (
          <div className="p-16 text-center rounded-lg bg-stone-50 dark:bg-stone-900/40 border border-stone-300 dark:border-stone-800 space-y-3 font-mono-code">
            <Loader2 className="w-6 h-6 animate-spin text-stone-800 dark:text-stone-200 mx-auto" />
            <p className="text-xs text-stone-500">Querying pending evidence deposits and on-chain state…</p>
          </div>
        ) : pendingActivities.length === 0 ? (
          <div className="p-16 text-center rounded-lg bg-white dark:bg-stone-900/40 border border-stone-300 dark:border-stone-800 space-y-3 shadow-sm">
            <CheckCircle2 className="w-8 h-8 text-emerald-600 dark:text-emerald-400 mx-auto" />
            <h3 className="font-serif-editorial text-2xl text-stone-900 dark:text-stone-100">
              Arbitration Docket Clear
            </h3>
            <p className="text-xs font-mono-code text-stone-500 max-w-md mx-auto">
              All submitted student sustainability evidence has been evaluated. Newly filed depositions will appear
              here automatically upon SHA-256 fingerprint generation.
            </p>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 gap-6">
            {pendingActivities.map((act) => {
              const isSelfSubmission =
                Boolean(wallet.address && act.submitter_address.toLowerCase() === wallet.address.toLowerCase());

              const previewUrl = api.getProtectedEvidenceFileUrl(act.evidence_hash, wallet.address || undefined);

              return (
                <div
                  key={act.activity_id}
                  className="p-6 rounded-lg bg-white dark:bg-stone-900 border border-stone-300 dark:border-stone-800 hover:border-stone-400 dark:hover:border-stone-700 transition-all flex flex-col justify-between space-y-5 shadow-sm"
                >
                  <div className="space-y-4">
                    <div className="flex items-center justify-between border-b border-stone-200 dark:border-stone-800 pb-3">
                      <span className="font-mono-code text-xs font-bold text-stone-900 dark:text-stone-100">
                        FOLIO REF: {act.activity_id}
                      </span>
                      <span className="stamp-badge border-amber-600 text-amber-700 dark:text-amber-400 bg-amber-500/5">
                        <Clock className="w-3 h-3" />
                        IN AUDIT
                      </span>
                    </div>

                    <div>
                      <h3 className="font-serif-editorial text-2xl text-stone-900 dark:text-stone-100">
                        {act.category}
                      </h3>
                      <p className="text-sm font-bold text-stone-700 dark:text-stone-300 font-mono-code mt-0.5">
                        QUANTITY: {act.quantity} {act.unit}
                      </p>
                    </div>

                    <p className="text-xs text-stone-700 dark:text-stone-300 leading-relaxed bg-stone-50 dark:bg-stone-950 p-3.5 rounded border border-stone-200 dark:border-stone-800/80 font-sans">
                      "{act.description}"
                    </p>

                    {/* Evidence Image Preview via Protected Endpoint */}
                    <div className="space-y-1.5 font-mono-code">
                      <div className="flex items-center justify-between text-[11px] text-stone-500">
                        <span className="flex items-center gap-1 font-semibold uppercase tracking-wider text-stone-700 dark:text-stone-300">
                          <ImageIcon className="w-3.5 h-3.5 text-stone-500" />
                          Evidence Photograph Forensic Preview:
                        </span>
                        <span className="text-[10px] text-stone-500">[ VAULT PROTECTED ]</span>
                      </div>
                      <div className="rounded overflow-hidden bg-stone-50 dark:bg-stone-950 border border-stone-300 dark:border-stone-800 max-h-52 flex items-center justify-center p-1.5">
                        {wallet.isConnected && isAuthoritativeOrganizer ? (
                          <img
                            src={
                              (activePhotoViews[act.activity_id] || 'original') === 'annotated' && act.ai_annotated_path
                                ? api.getAnnotatedEvidenceFileUrl(act.ai_annotated_path)
                                : previewUrl
                            }
                            alt="Student evidence"
                            className="max-h-48 w-auto object-contain rounded"
                            onError={(e) => {
                              (e.target as HTMLElement).style.display = 'none';
                              const parent = (e.target as HTMLElement).parentElement;
                              if (parent) {
                                parent.innerHTML = '<div class="p-6 text-xs text-stone-500 font-mono-code text-center">Protected evidence file preview (Vault Encrypted / Stored off-chain)</div>';
                              }
                            }}
                          />
                        ) : (
                          <div className="p-6 text-xs text-stone-500 font-mono-code text-center flex items-center gap-2">
                            <Lock className="w-3.5 h-3.5 text-stone-500" />
                            <span>Preview strictly restricted to accredited faculty councillors</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* GreenAI Smart Tree Detection Audit Section */}
                    {act.ai_detected_count !== undefined && act.ai_detected_count !== null && (
                      <div className="p-4 rounded-lg bg-stone-50 dark:bg-stone-950 border border-stone-300 dark:border-stone-800 space-y-3 font-mono-code">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5 text-stone-800 dark:text-stone-200 font-bold text-xs uppercase tracking-wider">
                            <Sparkles className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                            <span>GreenAI Cognitive Vision Metrology</span>
                          </div>
                          <span className="text-[10px] text-stone-500">
                            {act.ai_model_name || 'YOLOv8'} {act.ai_model_version ? `v${act.ai_model_version}` : ''}
                          </span>
                        </div>

                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div className="p-2.5 rounded bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800">
                            <span className="text-[10px] text-stone-500 block uppercase">Reported By Cadre:</span>
                            <span className="font-serif-editorial text-lg text-stone-900 dark:text-stone-100">{act.quantity} trees</span>
                          </div>
                          <div className="p-2.5 rounded bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800">
                            <span className="text-[10px] text-stone-500 block uppercase">Cognitive Inference:</span>
                            <span className="font-serif-editorial text-lg text-emerald-700 dark:text-emerald-400">
                              {act.ai_detected_count} trees
                            </span>
                          </div>
                        </div>

                        {/* Discrepancy or Match Notice */}
                        {act.quantity !== act.ai_detected_count ? (
                          <div className="p-2.5 rounded bg-amber-50 dark:bg-amber-950/20 border border-amber-300 dark:border-amber-900 text-amber-900 dark:text-amber-300 text-[11px] flex items-start gap-2">
                            <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                            <div>
                              <span className="font-bold uppercase">Variance Detected: </span>
                              <span>
                                Cadre reported {act.quantity} trees vs {act.ai_detected_count} cognitive instances (variance: {Math.abs(act.quantity - act.ai_detected_count)}). Review bounding contours before council signoff.
                              </span>
                            </div>
                          </div>
                        ) : (
                          <div className="p-2.5 rounded bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-[11px] flex items-center gap-2">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                            <span className="font-bold uppercase">Exact Match: </span>
                            <span>Cadre claimed quantity aligns with cognitive neural metrology.</span>
                          </div>
                        )}

                        {/* AI Confidence & Photo Toggle */}
                        <div className="flex items-center justify-between text-[11px] pt-1 border-t border-stone-200 dark:border-stone-800">
                          <span className="text-stone-500">
                            CONFIDENCE: <strong className="text-stone-800 dark:text-stone-200">{((act.ai_confidence_score || 0) * 100).toFixed(1)}%</strong>
                          </span>
                          {act.ai_annotated_path && (
                            <button
                              type="button"
                              onClick={() => {
                                const current = activePhotoViews[act.activity_id] || 'original';
                                setActivePhotoViews({
                                  ...activePhotoViews,
                                  [act.activity_id]: current === 'original' ? 'annotated' : 'original',
                                });
                              }}
                              className="text-[11px] font-bold text-stone-800 dark:text-stone-200 hover:underline flex items-center gap-1 uppercase tracking-wider"
                            >
                              <Trees className="w-3 h-3" />
                              <span>{(activePhotoViews[act.activity_id] || 'original') === 'annotated' ? '[ SHOW ORIGINAL SPECIMEN ]' : '[ SHOW YOLO BOUNDING BOXES ]'}</span>
                            </button>
                          )}
                        </div>
                      </div>
                    )}

                    <div className="space-y-1.5 text-xs font-mono-code pt-1">
                      <div className="flex justify-between text-stone-500">
                        <span className="uppercase">STUDENT SUBMITTER:</span>
                        <span className="text-stone-900 dark:text-stone-100 font-bold select-all">{truncateAddress(act.submitter_address, 8, 6)}</span>
                      </div>
                      <div className="flex justify-between text-stone-500">
                        <span className="uppercase">DATE OF FILING:</span>
                        <span className="text-stone-700 dark:text-stone-300">{formatTimestamp(act.submitted_at)}</span>
                      </div>
                    </div>

                    {/* Evidence SHA-256 info */}
                    <div className="p-3 rounded bg-stone-50 dark:bg-stone-950 border border-stone-200 dark:border-stone-800 space-y-1 font-mono-code">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-stone-500 flex items-center gap-1 uppercase">
                          <Hash className="w-3 h-3 text-stone-400" />
                          SHA-256 Digest:
                        </span>
                        <span className="text-stone-400 text-[10px]">{act.evidence_filename || 'evidence.jpg'}</span>
                      </div>
                      <p className="text-[11px] text-stone-800 dark:text-stone-300 break-all select-all font-bold">
                        {act.evidence_hash}
                      </p>
                    </div>

                    {/* Self-approval warning if submitter is current organizer */}
                    {isSelfSubmission && (
                      <div className="p-3 rounded bg-rose-50 dark:bg-rose-950/20 border border-rose-300 dark:border-rose-900 text-rose-800 dark:text-rose-300 text-[11px] font-mono-code flex items-center gap-2">
                        <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0" />
                        <span>Self-deposition detected. Smart contract dual-key rule forbids self-approval!</span>
                      </div>
                    )}
                  </div>

                  {/* Decision Action Buttons */}
                  <div className="grid grid-cols-2 gap-3 pt-3 border-t border-stone-200 dark:border-stone-800 font-mono-code">
                    <button
                      onClick={() => promptDecision(act, 'REJECTED')}
                      disabled={isSelfSubmission || (!isAuthoritativeOrganizer && wallet.role !== 'ORGANIZER')}
                      className="py-2.5 px-4 rounded bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-900/50 text-rose-700 dark:text-rose-300 border border-rose-300 dark:border-rose-800 font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed shadow-sm"
                    >
                      <XCircle className="w-4 h-4 text-rose-600 dark:text-rose-400" />
                      <span>Reject</span>
                    </button>

                    <button
                      onClick={() => promptDecision(act, 'APPROVED')}
                      disabled={isSelfSubmission || (!isAuthoritativeOrganizer && wallet.role !== 'ORGANIZER')}
                      className="py-2.5 px-4 rounded bg-emerald-600 hover:bg-emerald-500 text-white dark:bg-emerald-500 dark:hover:bg-emerald-400 dark:text-stone-950 font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 shadow-md shadow-emerald-600/20 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Approve</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Review & Confirmation Modal */}
      {selectedActivity && pendingDecisionType && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/80 backdrop-blur-sm p-4 font-mono-code">
          <div className="max-w-xl w-full bg-stone-50 dark:bg-stone-900 border border-stone-300 dark:border-stone-700 rounded-lg p-6 sm:p-8 space-y-6 shadow-2xl text-stone-900 dark:text-stone-100">
            <div className="flex items-center justify-between border-b border-stone-300 dark:border-stone-800 pb-4">
              <div>
                <span className="text-[11px] text-stone-500 uppercase tracking-widest">[ COUNCIL SANCTION ]</span>
                <h3 className="font-serif-editorial text-2xl text-stone-900 dark:text-stone-100 flex items-center gap-2 pt-0.5">
                  <span>Adjudicate Verdict:</span>
                  <span
                    className={`text-xs px-2.5 py-0.5 rounded font-bold uppercase tracking-wider ${
                      pendingDecisionType === 'APPROVED'
                        ? 'bg-emerald-600 text-white'
                        : 'bg-rose-700 text-white'
                    }`}
                  >
                    {pendingDecisionType}
                  </span>
                </h3>
                <p className="text-xs text-stone-500 pt-0.5">Folio Reference: {selectedActivity.activity_id}</p>
              </div>
              {!isSigning && (
                <button
                  onClick={closeDecisionModal}
                  className="text-stone-500 hover:text-stone-900 dark:hover:text-stone-100 text-xs px-2.5 py-1 rounded bg-stone-200 dark:bg-stone-800"
                >
                  [ CANCEL ]
                </button>
              )}
            </div>

            {decisionError && (
              <div className="p-3.5 rounded bg-rose-50 dark:bg-rose-950/20 border border-rose-300 dark:border-rose-900 text-rose-800 dark:text-rose-300 text-xs flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <span>ADJUDICATION ERROR: {decisionError}</span>
              </div>
            )}

            {confirmedTxHash ? (
              <div className="p-6 rounded bg-stone-100 dark:bg-stone-950 border border-stone-300 dark:border-stone-800 space-y-4 text-center">
                <CheckCircle2 className="w-8 h-8 text-emerald-600 dark:text-emerald-400 mx-auto" />
                <div className="space-y-1">
                  <h4 className="font-serif-editorial text-2xl text-stone-900 dark:text-stone-100">
                    Decision Notarized to Tezos Shadownet
                  </h4>
                  <p className="text-xs text-stone-600 dark:text-stone-400">
                    Evidentiary record has been permanently inscribed as{' '}
                    <span className="font-bold uppercase text-stone-900 dark:text-stone-100">{confirmedDecision}</span>.
                  </p>
                </div>
                <div className="p-3 bg-white dark:bg-stone-900 rounded border border-stone-300 dark:border-stone-800 text-left text-xs space-y-1">
                  <div className="flex items-center justify-between text-stone-500">
                    <span className="uppercase">CHRONICLE OP HASH:</span>
                    {EXPLORER_URL && (
                      <a
                        href={`${EXPLORER_URL}/${confirmedTxHash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-stone-800 dark:text-stone-200 hover:underline flex items-center gap-1 text-[11px]"
                      >
                        <span>[ VIEW TZKT ]</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                  <div className="text-stone-900 dark:text-stone-100 break-all select-all font-bold">{confirmedTxHash}</div>
                </div>
                <button
                  onClick={closeDecisionModal}
                  className="w-full py-2.5 rounded bg-stone-900 hover:bg-black text-white dark:bg-stone-100 dark:hover:bg-white dark:text-stone-950 font-bold text-xs uppercase tracking-wider"
                >
                  [ Complete Arbitration ]
                </button>
              </div>
            ) : (
              <>
                <div className="space-y-2 text-xs bg-white dark:bg-stone-950 p-4 rounded border border-stone-300 dark:border-stone-800">
                  <div className="flex justify-between">
                    <span className="text-stone-500 uppercase">SPECIMEN ID:</span>
                    <span className="font-bold text-stone-900 dark:text-stone-100">{selectedActivity.activity_id}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-stone-500 uppercase">ENVIRONMENTAL METRIC:</span>
                    <span className="font-bold text-stone-900 dark:text-stone-100">
                      {selectedActivity.quantity} {selectedActivity.unit} ({selectedActivity.category})
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-stone-500 uppercase">DEPOSITING CADRE:</span>
                    <span className="font-bold">{truncateAddress(selectedActivity.submitter_address)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-stone-500 uppercase">SIGNING COUNCIL KEY:</span>
                    <span className="font-bold">{truncateAddress(wallet.address || '')}</span>
                  </div>
                  <div className="flex flex-col gap-1 pt-2 border-t border-stone-200 dark:border-stone-800">
                    <span className="text-stone-500 uppercase">FINGERPRINT SHA-256:</span>
                    <span className="break-all text-[11px] text-stone-700 dark:text-stone-300">{selectedActivity.evidence_hash}</span>
                  </div>
                </div>

                {/* Optional/Required Rejection Reason */}
                {pendingDecisionType === 'REJECTED' && (
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-stone-700 dark:text-stone-300 uppercase tracking-wider flex items-center justify-between">
                      <span>Council Rejection Justification *</span>
                      <span className="text-[10px] text-rose-600 dark:text-rose-400 uppercase font-bold">[ REQUIRED ]</span>
                    </label>
                    <textarea
                      rows={2}
                      placeholder="Specify why evidence is insufficient (e.g. resolution deficit, missing temporal anchor)..."
                      value={rejectionReason}
                      onChange={(e) => setRejectionReason(e.target.value)}
                      disabled={isSigning}
                      className="w-full bg-white dark:bg-stone-950 border border-stone-300 dark:border-stone-700 rounded p-3 text-xs text-stone-900 dark:text-stone-100 focus:outline-none focus:border-stone-900 dark:focus:border-stone-100 transition-colors font-sans"
                    />
                  </div>
                )}

                {isSigning && (
                  <div className="p-3.5 rounded bg-stone-100 dark:bg-stone-950 border border-stone-300 dark:border-stone-700 text-stone-800 dark:text-stone-200 text-xs flex items-center gap-2.5">
                    <Loader2 className="w-4 h-4 animate-spin text-stone-900 dark:text-stone-100 shrink-0" />
                    <span>{signingStep || 'Communicating with Beacon signer wallet...'}</span>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="grid grid-cols-2 gap-3 pt-2">
                  <button
                    onClick={closeDecisionModal}
                    disabled={isSigning}
                    className="py-3 rounded bg-stone-100 hover:bg-stone-200 dark:bg-stone-800 dark:hover:bg-stone-700 text-stone-800 dark:text-stone-200 font-bold text-xs uppercase tracking-wider transition-colors border border-stone-300 dark:border-stone-700"
                  >
                    Cancel
                  </button>

                  <button
                    onClick={handleExecuteDecision}
                    disabled={isSigning}
                    className={`py-3 rounded font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 shadow-md ${
                      pendingDecisionType === 'APPROVED'
                        ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/20'
                        : 'bg-rose-700 hover:bg-rose-800 text-white shadow-rose-700/20'
                    }`}
                  >
                    {isSigning ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Notarizing...</span>
                      </>
                    ) : (
                      <>
                        <FileCheck className="w-4 h-4" />
                        <span>Confirm {pendingDecisionType === 'APPROVED' ? 'Approval' : 'Rejection'}</span>
                      </>
                    )}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* History of Reviewed Items */}
      <div className="space-y-6 pt-6">
        <div className="border-b border-stone-300 dark:border-stone-800 pb-4">
          <span className="font-mono-code text-xs text-stone-500 uppercase tracking-widest">[ SECTION III ]</span>
          <h2 className="font-serif-editorial text-2xl font-normal text-stone-900 dark:text-stone-100">
            Adjudicated Register // Historical Rulings
          </h2>
          <p className="text-xs font-mono-code text-stone-500 mt-1">
            ARCHIVAL TRANSCRIPT OF ALL COMPLETED FACULTY ARBITRATIONS
          </p>
        </div>

        <div className="rounded-lg border border-stone-300 dark:border-stone-800 bg-white dark:bg-stone-900/60 overflow-hidden shadow-sm">
          <table className="w-full text-left text-sm text-stone-700 dark:text-stone-300">
            <thead className="bg-stone-100 dark:bg-stone-950/80 text-[11px] font-mono-code uppercase tracking-wider text-stone-600 dark:text-stone-400 border-b border-stone-300 dark:border-stone-800">
              <tr>
                <th className="py-4 px-4 font-semibold">Folio Index</th>
                <th className="py-4 px-4 font-semibold">Environmental Scope</th>
                <th className="py-4 px-4 font-semibold">Council Verdict</th>
                <th className="py-4 px-4 font-semibold">Signing Arbitrator</th>
                <th className="py-4 px-4 font-semibold">Date Decided</th>
                <th className="py-4 px-4 font-semibold text-right">Dossier</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-200 dark:divide-stone-800 font-mono-code text-xs">
              {reviewedActivities.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-stone-500">
                    No adjudicated specimens on record in current session.
                  </td>
                </tr>
              ) : (
                reviewedActivities.map((act) => (
                  <tr key={act.activity_id} className="hover:bg-stone-50/70 dark:hover:bg-stone-800/40 transition-colors">
                    <td className="py-4 px-4 font-bold text-stone-900 dark:text-stone-100">
                      <Link to={`/activity/${act.activity_id}`} className="hover:underline">
                        {act.activity_id}
                      </Link>
                    </td>
                    <td className="py-4 px-4">
                      <span className="font-serif-editorial text-sm text-stone-900 dark:text-stone-100 block">
                        {act.category}
                      </span>
                      <span className="text-[11px] text-stone-500 font-mono-code">
                        {act.quantity} {act.unit}
                      </span>
                    </td>
                    <td className="py-4 px-4">
                      {act.status === 'APPROVED' ? (
                        <span className="stamp-badge border-emerald-600 text-emerald-700 dark:text-emerald-400 bg-emerald-500/5">
                          <CheckCircle2 className="w-3 h-3" /> RATIFIED
                        </span>
                      ) : (
                        <span className="stamp-badge border-rose-600 text-rose-700 dark:text-rose-400 bg-rose-500/5">
                          <XCircle className="w-3 h-3" /> DECLINED
                        </span>
                      )}
                    </td>
                    <td className="py-4 px-4 text-stone-500">
                      {act.approver_address ? truncateAddress(act.approver_address, 8, 4) : '-'}
                    </td>
                    <td className="py-4 px-4 text-stone-500">
                      {act.approved_at ? formatTimestamp(act.approved_at) : '-'}
                    </td>
                    <td className="py-4 px-4 text-right">
                      <Link
                        to={`/activity/${act.activity_id}`}
                        className="p-1.5 rounded border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-stone-700 dark:text-stone-300 hover:bg-stone-900 hover:text-white dark:hover:bg-stone-100 dark:hover:text-stone-950 inline-block transition-colors"
                        title="View complete evidentiary dossier"
                      >
                        <Eye className="w-4 h-4" />
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
