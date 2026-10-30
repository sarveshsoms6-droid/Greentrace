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

  // Fetch activities from backend SQLite cache
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
          setIsAuthoritativeOrganizer(onChainAuth || backendAuth);
        }
      } catch {
        if (!isCancelled) {
          setIsAuthoritativeOrganizer(false);
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

  // Merge remote activities with local context activities
  const allActivities: ActivityRecord[] = React.useMemo(() => {
    const map = new Map<string, ActivityRecord>();

    // Seed local activities
    for (const act of localActivities) {
      map.set(act.activity_id, act);
    }

    // Merge remote activities
    for (const remote of remoteActivities) {
      const existing = map.get(remote.activity_id);
      map.set(remote.activity_id, {
        activity_id: remote.activity_id,
        category: (remote.category as any) || 'Other',
        quantity: remote.quantity,
        unit: remote.unit,
        description: remote.description || '',
        evidence_hash: remote.evidence_hash,
        evidence_url: remote.evidence_hash,
        status: (remote.status_cache as any) || 'SUBMITTED',
        submitter_address: remote.submitter_address,
        approver_address: remote.approval_tx_hash ? remote.approval_tx_hash : existing?.approver_address,
        submitted_at: remote.submitted_at,
        approved_at: remote.approved_at || existing?.approved_at,
        rejection_reason: remote.rejection_reason || existing?.rejection_reason,
        submission_tx_hash: remote.submission_tx_hash || existing?.submission_tx_hash,
        approval_tx_hash: remote.approval_tx_hash || existing?.approval_tx_hash,
        is_sample: existing?.is_sample ?? false,
        ai_detected_count: remote.ai_detected_count !== undefined ? remote.ai_detected_count : existing?.ai_detected_count,
        ai_confidence_score: remote.ai_confidence_score !== undefined ? remote.ai_confidence_score : existing?.ai_confidence_score,
        ai_model_name: remote.ai_model_name || existing?.ai_model_name,
        ai_model_version: remote.ai_model_version || existing?.ai_model_version,
        ai_annotated_path: remote.ai_annotated_path || existing?.ai_annotated_path,
        ai_detection_data: remote.ai_detection_data || existing?.ai_detection_data,
      });
    }

    return Array.from(map.values());
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
    if (!isAuthoritativeOrganizer) {
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

      if (!CONTRACT_ADDRESS) {
        throw new Error(
          'VITE_CONTRACT_ADDRESS is not configured. A deployed SmartPy contract on Tezos Shadownet is required for on-chain wallet-signed decisions.'
        );
      }

      setSigningStep('Requesting wallet signature for transaction...');
      if (pendingDecisionType === 'APPROVED') {
        realTxHash = await approveActivityOperation(selectedActivity.activity_id);
      } else {
        realTxHash = await rejectActivityOperation(selectedActivity.activity_id);
      }
      setSigningStep('Waiting for block confirmation on Tezos Shadownet...');

      // Record off-chain in FastAPI backend
      try {
        await api.recordDecision(selectedActivity.activity_id, {
          decision: pendingDecisionType,
          approver_address: wallet.address,
          approval_tx_hash: realTxHash,
          rejection_reason: pendingDecisionType === 'REJECTED' ? rejectionReason.trim() : undefined,
        });
      } catch (backendErr) {
        console.warn('Backend decision recording warning:', backendErr);
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
      fetchBackendActivities();
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
    <div className="space-y-8 pb-16">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-6">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
              Organizer Review Portal
            </h1>
            <span className="text-[11px] bg-indigo-500/10 border border-indigo-500/30 text-indigo-600 dark:text-indigo-400 px-2.5 py-0.5 rounded-full font-mono font-semibold">
              AUTHORITATIVE REVIEW
            </span>
          </div>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
            Review student sustainability evidence, inspect SHA-256 fingerprints, and execute wallet-signed on-chain decisions.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleReconcile}
            disabled={isReconciling || !wallet.isConnected}
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-teal-50 hover:bg-teal-100 dark:bg-teal-500/10 dark:hover:bg-teal-500/20 text-teal-700 dark:text-teal-300 text-xs font-semibold border border-teal-200 dark:border-teal-500/30 transition-colors w-fit disabled:opacity-50"
            title="Reconcile local database records against authoritative on-chain Tezos contract state"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isReconciling ? 'animate-spin text-teal-500' : ''}`} />
            <span>{isReconciling ? 'Reconciling…' : 'Reconcile On-Chain'}</span>
          </button>
          <button
            onClick={fetchBackendActivities}
            disabled={isLoadingActivities}
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold border border-slate-200 dark:border-slate-700 transition-colors w-fit"
            title="Refresh activities from backend"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoadingActivities ? 'animate-spin text-emerald-500' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {reconcileResult && (
        <div className="p-3.5 rounded-2xl bg-teal-50 dark:bg-teal-500/10 border border-teal-200 dark:border-teal-500/30 text-teal-800 dark:text-teal-300 text-xs flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-teal-500 shrink-0" />
            <span>{reconcileResult}</span>
          </div>
          <button
            onClick={() => setReconcileResult(null)}
            className="text-teal-700 dark:text-teal-400 hover:underline text-xs font-mono"
          >
            ✕
          </button>
        </div>
      )}

      {/* Connected Wallet & Authorization Status Bar */}
      <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 text-xs shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shrink-0">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div className="space-y-0.5">
            <div className="font-semibold text-slate-900 dark:text-white flex items-center gap-2">
              <span>Connected Organizer:</span>
              {wallet.isConnected && wallet.address ? (
                <span className="font-mono text-emerald-600 dark:text-emerald-400">{wallet.address}</span>
              ) : (
                <span className="text-slate-500 dark:text-slate-400">No wallet connected</span>
              )}
            </div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400">
              Network: <span className="text-slate-700 dark:text-slate-200 font-mono">{wallet.network}</span> •{' '}
              Contract: <span className="text-slate-700 dark:text-slate-200 font-mono">{CONTRACT_ADDRESS ? truncateAddress(CONTRACT_ADDRESS) : 'SmartPy on Shadownet'}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isVerifyingOrganizer ? (
            <span className="flex items-center gap-1.5 text-amber-500 font-medium">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span>Verifying authorization…</span>
            </span>
          ) : isAuthoritativeOrganizer ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/30 font-semibold font-mono text-[11px]">
              <CheckCircle2 className="w-3.5 h-3.5" />
              AUTHORIZED ORGANIZER
            </span>
          ) : wallet.isConnected ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-50 dark:bg-rose-500/10 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-500/30 font-semibold font-mono text-[11px]">
              <Lock className="w-3.5 h-3.5" />
              UNAUTHORIZED WALLET
            </span>
          ) : (
            <button
              onClick={() => connectWallet('ORGANIZER')}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs shadow-md shadow-indigo-600/20"
            >
              <Wallet className="w-3.5 h-3.5" />
              <span>Connect Organizer Wallet</span>
            </button>
          )}
        </div>
      </div>

      {/* Disconnected Prompt */}
      {!wallet.isConnected && (
        <div className="p-6 rounded-2xl bg-white dark:bg-gradient-to-r dark:from-indigo-950/60 dark:to-slate-900 border border-indigo-500/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-md">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shrink-0">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 dark:text-white text-sm">Organizer Authentication Required</h3>
              <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">
                Review queue and on-chain verification authority is restricted to authorized campus organizers.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link
              to="/login"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-md shadow-indigo-600/20 transition-all shrink-0"
            >
              <ShieldCheck className="w-4 h-4" />
              <span>Sign In as Authorized Organizer</span>
            </Link>
            <Link
              to="/login"
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 text-xs font-semibold"
            >
              <span>Seek Permission</span>
            </Link>
          </div>
        </div>
      )}

      {/* Student Attempting Access to Organizer Review */}
      {wallet.role === 'STUDENT' && (
        <div className="p-5 rounded-2xl bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 text-rose-800 dark:text-rose-300 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <ShieldAlert className="w-5 h-5 text-rose-500 shrink-0" />
            <div>
              <span className="font-bold text-sm block">Student Account Connected</span>
              <span>Student accounts cannot access the Organizer Review Queue. You can submit activities or view your personal submissions on the Student Dashboard.</span>
            </div>
          </div>
          <div className="flex gap-2 shrink-0">
            <Link
              to="/student"
              className="px-3.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-semibold border border-slate-200 dark:border-slate-700"
            >
              Go to Student Dashboard
            </Link>
            <Link
              to="/login"
              className="px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold inline-block"
            >
              Switch Account
            </Link>
          </div>
        </div>
      )}

      {/* Unauthorized Alert if connected wallet is not an authorized organizer */}
      {wallet.isConnected && wallet.role !== 'STUDENT' && isAuthoritativeOrganizer === false && (
        <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 text-rose-800 dark:text-rose-300 text-xs flex items-start gap-3">
          <ShieldAlert className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <span className="font-bold text-sm">Unauthorized Wallet</span>
            <p>
              Your connected wallet address <span className="font-mono text-slate-900 dark:text-white font-bold">{wallet.address}</span> is not registered as an authorized organizer on the SmartPy contract or backend whitelist.
              You cannot approve or reject activities. Connect an authorized organizer wallet.
            </p>
          </div>
        </div>
      )}

      {/* Organizer KPI Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 space-y-1 shadow-sm">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 font-medium">
            <span>Total Submissions</span>
            <Layers className="w-4 h-4 text-indigo-500" />
          </div>
          <div className="text-2xl font-bold text-slate-900 dark:text-white">{allActivities.length}</div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">Campus-wide records</p>
        </div>

        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 space-y-1 shadow-sm">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 font-medium">
            <span>Pending Review</span>
            <Clock className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-2xl font-bold text-amber-600 dark:text-amber-300">{pendingActivities.length}</div>
          <p className="text-[11px] text-amber-600 dark:text-amber-400 font-medium">Awaiting decision</p>
        </div>

        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 space-y-1 shadow-sm">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 font-medium">
            <span>Approved Actions</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{approvedActivities.length}</div>
          <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">Verified on Tezos</p>
        </div>

        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 space-y-1 shadow-sm">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 font-medium">
            <span>Rejected</span>
            <XCircle className="w-4 h-4 text-rose-500" />
          </div>
          <div className="text-2xl font-bold text-rose-600 dark:text-rose-400">{rejectedActivities.length}</div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">With off-chain reason</p>
        </div>
      </div>

      {/* Pending Organizer Requests Seeking Permission */}
      {organizerRequests && organizerRequests.length > 0 && (
        <div className="space-y-3 p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
            <div className="flex items-center gap-2">
              <Lock className="w-4 h-4 text-indigo-500" />
              <h3 className="font-bold text-slate-900 dark:text-white text-sm">
                Organizer Access Requests Seeking Permission ({organizerRequests.filter((r) => r.status === 'PENDING').length} Pending)
              </h3>
            </div>
            <span className="text-[11px] text-slate-500 dark:text-slate-400">
              New organizers require approval from an existing authorized organizer
            </span>
          </div>

          <div className="space-y-2.5 pt-1">
            {organizerRequests.map((req) => (
              <div
                key={req.id}
                className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2 font-bold text-slate-900 dark:text-white">
                    <span>{req.name}</span>
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 font-normal">({req.department})</span>
                    <span className="text-[10px] text-indigo-600 dark:text-indigo-400 font-mono">ID: {req.id}</span>
                  </div>
                  <div className="text-slate-500 dark:text-slate-400 text-[11px] font-mono">
                    Email: <span className="text-slate-700 dark:text-slate-300 font-sans">{req.email}</span> • Wallet: <span className="text-indigo-600 dark:text-indigo-300 font-semibold">{truncateAddress(req.walletAddress, 8, 6)}</span>
                  </div>
                  <p className="text-[11px] text-slate-600 dark:text-slate-300 italic">"{req.reason}"</p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {req.status === 'PENDING' ? (
                    <>
                      <button
                        onClick={() => approveOrganizerRequest(req.id)}
                        className="px-3 py-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-500/15 hover:bg-emerald-100 dark:hover:bg-emerald-500/25 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-500/30 font-semibold flex items-center gap-1 transition-colors"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Grant Permission</span>
                      </button>
                      <button
                        onClick={() => rejectOrganizerRequest(req.id)}
                        className="px-3 py-1.5 rounded-lg bg-rose-50 dark:bg-rose-500/15 hover:bg-rose-100 dark:hover:bg-rose-500/25 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-500/30 font-semibold flex items-center gap-1 transition-colors"
                      >
                        <XCircle className="w-3.5 h-3.5" />
                        <span>Deny</span>
                      </button>
                    </>
                  ) : req.status === 'APPROVED' ? (
                    <span className="px-3 py-1 rounded-full bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/30 font-bold flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" />
                      <span>Permission Granted</span>
                    </span>
                  ) : (
                    <span className="px-3 py-1 rounded-full bg-rose-50 dark:bg-rose-500/10 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-500/30 font-bold flex items-center gap-1">
                      <XCircle className="w-3 h-3" />
                      <span>Denied</span>
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Pending Queue Section */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">Pending Submissions Queue</h2>
            <span className="px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-700 dark:text-amber-400 text-xs font-bold font-mono">
              {pendingActivities.length} Awaiting Decision
            </span>
          </div>
          <div className="flex items-center gap-2">
            {loadError && <span className="text-[11px] text-amber-500">{loadError}</span>}
            <Link
              to="/history"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold border border-slate-200 dark:border-slate-700 transition-colors"
            >
              <History className="w-3.5 h-3.5 text-teal-500" />
              <span>View All Submissions</span>
            </Link>
          </div>
        </div>

        {isLoadingActivities ? (
          <div className="p-12 text-center rounded-2xl bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 space-y-3">
            <Loader2 className="w-8 h-8 animate-spin text-indigo-500 mx-auto" />
            <p className="text-xs text-slate-500 dark:text-slate-400">Loading pending sustainability submissions…</p>
          </div>
        ) : pendingActivities.length === 0 ? (
          <div className="p-12 text-center rounded-2xl bg-white dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 space-y-2 shadow-sm">
            <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto" />
            <h3 className="text-base font-semibold text-slate-900 dark:text-white">Pending Queue Clear</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
              All submitted student sustainability activities have been processed. New wallet-signed submissions will appear here automatically.
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
                  className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 transition-all flex flex-col justify-between space-y-4 shadow-sm"
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs font-bold text-slate-900 dark:text-white bg-slate-100 dark:bg-slate-950 px-2.5 py-1 rounded-md border border-slate-200 dark:border-slate-800">
                        {act.activity_id}
                      </span>
                      <span className="text-xs text-amber-600 dark:text-amber-400 font-semibold flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" />
                        SUBMITTED
                      </span>
                    </div>

                    <div>
                      <h3 className="text-lg font-bold text-slate-900 dark:text-white">{act.category}</h3>
                      <p className="text-sm font-semibold text-emerald-600 dark:text-emerald-400 font-mono">
                        {act.quantity} {act.unit}
                      </p>
                    </div>

                    <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed bg-slate-50 dark:bg-slate-950/60 p-3 rounded-xl border border-slate-200 dark:border-slate-800/80">
                      "{act.description}"
                    </p>

                    {/* Evidence Image Preview via Protected Endpoint */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
                        <span className="flex items-center gap-1 font-semibold text-slate-700 dark:text-slate-300">
                          <ImageIcon className="w-3.5 h-3.5 text-indigo-500" />
                          Evidence Photograph Preview:
                        </span>
                        <span className="text-[10px] text-indigo-600 dark:text-indigo-400 font-mono">Protected Storage</span>
                      </div>
                      <div className="rounded-xl overflow-hidden bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800/80 max-h-48 flex items-center justify-center p-1">
                        {wallet.isConnected && isAuthoritativeOrganizer ? (
                          <img
                            src={
                              (activePhotoViews[act.activity_id] || 'original') === 'annotated' && act.ai_annotated_path
                                ? api.getAnnotatedEvidenceFileUrl(act.ai_annotated_path)
                                : previewUrl
                            }
                            alt="Student evidence"
                            className="max-h-44 w-auto object-contain rounded-lg"
                            onError={(e) => {
                              (e.target as HTMLElement).style.display = 'none';
                              const parent = (e.target as HTMLElement).parentElement;
                              if (parent) {
                                parent.innerHTML = '<div class="p-4 text-xs text-slate-500 font-mono text-center">Protected evidence file preview (Sample / Stored off-chain)</div>';
                              }
                            }}
                          />
                        ) : (
                          <div className="p-4 text-xs text-slate-500 font-mono text-center flex items-center gap-1.5">
                            <Lock className="w-3.5 h-3.5 text-rose-500" />
                            <span>Evidence preview restricted to authorized organizers</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* GreenAI Smart Tree Detection Audit Section */}
                    {act.ai_detected_count !== undefined && act.ai_detected_count !== null && (
                      <div className="p-3.5 rounded-xl bg-gradient-to-br from-emerald-500/10 via-teal-500/5 to-slate-50 dark:to-slate-950 border border-emerald-500/30 space-y-2.5">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400 font-bold text-xs">
                            <Sparkles className="w-4 h-4" />
                            <span>GreenAI Smart Tree Detection</span>
                          </div>
                          <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">
                            {act.ai_model_name || 'YOLO-World'} {act.ai_model_version ? `v${act.ai_model_version}` : ''}
                          </span>
                        </div>

                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div className="p-2 rounded-lg bg-white/60 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800">
                            <span className="text-[10px] text-slate-500 block">Student Reported:</span>
                            <span className="text-sm font-bold text-slate-900 dark:text-white font-mono">{act.quantity} trees</span>
                          </div>
                          <div className="p-2 rounded-lg bg-white/60 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800">
                            <span className="text-[10px] text-slate-500 block">AI Detected:</span>
                            <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400 font-mono">
                              {act.ai_detected_count} trees
                            </span>
                          </div>
                        </div>

                        {/* Discrepancy or Match Notice */}
                        {act.quantity !== act.ai_detected_count ? (
                          <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-800 dark:text-amber-300 text-[11px] flex items-start gap-1.5">
                            <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
                            <div>
                              <span className="font-bold">Count Discrepancy: </span>
                              <span>
                                Student reported {act.quantity} trees, but AI identified {act.ai_detected_count} trees (diff: {Math.abs(act.quantity - act.ai_detected_count)}). Please review bounding boxes before signing.
                              </span>
                            </div>
                          </div>
                        ) : (
                          <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-800 dark:text-emerald-300 text-[11px] flex items-center gap-1.5">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                            <span className="font-bold">Count Match: </span>
                            <span>Student-entered count matches AI tree detection.</span>
                          </div>
                        )}

                        {/* AI Confidence & Photo Toggle */}
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-slate-500 dark:text-slate-400">
                            Confidence: <strong className="text-emerald-600 dark:text-emerald-400 font-mono">{((act.ai_confidence_score || 0) * 100).toFixed(1)}%</strong>
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
                              className="text-[11px] font-semibold text-teal-600 dark:text-teal-400 hover:underline flex items-center gap-1"
                            >
                              <Trees className="w-3 h-3" />
                              <span>{(activePhotoViews[act.activity_id] || 'original') === 'annotated' ? 'Show Original Photo' : 'Show GreenAI Annotated'}</span>
                            </button>
                          )}
                        </div>

                        {/* Mandatory Policy Warning */}
                        <p className="text-[10px] text-slate-500 dark:text-slate-400 italic border-t border-slate-200 dark:border-slate-800/80 pt-1.5">
                          * AI analysis is advisory only and never automatically approves an activity. Organizers retain sole cryptographic decision authority.
                        </p>
                      </div>
                    )}

                    <div className="space-y-1 text-xs font-mono">
                      <div className="flex justify-between text-slate-500 dark:text-slate-400">
                        <span>Student Address:</span>
                        <span className="text-slate-800 dark:text-slate-200 select-all font-semibold">{truncateAddress(act.submitter_address, 8, 6)}</span>
                      </div>
                      <div className="flex justify-between text-slate-500 dark:text-slate-400">
                        <span>Submitted At:</span>
                        <span className="text-slate-700 dark:text-slate-300">{formatTimestamp(act.submitted_at)}</span>
                      </div>
                    </div>

                    {/* Evidence SHA-256 info */}
                    <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800/80 space-y-1.5">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-slate-500 dark:text-slate-400 flex items-center gap-1">
                          <Hash className="w-3 h-3 text-emerald-500" />
                          SHA-256 Fingerprint:
                        </span>
                        <span className="text-slate-400">{act.evidence_filename || 'evidence.jpg'}</span>
                      </div>
                      <p className="font-mono text-[11px] text-teal-700 dark:text-teal-300 break-all select-all">
                        {act.evidence_hash}
                      </p>
                    </div>

                    {/* Self-approval warning if submitter is current organizer */}
                    {isSelfSubmission && (
                      <div className="p-2.5 rounded-lg bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 text-rose-700 dark:text-rose-300 text-[11px] flex items-center gap-2">
                        <ShieldAlert className="w-4 h-4 text-rose-500 shrink-0" />
                        <span>Self-submission detected. Contract blocks your wallet from approving this.</span>
                      </div>
                    )}
                  </div>

                  {/* Decision Action Buttons */}
                  <div className="grid grid-cols-2 gap-2 pt-2">
                    <button
                      onClick={() => promptDecision(act, 'REJECTED')}
                      disabled={isSelfSubmission || !isAuthoritativeOrganizer}
                      className="py-2.5 rounded-xl bg-rose-50 hover:bg-rose-100 dark:bg-rose-500/10 dark:hover:bg-rose-500/20 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-500/30 font-semibold text-xs transition-colors flex items-center justify-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <XCircle className="w-4 h-4" />
                      <span>Reject</span>
                    </button>

                    <button
                      onClick={() => promptDecision(act, 'APPROVED')}
                      disabled={isSelfSubmission || !isAuthoritativeOrganizer}
                      className="py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs transition-colors shadow-md shadow-emerald-500/20 flex items-center justify-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4">
          <div className="max-w-xl w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-8 space-y-6 shadow-2xl animate-in fade-in duration-200 text-slate-900 dark:text-white">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-4">
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <span>Confirm {pendingDecisionType} Decision</span>
                  <span
                    className={`text-[11px] px-2 py-0.5 rounded-full font-mono font-bold ${
                      pendingDecisionType === 'APPROVED'
                        ? 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-400'
                        : 'bg-rose-500/20 text-rose-700 dark:text-rose-400'
                    }`}
                  >
                    {pendingDecisionType}
                  </span>
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-mono">Activity ID: {selectedActivity.activity_id}</p>
              </div>
              {!isSigning && (
                <button
                  onClick={closeDecisionModal}
                  className="text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white text-xs px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800"
                >
                  Cancel
                </button>
              )}
            </div>

            {decisionError && (
              <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 text-rose-800 dark:text-rose-300 text-xs flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                <span>{decisionError}</span>
              </div>
            )}

            {confirmedTxHash ? (
              <div className="p-5 rounded-2xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30 space-y-3 text-center">
                <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto" />
                <div className="space-y-1">
                  <h4 className="font-bold text-slate-900 dark:text-white text-base">
                    Decision Confirmed on Tezos!
                  </h4>
                  <p className="text-xs text-slate-600 dark:text-slate-300">
                    Activity has been marked <span className="font-bold text-emerald-600 dark:text-emerald-400">{confirmedDecision}</span>.
                  </p>
                </div>
                <div className="p-3 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800 text-left font-mono text-[11px] space-y-1">
                  <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
                    <span>Operation Hash:</span>
                    {EXPLORER_URL && (
                      <a
                        href={`${EXPLORER_URL}/${confirmedTxHash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1 text-[10px]"
                      >
                        <span>View on TzKT</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                  <div className="text-teal-700 dark:text-teal-300 break-all select-all">{confirmedTxHash}</div>
                </div>
                <button
                  onClick={closeDecisionModal}
                  className="w-full py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs"
                >
                  Done
                </button>
              </div>
            ) : (
              <>
                <div className="space-y-2 text-xs bg-slate-50 dark:bg-slate-950 p-4 rounded-xl border border-slate-200 dark:border-slate-800 font-mono">
                  <div className="flex justify-between">
                    <span className="text-slate-500 dark:text-slate-400">Activity:</span>
                    <span className="text-slate-900 dark:text-white font-bold">{selectedActivity.activity_id}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500 dark:text-slate-400">Scope:</span>
                    <span className="text-emerald-600 dark:text-emerald-400 font-bold">
                      {selectedActivity.quantity} {selectedActivity.unit} ({selectedActivity.category})
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500 dark:text-slate-400">Student:</span>
                    <span className="text-slate-800 dark:text-slate-200 font-semibold">{truncateAddress(selectedActivity.submitter_address)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500 dark:text-slate-400">Signing Wallet:</span>
                    <span className="text-indigo-600 dark:text-indigo-400 font-semibold">{truncateAddress(wallet.address || '')}</span>
                  </div>
                  <div className="flex flex-col gap-1 pt-1 border-t border-slate-200 dark:border-slate-800">
                    <span className="text-slate-500 dark:text-slate-400">SHA-256 Digest:</span>
                    <span className="text-teal-700 dark:text-teal-300 break-all text-[11px]">{selectedActivity.evidence_hash}</span>
                  </div>
                </div>

                {/* Optional/Required Rejection Reason */}
                {pendingDecisionType === 'REJECTED' && (
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center justify-between">
                      <span>Rejection Reason (Off-chain) *</span>
                      <span className="text-[10px] text-rose-500 font-bold">Required</span>
                    </label>
                    <textarea
                      rows={2}
                      placeholder="Explain why evidence is insufficient (e.g. blurry image, missing timestamp proof)..."
                      value={rejectionReason}
                      onChange={(e) => setRejectionReason(e.target.value)}
                      disabled={isSigning}
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-3 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-rose-500 transition-colors"
                    />
                  </div>
                )}

                {isSigning && (
                  <div className="p-3 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-500/30 text-indigo-700 dark:text-indigo-200 text-xs flex items-center gap-2.5">
                    <Loader2 className="w-4 h-4 animate-spin text-indigo-500 shrink-0" />
                    <span>{signingStep || 'Communicating with Beacon wallet...'}</span>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="grid grid-cols-2 gap-3 pt-2">
                  <button
                    onClick={closeDecisionModal}
                    disabled={isSigning}
                    className="py-3 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-semibold text-xs transition-colors"
                  >
                    Cancel
                  </button>

                  <button
                    onClick={handleExecuteDecision}
                    disabled={isSigning}
                    className={`py-3 rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-1.5 shadow-md ${
                      pendingDecisionType === 'APPROVED'
                        ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-emerald-500/20'
                        : 'bg-rose-600 hover:bg-rose-500 text-white shadow-rose-600/20'
                    }`}
                  >
                    {isSigning ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Signing...</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Sign {pendingDecisionType} with Wallet</span>
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
      <div className="space-y-4 pt-6">
        <h2 className="text-lg font-bold text-slate-900 dark:text-white">Reviewed Activities History</h2>
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 overflow-hidden shadow-sm">
          <table className="w-full text-left text-sm text-slate-700 dark:text-slate-300">
            <thead className="bg-slate-50 dark:bg-slate-950/80 text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="py-3.5 px-4">Activity ID</th>
                <th className="py-3.5 px-4">Scope</th>
                <th className="py-3.5 px-4">Decision</th>
                <th className="py-3.5 px-4">Approver</th>
                <th className="py-3.5 px-4">Decision Timestamp</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {reviewedActivities.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-500 text-xs">
                    No reviewed activities recorded yet.
                  </td>
                </tr>
              ) : (
                reviewedActivities.map((act) => (
                  <tr key={act.activity_id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="py-3.5 px-4 font-mono font-medium text-slate-900 dark:text-white">{act.activity_id}</td>
                    <td className="py-3.5 px-4">
                      {act.quantity} {act.unit} ({act.category})
                    </td>
                    <td className="py-3.5 px-4">
                      {act.status === 'APPROVED' ? (
                        <span className="text-emerald-600 dark:text-emerald-400 text-xs font-semibold inline-flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Approved
                        </span>
                      ) : (
                        <span className="text-rose-600 dark:text-rose-400 text-xs font-semibold inline-flex items-center gap-1">
                          <XCircle className="w-3.5 h-3.5" /> Rejected
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 font-mono text-xs text-slate-500 dark:text-slate-400">
                      {act.approver_address ? truncateAddress(act.approver_address) : '-'}
                    </td>
                    <td className="py-3.5 px-4 text-xs text-slate-500 dark:text-slate-400">
                      {act.approved_at ? formatTimestamp(act.approved_at) : '-'}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <Link
                        to={`/activity/${act.activity_id}`}
                        className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 inline-block transition-colors"
                        title="View details"
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
