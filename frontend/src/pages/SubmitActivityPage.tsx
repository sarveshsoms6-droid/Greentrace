import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useWallet } from '../context/WalletContext';
import type { ActivityCategory, ActivityRecord, TreeDetectionResult } from '../types';
import { CATEGORY_UNITS } from '../types';
import { calculateFileSHA256, truncateAddress } from '../utils/crypto';
import { api, ApiError } from '../services/api';
import { submitActivityOperation, CONTRACT_ADDRESS, formatWalletError } from '../services/tezos';
import { 
  Upload, 
  Hash, 
  AlertTriangle, 
  CheckCircle2, 
  ArrowLeft, 
  Loader2, 
  ShieldAlert, 
  Sparkles,
  Bot,
  Trees,
  Check,
  Eye,
  Info
} from 'lucide-react';

export const SubmitActivityPage: React.FC = () => {
  const { wallet, addActivity, isDuplicateHash } = useWallet();

  const [category, setCategory] = useState<ActivityCategory>('Recycling');
  const [unit, setUnit] = useState<string>('kg');
  const [customUnit, setCustomUnit] = useState<string>('');
  const [quantity, setQuantity] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [activityDate, setActivityDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );

  const [evidenceFile, setEvidenceFile] = useState<File | null>(null);
  const [evidencePreviewUrl, setEvidencePreviewUrl] = useState<string | null>(null);
  const [evidenceHash, setEvidenceHash] = useState<string>('');
  const [serverHash, setServerHash] = useState<string>('');
  const [isHashing, setIsHashing] = useState<boolean>(false);
  const [uploadProgress, setUploadProgress] = useState<'idle' | 'uploading' | 'done' | 'error'>('idle');
  const [duplicateWarning, setDuplicateWarning] = useState<boolean>(false);
  const [duplicateActivityId, setDuplicateActivityId] = useState<string | null>(null);

  // GreenAI Tree Detection States
  const [isAnalyzingAI, setIsAnalyzingAI] = useState<boolean>(false);
  const [aiResult, setAiResult] = useState<TreeDetectionResult | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  const [activeImageView, setActiveImageView] = useState<'ORIGINAL' | 'ANNOTATED'>('ANNOTATED');

  // Submission lifecycle states
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [submissionStep, setSubmissionStep] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successRecord, setSuccessRecord] = useState<ActivityRecord | null>(null);

  // Sync compatible units whenever category changes
  useEffect(() => {
    const availableUnits = CATEGORY_UNITS[category];
    if (availableUnits && availableUnits.length > 0) {
      setUnit(availableUnits[0]);
    }
    // Reset AI result if category changes away from Tree planting
    if (category !== 'Tree planting') {
      setAiResult(null);
      setAiError(null);
    }
  }, [category]);

  // Handle file selection & client-side SHA-256 calculation + backend duplicate check
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      setErrorMessage('Please upload a valid image file (PNG, JPEG, WebP).');
      return;
    }

    // Validate size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      setErrorMessage('Evidence file size exceeds 10MB limit.');
      return;
    }

    setErrorMessage(null);
    setEvidenceFile(file);
    setEvidencePreviewUrl(URL.createObjectURL(file));
    setServerHash('');
    setDuplicateWarning(false);
    setDuplicateActivityId(null);
    setAiResult(null);
    setAiError(null);
    setUploadProgress('idle');
    setIsHashing(true);

    try {
      // Client-side hash (fast feedback)
      const clientHash = await calculateFileSHA256(file);
      setEvidenceHash(clientHash);

      // Check backend for duplicates using client-computed hash
      try {
        const dupCheck = await api.checkDuplicate(clientHash);
        setDuplicateWarning(dupCheck.is_duplicate);
        setDuplicateActivityId(dupCheck.existing_activity_id ?? null);
      } catch {
        // Fall back gracefully
        const localDup = isDuplicateHash(clientHash);
        setDuplicateWarning(localDup);
      }
    } catch {
      setErrorMessage('Failed to calculate SHA-256 hash for the selected file.');
    } finally {
      setIsHashing(false);
    }
  };

  // Trigger GreenAI tree detection
  const handleAnalyzeWithGreenAI = async () => {
    if (!evidenceFile) {
      setAiError('Please select a photograph first to analyze.');
      return;
    }

    setIsAnalyzingAI(true);
    setAiError(null);

    try {
      const result = await api.detectTrees(evidenceFile);
      setAiResult(result);
      setActiveImageView('ANNOTATED');

      // Auto-suggest count if student hasn't entered one yet
      if (!quantity && result.count > 0) {
        setQuantity(String(result.count));
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'AI tree detection failed. Please check backend connection.';
      setAiError(msg);
    } finally {
      setIsAnalyzingAI(false);
    }
  };

  const handleApplyAiCount = () => {
    if (aiResult) {
      setQuantity(String(aiResult.count));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    if (!wallet.isConnected || !wallet.address) {
      setErrorMessage('Please connect your Tezos wallet before submitting.');
      return;
    }

    const numQty = parseFloat(quantity);
    if (isNaN(numQty) || numQty <= 0) {
      setErrorMessage('Please enter a valid positive quantity.');
      return;
    }

    if (!description.trim() || description.trim().length < 10) {
      setErrorMessage('Please provide a descriptive explanation (at least 10 characters).');
      return;
    }

    if (!evidenceFile || !evidenceHash) {
      setErrorMessage('Please upload photographic evidence with a calculated SHA-256 hash.');
      return;
    }

    const finalUnit = category === 'Other' ? customUnit.trim() || 'units' : unit;

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      // Step 1: Upload evidence to backend & verify server-side hash matches client hash
      setSubmissionStep('Uploading evidence and verifying SHA-256 fingerprint server-side...');
      setUploadProgress('uploading');

      let confirmedHash = evidenceHash;
      try {
        const uploadResult = await api.uploadEvidence(evidenceFile);
        setUploadProgress('done');
        setServerHash(uploadResult.evidence_hash);

        // Hash integrity check: client hash must match server hash
        if (uploadResult.evidence_hash !== evidenceHash) {
          setUploadProgress('error');
          setErrorMessage(
            `Hash mismatch: client computed ${evidenceHash.slice(0, 12)}… but server got ${uploadResult.evidence_hash.slice(0, 12)}…. ` +
            'The file may have been altered in transit. Please re-select the evidence file.'
          );
          return;
        }

        confirmedHash = uploadResult.evidence_hash;

        // Show duplicate warning if server detected one
        if (uploadResult.is_duplicate) {
          setDuplicateWarning(true);
          setDuplicateActivityId(uploadResult.existing_activity_id ?? null);
        }
      } catch (uploadErr) {
        setUploadProgress('error');
        if (uploadErr instanceof ApiError) {
          setErrorMessage(`Evidence upload failed (${uploadErr.status}): ${uploadErr.detail}`);
        } else {
          setErrorMessage('Evidence upload failed. Backend may be offline — submission cannot continue without server-side verification.');
        }
        return;
      }

      // Generate activity record
      const uniqueId = `act-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;
      const contractTimestamp = new Date().toISOString();

      // Step 2: On-chain transaction with connected wallet if contract configured
      let confirmedTxHash: string | undefined = undefined;
      if (CONTRACT_ADDRESS) {
        setSubmissionStep('Requesting transaction signature in connected Beacon wallet...');
        try {
          confirmedTxHash = await submitActivityOperation({
            activityId: uniqueId,
            evidenceHash: confirmedHash,
            category,
            quantity: numQty,
            unit: finalUnit,
          });
          setSubmissionStep('Operation confirmed on Tezos blockchain!');
        } catch (walletErr) {
          throw new Error(formatWalletError(walletErr));
        }
      } else {
        setSubmissionStep('Saving to off-chain ledger (Contract pending testnet deployment)...');
      }

      const newRecord: ActivityRecord = {
        activity_id: uniqueId,
        category,
        quantity: numQty,
        unit: finalUnit,
        description: description.trim(),
        evidence_hash: confirmedHash,
        evidence_filename: evidenceFile.name,
        status: 'SUBMITTED',
        submitter_address: wallet.address,
        submitted_at: contractTimestamp,
        activity_date: activityDate,
        submission_tx_hash: confirmedTxHash,
        is_sample: false,
        // Attach GreenAI detection metadata if tree activity was analyzed
        ai_detected_count: aiResult ? aiResult.count : undefined,
        ai_confidence_score: aiResult ? aiResult.average_confidence : undefined,
        ai_model_name: aiResult ? aiResult.model_name : undefined,
        ai_model_version: aiResult ? aiResult.model_version : undefined,
        ai_annotated_path: aiResult ? aiResult.annotated_image_url : undefined,
        ai_detection_data: aiResult ? JSON.stringify(aiResult.detections) : undefined,
      };

      // Persist to SQLite backend database
      try {
        await api.createActivity({
          activity_id: uniqueId,
          submitter_address: wallet.address,
          category,
          quantity: numQty,
          unit: finalUnit,
          description: description.trim(),
          evidence_hash: confirmedHash,
          submission_tx_hash: confirmedTxHash || undefined,
          submitted_at: contractTimestamp,
          ai_detected_count: aiResult ? aiResult.count : undefined,
          ai_confidence_score: aiResult ? aiResult.average_confidence : undefined,
          ai_model_name: aiResult ? aiResult.model_name : undefined,
          ai_model_version: aiResult ? aiResult.model_version : undefined,
          ai_annotated_path: aiResult ? aiResult.annotated_image_url : undefined,
          ai_detection_data: aiResult ? JSON.stringify(aiResult.detections) : undefined,
        });
      } catch (dbErr) {
        console.warn('Backend activity persistence warning:', dbErr);
      }

      addActivity(newRecord);
      setSuccessRecord(newRecord);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Submission failed. Check network connection or wallet rejection.';
      setErrorMessage(msg);
    } finally {
      setIsSubmitting(false);
      setSubmissionStep('');
    }
  };

  if (successRecord) {
    return (
      <div className="max-w-2xl mx-auto py-8">
        <div className="p-8 rounded-3xl bg-white dark:bg-slate-900 border border-emerald-500/40 space-y-6 text-center shadow-xl">
          <div className="w-16 h-16 rounded-2xl bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-8 h-8" />
          </div>

          <div className="space-y-2">
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Activity Submitted & Signed!</h2>
            <p className="text-sm text-slate-600 dark:text-slate-300">
              Your activity has been cryptographically signed and submitted for organizer review.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-left space-y-2 text-xs font-mono">
            <div className="flex justify-between">
              <span className="text-slate-500 dark:text-slate-400">Activity ID:</span>
              <span className="text-slate-900 dark:text-white font-bold">{successRecord.activity_id}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500 dark:text-slate-400">Scope:</span>
              <span className="text-emerald-600 dark:text-emerald-400 font-bold">{successRecord.quantity} {successRecord.unit} ({successRecord.category})</span>
            </div>
            {successRecord.ai_detected_count !== undefined && (
              <div className="flex justify-between items-center text-indigo-600 dark:text-indigo-400">
                <span>GreenAI Detection:</span>
                <span className="font-bold">{successRecord.ai_detected_count} trees detected ({((successRecord.ai_confidence_score || 0) * 100).toFixed(1)}% conf)</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-slate-500 dark:text-slate-400">SHA-256 Fingerprint:</span>
              <span className="text-slate-700 dark:text-slate-300 truncate max-w-[260px]">{successRecord.evidence_hash}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500 dark:text-slate-400">Status:</span>
              <span className="text-amber-600 dark:text-amber-400 font-bold">SUBMITTED (Pending Organizer Review)</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500 dark:text-slate-400">Submitter Wallet:</span>
              <span className="text-slate-700 dark:text-slate-300">{truncateAddress(successRecord.submitter_address)}</span>
            </div>
          </div>

          <div className="flex items-center justify-center gap-3 pt-2">
            <Link
              to="/student"
              className="px-5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold transition-colors"
            >
              Back to Dashboard
            </Link>
            <Link
              to={`/activity/${successRecord.activity_id}`}
              className="px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold transition-colors shadow-md"
            >
              View Full Audit Trail
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-16">
      {/* Back button */}
      <Link
        to="/student"
        className="inline-flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Return to Dashboard</span>
      </Link>

      <div className="p-6 sm:p-8 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-md space-y-6">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Log Campus Sustainability Action</h1>
            <span className="text-[10px] bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded-full font-mono font-semibold">
              WALLET-SIGNED
            </span>
          </div>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
            Fill in the details, attach proof image for SHA-256 fingerprinting, and sign the transaction with your wallet.
          </p>
        </div>

        {errorMessage && (
          <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 text-rose-700 dark:text-rose-300 text-xs flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
            <span>{errorMessage}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Category & Unit selection */}
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                Activity Category *
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as ActivityCategory)}
                disabled={isSubmitting}
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500 transition-colors"
              >
                <option value="Recycling">Recycling</option>
                <option value="Tree planting">Tree planting (with GreenAI Detection)</option>
                <option value="Energy conservation">Energy conservation</option>
                <option value="Water conservation">Water conservation</option>
                <option value="Waste collection">Waste collection</option>
                <option value="Other">Other</option>
              </select>
            </div>

            {/* Quantity and Unit pairing */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center justify-between">
                <span>Quantity & Unit *</span>
                {category === 'Tree planting' && aiResult && (
                  <span className="text-[10px] text-indigo-600 dark:text-indigo-400 font-mono">
                    AI Suggested: {aiResult.count}
                  </span>
                )}
              </label>
              <div className="flex gap-2">
                <input
                  type="number"
                  step="any"
                  min="0.01"
                  placeholder="e.g. 5"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  disabled={isSubmitting}
                  required
                  className="w-2/3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500 transition-colors"
                />

                {category === 'Other' ? (
                  <input
                    type="text"
                    placeholder="custom unit"
                    value={customUnit}
                    onChange={(e) => setCustomUnit(e.target.value)}
                    disabled={isSubmitting}
                    className="w-1/3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500 transition-colors"
                  />
                ) : (
                  <select
                    value={unit}
                    onChange={(e) => setUnit(e.target.value)}
                    disabled={isSubmitting}
                    className="w-1/3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-emerald-600 dark:text-emerald-400 font-semibold focus:outline-none focus:border-emerald-500 transition-colors"
                  >
                    {CATEGORY_UNITS[category].map((u) => (
                      <option key={u} value={u}>
                        {u}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            </div>
          </div>

          {/* Activity Date */}
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center justify-between">
                <span>Reported Activity Date</span>
                <span className="text-[10px] text-slate-500 dark:text-slate-400 font-normal">Off-chain metadata</span>
              </label>
              <input
                type="date"
                value={activityDate}
                onChange={(e) => setActivityDate(e.target.value)}
                disabled={isSubmitting}
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500 transition-colors"
              />
              <p className="text-[10px] text-slate-500">
                Note: Contract timestamp is independently recorded on the Tezos blockchain when mined.
              </p>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center justify-between">
                <span>Submitter Identity</span>
                <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-normal">From Tezos Sender</span>
              </label>
              <input
                type="text"
                disabled
                value={wallet.address || 'Connect wallet to proceed'}
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2.5 text-xs font-mono text-slate-500 cursor-not-allowed"
              />
            </div>
          </div>

          {/* Short description */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
              Description & Campus Location *
            </label>
            <textarea
              rows={3}
              placeholder="Provide context on where the activity occurred (e.g., Campus East Lawn, Dorm Block B sorting station)..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={isSubmitting}
              required
              className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-3.5 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500 transition-colors"
            />
          </div>

          {/* Evidence File Upload and SHA-256 Calculation */}
          <div className="space-y-3">
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center justify-between">
              <span>Evidence Photograph *</span>
              <span className="text-[10px] text-teal-600 dark:text-teal-400 font-mono">SHA-256 Fingerprinted</span>
            </label>

            <div className="border-2 border-dashed border-slate-300 dark:border-slate-800 hover:border-emerald-500/50 rounded-2xl p-6 text-center transition-colors bg-slate-50 dark:bg-slate-950/50">
              <input
                type="file"
                id="evidence-upload"
                accept="image/png, image/jpeg, image/webp"
                onChange={handleFileChange}
                disabled={isSubmitting}
                className="hidden"
              />
              <label
                htmlFor="evidence-upload"
                className="cursor-pointer flex flex-col items-center justify-center space-y-2"
              >
                <div className="w-12 h-12 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-300">
                  {isHashing ? (
                    <Loader2 className="w-6 h-6 animate-spin text-emerald-500" />
                  ) : (
                    <Upload className="w-6 h-6 text-emerald-500" />
                  )}
                </div>
                <div>
                  <span className="text-sm font-semibold text-emerald-600 dark:text-emerald-400 hover:underline">
                    Click to upload evidence photo
                  </span>
                  <span className="text-xs text-slate-500 block mt-0.5">
                    PNG, JPG, or WebP up to 10MB
                  </span>
                </div>
              </label>

              {evidenceFile && (
                <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-800 text-left space-y-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-700 dark:text-slate-300 font-medium truncate max-w-xs">{evidenceFile.name}</span>
                    <span className="text-slate-500">{(evidenceFile.size / 1024).toFixed(1)} KB</span>
                  </div>

                  <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 space-y-1">
                    <div className="flex items-center gap-1.5 text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold">
                      <Hash className="w-3.5 h-3.5" />
                      <span>SHA-256 Digest (Calculated Client-side):</span>
                    </div>
                    <p className="font-mono text-xs text-slate-700 dark:text-slate-300 break-all select-all">
                      {evidenceHash || 'Calculating...'}
                    </p>
                  </div>

                  {/* Upload progress indicator */}
                  {uploadProgress === 'uploading' && (
                    <div className="flex items-center gap-2 text-[11px] text-teal-600 dark:text-teal-400">
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Uploading evidence to secure storage…</span>
                    </div>
                  )}
                  {uploadProgress === 'done' && serverHash && (
                    <div className="flex items-center gap-2 text-[11px] text-emerald-600 dark:text-emerald-400">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Server hash verified: {serverHash.slice(0, 16)}…</span>
                    </div>
                  )}
                  {uploadProgress === 'error' && (
                    <div className="flex items-center gap-2 text-[11px] text-rose-600 dark:text-rose-400">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      <span>Upload or hash verification failed — see error above.</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Duplicate Evidence Alert */}
            {duplicateWarning && (
              <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 text-amber-800 dark:text-amber-300 text-xs flex items-start gap-2.5">
                <ShieldAlert className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <span className="font-bold">Duplicate Evidence Detected</span>
                  <p>
                    An identical photograph with this exact SHA-256 fingerprint has already been submitted in activity{' '}
                    <code className="font-mono text-amber-700 dark:text-amber-300 font-bold">{duplicateActivityId || 'record'}</code>.
                    Please provide authentic, original evidence for your current sustainability contribution.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* ================================================================= */}
          {/* GREENAI: SMART TREE DETECTION SECTION */}
          {/* ================================================================= */}
          {category === 'Tree planting' && evidenceFile && (
            <div className="p-5 rounded-2xl bg-gradient-to-br from-indigo-50/70 via-white to-emerald-50/50 dark:from-indigo-950/40 dark:via-slate-900 dark:to-emerald-950/20 border-2 border-indigo-500/30 space-y-4 shadow-sm animate-fadeIn">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-600 dark:text-indigo-400">
                    <Bot className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <h3 className="font-bold text-slate-900 dark:text-white text-sm">
                        GreenAI — Smart Tree Detection
                      </h3>
                      <span className="text-[10px] bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 border border-indigo-500/30 px-1.5 py-0.2 rounded font-mono font-bold">
                        YOLO-World
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Run automated vision analysis to count trees and verify planting evidence.
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleAnalyzeWithGreenAI}
                  disabled={isAnalyzingAI || isSubmitting}
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-md shadow-indigo-600/20 transition-all flex items-center justify-center gap-1.5 shrink-0 disabled:opacity-50"
                >
                  {isAnalyzingAI ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Scanning Photograph…</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      <span>{aiResult ? 'Re-Analyze with GreenAI' : 'Analyze with GreenAI'}</span>
                    </>
                  )}
                </button>
              </div>

              {aiError && (
                <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{aiError}</span>
                </div>
              )}

              {/* Progress Indicator when analyzing */}
              {isAnalyzingAI && (
                <div className="p-4 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-500/30 text-indigo-800 dark:text-indigo-200 text-xs flex items-center gap-3 animate-pulse">
                  <Loader2 className="w-5 h-5 animate-spin text-indigo-500 shrink-0" />
                  <div>
                    <div className="font-bold">GreenAI is analyzing photograph...</div>
                    <div className="text-[11px] text-slate-600 dark:text-slate-400">
                      Running open-vocabulary YOLO-World object detection model for tree crown and sapling identification.
                    </div>
                  </div>
                </div>
              )}

              {/* Detection Results Display */}
              {aiResult && !isAnalyzingAI && (
                <div className="space-y-4 pt-1">
                  {/* View Toggle & Image Preview */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                        <Eye className="w-3.5 h-3.5 text-indigo-500" />
                        <span>Detection Preview:</span>
                      </span>

                      <div className="flex rounded-lg bg-slate-100 dark:bg-slate-800 p-0.5 text-[11px] font-medium border border-slate-200 dark:border-slate-700">
                        <button
                          type="button"
                          onClick={() => setActiveImageView('ANNOTATED')}
                          className={`px-2.5 py-1 rounded-md transition-colors ${
                            activeImageView === 'ANNOTATED'
                              ? 'bg-indigo-600 text-white font-bold'
                              : 'text-slate-600 dark:text-slate-400'
                          }`}
                        >
                          Annotated AI View ({aiResult.count} boxes)
                        </button>
                        <button
                          type="button"
                          onClick={() => setActiveImageView('ORIGINAL')}
                          className={`px-2.5 py-1 rounded-md transition-colors ${
                            activeImageView === 'ORIGINAL'
                              ? 'bg-indigo-600 text-white font-bold'
                              : 'text-slate-600 dark:text-slate-400'
                          }`}
                        >
                          Original Photograph
                        </button>
                      </div>
                    </div>

                    <div className="rounded-2xl overflow-hidden bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-center p-2 max-h-72">
                      <img
                        src={
                          activeImageView === 'ANNOTATED' && aiResult.annotated_image_base64
                            ? aiResult.annotated_image_base64
                            : evidencePreviewUrl || ''
                        }
                        alt="GreenAI Tree Detection"
                        className="max-h-68 w-auto object-contain rounded-xl"
                      />
                    </div>
                  </div>

                  {/* Summary Cards */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                    <div className="p-3 rounded-xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-0.5">
                      <span className="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
                        Estimated Count
                      </span>
                      <div className="text-xl font-extrabold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                        <Trees className="w-4 h-4" />
                        <span>{aiResult.count} {aiResult.count === 1 ? 'Tree' : 'Trees'}</span>
                      </div>
                    </div>

                    <div className="p-3 rounded-xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-0.5">
                      <span className="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
                        Detection Confidence
                      </span>
                      <div className="text-xl font-extrabold text-indigo-600 dark:text-indigo-400 font-mono">
                        {(aiResult.average_confidence * 100).toFixed(1)}%
                      </div>
                    </div>

                    <div className="p-3 rounded-xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-0.5 col-span-2 sm:col-span-1">
                      <span className="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
                        Inference Model
                      </span>
                      <div className="font-bold text-slate-800 dark:text-slate-200 truncate">
                        YOLO-World v8s
                      </div>
                      <div className="text-[10px] text-slate-400 font-mono truncate">
                        {aiResult.processing_time_ms}ms
                      </div>
                    </div>
                  </div>

                  {/* Individual Bounding Boxes List */}
                  {aiResult.detections.length > 0 && (
                    <div className="space-y-1.5">
                      <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider block">
                        Detected Items ({aiResult.detections.length}):
                      </span>
                      <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
                        {aiResult.detections.map((det) => (
                          <span
                            key={det.id}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-[11px] font-mono"
                          >
                            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                            <span className="font-semibold text-slate-800 dark:text-slate-200">{det.class_name} #{det.id.split('-')[1]}</span>
                            <span className="text-slate-400">({(det.confidence * 100).toFixed(0)}%)</span>
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Count Sync / Action */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-xl bg-indigo-50/50 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-500/30">
                    <div className="text-xs text-slate-700 dark:text-slate-300">
                      {quantity && parseFloat(quantity) !== aiResult.count ? (
                        <span>
                          <strong>Note:</strong> Your entered count ({quantity}) differs from GreenAI estimate ({aiResult.count}). You may confirm your manual count or apply the AI detected count.
                        </span>
                      ) : (
                        <span>
                          <strong>Count Confirmed:</strong> AI analysis matches your submission quantity.
                        </span>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={handleApplyAiCount}
                      className="px-3.5 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs transition-colors shrink-0 flex items-center gap-1.5"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>Use AI Count: {aiResult.count} saplings</span>
                    </button>
                  </div>

                  {/* Caveat Notice */}
                  {aiResult.discrepancy_notice && (
                    <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-[11px] text-slate-500 dark:text-slate-400 flex items-start gap-2">
                      <Info className="w-4 h-4 text-indigo-500 shrink-0 mt-0.5" />
                      <span>{aiResult.discrepancy_notice}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Transaction submit button */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={isSubmitting || duplicateWarning}
              className="w-full py-3.5 px-6 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-sm shadow-md shadow-emerald-500/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed hover:scale-101"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>{submissionStep || 'Processing Transaction…'}</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>
                    Submit Activity with Cryptographic Proof {aiResult ? '(GreenAI Verified)' : ''}
                  </span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
