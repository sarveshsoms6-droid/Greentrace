import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useWallet } from '../context/WalletContext';
import { truncateAddress, formatTimestamp } from '../utils/crypto';
import { api } from '../services/api';
import type { ActivityApiResponse, ActivityStatsApiResponse } from '../services/api';
import { EXPLORER_URL } from '../services/tezos';
import {
  PlusCircle,
  CheckCircle2,
  Clock,
  XCircle,
  QrCode,
  Eye,
  Zap,
  ExternalLink,
  History,
  RefreshCw,
  AlertCircle,
  User,
  Trees,
} from 'lucide-react';
import type { ActivityStatus } from '../types';

export const StudentDashboard: React.FC = () => {
  const { wallet, activities: localActivities } = useWallet();
  const [filter, setFilter] = useState<'ALL' | ActivityStatus>('ALL');
  const [studentActivities, setStudentActivities] = useState<ActivityApiResponse[]>([]);
  const [stats, setStats] = useState<ActivityStatsApiResponse>({
    total: 0,
    approved: 0,
    pending: 0,
    rejected: 0,
    impacts: [],
  });
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fetchStudentData = useCallback(async () => {
    if (!wallet.isConnected || !wallet.address) {
      setStudentActivities([]);
      setStats({ total: 0, approved: 0, pending: 0, rejected: 0, impacts: [] });
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);
    try {
      // Fetch only this student's real activities from backend
      let activitiesData: ActivityApiResponse[] = [];
      let statsData: ActivityStatsApiResponse = { total: 0, approved: 0, pending: 0, rejected: 0, impacts: [] };

      try {
        const [aData, sData] = await Promise.all([
          api.getActivities({ submitter_address: wallet.address }),
          api.getActivityStats(wallet.address),
        ]);
        activitiesData = aData;
        statsData = sData;
      } catch (apiErr) {
        console.warn('Backend student data fetch notice:', apiErr);
      }

      // Merge any local submissions from this wallet that haven't yet synced
      const dataIds = new Set(activitiesData.map((d) => d.activity_id));
      const pendingLocal: ActivityApiResponse[] = localActivities
        .filter((a) => {
          if (a.is_sample) return false;
          if (dataIds.has(a.activity_id)) return false;
          if (wallet.address && a.submitter_address.toLowerCase() !== wallet.address.toLowerCase()) return false;
          return true;
        })
        .map((local) => ({
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
        }));

      const combinedActivities = [...activitiesData, ...pendingLocal];
      setStudentActivities(combinedActivities);

      // If stats are empty but local activities exist, compute baseline stats
      if (statsData.total === 0 && combinedActivities.length > 0) {
        const approvedCount = combinedActivities.filter((a) => a.status_cache === 'APPROVED').length;
        const pendingCount = combinedActivities.filter((a) => a.status_cache === 'SUBMITTED').length;
        const rejectedCount = combinedActivities.filter((a) => a.status_cache === 'REJECTED').length;
        setStats({
          total: combinedActivities.length,
          approved: approvedCount,
          pending: pendingCount,
          rejected: rejectedCount,
          impacts: statsData.impacts,
        });
      } else {
        setStats(statsData);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load student activity records.';
      setErrorMessage(msg);
    } finally {
      setIsLoading(false);
    }
  }, [wallet.isConnected, wallet.address, localActivities]);

  useEffect(() => {
    fetchStudentData();
  }, [fetchStudentData]);

  // Client filter on student's own records
  const filteredActivities = studentActivities.filter((a) => {
    if (filter === 'ALL') return true;
    return a.status_cache === filter;
  });

  // Calculate specific impact totals from backend response
  const totalTrees = stats.impacts
    .filter((i) => i.category === 'Tree planting')
    .reduce((sum, i) => sum + i.total_qty, 0);

  const totalWasteSorted = stats.impacts
    .filter((i) => i.category === 'Recycling' || i.category === 'Waste collection')
    .reduce((sum, i) => sum + i.total_qty, 0);

  const totalEnergySaved = stats.impacts
    .filter((i) => i.category === 'Energy conservation')
    .reduce((sum, i) => sum + i.total_qty, 0);

  const totalWaterSaved = stats.impacts
    .filter((i) => i.category === 'Water conservation')
    .reduce((sum, i) => sum + i.total_qty, 0);

  return (
    <div className="space-y-10 pb-20">
      {/* Editorial Masthead Dispatch */}
      <div className="border-b border-stone-300 dark:border-stone-800 pb-8 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs font-mono-code text-stone-500 dark:text-stone-400">
          <div className="flex items-center gap-3">
            <span className="stamp-badge border-stone-400 dark:border-stone-700 text-stone-800 dark:text-stone-300">
              CADRE FOLIO 2026.IV
            </span>
            <span className="hidden sm:inline">// STUDENT RESEARCH CADRE DESK</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span>CHRONICLE STATUS: SYNCHRONIZED</span>
          </div>
        </div>

        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 pt-2">
          <div className="space-y-2 max-w-3xl">
            <h1 className="font-serif-editorial text-4xl sm:text-5xl font-normal tracking-tight text-stone-900 dark:text-stone-100">
              {wallet.userName ? `${wallet.userName}'s` : 'Student'}{' '}
              <span className="italic font-normal">Ecological Ledger.</span>
            </h1>
            <p className="text-base sm:text-lg text-stone-600 dark:text-stone-400 leading-relaxed font-sans font-light">
              Personal empirical repository and verification history. All filed evidence is fingerprinted with
              SHA-256 digests and subject to faculty council ratification before immutable on-chain inscription.
            </p>
          </div>

          {/* Action Hub */}
          <div className="flex items-center gap-2.5 flex-wrap">
            <button
              onClick={fetchStudentData}
              disabled={isLoading || !wallet.isConnected}
              className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-lg bg-stone-100 hover:bg-stone-200 dark:bg-stone-900 dark:hover:bg-stone-800 text-stone-700 dark:text-stone-200 text-xs font-mono-code font-semibold border border-stone-300 dark:border-stone-800 transition-colors disabled:opacity-50"
              title="Refresh student submissions"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-emerald-600' : ''}`} />
              <span>[ ↻ REFRESH ]</span>
            </button>

            <Link
              to="/history?mine=true"
              className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-lg bg-stone-100 hover:bg-stone-200 dark:bg-stone-900 dark:hover:bg-stone-800 text-stone-700 dark:text-stone-200 text-xs font-mono-code font-semibold border border-stone-300 dark:border-stone-800 transition-colors"
            >
              <History className="w-3.5 h-3.5 text-stone-600 dark:text-stone-400" />
              <span>[ 01 // AUDIT REGISTER ]</span>
            </Link>

            <Link
              to="/submit"
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-stone-900 hover:bg-black dark:bg-stone-100 dark:hover:bg-white text-white dark:text-stone-950 font-mono-code font-bold text-xs uppercase tracking-wider transition-all shadow-sm"
            >
              <PlusCircle className="w-4 h-4 text-emerald-400 dark:text-emerald-600" />
              <span>[ DEPOSIT NEW EVIDENCE ]</span>
            </Link>
          </div>
        </div>

        {/* Cadre Identity Dossier Strip */}
        <div className="pt-4 flex flex-wrap items-center justify-between gap-4 text-xs font-mono-code bg-stone-100/70 dark:bg-stone-900/50 p-3.5 rounded-lg border border-stone-300 dark:border-stone-800">
          <div className="flex items-center gap-2">
            <span className="text-stone-500 uppercase tracking-wider">REGISTERED IDENTITY:</span>
            {wallet.isConnected && wallet.address ? (
              <span className="font-bold text-stone-900 dark:text-stone-100">
                {wallet.userName || 'Enrolled Student'} ({truncateAddress(wallet.address, 10, 8)})
              </span>
            ) : (
              <span className="text-amber-700 dark:text-amber-400 font-bold">
                Cadre Disconnected — Sign in to view your ledger
              </span>
            )}
          </div>
          <div className="flex items-center gap-4 text-stone-500">
            <span>PROTOCOL: TEZOS MAINNET SHADOW</span>
            <span className="hidden md:inline">//</span>
            <span className="hidden md:inline">COGNITION: YOLOV8 INTEGRATED</span>
          </div>
        </div>
      </div>

      {/* Organizer Context Banner if active role is Organizer */}
      {wallet.role === 'ORGANIZER' && (
        <div className="p-4 rounded-lg bg-stone-100 dark:bg-stone-900/90 border-l-4 border-l-stone-800 dark:border-l-stone-200 border border-stone-300 dark:border-stone-800 flex items-center justify-between gap-4 font-mono-code text-xs">
          <div className="text-stone-800 dark:text-stone-200">
            <strong className="uppercase">[ COUNCIL CONTEXT ]:</strong> You are currently viewing the individual Student
            deposit register.
          </div>
          <Link
            to="/organizer"
            className="font-bold px-3 py-1.5 rounded bg-stone-900 hover:bg-black text-white dark:bg-stone-100 dark:hover:bg-white dark:text-stone-950 transition-colors uppercase tracking-wider text-[11px]"
          >
            Council Ratification Chamber →
          </Link>
        </div>
      )}

      {/* Account Login Prompt if Disconnected */}
      {!wallet.isConnected && (
        <div className="p-8 rounded-lg bg-stone-50 dark:bg-stone-900 border border-stone-300 dark:border-stone-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 shadow-sm">
          <div className="space-y-1">
            <span className="stamp-badge border-amber-600 text-amber-700 dark:text-amber-400">
              AUTHENTICATION REQUIRED
            </span>
            <h3 className="font-serif-editorial text-2xl text-stone-900 dark:text-stone-100 pt-1">
              Field Submissions Restricted
            </h3>
            <p className="text-sm text-stone-600 dark:text-stone-400">
              Sign in with your enrolled student cadre credentials or connect an institutional wallet to access your
              certified impact ledger.
            </p>
          </div>
          <Link
            to="/login"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-stone-900 hover:bg-black dark:bg-stone-100 dark:hover:bg-white text-white dark:text-stone-950 font-mono-code font-bold text-xs uppercase tracking-wider shrink-0 transition-all shadow-sm"
          >
            <User className="w-4 h-4 text-emerald-400 dark:text-emerald-600" />
            <span>[ AUTHENTICATE CADRE ACCOUNT ]</span>
          </Link>
        </div>
      )}

      {/* Error Message */}
      {errorMessage && (
        <div className="p-4 rounded-lg bg-rose-50 dark:bg-rose-950/20 border border-rose-300 dark:border-rose-900 text-rose-800 dark:text-rose-300 text-xs font-mono-code flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>ERR // {errorMessage}</span>
          </div>
          <button onClick={fetchStudentData} className="underline hover:text-rose-950 dark:hover:text-rose-100 uppercase">
            Retry Sync
          </button>
        </div>
      )}

      {/* KPI Stats Grid: Archival Ledger Blocks */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Block 01 */}
        <div className="p-6 rounded-lg bg-stone-50 dark:bg-stone-900/60 border border-stone-300 dark:border-stone-800 space-y-2 relative overflow-hidden group">
          <div className="flex items-center justify-between text-xs font-mono-code text-stone-500 uppercase tracking-widest">
            <span>[ METRIC 01 ]</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div className="pt-2">
            <div className="font-serif-editorial text-4xl sm:text-5xl font-normal text-stone-900 dark:text-stone-100">
              {stats.approved}
            </div>
            <div className="text-xs font-mono-code uppercase tracking-wider text-stone-600 dark:text-stone-400 pt-1">
              Ratified Actions
            </div>
          </div>
          <p className="text-[11px] font-mono-code text-emerald-700 dark:text-emerald-400 pt-2 border-t border-stone-200 dark:border-stone-800">
            Immutable on-chain consensus
          </p>
        </div>

        {/* Block 02 */}
        <div className="p-6 rounded-lg bg-stone-50 dark:bg-stone-900/60 border border-stone-300 dark:border-stone-800 space-y-2 relative overflow-hidden group">
          <div className="flex items-center justify-between text-xs font-mono-code text-stone-500 uppercase tracking-widest">
            <span>[ METRIC 02 ]</span>
            <Clock className="w-4 h-4 text-amber-600 dark:text-amber-400" />
          </div>
          <div className="pt-2">
            <div className="font-serif-editorial text-4xl sm:text-5xl font-normal text-stone-900 dark:text-stone-100">
              {stats.pending}
            </div>
            <div className="text-xs font-mono-code uppercase tracking-wider text-stone-600 dark:text-stone-400 pt-1">
              Under Adjudication
            </div>
          </div>
          <p className="text-[11px] font-mono-code text-stone-500 pt-2 border-t border-stone-200 dark:border-stone-800">
            {stats.rejected} rejected / returned
          </p>
        </div>

        {/* Block 03 */}
        <div className="p-6 rounded-lg bg-stone-50 dark:bg-stone-900/60 border border-stone-300 dark:border-stone-800 space-y-2 relative overflow-hidden group">
          <div className="flex items-center justify-between text-xs font-mono-code text-stone-500 uppercase tracking-widest">
            <span>[ METRIC 03 ]</span>
            <Trees className="w-4 h-4 text-teal-600 dark:text-teal-400" />
          </div>
          <div className="pt-2">
            <div className="font-serif-editorial text-4xl sm:text-5xl font-normal text-stone-900 dark:text-stone-100">
              {totalTrees}
            </div>
            <div className="text-xs font-mono-code uppercase tracking-wider text-stone-600 dark:text-stone-400 pt-1">
              Saplings Inscribed
            </div>
          </div>
          <p className="text-[11px] font-mono-code text-stone-500 pt-2 border-t border-stone-200 dark:border-stone-800">
            {totalWasteSorted} kg waste diverted
          </p>
        </div>

        {/* Block 04 */}
        <div className="p-6 rounded-lg bg-stone-50 dark:bg-stone-900/60 border border-stone-300 dark:border-stone-800 space-y-2 relative overflow-hidden group">
          <div className="flex items-center justify-between text-xs font-mono-code text-stone-500 uppercase tracking-widest">
            <span>[ METRIC 04 ]</span>
            <Zap className="w-4 h-4 text-stone-700 dark:text-stone-300" />
          </div>
          <div className="pt-2">
            <div className="font-serif-editorial text-4xl sm:text-5xl font-normal text-stone-900 dark:text-stone-100">
              {totalEnergySaved} <span className="text-lg font-mono-code font-normal">kWh</span>
            </div>
            <div className="text-xs font-mono-code uppercase tracking-wider text-stone-600 dark:text-stone-400 pt-1">
              Energy Abated
            </div>
          </div>
          <p className="text-[11px] font-mono-code text-stone-500 pt-2 border-t border-stone-200 dark:border-stone-800">
            {totalWaterSaved} litres conserved
          </p>
        </div>
      </div>

      {/* Table Section: Historical Audit Register */}
      <div className="space-y-6 pt-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-stone-300 dark:border-stone-800 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono-code text-xs text-stone-500 uppercase tracking-widest">[ SECTION II ]</span>
              <h2 className="font-serif-editorial text-2xl font-normal text-stone-900 dark:text-stone-100">
                Personal Field Deposits Register
              </h2>
            </div>
            <p className="text-xs font-mono-code text-stone-500 mt-1">
              RECORD COUNT: {filteredActivities.length} OF {studentActivities.length} SPECIMENS
            </p>
          </div>

          {/* Filter Pills in Editorial Style */}
          <div className="flex items-center gap-1 p-1 bg-stone-100 dark:bg-stone-900 border border-stone-300 dark:border-stone-800 rounded-lg text-xs font-mono-code">
            <button
              onClick={() => setFilter('ALL')}
              className={`px-3 py-1.5 rounded transition-colors uppercase tracking-wider ${
                filter === 'ALL'
                  ? 'bg-stone-900 text-white dark:bg-stone-100 dark:text-stone-950 font-bold shadow-sm'
                  : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-100'
              }`}
            >
              All ({studentActivities.length})
            </button>
            <button
              onClick={() => setFilter('APPROVED')}
              className={`px-3 py-1.5 rounded transition-colors uppercase tracking-wider ${
                filter === 'APPROVED'
                  ? 'bg-emerald-600 text-white font-bold shadow-sm'
                  : 'text-stone-600 dark:text-stone-400 hover:text-emerald-600'
              }`}
            >
              Ratified ({stats.approved})
            </button>
            <button
              onClick={() => setFilter('SUBMITTED')}
              className={`px-3 py-1.5 rounded transition-colors uppercase tracking-wider ${
                filter === 'SUBMITTED'
                  ? 'bg-amber-600 text-white font-bold shadow-sm'
                  : 'text-stone-600 dark:text-stone-400 hover:text-amber-600'
              }`}
            >
              Auditing ({stats.pending})
            </button>
            <button
              onClick={() => setFilter('REJECTED')}
              className={`px-3 py-1.5 rounded transition-colors uppercase tracking-wider ${
                filter === 'REJECTED'
                  ? 'bg-rose-700 text-white font-bold shadow-sm'
                  : 'text-stone-600 dark:text-stone-400 hover:text-rose-600'
              }`}
            >
              Declined ({stats.rejected})
            </button>
          </div>
        </div>

        {/* Activities Table */}
        <div className="rounded-lg border border-stone-300 dark:border-stone-800 bg-white dark:bg-stone-900/60 overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-stone-700 dark:text-stone-300">
              <thead className="bg-stone-100 dark:bg-stone-950/80 text-[11px] font-mono-code uppercase tracking-wider text-stone-600 dark:text-stone-400 border-b border-stone-300 dark:border-stone-800">
                <tr>
                  <th className="py-4 px-4 font-semibold">Folio Index</th>
                  <th className="py-4 px-4 font-semibold">Environmental Action</th>
                  <th className="py-4 px-4 font-semibold">Consensus Verdict</th>
                  <th className="py-4 px-4 font-semibold">Date Inscribed</th>
                  <th className="py-4 px-4 font-semibold">Cryptographic Tx</th>
                  <th className="py-4 px-4 font-semibold text-right">Dossier Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-200 dark:divide-stone-800">
                {isLoading ? (
                  <tr>
                    <td colSpan={6} className="py-16 text-center text-stone-500 font-mono-code">
                      <div className="flex items-center justify-center gap-2">
                        <RefreshCw className="w-4 h-4 animate-spin text-stone-800 dark:text-stone-200" />
                        <span>Querying institutional ledger and cryptographic state...</span>
                      </div>
                    </td>
                  </tr>
                ) : filteredActivities.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-16 text-center text-stone-500 space-y-3">
                      <p className="font-serif-editorial text-xl text-stone-800 dark:text-stone-200">
                        No field records matching filter criteria.
                      </p>
                      <p className="text-xs font-mono-code text-stone-500">
                        {filter !== 'ALL'
                          ? `No submissions currently in [ ${filter} ] status.`
                          : 'Your personal cadre register contains zero environmental depositions.'}
                      </p>
                      <Link
                        to="/submit"
                        className="inline-flex items-center gap-2 px-4 py-2 mt-2 rounded bg-stone-900 hover:bg-black text-white dark:bg-stone-100 dark:hover:bg-white dark:text-stone-950 font-mono-code text-xs uppercase tracking-wider"
                      >
                        <PlusCircle className="w-3.5 h-3.5 text-emerald-400" />
                        <span>[ Deposit First Empirical Record ]</span>
                      </Link>
                    </td>
                  </tr>
                ) : (
                  filteredActivities.map((act) => (
                    <tr
                      key={act.activity_id}
                      className="hover:bg-stone-50/70 dark:hover:bg-stone-800/40 transition-colors"
                    >
                      <td className="py-4 px-4 font-mono-code font-bold text-stone-900 dark:text-stone-100 text-xs">
                        <Link
                          to={`/activity/${act.activity_id}`}
                          className="hover:text-emerald-700 dark:hover:text-emerald-400 transition-colors underline decoration-stone-300 dark:decoration-stone-700 underline-offset-4"
                        >
                          {act.activity_id}
                        </Link>
                      </td>
                      <td className="py-4 px-4">
                        <div className="font-serif-editorial text-base text-stone-900 dark:text-stone-100">
                          {act.category}
                        </div>
                        <div className="text-xs text-stone-600 dark:text-stone-400 font-mono-code">
                          {act.quantity} {act.unit}
                        </div>
                      </td>
                      <td className="py-4 px-4">
                        {act.status_cache === 'APPROVED' ? (
                          <span className="stamp-badge border-emerald-600 text-emerald-700 dark:text-emerald-400 bg-emerald-500/5">
                            <CheckCircle2 className="w-3 h-3" />
                            RATIFIED
                          </span>
                        ) : act.status_cache === 'SUBMITTED' ? (
                          <span className="stamp-badge border-amber-600 text-amber-700 dark:text-amber-400 bg-amber-500/5">
                            <Clock className="w-3 h-3" />
                            IN AUDIT
                          </span>
                        ) : (
                          <span className="stamp-badge border-rose-600 text-rose-700 dark:text-rose-400 bg-rose-500/5">
                            <XCircle className="w-3 h-3" />
                            DECLINED
                          </span>
                        )}
                      </td>
                      <td className="py-4 px-4 text-xs font-mono-code text-stone-600 dark:text-stone-400">
                        {formatTimestamp(act.submitted_at)}
                      </td>
                      <td className="py-4 px-4 font-mono-code text-xs">
                        {act.submission_tx_hash ? (
                          <a
                            href={`${EXPLORER_URL}/${act.submission_tx_hash}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-stone-700 dark:text-stone-300 hover:text-emerald-600 underline decoration-stone-300 inline-flex items-center gap-1"
                            title={act.submission_tx_hash}
                          >
                            <span>{truncateAddress(act.submission_tx_hash, 8, 4)}</span>
                            <ExternalLink className="w-3 h-3 text-stone-400" />
                          </a>
                        ) : (
                          <span className="text-stone-400 dark:text-stone-600 italic">Off-Chain Cache</span>
                        )}
                      </td>
                      <td className="py-4 px-4 text-right">
                        <div className="flex items-center justify-end gap-2 font-mono-code">
                          <Link
                            to={`/activity/${act.activity_id}`}
                            className="p-1.5 rounded border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-stone-700 dark:text-stone-300 hover:bg-stone-900 hover:text-white dark:hover:bg-stone-100 dark:hover:text-stone-950 transition-colors"
                            title="Inspect complete evidentiary dossier"
                          >
                            <Eye className="w-4 h-4" />
                          </Link>
                          <Link
                            to={`/verify?id=${act.activity_id}`}
                            className="p-1.5 rounded border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-stone-700 dark:text-stone-300 hover:bg-stone-900 hover:text-white dark:hover:bg-stone-100 dark:hover:text-stone-950 transition-colors"
                            title="Open public verification certificate"
                          >
                            <QrCode className="w-4 h-4" />
                          </Link>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
