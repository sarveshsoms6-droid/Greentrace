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
  FileCheck,
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
      setErrorMessage('Please upload an authentic image file (PNG, JPEG, WebP).');
      return;
    }

    // Validate size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      setErrorMessage('Evidence file size exceeds institutional 10MB limit.');
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
      // Client-side hash (fast cryptographic fingerprint)
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
      setErrorMessage('Failed to compute SHA-256 digest for selected photograph.');
    } finally {
      setIsHashing(false);
    }
  };

  // Trigger GreenAI tree detection
  const handleAnalyzeWithGreenAI = async () => {
    if (!evidenceFile) {
      setAiError('Please select an evidence photograph first.');
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
      const msg = err instanceof Error ? err.message : 'Cognitive vision service unavailable.';
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

  // Execute full submission lifecycle
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!wallet.isConnected || !wallet.address) {
      setErrorMessage('Enrolled student wallet not connected. Please authenticate first.');
      return;
    }

    if (!evidenceFile) {
      setErrorMessage('An authentic photographic proof is mandatory for deposition.');
      return;
    }

    if (!quantity || isNaN(Number(quantity)) || Number(quantity) <= 0) {
      setErrorMessage('Please state a valid positive numerical quantity.');
      return;
    }

    if (duplicateWarning) {
      setErrorMessage('Duplicate evidence detected. You must submit original, unrecorded field evidence.');
      return;
    }

    const numQty = parseFloat(quantity);
    const finalUnit = category === 'Other' ? customUnit.trim() || 'units' : unit;

    setIsSubmitting(true);
    setSubmissionStep('Computing SHA-256 digest and uploading evidence to vault...');
    setUploadProgress('uploading');

    try {
      // Step 1: Upload evidence file and obtain authoritative server hash
      let confirmedHash = evidenceHash;
      try {
        const uploadResult = await api.uploadEvidence(evidenceFile);
        setServerHash(uploadResult.evidence_hash);
        setUploadProgress('done');

        // Cryptographic integrity check: client hash must equal server hash
        if (evidenceHash && uploadResult.evidence_hash !== evidenceHash) {
          throw new Error('Digest mismatch: Client computed SHA-256 does not match server digest.');
        }

        confirmedHash = uploadResult.evidence_hash;

        if (uploadResult.is_duplicate) {
          setDuplicateWarning(true);
          setDuplicateActivityId(uploadResult.existing_activity_id ?? null);
        }
      } catch (uploadErr) {
        setUploadProgress('error');
        if (uploadErr instanceof ApiError) {
          setErrorMessage(`Evidence vault failure (${uploadErr.status}): ${uploadErr.detail}`);
        } else {
          setErrorMessage('Evidence upload failed. Server must confirm cryptographic digest before submission.');
        }
        return;
      }

      // Generate unique activity folio record
      const uniqueId = `act-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;
      const contractTimestamp = new Date().toISOString();

      // Step 2: On-chain transaction with connected wallet if contract configured
      let confirmedTxHash: string | undefined = undefined;
      if (CONTRACT_ADDRESS) {
        setSubmissionStep('Requesting cryptographic signature via Beacon wallet...');
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
        setSubmissionStep('Recording deposition into off-chain archive...');
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
        ai_detected_count: aiResult ? aiResult.count : undefined,
        ai_confidence_score: aiResult ? aiResult.average_confidence : undefined,
        ai_model_name: aiResult ? aiResult.model_name : undefined,
        ai_model_version: aiResult ? aiResult.model_version : undefined,
        ai_annotated_path: aiResult ? aiResult.annotated_image_url : undefined,
        ai_detection_data: aiResult ? JSON.stringify(aiResult.detections) : undefined,
      };

      // Persist to off-chain database (Supabase / PostgreSQL)
      setSubmissionStep('Notarizing activity folio in persistent ledger...');
      try {
        const savedActivity = await api.createActivity({
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
        if (savedActivity?.activity_id) {
          newRecord.activity_id = savedActivity.activity_id;
        }
      } catch (dbErr: unknown) {
        if (dbErr instanceof ApiError) {
          throw new Error(`Database error (${dbErr.status}): ${dbErr.detail || dbErr.message}`);
        } else if (dbErr instanceof Error) {
          throw dbErr;
        } else {
          throw new Error('Failed to record activity in backend database.');
        }
      }

      addActivity(newRecord);
      setSuccessRecord(newRecord);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Deposition failed. Verify network connection.';
      setErrorMessage(msg);
    } finally {
      setIsSubmitting(false);
      setSubmissionStep('');
    }
  };

  // Render Post-Deposition Archival Certificate
  if (successRecord) {
    return (
      <div className="max-w-2xl mx-auto py-12 space-y-6">
        <div className="p-8 sm:p-10 rounded-lg bg-stone-50 dark:bg-stone-900 border border-stone-300 dark:border-stone-800 space-y-6 text-center shadow-lg font-mono-code relative overflow-hidden">
          <div className="stamp-badge border-emerald-600 text-emerald-700 dark:text-emerald-400 mx-auto">
            <CheckCircle2 className="w-3.5 h-3.5" />
            EVIDENTIARY DEPOSITION ACCEPTED
          </div>

          <div className="space-y-2">
            <h2 className="font-serif-editorial text-3xl sm:text-4xl text-stone-900 dark:text-stone-100">
              Folio Inscribed to Adjudication Docket
            </h2>
            <p className="text-xs text-stone-600 dark:text-stone-400 max-w-md mx-auto font-sans">
              Your field evidence has been fingerprinted with SHA-256 and recorded into the institutional review queue.
              Final consensus ratification will be issued by the Faculty Council.
            </p>
          </div>

          <div className="p-5 rounded bg-white dark:bg-stone-950 border border-stone-300 dark:border-stone-800 text-left space-y-2 text-xs">
            <div className="flex justify-between border-b border-stone-200 dark:border-stone-800 pb-2">
              <span className="text-stone-500 uppercase">FOLIO IDENTIFIER:</span>
              <span className="font-bold text-stone-900 dark:text-stone-100 select-all">{successRecord.activity_id}</span>
            </div>
            <div className="flex justify-between border-b border-stone-200 dark:border-stone-800 pb-2">
              <span className="text-stone-500 uppercase">ENVIRONMENTAL ACTION:</span>
              <span className="font-bold text-stone-900 dark:text-stone-100">
                {successRecord.quantity} {successRecord.unit} ({successRecord.category})
              </span>
            </div>
            {successRecord.ai_detected_count !== undefined && (
              <div className="flex justify-between items-center border-b border-stone-200 dark:border-stone-800 pb-2">
                <span className="text-stone-500 uppercase">GREENAI METROLOGY:</span>
                <span className="font-bold text-emerald-700 dark:text-emerald-400">
                  {successRecord.ai_detected_count} trees detected ({((successRecord.ai_confidence_score || 0) * 100).toFixed(1)}% conf)
                </span>
              </div>
            )}
            <div className="flex justify-between border-b border-stone-200 dark:border-stone-800 pb-2">
              <span className="text-stone-500 uppercase">SHA-256 FINGERPRINT:</span>
              <span className="truncate max-w-[260px] text-stone-700 dark:text-stone-300">{successRecord.evidence_hash}</span>
            </div>
            <div className="flex justify-between border-b border-stone-200 dark:border-stone-800 pb-2">
              <span className="text-stone-500 uppercase">CONSENSUS STATUS:</span>
              <span className="text-amber-700 dark:text-amber-400 font-bold">[ IN AUDIT // PENDING COUNCIL ]</span>
            </div>
            <div className="flex justify-between pt-1">
              <span className="text-stone-500 uppercase">DEPOSITING CADRE:</span>
              <span className="text-stone-700 dark:text-stone-300">{truncateAddress(successRecord.submitter_address)}</span>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-3 pt-3">
            <Link
              to="/student"
              className="px-5 py-2.5 rounded bg-stone-100 hover:bg-stone-200 dark:bg-stone-800 text-stone-800 dark:text-stone-200 text-xs font-bold uppercase tracking-wider border border-stone-300 dark:border-stone-700 transition-colors"
            >
              [ Return to Cadre Desk ]
            </Link>
            <Link
              to={`/activity/${successRecord.activity_id}`}
              className="px-5 py-2.5 rounded bg-stone-900 hover:bg-black text-white dark:bg-stone-100 dark:hover:bg-white dark:text-stone-950 text-xs font-bold uppercase tracking-wider transition-colors shadow-sm"
            >
              [ Inspect Evidentiary Dossier ]
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-8 pb-20">
      {/* Return navigation link */}
      <Link
        to="/student"
        className="inline-flex items-center gap-2 text-xs font-mono-code text-stone-500 hover:text-stone-900 dark:hover:text-stone-100 transition-colors uppercase tracking-wider"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        <span>[ Return to Student Cadre Desk ]</span>
      </Link>

      {/* Masthead Header */}
      <div className="border-b border-stone-300 dark:border-stone-800 pb-6 space-y-3 font-mono-code">
        <div className="flex items-center gap-3 text-xs text-stone-500">
          <span className="stamp-badge border-stone-400 text-stone-700 dark:text-stone-300">
            DEPOSITION CODEX 2026.IV
          </span>
          <span>// DISPATCH ENTRY FOLIO</span>
        </div>
        <h1 className="font-serif-editorial text-4xl sm:text-5xl font-normal text-stone-900 dark:text-stone-100 tracking-tight">
          Empirical Field Deposition{' '}
          <span className="italic font-normal">& Evidence Inscription.</span>
        </h1>
        <p className="text-base text-stone-600 dark:text-stone-400 font-sans font-light leading-relaxed">
          Direct deposition of institutional environmental impact data. Photographic proofs are cryptographically
          fingerprinted via SHA-256 before Tezos on-chain notarization. Silvicultural submissions undergo automated
          YOLOv8 cognitive metrology.
        </p>
      </div>

      {/* Main Form Dossier Card */}
      <div className="p-6 sm:p-8 rounded-lg bg-white dark:bg-stone-900 border border-stone-300 dark:border-stone-800 shadow-sm">
        <form onSubmit={handleSubmit} className="space-y-8">
          {errorMessage && (
            <div className="p-4 rounded bg-rose-50 dark:bg-rose-950/20 border border-rose-300 dark:border-rose-900 text-rose-800 dark:text-rose-300 text-xs font-mono-code flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <span>DEPOSITION ERROR: {errorMessage}</span>
            </div>
          )}

          {/* ================================================================= */}
          {/* SECTION 01: EMPIRICAL PARAMETERS */}
          {/* ================================================================= */}
          <div className="space-y-5">
            <div className="border-b border-stone-200 dark:border-stone-800 pb-2">
              <span className="font-mono-code text-[11px] text-stone-500 uppercase tracking-widest">[ SECTION 01 ]</span>
              <h3 className="font-serif-editorial text-xl font-normal text-stone-900 dark:text-stone-100">
                Empirical Environmental Parameters
              </h3>
            </div>

            <div className="grid sm:grid-cols-2 gap-5 font-mono-code">
              {/* Category */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-stone-700 dark:text-stone-300 uppercase tracking-wider block">
                  Action Classification *
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as ActivityCategory)}
                  disabled={isSubmitting}
                  className="w-full bg-stone-50 dark:bg-stone-950 border border-stone-300 dark:border-stone-700 rounded p-3 text-xs text-stone-900 dark:text-stone-100 focus:outline-none focus:border-stone-900 dark:focus:border-stone-100 transition-colors font-sans"
                >
                  <option value="Tree planting">Tree planting (Silviculture)</option>
                  <option value="Recycling">Recycling (Materials Diverted)</option>
                  <option value="Energy conservation">Energy conservation (Abatement)</option>
                  <option value="Water conservation">Water conservation (Resource Care)</option>
                  <option value="Waste collection">Waste collection (Sanitation)</option>
                  <option value="Other">Other Campus Environmental Project</option>
                </select>
              </div>

              {/* Quantity and Unit */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-stone-700 dark:text-stone-300 uppercase tracking-wider block">
                  Measured Quantity *
                </label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    step="any"
                    min="0.01"
                    placeholder="e.g. 12"
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    disabled={isSubmitting}
                    required
                    className="w-2/3 bg-stone-50 dark:bg-stone-950 border border-stone-300 dark:border-stone-700 rounded p-3 text-xs text-stone-900 dark:text-stone-100 focus:outline-none focus:border-stone-900 dark:focus:border-stone-100 transition-colors font-mono-code"
                  />

                  {category === 'Other' ? (
                    <input
                      type="text"
                      placeholder="custom unit"
                      value={customUnit}
                      onChange={(e) => setCustomUnit(e.target.value)}
                      disabled={isSubmitting}
                      className="w-1/3 bg-stone-50 dark:bg-stone-950 border border-stone-300 dark:border-stone-700 rounded p-3 text-xs text-stone-900 dark:text-stone-100 focus:outline-none focus:border-stone-900 dark:focus:border-stone-100 transition-colors font-sans"
                    />
                  ) : (
                    <select
                      value={unit}
                      onChange={(e) => setUnit(e.target.value)}
                      disabled={isSubmitting}
                      className="w-1/3 bg-stone-50 dark:bg-stone-950 border border-stone-300 dark:border-stone-700 rounded p-3 text-xs text-stone-900 dark:text-stone-100 font-bold focus:outline-none focus:border-stone-900 dark:focus:border-stone-100 transition-colors font-mono-code"
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

            {/* Date and Submitter */}
            <div className="grid sm:grid-cols-2 gap-5 font-mono-code">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-stone-700 dark:text-stone-300 uppercase tracking-wider block">
                  Observation Date
                </label>
                <input
                  type="date"
                  value={activityDate}
                  onChange={(e) => setActivityDate(e.target.value)}
                  disabled={isSubmitting}
                  className="w-full bg-stone-50 dark:bg-stone-950 border border-stone-300 dark:border-stone-700 rounded p-3 text-xs text-stone-900 dark:text-stone-100 focus:outline-none focus:border-stone-900 dark:focus:border-stone-100 transition-colors font-mono-code"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-stone-700 dark:text-stone-300 uppercase tracking-wider block">
                  Enrolled Submitter Credential
                </label>
                <input
                  type="text"
                  disabled
                  value={wallet.address || 'Connect wallet to proceed'}
                  className="w-full bg-stone-100 dark:bg-stone-950 border border-stone-300 dark:border-stone-800 rounded p-3 text-xs font-mono-code text-stone-500 cursor-not-allowed"
                />
              </div>
            </div>

            {/* Description */}
            <div className="space-y-1.5 font-mono-code">
              <label className="text-xs font-semibold text-stone-700 dark:text-stone-300 uppercase tracking-wider block">
                Field Geolocation & Contextual Notes *
              </label>
              <textarea
                rows={3}
                placeholder="Specify precise campus location (e.g. North Quad Arboretum, Block 4 Sorting Station) and empirical notes..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                disabled={isSubmitting}
                required
                className="w-full bg-stone-50 dark:bg-stone-950 border border-stone-300 dark:border-stone-700 rounded p-3 text-xs text-stone-900 dark:text-stone-100 focus:outline-none focus:border-stone-900 dark:focus:border-stone-100 transition-colors font-sans leading-relaxed"
              />
            </div>
          </div>

          {/* ================================================================= */}
          {/* SECTION 02: PHOTOGRAPHIC PROOF & DIGEST METROLOGY */}
          {/* ================================================================= */}
          <div className="space-y-4">
            <div className="border-b border-stone-200 dark:border-stone-800 pb-2">
              <span className="font-mono-code text-[11px] text-stone-500 uppercase tracking-widest">[ SECTION 02 ]</span>
              <h3 className="font-serif-editorial text-xl font-normal text-stone-900 dark:text-stone-100">
                Photographic Proof & Digest Metrology
              </h3>
            </div>

            <div className="border-2 border-dashed border-stone-300 dark:border-stone-800 hover:border-stone-500 rounded-lg p-6 text-center transition-colors bg-stone-50/50 dark:bg-stone-950/40">
              <input
                type="file"
                id="evidence-upload"
                accept="image/png, image/jpeg, image/webp"
                onChange={handleFileChange}
                disabled={isSubmitting}
                className="hidden"
              />
              <label htmlFor="evidence-upload" className="cursor-pointer flex flex-col items-center justify-center space-y-2">
                <div className="w-12 h-12 rounded bg-stone-200 dark:bg-stone-800 flex items-center justify-center text-stone-700 dark:text-stone-300">
                  {isHashing ? <Loader2 className="w-5 h-5 animate-spin" /> : <Upload className="w-5 h-5" />}
                </div>
                <div>
                  <span className="text-xs font-mono-code font-bold uppercase tracking-wider text-stone-900 dark:text-stone-100 hover:underline">
                    [ Click to Select Evidence Photograph ]
                  </span>
                  <span className="text-[11px] font-mono-code text-stone-500 block mt-1">
                    Accepts PNG, JPG, or WebP up to 10MB
                  </span>
                </div>
              </label>

              {evidenceFile && (
                <div className="mt-4 pt-4 border-t border-stone-200 dark:border-stone-800 text-left space-y-3 font-mono-code">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-stone-900 dark:text-stone-100 truncate max-w-xs">{evidenceFile.name}</span>
                    <span className="text-stone-500">{(evidenceFile.size / 1024).toFixed(1)} KB</span>
                  </div>

                  <div className="p-3 bg-white dark:bg-stone-900 rounded border border-stone-300 dark:border-stone-800 space-y-1">
                    <div className="flex items-center gap-1.5 text-[11px] text-stone-500 font-semibold uppercase">
                      <Hash className="w-3.5 h-3.5" />
                      <span>SHA-256 Digest (Client Computed):</span>
                    </div>
                    <p className="text-xs text-stone-900 dark:text-stone-100 break-all select-all font-bold">
                      {evidenceHash || 'Computing SHA-256 cryptographic hash...'}
                    </p>
                  </div>

                  {uploadProgress === 'uploading' && (
                    <div className="flex items-center gap-2 text-xs text-stone-600 dark:text-stone-400">
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Uploading to secure evidentiary vault…</span>
                    </div>
                  )}
                  {uploadProgress === 'done' && serverHash && (
                    <div className="flex items-center gap-2 text-xs text-emerald-700 dark:text-emerald-400">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Vault digest verified matching: {serverHash.slice(0, 16)}…</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {duplicateWarning && (
              <div className="p-4 rounded bg-rose-50 dark:bg-rose-950/20 border border-rose-300 dark:border-rose-900 text-rose-800 dark:text-rose-300 text-xs font-mono-code flex items-start gap-2.5">
                <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <span className="font-bold uppercase tracking-wider block">Duplicate Fingerprint Collision</span>
                  <p>
                    An identical photograph with this exact SHA-256 digest has previously been submitted in record{' '}
                    <code className="font-bold underline">{duplicateActivityId || 'existing'}</code>. You must provide
                    authentic original evidence.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* ================================================================= */}
          {/* SECTION 03: COGNITIVE GREENAI METROLOGY (IF TREE PLANTING) */}
          {/* ================================================================= */}
          {category === 'Tree planting' && evidenceFile && (
            <div className="p-6 rounded-lg bg-stone-50 dark:bg-stone-950 border border-stone-300 dark:border-stone-800 space-y-4 font-mono-code">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-stone-200 dark:border-stone-800 pb-3">
                <div className="flex items-center gap-2">
                  <Bot className="w-5 h-5 text-stone-800 dark:text-stone-200" />
                  <div>
                    <h3 className="font-serif-editorial text-lg text-stone-900 dark:text-stone-100">
                      GreenAI Cognitive Tree Metrology
                    </h3>
                    <p className="text-[11px] text-stone-500 font-sans">
                      Automated neural vision scan for sapling crown detection.
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleAnalyzeWithGreenAI}
                  disabled={isAnalyzingAI || isSubmitting}
                  className="px-4 py-2 rounded bg-stone-900 hover:bg-black text-white dark:bg-stone-100 dark:hover:bg-white dark:text-stone-950 font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 shrink-0 disabled:opacity-50"
                >
                  {isAnalyzingAI ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Scanning Photograph…</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-3.5 h-3.5 text-emerald-400 dark:text-emerald-600" />
                      <span>{aiResult ? '[ Re-Scan Vision Model ]' : '[ Run Cognitive Metrology ]'}</span>
                    </>
                  )}
                </button>
              </div>

              {aiError && (
                <div className="p-3 rounded bg-rose-50 dark:bg-rose-950/20 border border-rose-300 text-rose-800 dark:text-rose-300 text-xs flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{aiError}</span>
                </div>
              )}

              {aiResult && !isAnalyzingAI && (
                <div className="space-y-4 pt-1">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold uppercase tracking-wider text-stone-700 dark:text-stone-300 flex items-center gap-1.5">
                        <Eye className="w-3.5 h-3.5 text-stone-500" />
                        <span>Contour Inspection:</span>
                      </span>

                      <div className="flex rounded bg-stone-200 dark:bg-stone-800 p-0.5 text-[11px] font-bold">
                        <button
                          type="button"
                          onClick={() => setActiveImageView('ANNOTATED')}
                          className={`px-3 py-1 rounded transition-colors uppercase ${
                            activeImageView === 'ANNOTATED'
                              ? 'bg-stone-900 text-white dark:bg-stone-100 dark:text-stone-950'
                              : 'text-stone-600 dark:text-stone-400'
                          }`}
                        >
                          Annotated AI View ({aiResult.count})
                        </button>
                        <button
                          type="button"
                          onClick={() => setActiveImageView('ORIGINAL')}
                          className={`px-3 py-1 rounded transition-colors uppercase ${
                            activeImageView === 'ORIGINAL'
                              ? 'bg-stone-900 text-white dark:bg-stone-100 dark:text-stone-950'
                              : 'text-stone-600 dark:text-stone-400'
                          }`}
                        >
                          Raw Specimen
                        </button>
                      </div>
                    </div>

                    <div className="rounded overflow-hidden bg-stone-900 border border-stone-300 dark:border-stone-800 flex items-center justify-center p-2 max-h-72">
                      <img
                        src={
                          activeImageView === 'ANNOTATED' && aiResult.annotated_image_base64
                            ? aiResult.annotated_image_base64
                            : evidencePreviewUrl || ''
                        }
                        alt="GreenAI Tree Detection"
                        className="max-h-68 w-auto object-contain rounded"
                      />
                    </div>
                  </div>

                  {/* Summary Cards */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                    <div className="p-3 rounded bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 space-y-0.5">
                      <span className="text-[10px] text-stone-500 uppercase tracking-wider block">Estimated Count</span>
                      <div className="font-serif-editorial text-2xl text-stone-900 dark:text-stone-100 flex items-center gap-1.5">
                        <Trees className="w-4 h-4 text-emerald-600" />
                        <span>{aiResult.count} {aiResult.count === 1 ? 'Sapling' : 'Saplings'}</span>
                      </div>
                    </div>

                    <div className="p-3 rounded bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 space-y-0.5">
                      <span className="text-[10px] text-stone-500 uppercase tracking-wider block">Confidence Score</span>
                      <div className="font-serif-editorial text-2xl text-stone-900 dark:text-stone-100">
                        {(aiResult.average_confidence * 100).toFixed(1)}%
                      </div>
                    </div>

                    <div className="p-3 rounded bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 space-y-0.5 col-span-2 sm:col-span-1">
                      <span className="text-[10px] text-stone-500 uppercase tracking-wider block">Cognitive Model</span>
                      <div className="font-bold text-stone-800 dark:text-stone-200 truncate">
                        YOLOv8 Open-World
                      </div>
                      <div className="text-[10px] text-stone-400 font-mono-code truncate">
                        Latency: {aiResult.processing_time_ms}ms
                      </div>
                    </div>
                  </div>

                  {/* Count Sync Action */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded bg-stone-100 dark:bg-stone-900 border border-stone-200 dark:border-stone-800">
                    <div className="text-xs text-stone-700 dark:text-stone-300 font-sans">
                      {quantity && parseFloat(quantity) !== aiResult.count ? (
                        <span>
                          <strong>Variance:</strong> Entered count ({quantity}) differs from vision inference ({aiResult.count}).
                        </span>
                      ) : (
                        <span>
                          <strong>Aligned:</strong> Entered count matches neural vision inference.
                        </span>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={handleApplyAiCount}
                      className="px-3.5 py-1.5 rounded bg-stone-900 hover:bg-black text-white dark:bg-stone-100 dark:text-stone-950 font-bold text-xs uppercase tracking-wider transition-colors shrink-0 flex items-center gap-1.5"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>Apply AI Count ({aiResult.count})</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ================================================================= */}
          {/* SECTION 04: IMMUTABLE STATE INSCRIPTION */}
          {/* ================================================================= */}
          <div className="pt-2 font-mono-code">
            <button
              type="submit"
              disabled={isSubmitting || duplicateWarning}
              className="w-full py-4 px-6 rounded bg-stone-900 hover:bg-black text-white dark:bg-stone-100 dark:hover:bg-white dark:text-stone-950 font-bold text-xs uppercase tracking-widest shadow-sm transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-emerald-400 dark:text-emerald-600" />
                  <span>{submissionStep || 'NOTARIZING PROOF INTO PROTOCOL…'}</span>
                </>
              ) : (
                <>
                  <FileCheck className="w-4 h-4 text-emerald-400 dark:text-emerald-600" />
                  <span>
                    [ INSCRIBE DEPOSITION INTO PROTOCOL {aiResult ? '— COGNITIVELY SCANNED' : ''} ]
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
