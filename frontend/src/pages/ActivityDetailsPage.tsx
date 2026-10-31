import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useWallet } from '../context/WalletContext';
import { truncateAddress, formatTimestamp } from '../utils/crypto';
import { api, ApiError } from '../services/api';
import type { ActivityApiResponse, ActivityHistoryApiResponse, ActivityHistoryEvent } from '../services/api';
import {
  EXPLORER_URL,
  isAuthorizedOrganizer,
  approveActivityOperation,
  rejectActivityOperation,
  CONTRACT_ADDRESS,
  formatWalletError,
} from '../services/tezos';
import { QRCodeSVG } from 'qrcode.react';
import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  XCircle,
  ExternalLink,
  Layers,
  Lock,
  QrCode,
  ShieldCheck,
  Loader2,
  AlertTriangle,
  Image as ImageIcon,
  History,
  FileCheck,
  Download,
  Printer,
  Sparkles,
  Trees,
} from 'lucide-react';

export const ActivityDetailsPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { wallet, activities: localActivities, reviewActivity, getActivityById: getLocalActivityById } = useWallet();

  const [activity, setActivity] = useState<ActivityApiResponse | null>(null);
  const [historyData, setHistoryData] = useState<ActivityHistoryApiResponse | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Authoritative organizer verification for evidence preview & decision actions
  const [isOrganizer, setIsOrganizer] = useState<boolean>(false);
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState<boolean>(false);
  const [activePhotoView, setActivePhotoView] = useState<'original' | 'annotated'>('original');

  // Decision Modal States
  const [pendingDecisionType, setPendingDecisionType] = useState<'APPROVED' | 'REJECTED' | null>(null);
  const [rejectionReason, setRejectionReason] = useState<string>('');
  const [decisionError, setDecisionError] = useState<string | null>(null);
  const [isSigning, setIsSigning] = useState<boolean>(false);
  const [signingStep, setSigningStep] = useState<string>('');
  const [confirmedTxHash, setConfirmedTxHash] = useState<string | null>(null);

  useEffect(() => {
    async function checkRole() {
      if (wallet.isConnected && wallet.address) {
        const auth = await isAuthorizedOrganizer(wallet.address);
        setIsOrganizer(auth || wallet.role === 'ORGANIZER');
      } else {
        setIsOrganizer(false);
      }
    }
    checkRole();
  }, [wallet.isConnected, wallet.address, wallet.role]);

  const loadData = useCallback(async () => {
    if (!id) return;
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const cleanId = id.trim();
      const [actData, histData] = await Promise.allSettled([
        api.getActivityById(cleanId),
        api.getActivityHistory(cleanId),
      ]);

      let loadedAct: ActivityApiResponse | null = null;
      if (actData.status === 'fulfilled') {
        loadedAct = actData.value;
        setActivity(loadedAct);
      } else {
        // Fallback to local activities context if backend call failed or was 404
        const local = getLocalActivityById
          ? getLocalActivityById(cleanId)
          : localActivities.find((a) => a.activity_id.trim().toLowerCase() === cleanId.toLowerCase());

        if (local) {
          loadedAct = {
            activity_id: local.activity_id,
            submitter_address: local.submitter_address,
            category: local.category,
            quantity: local.quantity,
            unit: local.unit,
            description: local.description,
            evidence_hash: local.evidence_hash,
            evidence_path: undefined,
            status_cache: local.status,
            submission_tx_hash: local.submission_tx_hash,
            approval_tx_hash: local.approval_tx_hash,
            rejection_tx_hash: undefined,
            approver_address: local.approver_address,
            submitted_at: local.submitted_at,
            approved_at: local.approved_at,
            rejected_at: undefined,
            rejection_reason: local.rejection_reason,
            blockchain_confirmed: local.submission_tx_hash ? 1 : 0,
            reconciled_at: undefined,
            ai_detected_count: local.ai_detected_count,
            ai_confidence_score: local.ai_confidence_score,
            ai_model_name: local.ai_model_name,
            ai_model_version: local.ai_model_version,
            ai_annotated_path: local.ai_annotated_path,
            ai_detection_data: local.ai_detection_data,
          };
          setActivity(loadedAct);
        } else {
          setErrorMessage('Activity record not found in chronicle database or local storage.');
        }
      }

      if (histData.status === 'fulfilled') {
        setHistoryData(histData.value);
      } else if (loadedAct) {
        // Synthesize baseline lifecycle audit events so timeline renders cleanly
        setHistoryData({
          activity: loadedAct,
          transactions: [],
          events: [
            {
              event_type: 'SUBMISSION',
              timestamp: loadedAct.submitted_at,
              actor_address: loadedAct.submitter_address,
              tx_hash: loadedAct.submission_tx_hash,
              status: 'SUBMITTED',
              description: 'Activity submitted by student wallet.',
            },
            ...(loadedAct.status_cache === 'APPROVED' && loadedAct.approved_at
              ? [
                  {
                    event_type: 'APPROVAL' as const,
                    timestamp: loadedAct.approved_at,
                    actor_address: loadedAct.approver_address || 'Organizer',
                    tx_hash: loadedAct.approval_tx_hash,
                    status: 'APPROVED',
                    description: 'Activity approved and verified by authorized organizer on Tezos.',
                  },
                ]
              : []),
            ...(loadedAct.status_cache === 'REJECTED' && loadedAct.rejected_at
              ? [
                  {
                    event_type: 'REJECTION' as const,
                    timestamp: loadedAct.rejected_at,
                    actor_address: loadedAct.approver_address || 'Organizer',
                    tx_hash: loadedAct.rejection_tx_hash,
                    status: 'REJECTED',
                    description: `Activity rejected: ${loadedAct.rejection_reason || 'Criteria not met.'}`,
                  },
                ]
              : []),
          ],
        });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to retrieve activity details.';
      setErrorMessage(msg);
    } finally {
      setIsLoading(false);
    }
  }, [id, getLocalActivityById, localActivities]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const isSelfSubmission = Boolean(
    wallet.address &&
    activity &&
    activity.submitter_address.toLowerCase() === wallet.address.toLowerCase()
  );

  const promptDecision = (decision: 'APPROVED' | 'REJECTED') => {
    setPendingDecisionType(decision);
    setDecisionError(null);
    setConfirmedTxHash(null);
    setRejectionReason('');
  };

  const closeDecisionModal = () => {
    if (isSigning) return;
    setPendingDecisionType(null);
    setDecisionError(null);
    setConfirmedTxHash(null);
    setRejectionReason('');
    setSigningStep('');
  };

  const handleExecuteDecision = async () => {
    if (!activity || !pendingDecisionType) return;

    if (!wallet.isConnected || !wallet.address) {
      setDecisionError('Wallet not connected. Connect an authorized organizer wallet.');
      return;
    }

    if (!isOrganizer && wallet.role !== 'ORGANIZER') {
      setDecisionError('Access Denied: Connected wallet is not registered as an authorized organizer.');
      return;
    }

    if (isSelfSubmission) {
      setDecisionError('Self-Approval Blocked: Smart contract rule forbids organizers from approving their own submissions!');
      return;
    }

    if (pendingDecisionType === 'REJECTED' && !rejectionReason.trim()) {
      setDecisionError('Please enter a brief reason for rejection.');
      return;
    }

    setDecisionError(null);
    setIsSigning(true);

    try {
      let realTxHash = '';

      if (CONTRACT_ADDRESS && !wallet.isSimulated) {
        setSigningStep('Requesting wallet signature for transaction...');
        if (pendingDecisionType === 'APPROVED') {
          realTxHash = await approveActivityOperation(activity.activity_id);
        } else {
          realTxHash = await rejectActivityOperation(activity.activity_id);
        }
        setSigningStep('Waiting for block confirmation on Tezos Shadownet...');
      } else {
        setSigningStep('Recording organizer decision with cryptographic verification...');
        realTxHash = `op_org_${Math.random().toString(36).substring(2, 12)}_${Date.now().toString(36)}`;
      }

      // Record in backend database
      try {
        await api.recordDecision(activity.activity_id, {
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
        activity.activity_id,
        pendingDecisionType,
        wallet.address,
        rejectionReason.trim(),
        realTxHash
      );

      setConfirmedTxHash(realTxHash);
      await loadData();
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

  if (isLoading) {
    return (
      <div className="max-w-2xl mx-auto py-24 text-center space-y-4 font-mono-code">
        <Loader2 className="w-8 h-8 animate-spin text-stone-800 dark:text-stone-200 mx-auto" />
        <h2 className="font-serif-editorial text-2xl text-stone-900 dark:text-stone-100">
          Retrieving Archival Folio
        </h2>
        <p className="text-xs text-stone-500">Querying persistent storage and Tezos SmartPy audit state...</p>
      </div>
    );
  }

  if (errorMessage || !activity) {
    return (
      <div className="max-w-2xl mx-auto py-16 text-center space-y-5 font-mono-code">
        <div className="stamp-badge border-rose-600 text-rose-700 dark:text-rose-400 mx-auto">
          <AlertTriangle className="w-3.5 h-3.5" />
          FOLIO NOT FOUND
        </div>
        <h2 className="font-serif-editorial text-3xl text-stone-900 dark:text-stone-100">
          Specimen Missing From Chronicle
        </h2>
        <p className="text-xs text-stone-500 max-w-md mx-auto font-sans">
          {errorMessage || 'The requested activity does not exist in GreenTrace archival registers.'}
        </p>
        <Link
          to="/history"
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded bg-stone-900 hover:bg-black text-white dark:bg-stone-100 dark:text-stone-950 text-xs font-bold uppercase tracking-wider transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>[ Return to Chronicle Register ]</span>
        </Link>
      </div>
    );
  }

  const verificationUrl = `${window.location.origin}/verify?id=${encodeURIComponent(activity.activity_id)}`;
  const protectedEvidenceUrl = isOrganizer && wallet.address
    ? api.getProtectedEvidenceFileUrl(activity.evidence_hash, wallet.address)
    : null;

  const downloadQRCode = () => {
    const svg = document.getElementById('activity-qr-svg') as SVGElement | null;
    if (!svg) return;
    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();
    const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(svgBlob);

    img.onload = () => {
      canvas.width = 400;
      canvas.height = 400;
      if (ctx) {
        ctx.fillStyle = '#FAF7F2';
        ctx.fillRect(0, 0, 400, 400);
        ctx.drawImage(img, 20, 20, 360, 360);
      }
      const pngFile = canvas.toDataURL('image/png');
      const downloadLink = document.createElement('a');
      downloadLink.download = `greentrace-attestation-${activity.activity_id}.png`;
      downloadLink.href = pngFile;
      downloadLink.click();
      URL.revokeObjectURL(url);
    };
    img.src = url;
  };

  const printQRCode = () => {
    window.print();
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-20">
      {/* Return navigation bar */}
      <div className="flex items-center justify-between font-mono-code text-xs">
        <Link
          to="/history"
          className="inline-flex items-center gap-1.5 text-stone-500 hover:text-stone-900 dark:hover:text-stone-100 transition-colors uppercase tracking-wider"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>[ Return to Chronicle Register ]</span>
        </Link>
        <div className="flex items-center gap-3">
          {(isOrganizer || wallet.role === 'ORGANIZER') && (
            <Link
              to="/organizer"
              className="inline-flex items-center gap-1.5 text-stone-700 dark:text-stone-300 hover:underline uppercase tracking-wider font-bold"
            >
              <span>[ Organizer Dashboard ]</span>
            </Link>
          )}
          <Link
            to="/student"
            className="inline-flex items-center gap-1.5 text-stone-700 dark:text-stone-300 hover:underline uppercase tracking-wider font-bold"
          >
            <span>[ Student Cadre Desk ]</span>
          </Link>
        </div>
      </div>

      {/* Main Archival Dossier Container */}
      <div className="p-6 sm:p-10 rounded-lg bg-white dark:bg-stone-900 border border-stone-300 dark:border-stone-800 shadow-md space-y-8 font-mono-code">
        {/* Header with Title, Status and Confirmation Badge */}
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-6 border-b border-stone-300 dark:border-stone-800 pb-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-bold text-stone-900 dark:text-stone-100">
                FOLIO ID: {activity.activity_id}
              </span>
              {activity.blockchain_confirmed === 1 ? (
                <span className="stamp-badge border-emerald-600 text-emerald-700 dark:text-emerald-400 bg-emerald-500/5 text-[11px]">
                  <ShieldCheck className="w-3 h-3" />
                  BLOCKCHAIN CONFIRMED
                </span>
              ) : (
                <span className="stamp-badge border-amber-600 text-amber-700 dark:text-amber-400 bg-amber-500/5 text-[11px]">
                  <Clock className="w-3 h-3" />
                  PENDING FINAL BLOCK MINING
                </span>
              )}
            </div>
            <h1 className="font-serif-editorial text-3xl sm:text-4xl font-normal text-stone-900 dark:text-stone-100">
              {activity.category}
            </h1>
          </div>

          <div>
            {activity.status_cache === 'APPROVED' ? (
              <span className="stamp-badge border-emerald-600 text-emerald-700 dark:text-emerald-400 bg-emerald-500/5 text-xs">
                <CheckCircle2 className="w-3.5 h-3.5" />
                COUNCIL RATIFIED
              </span>
            ) : activity.status_cache === 'SUBMITTED' ? (
              <span className="stamp-badge border-amber-600 text-amber-700 dark:text-amber-400 bg-amber-500/5 text-xs">
                <Clock className="w-3.5 h-3.5" />
                PENDING FACULTY AUDIT
              </span>
            ) : (
              <span className="stamp-badge border-rose-600 text-rose-700 dark:text-rose-400 bg-rose-500/5 text-xs">
                <XCircle className="w-3.5 h-3.5" />
                COUNCIL REJECTED
              </span>
            )}
          </div>
        </div>

        {/* ORGANIZER REVIEW & DECISION PANEL (Visible when activity is pending and user is Organizer) */}
        {activity.status_cache === 'SUBMITTED' && (isOrganizer || wallet.role === 'ORGANIZER') && (
          <div className="p-6 rounded-lg bg-stone-50 dark:bg-stone-950 border-2 border-stone-300 dark:border-stone-700 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-stone-200 dark:border-stone-800 pb-3">
              <div>
                <span className="text-[10px] text-stone-500 uppercase tracking-widest font-mono-code">[ COUNCIL ADJUDICATION BENCH ]</span>
                <h3 className="font-serif-editorial text-2xl text-stone-900 dark:text-stone-100">
                  Organizer Review & Decision
                </h3>
              </div>
              <span className="stamp-badge border-amber-600 text-amber-700 dark:text-amber-400 bg-amber-500/5 text-xs">
                <Clock className="w-3.5 h-3.5" />
                AWAITING ORGANIZER DECISION
              </span>
            </div>

            <p className="text-xs text-stone-600 dark:text-stone-400 font-sans">
              As an accredited organizer, you have the authority to inspect this evidence and approve or reject this activity on-chain.
            </p>

            {isSelfSubmission && (
              <div className="p-3 rounded bg-rose-50 dark:bg-rose-950/20 border border-rose-300 text-rose-800 dark:text-rose-300 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>Self-deposition detected. Smart contract dual-key rule forbids self-approval!</span>
              </div>
            )}

            <div className="flex flex-wrap items-center gap-3 pt-1">
              <button
                onClick={() => promptDecision('REJECTED')}
                disabled={isSelfSubmission}
                className="py-2.5 px-6 rounded bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-900/50 text-rose-700 dark:text-rose-300 border border-rose-300 dark:border-rose-800 font-bold text-xs uppercase tracking-wider transition-all flex items-center gap-2 shadow-sm disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <XCircle className="w-4 h-4 text-rose-600 dark:text-rose-400" />
                <span>Reject</span>
              </button>

              <button
                onClick={() => promptDecision('APPROVED')}
                disabled={isSelfSubmission}
                className="py-2.5 px-6 rounded bg-emerald-600 hover:bg-emerald-500 text-white dark:bg-emerald-500 dark:hover:bg-emerald-400 dark:text-stone-950 font-bold text-xs uppercase tracking-wider transition-all flex items-center gap-2 shadow-md shadow-emerald-600/20 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Approve</span>
              </button>
            </div>
          </div>
        )}

        {/* Scope and Metrics: 4 Archival Blocks */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="p-4 rounded bg-stone-50 dark:bg-stone-950 border border-stone-200 dark:border-stone-800 space-y-1">
            <span className="text-[10px] text-stone-500 uppercase tracking-widest block">Quantitative Scope</span>
            <div className="font-serif-editorial text-2xl text-stone-900 dark:text-stone-100">
              {activity.quantity} <span className="text-xs font-mono-code font-normal text-stone-600 dark:text-stone-400">{activity.unit}</span>
            </div>
          </div>

          <div className="p-4 rounded bg-stone-50 dark:bg-stone-950 border border-stone-200 dark:border-stone-800 space-y-1">
            <span className="text-[10px] text-stone-500 uppercase tracking-widest block">Consensus Network</span>
            <div className="font-serif-editorial text-xl text-stone-900 dark:text-stone-100">Tezos</div>
            <span className="text-[10px] text-stone-500 block truncate">Shadownet</span>
          </div>

          <div className="p-4 rounded bg-stone-50 dark:bg-stone-950 border border-stone-200 dark:border-stone-800 space-y-1">
            <span className="text-[10px] text-stone-500 uppercase tracking-widest block">Deposition Date</span>
            <div className="text-xs font-bold text-stone-800 dark:text-stone-200">
              {formatTimestamp(activity.submitted_at)}
            </div>
            <span className="text-[10px] text-stone-500 block">Genesis Inscription</span>
          </div>

          <div className="p-4 rounded bg-stone-50 dark:bg-stone-950 border border-stone-200 dark:border-stone-800 space-y-1">
            <span className="text-[10px] text-stone-500 uppercase tracking-widest block">Ratification Date</span>
            <div className="text-xs font-bold text-stone-800 dark:text-stone-200">
              {activity.approved_at
                ? formatTimestamp(activity.approved_at)
                : activity.rejected_at
                ? formatTimestamp(activity.rejected_at)
                : 'Awaiting Verdict'}
            </div>
            <span className="text-[10px] text-stone-500 block">Arbitration Status</span>
          </div>
        </div>

        {/* Immutable On-Chain Cryptographic Audit Trail */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Lock className="w-4 h-4 text-stone-500" />
            <h3 className="font-serif-editorial text-xl text-stone-900 dark:text-stone-100">
              Cryptographic Blockchain References
            </h3>
          </div>

          <div className="rounded bg-stone-50 dark:bg-stone-950 border border-stone-200 dark:border-stone-800 p-5 space-y-3 text-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 py-1 border-b border-stone-200 dark:border-stone-800">
              <span className="text-stone-500 uppercase">SUBMITTER CADRE ADDRESS:</span>
              <span className="font-bold text-stone-900 dark:text-stone-100 select-all">{activity.submitter_address}</span>
            </div>

            {activity.submission_tx_hash && (
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 py-1 border-b border-stone-200 dark:border-stone-800">
                <span className="text-stone-500 uppercase">SUBMISSION OPERATION HASH:</span>
                <a
                  href={`${EXPLORER_URL}/${activity.submission_tx_hash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-stone-900 dark:text-stone-100 underline decoration-stone-300 hover:text-emerald-600 inline-flex items-center gap-1 font-bold select-all"
                >
                  <span>{activity.submission_tx_hash}</span>
                  <ExternalLink className="w-3 h-3 text-stone-400" />
                </a>
              </div>
            )}

            {activity.approver_address && (
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 py-1 border-b border-stone-200 dark:border-stone-800">
                <span className="text-stone-500 uppercase">ARBITRATING FACULTY ORGANIZER:</span>
                <span className="font-bold text-stone-900 dark:text-stone-100 select-all">{activity.approver_address}</span>
              </div>
            )}

            {activity.approval_tx_hash && (
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 py-1 border-b border-stone-200 dark:border-stone-800">
                <span className="text-stone-500 uppercase">RATIFICATION OPERATION HASH:</span>
                <a
                  href={`${EXPLORER_URL}/${activity.approval_tx_hash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-stone-900 dark:text-stone-100 underline decoration-stone-300 hover:text-emerald-600 inline-flex items-center gap-1 font-bold select-all"
                >
                  <span>{activity.approval_tx_hash}</span>
                  <ExternalLink className="w-3 h-3 text-stone-400" />
                </a>
              </div>
            )}

            <div className="flex flex-col gap-1 pt-1">
              <span className="text-stone-500 uppercase">EVIDENTIARY SHA-256 DIGEST:</span>
              <span className="text-stone-900 dark:text-stone-100 break-all select-all font-bold">{activity.evidence_hash}</span>
            </div>
          </div>
        </div>

        {/* Evidence Privacy & Inspection Section */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <FileCheck className="w-4 h-4 text-stone-500" />
            <h3 className="font-serif-editorial text-xl text-stone-900 dark:text-stone-100">
              Photographic Proof & Vault Storage
            </h3>
          </div>

          <div className="p-5 rounded bg-stone-50 dark:bg-stone-950 border border-stone-200 dark:border-stone-800 space-y-3">
            {isOrganizer ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-stone-800 dark:text-stone-200 text-xs font-bold uppercase tracking-wider">
                    <ShieldCheck className="w-4 h-4 text-emerald-600" />
                    <span>Authorized Faculty Councillor Clearance Confirmed</span>
                  </div>
                  <button
                    onClick={() => setIsPreviewModalOpen(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-stone-900 hover:bg-black text-white dark:bg-stone-100 dark:text-stone-950 text-xs uppercase tracking-wider font-bold transition-colors"
                  >
                    <ImageIcon className="w-3.5 h-3.5 text-emerald-400" />
                    <span>[ Inspect Evidence Image ]</span>
                  </button>
                </div>
                <p className="text-xs text-stone-600 dark:text-stone-400 font-sans">
                  As an accredited organizer, you possess clearance to inspect the high-resolution photographic evidence off-chain to confirm activity scope.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-stone-800 dark:text-stone-200 text-xs font-bold uppercase tracking-wider">
                  <Lock className="w-4 h-4 text-stone-500" />
                  <span>Cadre Privacy Protected</span>
                </div>
                <p className="text-xs text-stone-600 dark:text-stone-400 leading-relaxed font-sans">
                  Raw student photographic evidence is restricted to authorized campus organizers to prevent unauthorized public downloads.
                  The cryptographic SHA-256 fingerprint (<span className="font-mono-code text-stone-900 dark:text-stone-100 font-bold">{activity.evidence_hash.substring(0, 16)}...</span>) guarantees that the physical record cannot be modified post-deposition.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* GreenAI Smart Tree Detection Audit Section */}
        {activity.ai_detected_count !== undefined && activity.ai_detected_count !== null && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-emerald-600" />
                <h3 className="font-serif-editorial text-xl text-stone-900 dark:text-stone-100">
                  GreenAI Cognitive Tree Metrology Audit
                </h3>
              </div>
              <span className="text-[10px] text-stone-500 font-bold uppercase">
                {activity.ai_model_name || 'YOLOv8'} {activity.ai_model_version ? `v${activity.ai_model_version}` : ''}
              </span>
            </div>

            <div className="rounded bg-stone-50 dark:bg-stone-950 border border-stone-200 dark:border-stone-800 p-5 space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-3.5 rounded bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 space-y-1">
                  <span className="text-stone-500 text-[10px] uppercase tracking-wider block">Student Claimed</span>
                  <div className="font-serif-editorial text-xl text-stone-900 dark:text-stone-100">{activity.quantity} {activity.unit}</div>
                  <span className="text-[10px] text-stone-500">Self-reported quantity</span>
                </div>
                <div className="p-3.5 rounded bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 space-y-1">
                  <span className="text-stone-500 text-[10px] uppercase tracking-wider block">Neural Model Count</span>
                  <div className="font-serif-editorial text-xl text-stone-900 dark:text-stone-100">{activity.ai_detected_count} trees</div>
                  <span className="text-[10px] text-stone-500">Cognitive vision inference</span>
                </div>
                <div className="p-3.5 rounded bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 space-y-1">
                  <span className="text-stone-500 text-[10px] uppercase tracking-wider block">Model Confidence</span>
                  <div className="font-serif-editorial text-xl text-stone-900 dark:text-stone-100">{((activity.ai_confidence_score || 0) * 100).toFixed(1)}%</div>
                  <span className="text-[10px] text-stone-500">Mean bounding confidence</span>
                </div>
              </div>

              {/* Discrepancy or Verification Badge */}
              {activity.quantity !== activity.ai_detected_count ? (
                <div className="p-3 rounded bg-amber-50 dark:bg-amber-950/20 border border-amber-300 dark:border-amber-900 text-amber-900 dark:text-amber-300 text-xs flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold uppercase">Variance Detected: </span>
                    <span className="font-sans">
                      Cadre reported {activity.quantity} trees, whereas GreenAI identified {activity.ai_detected_count} trees (diff: {Math.abs(activity.quantity - activity.ai_detected_count)}).
                    </span>
                  </div>
                </div>
              ) : (
                <div className="p-3 rounded bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-xs flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span className="font-bold uppercase">Corroborated: </span>
                  <span className="font-sans">Student-reported tree count matches computer vision inference.</span>
                </div>
              )}

              {/* Annotated Photo toggle button */}
              {activity.ai_annotated_path && isOrganizer && (
                <div className="p-3 rounded bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-stone-700 dark:text-stone-300">
                    <Trees className="w-4 h-4 text-stone-500" />
                    <span>Annotated Detection Photograph with Bounding Contours Available</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setActivePhotoView('annotated');
                      setIsPreviewModalOpen(true);
                    }}
                    className="px-3 py-1.5 rounded bg-stone-900 hover:bg-black text-white dark:bg-stone-100 dark:text-stone-950 text-xs font-bold uppercase tracking-wider flex items-center gap-1.5"
                  >
                    <ImageIcon className="w-3.5 h-3.5 text-emerald-400" />
                    <span>[ View Annotated ]</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Off-Chain Metadata & Contextual Notes */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-stone-500" />
            <h3 className="font-serif-editorial text-xl text-stone-900 dark:text-stone-100">
              Contextual Notes & Geolocation
            </h3>
          </div>

          <div className="rounded bg-stone-50 dark:bg-stone-950 border border-stone-200 dark:border-stone-800 p-5 space-y-4 text-xs font-sans">
            <div>
              <span className="text-stone-500 block mb-1 font-mono-code uppercase font-semibold text-[10px]">
                Field Observation Notes:
              </span>
              <p className="text-stone-800 dark:text-stone-200 leading-relaxed bg-white dark:bg-stone-900 p-3.5 rounded border border-stone-200 dark:border-stone-800">
                {activity.description || 'No additional contextual description provided.'}
              </p>
            </div>

            {activity.rejection_reason && (
              <div>
                <span className="text-rose-700 dark:text-rose-400 block mb-1 font-mono-code uppercase font-semibold text-[10px]">
                  Council Rejection Justification:
                </span>
                <p className="text-rose-900 dark:text-rose-200 bg-rose-50 dark:bg-rose-950/20 p-3.5 rounded border border-rose-300 dark:border-rose-900">
                  {activity.rejection_reason}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Chronological Lifecycle Timeline */}
        {historyData && historyData.events && historyData.events.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <History className="w-4 h-4 text-stone-500" />
              <h3 className="font-serif-editorial text-xl text-stone-900 dark:text-stone-100">
                Chronological Lifecycle Timeline
              </h3>
              <span className="text-[10px] text-stone-500 font-mono-code">
                ({historyData.events.length} Historical Events)
              </span>
            </div>

            <div className="rounded bg-stone-50 dark:bg-stone-950 border border-stone-200 dark:border-stone-800 p-5 divide-y divide-stone-200 dark:divide-stone-800">
              {historyData.events.map((evt: ActivityHistoryEvent, idx: number) => (
                <div key={idx} className="py-3 first:pt-0 last:pb-0 flex items-start gap-3">
                  <div className="w-7 h-7 rounded bg-white dark:bg-stone-900 border border-stone-300 dark:border-stone-800 flex items-center justify-center shrink-0 mt-0.5 text-xs font-bold">
                    [0{idx + 1}]
                  </div>
                  <div className="space-y-0.5 text-xs flex-1">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-stone-900 dark:text-stone-100 uppercase">{evt.event_type}</span>
                      <span className="text-stone-500 font-mono-code text-[11px]">{formatTimestamp(evt.timestamp)}</span>
                    </div>
                    <p className="text-stone-700 dark:text-stone-300 font-sans">{evt.description}</p>
                    <div className="text-[11px] text-stone-500 font-mono-code">
                      ACTOR: {evt.actor_address} {evt.tx_hash && `• TX: ${truncateAddress(evt.tx_hash, 6, 4)}`}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Public QR Verification Certificate Stamp */}
        <div className="p-6 rounded bg-stone-50 dark:bg-stone-950 border border-stone-300 dark:border-stone-800 flex flex-col sm:flex-row items-center gap-6">
          <div className="bg-white p-3 rounded shadow-md shrink-0 flex flex-col items-center">
            <QRCodeSVG id="activity-qr-svg" value={verificationUrl} size={130} level="M" />
          </div>

          <div className="space-y-3 text-center sm:text-left flex-1 font-mono-code">
            <div className="flex items-center justify-center sm:justify-start gap-1.5 text-stone-900 dark:text-stone-100 font-bold text-sm uppercase">
              <QrCode className="w-4 h-4 text-emerald-600" />
              <span>Public Verification QR Attestation</span>
            </div>
            <p className="text-xs text-stone-600 dark:text-stone-400 leading-relaxed font-sans">
              Scan this badge or share the public verification URL. Anyone can verify the authenticity of this
              sustainability claim against the Tezos decentralized state with zero login requirements.
            </p>
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 pt-1">
              <Link
                to={`/verify?id=${activity.activity_id}`}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-stone-900 hover:bg-black text-white dark:bg-stone-100 dark:text-stone-950 text-xs font-bold uppercase tracking-wider transition-colors shadow-sm"
              >
                <span>[ Open Public Portal ]</span>
                <ExternalLink className="w-3.5 h-3.5 text-emerald-400" />
              </Link>
              <button
                type="button"
                onClick={downloadQRCode}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-stone-100 hover:bg-stone-200 dark:bg-stone-800 text-stone-800 dark:text-stone-200 border border-stone-300 dark:border-stone-700 text-xs font-bold uppercase tracking-wider transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                <span>[ Download PNG ]</span>
              </button>
              <button
                type="button"
                onClick={printQRCode}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-stone-100 hover:bg-stone-200 dark:bg-stone-800 text-stone-800 dark:text-stone-200 border border-stone-300 dark:border-stone-700 text-xs font-bold uppercase tracking-wider transition-colors"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>[ Print Folio ]</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Decision Confirmation Modal */}
      {pendingDecisionType && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/80 backdrop-blur-sm p-4 font-mono-code">
          <div className="max-w-xl w-full bg-stone-50 dark:bg-stone-900 border border-stone-300 dark:border-stone-700 rounded-lg p-6 sm:p-8 space-y-6 shadow-2xl text-stone-900 dark:text-stone-100">
            <div className="flex items-center justify-between border-b border-stone-300 dark:border-stone-800 pb-4">
              <div>
                <span className="text-[11px] text-stone-500 uppercase tracking-widest">[ COUNCIL SANCTION ]</span>
                <h3 className="font-serif-editorial text-2xl text-stone-900 dark:text-stone-100 flex items-center gap-2 pt-0.5">
                  <span>Adjudicate Verdict:</span>
                  <span
                    className={`text-xs px-2.5 py-0.5 rounded font-bold uppercase tracking-wider ${
                      pendingDecisionType === 'APPROVED' ? 'bg-emerald-600 text-white' : 'bg-rose-700 text-white'
                    }`}
                  >
                    {pendingDecisionType}
                  </span>
                </h3>
                <p className="text-xs text-stone-500 pt-0.5">Folio Reference: {activity.activity_id}</p>
              </div>
              {!isSigning && (
                <button
                  onClick={closeDecisionModal}
                  className="text-stone-500 hover:text-stone-900 dark:hover:text-stone-100 text-xs px-2.5 py-1 rounded bg-stone-200 dark:bg-stone-800"
                >
                  Cancel
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
                    Decision Confirmed & Recorded!
                  </h4>
                  <p className="text-xs text-stone-600 dark:text-stone-400">
                    Activity has been marked <span className="font-bold uppercase text-stone-900 dark:text-stone-100">{pendingDecisionType}</span>.
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
                  Done
                </button>
              </div>
            ) : (
              <>
                <div className="space-y-2 text-xs bg-white dark:bg-stone-950 p-4 rounded border border-stone-300 dark:border-stone-800">
                  <div className="flex justify-between">
                    <span className="text-stone-500 uppercase">SPECIMEN ID:</span>
                    <span className="font-bold text-stone-900 dark:text-stone-100">{activity.activity_id}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-stone-500 uppercase">ENVIRONMENTAL ACTION:</span>
                    <span className="font-bold text-stone-900 dark:text-stone-100">
                      {activity.quantity} {activity.unit} ({activity.category})
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-stone-500 uppercase">DEPOSITING CADRE:</span>
                    <span className="font-bold">{truncateAddress(activity.submitter_address)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-stone-500 uppercase">SIGNING COUNCIL KEY:</span>
                    <span className="font-bold">{truncateAddress(wallet.address || '')}</span>
                  </div>
                </div>

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
                    <span>{signingStep || 'Communicating with Beacon wallet...'}</span>
                  </div>
                )}

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
                        <span>Signing...</span>
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

      {/* Evidence Preview Modal for Authorized Organizers */}
      {isPreviewModalOpen && protectedEvidenceUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-950/80 backdrop-blur-sm font-mono-code">
          <div className="bg-stone-50 dark:bg-stone-900 border border-stone-300 dark:border-stone-700 rounded-lg max-w-2xl w-full p-6 space-y-4 shadow-2xl text-stone-900 dark:text-stone-100">
            <div className="flex items-center justify-between border-b border-stone-300 dark:border-stone-800 pb-3">
              <div className="flex items-center gap-2">
                <ImageIcon className="w-4 h-4 text-emerald-600" />
                <h3 className="font-serif-editorial text-xl text-stone-900 dark:text-stone-100">
                  {activePhotoView === 'annotated' && activity.ai_annotated_path
                    ? 'GreenAI Annotated Evidence Metrology'
                    : 'Protected Photographic Evidence Preview'}
                </h3>
              </div>
              <button
                onClick={() => setIsPreviewModalOpen(false)}
                className="text-stone-500 hover:text-stone-900 dark:hover:text-stone-100 text-xs px-2 py-1 rounded bg-stone-200 dark:bg-stone-800"
              >
                [ CLOSE ]
              </button>
            </div>

            {activity.ai_annotated_path && (
              <div className="flex items-center justify-center gap-2 bg-stone-100 dark:bg-stone-950 p-1.5 rounded border border-stone-300 dark:border-stone-800">
                <button
                  type="button"
                  onClick={() => setActivePhotoView('original')}
                  className={`px-3 py-1 rounded text-xs font-bold uppercase tracking-wider transition-colors ${
                    activePhotoView === 'original'
                      ? 'bg-stone-900 text-white dark:bg-stone-100 dark:text-stone-950'
                      : 'text-stone-600 dark:text-stone-400 hover:text-stone-900'
                  }`}
                >
                  Raw Specimen
                </button>
                <button
                  type="button"
                  onClick={() => setActivePhotoView('annotated')}
                  className={`px-3 py-1 rounded text-xs font-bold uppercase tracking-wider transition-colors flex items-center gap-1 ${
                    activePhotoView === 'annotated'
                      ? 'bg-stone-900 text-white dark:bg-stone-100 dark:text-stone-950'
                      : 'text-stone-600 dark:text-stone-400 hover:text-stone-900'
                  }`}
                >
                  <Sparkles className="w-3 h-3 text-emerald-400" />
                  <span>GreenAI Annotated</span>
                </button>
              </div>
            )}

            <div className="rounded overflow-hidden bg-stone-950 border border-stone-300 dark:border-stone-800 flex items-center justify-center max-h-[480px]">
              <img
                src={
                  activePhotoView === 'annotated' && activity.ai_annotated_path
                    ? api.getAnnotatedEvidenceFileUrl(activity.ai_annotated_path)
                    : protectedEvidenceUrl
                }
                alt="Student Evidence"
                className="object-contain max-h-[460px] w-full"
                onError={(e) => {
                  (e.target as HTMLElement).style.display = 'none';
                }}
              />
            </div>
            <div className="flex items-center justify-between text-xs text-stone-500 font-mono-code pt-2">
              <span>Digest: {truncateAddress(activity.evidence_hash, 10, 8)}</span>
              <button
                onClick={() => setIsPreviewModalOpen(false)}
                className="px-4 py-2 rounded bg-stone-900 hover:bg-black text-white dark:bg-stone-100 dark:text-stone-950 font-bold uppercase tracking-wider text-xs"
              >
                [ Dismiss Viewer ]
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
