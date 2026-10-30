import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useWallet } from '../context/WalletContext';
import { truncateAddress, formatTimestamp } from '../utils/crypto';
import { api } from '../services/api';
import type { ActivityApiResponse, ActivityHistoryApiResponse, ActivityHistoryEvent } from '../services/api';
import { EXPLORER_URL, isAuthorizedOrganizer } from '../services/tezos';
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
  const { wallet } = useWallet();

  const [activity, setActivity] = useState<ActivityApiResponse | null>(null);
  const [historyData, setHistoryData] = useState<ActivityHistoryApiResponse | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Authoritative organizer verification for evidence preview
  const [isOrganizer, setIsOrganizer] = useState<boolean>(false);
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState<boolean>(false);
  const [activePhotoView, setActivePhotoView] = useState<'original' | 'annotated'>('original');

  useEffect(() => {
    async function checkRole() {
      if (wallet.isConnected && wallet.address) {
        const auth = await isAuthorizedOrganizer(wallet.address);
        setIsOrganizer(auth);
      } else {
        setIsOrganizer(false);
      }
    }
    checkRole();
  }, [wallet.isConnected, wallet.address]);

  useEffect(() => {
    if (!id) return;

    let isCancelled = false;
    async function loadData() {
      setIsLoading(true);
      setErrorMessage(null);
      try {
        const [actData, histData] = await Promise.allSettled([
          api.getActivityById(id!),
          api.getActivityHistory(id!),
        ]);

        if (isCancelled) return;

        if (actData.status === 'fulfilled') {
          setActivity(actData.value);
        } else {
          setErrorMessage('Activity record not found in database or unavailable.');
        }

        if (histData.status === 'fulfilled') {
          setHistoryData(histData.value);
        }
      } catch (err: unknown) {
        if (!isCancelled) {
          const msg = err instanceof Error ? err.message : 'Failed to retrieve activity details.';
          setErrorMessage(msg);
        }
      } finally {
        if (!isCancelled) {
          setIsLoading(false);
        }
      }
    }

    loadData();
    return () => {
      isCancelled = true;
    };
  }, [id]);

  if (isLoading) {
    return (
      <div className="max-w-2xl mx-auto py-24 text-center space-y-4">
        <Loader2 className="w-10 h-10 animate-spin text-emerald-400 mx-auto" />
        <h2 className="text-lg font-bold text-white">Loading Activity Details</h2>
        <p className="text-xs text-slate-400">Querying SQLite records and Tezos SmartPy audit state...</p>
      </div>
    );
  }

  if (errorMessage || !activity) {
    return (
      <div className="max-w-2xl mx-auto py-16 text-center space-y-5">
        <div className="w-16 h-16 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400 mx-auto">
          <AlertTriangle className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-white">Activity Not Found</h2>
        <p className="text-sm text-slate-400">{errorMessage || 'The requested activity does not exist in GreenTrace records.'}</p>
        <Link
          to="/history"
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-800 text-slate-200 text-xs font-semibold hover:bg-slate-700 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Activity History</span>
        </Link>
      </div>
    );
  }

  const verificationUrl = `${window.location.origin}/verify?id=${activity.activity_id}`;
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
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, 400, 400);
        ctx.drawImage(img, 20, 20, 360, 360);
      }
      const pngFile = canvas.toDataURL('image/png');
      const downloadLink = document.createElement('a');
      downloadLink.download = `greentrace-qr-${activity.activity_id}.png`;
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
    <div className="max-w-4xl mx-auto space-y-8 pb-16">
      {/* Back button */}
      <div className="flex items-center justify-between">
        <Link
          to="/history"
          className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Return to Activity History</span>
        </Link>
        <Link
          to="/student"
          className="inline-flex items-center gap-1.5 text-xs text-emerald-400 hover:text-emerald-300 font-semibold"
        >
          <span>My Student Dashboard</span>
        </Link>
      </div>

      {/* Main Card */}
      <div className="p-6 sm:p-8 rounded-3xl bg-slate-900 border border-slate-800 shadow-2xl space-y-8">
        {/* Header with Title, Status and Confirmation Badge */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-800 pb-6">
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-mono text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-md font-bold">
                ID: {activity.activity_id}
              </span>
              {activity.blockchain_confirmed === 1 ? (
                <span className="inline-flex items-center gap-1 text-[11px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 px-2.5 py-0.5 rounded-full font-semibold font-mono">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  BLOCKCHAIN CONFIRMED
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-[11px] bg-amber-500/10 text-amber-400 border border-amber-500/30 px-2.5 py-0.5 rounded-full font-semibold font-mono">
                  <Clock className="w-3.5 h-3.5" />
                  PENDING ON-CHAIN CONFIRMATION
                </span>
              )}
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white">
              {activity.category}
            </h1>
          </div>

          <div>
            {activity.status_cache === 'APPROVED' ? (
              <div className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                <CheckCircle2 className="w-4 h-4" />
                <span>Status: APPROVED</span>
              </div>
            ) : activity.status_cache === 'SUBMITTED' ? (
              <div className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold bg-amber-500/10 text-amber-400 border border-amber-500/30">
                <Clock className="w-4 h-4" />
                <span>Status: PENDING REVIEW</span>
              </div>
            ) : (
              <div className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold bg-rose-500/10 text-rose-400 border border-rose-500/30">
                <XCircle className="w-4 h-4" />
                <span>Status: REJECTED</span>
              </div>
            )}
          </div>
        </div>

        {/* Scope and Metrics */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
            <span className="text-xs text-slate-400">Quantity</span>
            <div className="text-xl font-bold text-white font-mono">
              {activity.quantity} <span className="text-emerald-400 text-sm">{activity.unit}</span>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
            <span className="text-xs text-slate-400">Tezos Network</span>
            <div className="text-base font-bold text-slate-200">Shadownet</div>
            <span className="text-[10px] text-emerald-400 font-mono">rpc.shadownet.teztnets.com</span>
          </div>

          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
            <span className="text-xs text-slate-400">Submitted At</span>
            <div className="text-xs font-bold text-slate-200 font-mono">
              {formatTimestamp(activity.submitted_at)}
            </div>
            <span className="text-[10px] text-slate-500">Mined timestamp</span>
          </div>

          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
            <span className="text-xs text-slate-400">Decision Date</span>
            <div className="text-xs font-bold text-slate-200 font-mono">
              {activity.approved_at
                ? formatTimestamp(activity.approved_at)
                : activity.rejected_at
                ? formatTimestamp(activity.rejected_at)
                : 'Awaiting Decision'}
            </div>
            <span className="text-[10px] text-slate-500">Review status</span>
          </div>
        </div>

        {/* Immutable On-Chain Cryptographic Audit Trail */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Lock className="w-4 h-4 text-emerald-400" />
            <h3 className="text-base font-bold text-white">Cryptographic Blockchain References</h3>
            <span className="text-[10px] text-slate-400 bg-slate-800 px-2 py-0.5 rounded font-mono">Tezos On-Chain</span>
          </div>

          <div className="rounded-2xl bg-slate-950 border border-slate-800 p-5 space-y-3 font-mono text-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 py-1 border-b border-slate-900">
              <span className="text-slate-400">Submitter Student Address:</span>
              <span className="text-white select-all">{activity.submitter_address}</span>
            </div>

            {activity.submission_tx_hash && (
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 py-1 border-b border-slate-900">
                <span className="text-slate-400">Submission Operation Hash:</span>
                <a
                  href={`${EXPLORER_URL}/${activity.submission_tx_hash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-teal-400 hover:text-teal-300 inline-flex items-center gap-1 select-all"
                >
                  <span>{activity.submission_tx_hash}</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            )}

            {activity.approver_address && (
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 py-1 border-b border-slate-900">
                <span className="text-slate-400">Reviewer Organizer Address:</span>
                <span className="text-indigo-300 select-all">{activity.approver_address}</span>
              </div>
            )}

            {activity.approval_tx_hash && (
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 py-1 border-b border-slate-900">
                <span className="text-slate-400">Decision Operation Hash:</span>
                <a
                  href={`${EXPLORER_URL}/${activity.approval_tx_hash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-teal-400 hover:text-teal-300 inline-flex items-center gap-1 select-all"
                >
                  <span>{activity.approval_tx_hash}</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            )}

            <div className="flex flex-col gap-1 pt-1">
              <span className="text-slate-400">Evidence SHA-256 Digest:</span>
              <span className="text-teal-300 break-all select-all font-mono">{activity.evidence_hash}</span>
            </div>
          </div>
        </div>

        {/* Evidence Privacy & Inspection Section */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <FileCheck className="w-4 h-4 text-teal-400" />
            <h3 className="text-base font-bold text-white">Photographic Evidence</h3>
            <span className="text-[10px] text-slate-400 bg-slate-800 px-2 py-0.5 rounded font-mono">Protected Storage</span>
          </div>

          <div className="p-5 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
            {isOrganizer ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-emerald-400 text-xs font-semibold">
                    <ShieldCheck className="w-4 h-4" />
                    <span>Authorized Organizer Access Granted</span>
                  </div>
                  <button
                    onClick={() => setIsPreviewModalOpen(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-xs font-semibold"
                  >
                    <ImageIcon className="w-3.5 h-3.5" />
                    <span>Inspect Evidence Image</span>
                  </button>
                </div>
                <p className="text-xs text-slate-400">
                  As an authorized organizer, you can inspect the high-resolution photographic evidence off-chain to confirm activity scope.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-slate-300 text-xs font-semibold">
                  <Lock className="w-4 h-4 text-emerald-400" />
                  <span>Student Privacy Protected</span>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Raw student photographic evidence is restricted to authorized campus organizers to prevent unauthorized public downloads.
                  The SHA-256 cryptographic digest (<span className="font-mono text-teal-300">{activity.evidence_hash.substring(0, 16)}...</span>) guarantees that the evidence cannot be altered or falsified.
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
                <Sparkles className="w-4 h-4 text-emerald-400" />
                <h3 className="text-base font-bold text-white">GreenAI Smart Tree Detection Audit</h3>
              </div>
              <span className="text-[10px] text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-0.5 rounded-full font-mono">
                {activity.ai_model_name || 'YOLO-World'} {activity.ai_model_version ? `v${activity.ai_model_version}` : ''}
              </span>
            </div>

            <div className="rounded-2xl bg-slate-950 border border-slate-800 p-5 space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 space-y-1">
                  <span className="text-slate-400 text-[11px]">Student Claimed</span>
                  <div className="text-base font-bold text-white font-mono">{activity.quantity} {activity.unit}</div>
                  <span className="text-[10px] text-slate-500">Self-reported quantity</span>
                </div>
                <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 space-y-1">
                  <span className="text-slate-400 text-[11px]">AI Model Count</span>
                  <div className="text-base font-bold text-emerald-400 font-mono">{activity.ai_detected_count} trees</div>
                  <span className="text-[10px] text-slate-500">Automated computer vision</span>
                </div>
                <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 space-y-1">
                  <span className="text-slate-400 text-[11px]">Model Confidence</span>
                  <div className="text-base font-bold text-teal-400 font-mono">{((activity.ai_confidence_score || 0) * 100).toFixed(1)}%</div>
                  <span className="text-[10px] text-slate-500">Average detection score</span>
                </div>
              </div>

              {/* Discrepancy or Verification Badge */}
              {activity.quantity !== activity.ai_detected_count ? (
                <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold">Count Discrepancy Detected: </span>
                    <span>
                      Student reported {activity.quantity} trees, whereas GreenAI identified {activity.ai_detected_count} trees (difference: {Math.abs(activity.quantity - activity.ai_detected_count)}).
                    </span>
                  </div>
                </div>
              ) : (
                <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span className="font-bold">Count Corroborated: </span>
                  <span>Student-reported tree count aligns with the GreenAI vision model inference.</span>
                </div>
              )}

              {/* Annotated Photo toggle button */}
              {activity.ai_annotated_path && isOrganizer && (
                <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-slate-300">
                    <Trees className="w-4 h-4 text-emerald-400" />
                    <span>Annotated Detection Photograph with Bounding Boxes Available</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setActivePhotoView('annotated');
                      setIsPreviewModalOpen(true);
                    }}
                    className="px-3 py-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-xs font-semibold flex items-center gap-1.5"
                  >
                    <ImageIcon className="w-3.5 h-3.5" />
                    <span>View Annotated Photo</span>
                  </button>
                </div>
              )}

              <p className="text-[11px] text-slate-400 italic">
                * GreenAI operates as an advisory verification layer. Decisions require cryptographic signatures from an authorized campus organizer wallet.
              </p>
            </div>
          </div>
        )}

        {/* Off-Chain Metadata & Notes */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-cyan-400" />
            <h3 className="text-base font-bold text-white">Off-Chain Metadata</h3>
          </div>

          <div className="rounded-2xl bg-slate-950 border border-slate-800 p-5 space-y-4 text-xs">
            <div>
              <span className="text-slate-400 block mb-1 font-semibold">Activity Description:</span>
              <p className="text-slate-200 leading-relaxed bg-slate-900 p-3.5 rounded-xl border border-slate-800">
                {activity.description || 'No additional description provided.'}
              </p>
            </div>

            {activity.rejection_reason && (
              <div>
                <span className="text-rose-400 font-semibold block mb-1">Organizer Rejection Note:</span>
                <p className="text-rose-200 bg-rose-950/30 p-3.5 rounded-xl border border-rose-900/50">
                  {activity.rejection_reason}
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
                <Sparkles className="w-4 h-4 text-emerald-400" />
                <h3 className="text-base font-bold text-white">GreenAI Smart Tree Detection Audit</h3>
              </div>
              <span className="text-[10px] text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-0.5 rounded-full font-mono">
                {activity.ai_model_name || 'YOLO-World'} {activity.ai_model_version ? `v${activity.ai_model_version}` : ''}
              </span>
            </div>

            <div className="rounded-2xl bg-slate-950 border border-slate-800 p-5 space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 space-y-1">
                  <span className="text-slate-400 text-[11px]">Student Claimed</span>
                  <div className="text-base font-bold text-white font-mono">{activity.quantity} {activity.unit}</div>
                  <span className="text-[10px] text-slate-500">Self-reported quantity</span>
                </div>
                <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 space-y-1">
                  <span className="text-slate-400 text-[11px]">AI Model Count</span>
                  <div className="text-base font-bold text-emerald-400 font-mono">{activity.ai_detected_count} trees</div>
                  <span className="text-[10px] text-slate-500">Automated computer vision</span>
                </div>
                <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 space-y-1">
                  <span className="text-slate-400 text-[11px]">Model Confidence</span>
                  <div className="text-base font-bold text-teal-400 font-mono">{((activity.ai_confidence_score || 0) * 100).toFixed(1)}%</div>
                  <span className="text-[10px] text-slate-500">Average detection score</span>
                </div>
              </div>

              {/* Discrepancy or Verification Badge */}
              {activity.quantity !== activity.ai_detected_count ? (
                <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold">Count Discrepancy Detected: </span>
                    <span>
                      Student reported {activity.quantity} trees, whereas GreenAI identified {activity.ai_detected_count} trees (difference: {Math.abs(activity.quantity - activity.ai_detected_count)}).
                    </span>
                  </div>
                </div>
              ) : (
                <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span className="font-bold">Count Corroborated: </span>
                  <span>Student-reported tree count aligns with the GreenAI vision model inference.</span>
                </div>
              )}

              {/* Annotated Photo toggle button */}
              {activity.ai_annotated_path && isOrganizer && (
                <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-slate-300">
                    <Trees className="w-4 h-4 text-emerald-400" />
                    <span>Annotated Detection Photograph with Bounding Boxes Available</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setActivePhotoView('annotated');
                      setIsPreviewModalOpen(true);
                    }}
                    className="px-3 py-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-xs font-semibold flex items-center gap-1.5"
                  >
                    <ImageIcon className="w-3.5 h-3.5" />
                    <span>View Annotated Photo</span>
                  </button>
                </div>
              )}

              <p className="text-[11px] text-slate-400 italic">
                * GreenAI operates as an advisory verification layer. Decisions require cryptographic signatures from an authorized campus organizer wallet.
              </p>
            </div>
          </div>
        )}

        {/* Chronological Audit Trail Timeline from Phase 7 */}
        {historyData && historyData.events && historyData.events.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <History className="w-4 h-4 text-indigo-400" />
              <h3 className="text-base font-bold text-white">Chronological Lifecycle Timeline</h3>
              <span className="text-[10px] text-slate-400 bg-slate-800 px-2 py-0.5 rounded font-mono">
                {historyData.events.length} Events
              </span>
            </div>

            <div className="rounded-2xl bg-slate-950 border border-slate-800 p-5 divide-y divide-slate-800/80">
              {historyData.events.map((evt: ActivityHistoryEvent, idx: number) => (
                <div key={idx} className="py-3 first:pt-0 last:pb-0 flex items-start gap-3">
                  <div className="w-7 h-7 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-center shrink-0 mt-0.5">
                    {evt.event_type === 'APPROVAL' ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    ) : evt.event_type === 'REJECTION' ? (
                      <XCircle className="w-4 h-4 text-rose-400" />
                    ) : (
                      <Clock className="w-4 h-4 text-amber-400" />
                    )}
                  </div>
                  <div className="space-y-0.5 text-xs flex-1">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-white">{evt.event_type}</span>
                      <span className="text-slate-400 font-mono text-[11px]">{formatTimestamp(evt.timestamp)}</span>
                    </div>
                    <p className="text-slate-300">{evt.description}</p>
                    <div className="text-[11px] text-slate-500 font-mono">
                      Actor: {evt.actor_address} {evt.tx_hash && `• TX: ${truncateAddress(evt.tx_hash, 6, 4)}`}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Public QR Verification Portal Badge */}
        <div className="p-6 rounded-2xl bg-gradient-to-r from-slate-950 to-slate-900 border border-slate-800 flex flex-col sm:flex-row items-center gap-6">
          <div className="bg-white p-3 rounded-xl shadow-lg shrink-0 flex flex-col items-center">
            <QRCodeSVG id="activity-qr-svg" value={verificationUrl} size={130} level="M" />
          </div>

          <div className="space-y-3 text-center sm:text-left flex-1">
            <div className="flex items-center justify-center sm:justify-start gap-1.5 text-emerald-400 font-bold text-sm">
              <QrCode className="w-4 h-4" />
              <span>Public Verification QR Code</span>
            </div>
            <p className="text-xs text-slate-300 max-w-md leading-relaxed">
              Anyone can scan this badge or visit the public verification portal without logging in. The verification portal queries the Tezos SmartPy contract state directly to prove record authenticity.
            </p>
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-3 pt-1">
              <Link
                to={`/verify?id=${activity.activity_id}`}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-xs text-emerald-300 hover:bg-emerald-500/20 font-semibold transition-colors"
              >
                <span>Open Public Verification Page</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </Link>
              <button
                type="button"
                onClick={downloadQRCode}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs text-slate-200 font-medium transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download QR (PNG)</span>
              </button>
              <button
                type="button"
                onClick={printQRCode}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs text-slate-200 font-medium transition-colors"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print Badge</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Evidence Preview Modal for Authorized Organizers */}
      {isPreviewModalOpen && protectedEvidenceUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-2xl w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <ImageIcon className="w-5 h-5 text-emerald-400" />
                <h3 className="font-bold text-white text-base">
                  {activePhotoView === 'annotated' && activity.ai_annotated_path
                    ? 'GreenAI Annotated Evidence Preview'
                    : 'Protected Photographic Evidence Preview'}
                </h3>
              </div>
              <button
                onClick={() => setIsPreviewModalOpen(false)}
                className="text-slate-400 hover:text-white font-mono text-sm"
              >
                ✕
              </button>
            </div>

            {activity.ai_annotated_path && (
              <div className="flex items-center justify-center gap-2 bg-slate-950 p-1.5 rounded-xl border border-slate-800">
                <button
                  type="button"
                  onClick={() => setActivePhotoView('original')}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors ${
                    activePhotoView === 'original'
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Original Evidence
                </button>
                <button
                  type="button"
                  onClick={() => setActivePhotoView('annotated')}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1 ${
                    activePhotoView === 'annotated'
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Sparkles className="w-3 h-3 text-emerald-400" />
                  <span>GreenAI Annotated</span>
                </button>
              </div>
            )}

            <div className="rounded-xl overflow-hidden bg-slate-950 border border-slate-800 flex items-center justify-center max-h-[480px]">
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
            <div className="flex items-center justify-between text-xs text-slate-400 font-mono">
              <span>Digest: {truncateAddress(activity.evidence_hash, 10, 8)}</span>
              <button
                onClick={() => setIsPreviewModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
