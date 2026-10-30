import React, { useState, useEffect, useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useWallet } from '../hooks/useWallet';
import { truncateAddress, formatTimestamp } from '../utils/crypto';
import { api } from '../services/api';
import type { ActivityApiResponse } from '../services/api';
import { EXPLORER_URL } from '../services/tezos';
import {
  Filter,
  CheckCircle2,
  Clock,
  XCircle,
  ExternalLink,
  Eye,
  QrCode,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  User,
  AlertCircle,
} from 'lucide-react';
import type { ActivityCategory } from '../types';

const CATEGORIES: ('ALL' | ActivityCategory)[] = [
  'ALL',
  'Recycling',
  'Tree planting',
  'Energy conservation',
  'Water conservation',
  'Waste collection',
  'Other',
];

const PAGE_SIZE = 10;

export const ActivityHistoryPage: React.FC = () => {
  const { wallet, activities: localActivities } = useWallet();
  const [searchParams, setSearchParams] = useSearchParams();

  // Filters from query params or local state
  const statusParam = searchParams.get('status') || 'ALL';
  const categoryParam = searchParams.get('category') || 'ALL';
  const mineParam = searchParams.get('mine') === 'true';

  const [statusFilter, setStatusFilter] = useState<string>(statusParam);
  const [categoryFilter, setCategoryFilter] = useState<string>(categoryParam);
  const [onlyMine, setOnlyMine] = useState<boolean>(mineParam);

  const [activities, setActivities] = useState<ActivityApiResponse[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [page, setPage] = useState<number>(0);
  const [hasMore, setHasMore] = useState<boolean>(false);

  const fetchActivities = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const params: {
        status?: string;
        category?: string;
        submitter_address?: string;
        limit: number;
        offset: number;
      } = {
        limit: PAGE_SIZE + 1, // Fetch 1 extra to detect if next page exists
        offset: page * PAGE_SIZE,
      };

      if (statusFilter !== 'ALL') {
        params.status = statusFilter;
      }
      if (categoryFilter !== 'ALL') {
        params.category = categoryFilter;
      }
      if (onlyMine && wallet.address) {
        params.submitter_address = wallet.address;
      }

      let data: ActivityApiResponse[] = [];
      try {
        data = await api.getActivities(params);
      } catch (apiErr) {
        console.warn('Backend fetch notice:', apiErr);
      }

      // Merge any local submissions that match the active filters
      const dataIds = new Set(data.map((d) => d.activity_id));
      const pendingLocal: ActivityApiResponse[] = localActivities
        .filter((a) => {
          if (a.is_sample) return false;
          if (dataIds.has(a.activity_id)) return false;
          if (statusFilter !== 'ALL' && a.status !== statusFilter) return false;
          if (categoryFilter !== 'ALL' && a.category !== categoryFilter) return false;
          if (onlyMine && wallet.address && a.submitter_address.toLowerCase() !== wallet.address.toLowerCase()) return false;
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

      const combined = [...data, ...pendingLocal];

      if (combined.length > PAGE_SIZE) {
        setHasMore(true);
        setActivities(combined.slice(0, PAGE_SIZE));
      } else {
        setHasMore(false);
        setActivities(combined);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load activity history.';
      setErrorMessage(msg);
    } finally {
      setIsLoading(false);
    }
  }, [statusFilter, categoryFilter, onlyMine, wallet.address, page, localActivities]);

  useEffect(() => {
    fetchActivities();
  }, [fetchActivities]);

  // Sync state changes with URL query parameters
  const updateFilters = (newStatus: string, newCategory: string, newOnlyMine: boolean) => {
    setStatusFilter(newStatus);
    setCategoryFilter(newCategory);
    setOnlyMine(newOnlyMine);
    setPage(0);

    const nextParams = new URLSearchParams();
    if (newStatus !== 'ALL') nextParams.set('status', newStatus);
    if (newCategory !== 'ALL') nextParams.set('category', newCategory);
    if (newOnlyMine) nextParams.set('mine', 'true');
    setSearchParams(nextParams);
  };

  return (
    <div className="space-y-8 pb-16 animate-fadeIn font-mono">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-stone-300 dark:border-stone-800 pb-6">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono font-bold uppercase tracking-widest text-emerald-800 dark:text-emerald-400">
              [ CHRONICLE REGISTER // SECTION III ]
            </span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-display-serif font-bold text-stone-950 dark:text-stone-100 tracking-tight mt-1">
            Historical Audit Register
          </h1>
          <p className="text-xs font-sans text-stone-600 dark:text-stone-400 mt-1">
            Complete institutional archive of verified environmental proofs, smart contract transitions, and cryptographic transaction receipts.
          </p>
        </div>

        <button
          onClick={fetchActivities}
          disabled={isLoading}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-xs border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900 text-stone-800 dark:text-stone-200 text-xs font-mono uppercase tracking-wider font-bold transition-colors w-fit hover:border-stone-600"
          title="Refresh activity history"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-emerald-600' : ''}`} />
          <span>REFRESH ARCHIVE</span>
        </button>
      </div>

      {/* Filter Toolbar (Editorial Card) */}
      <div className="p-4 rounded-xs bg-white dark:bg-[#141312] border border-stone-300 dark:border-stone-800 space-y-4 shadow-xs">
        <div className="flex items-center gap-2 text-xs font-bold text-stone-800 dark:text-stone-200 uppercase tracking-widest">
          <Filter className="w-3.5 h-3.5 text-stone-500" />
          <span>ARCHIVAL FILTERS & PARAMETERS</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-4 gap-4 text-xs font-mono">
          {/* Status Filter */}
          <div>
            <label className="block text-stone-500 mb-1.5 uppercase tracking-wider text-[10px] font-bold">Status State</label>
            <select
              value={statusFilter}
              onChange={(e) => updateFilters(e.target.value, categoryFilter, onlyMine)}
              className="w-full bg-stone-50 dark:bg-stone-950 border border-stone-300 dark:border-stone-800 rounded-xs px-3 py-2 text-stone-900 dark:text-stone-100 focus:outline-none focus:border-stone-900 dark:focus:border-stone-100"
            >
              <option value="ALL">ALL STATUSES</option>
              <option value="SUBMITTED">PENDING REVIEW (SUBMITTED)</option>
              <option value="APPROVED">RATIFIED (APPROVED)</option>
              <option value="REJECTED">DECLINED (REJECTED)</option>
            </select>
          </div>

          {/* Category Filter */}
          <div>
            <label className="block text-stone-500 mb-1.5 uppercase tracking-wider text-[10px] font-bold">Discipline</label>
            <select
              value={categoryFilter}
              onChange={(e) => updateFilters(statusFilter, e.target.value, onlyMine)}
              className="w-full bg-stone-50 dark:bg-stone-950 border border-stone-300 dark:border-stone-800 rounded-xs px-3 py-2 text-stone-900 dark:text-stone-100 focus:outline-none focus:border-stone-900 dark:focus:border-stone-100"
            >
              {CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {cat === 'ALL' ? 'ALL DISCIPLINES' : cat.toUpperCase()}
                </option>
              ))}
            </select>
          </div>

          {/* Submitter Scope Toggle */}
          <div>
            <label className="block text-stone-500 mb-1.5 uppercase tracking-wider text-[10px] font-bold">Dossier Scope</label>
            <button
              onClick={() => {
                if (!wallet.isConnected) return;
                updateFilters(statusFilter, categoryFilter, !onlyMine);
              }}
              disabled={!wallet.isConnected}
              className={`w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xs border text-xs tracking-wider uppercase font-bold transition-colors ${
                onlyMine
                  ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-200 border-emerald-400 dark:border-emerald-700'
                  : 'bg-stone-50 dark:bg-stone-950 text-stone-700 dark:text-stone-300 border-stone-300 dark:border-stone-800 hover:border-stone-600'
              } disabled:opacity-40 disabled:cursor-not-allowed`}
              title={wallet.isConnected ? 'Filter to submissions from your connected wallet' : 'Connect wallet to view your submissions only'}
            >
              <User className="w-3.5 h-3.5" />
              <span>{onlyMine ? 'MY PROOFS ONLY' : 'ENTIRE ARCHIVE'}</span>
            </button>
          </div>

          {/* Reset Filters */}
          <div className="flex items-end">
            <button
              onClick={() => updateFilters('ALL', 'ALL', false)}
              className="w-full px-3 py-2 rounded-xs border border-stone-300 dark:border-stone-800 hover:bg-stone-100 dark:hover:bg-stone-900 text-stone-700 dark:text-stone-300 text-xs uppercase tracking-wider font-bold transition-colors"
            >
              RESET FILTERS
            </button>
          </div>
        </div>
      </div>

      {/* Error Banner */}
      {errorMessage && (
        <div className="p-4 rounded-xs bg-rose-50 dark:bg-rose-950/40 border border-rose-300 dark:border-rose-900 text-rose-900 dark:text-rose-200 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{errorMessage}</span>
          </div>
          <button onClick={fetchActivities} className="underline text-rose-800 dark:text-rose-200 font-bold uppercase">
            Retry
          </button>
        </div>
      )}

      {/* Activities Table (Archival Register) */}
      <div className="rounded-xs border border-stone-300 dark:border-stone-800 bg-white dark:bg-[#141312] overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-stone-800 dark:text-stone-200">
            <thead className="bg-stone-100/90 dark:bg-stone-900/90 text-[10px] uppercase tracking-widest text-stone-600 dark:text-stone-400 border-b border-stone-300 dark:border-stone-800">
              <tr>
                <th className="py-3 px-4 font-bold">Activity ID</th>
                <th className="py-3 px-4 font-bold">Discipline & Metric</th>
                <th className="py-3 px-4 font-bold">Cadre Submitter</th>
                <th className="py-3 px-4 font-bold">Ratification State</th>
                <th className="py-3 px-4 font-bold">Chronicle Timestamp</th>
                <th className="py-3 px-4 font-bold">Tezos On-Chain TX</th>
                <th className="py-3 px-4 text-right font-bold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-200 dark:divide-stone-800/80 font-mono text-[11px]">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-stone-500">
                    <div className="flex items-center justify-center gap-2">
                      <RefreshCw className="w-4 h-4 animate-spin text-stone-600" />
                      <span>ACCESSING ARCHIVAL INDEX...</span>
                    </div>
                  </td>
                </tr>
              ) : activities.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-stone-500 space-y-2">
                    <p className="font-bold text-stone-700 dark:text-stone-300 uppercase">[ NO RECORDS MATCH ACTIVE FILTERS ]</p>
                    <p className="text-xs font-sans text-stone-500">
                      Adjust status or discipline filters, or submit a new empirical record to the registry.
                    </p>
                  </td>
                </tr>
              ) : (
                activities.map((act) => (
                  <tr key={act.activity_id} className="hover:bg-stone-100/50 dark:hover:bg-stone-900/50 transition-colors">
                    <td className="py-3.5 px-4 font-bold text-stone-950 dark:text-stone-100">
                      <Link
                        to={`/activity/${act.activity_id}`}
                        className="hover:text-emerald-700 dark:hover:text-emerald-400 transition-colors underline decoration-dotted"
                      >
                        {act.activity_id}
                      </Link>
                    </td>

                    <td className="py-3.5 px-4">
                      <div className="font-bold font-sans text-xs text-stone-900 dark:text-stone-100">{act.category}</div>
                      <div className="text-[11px] text-emerald-800 dark:text-emerald-400 font-mono">
                        {act.quantity} {act.unit}
                      </div>
                    </td>

                    <td className="py-3.5 px-4 text-stone-600 dark:text-stone-400 text-xs">
                      <span title={act.submitter_address}>
                        {truncateAddress(act.submitter_address, 6, 4)}
                      </span>
                      {wallet.address && act.submitter_address.toLowerCase() === wallet.address.toLowerCase() && (
                        <span className="ml-1.5 px-1 py-0.2 rounded-xs bg-emerald-500/10 text-emerald-800 dark:text-emerald-300 text-[9px] font-bold uppercase">
                          YOU
                        </span>
                      )}
                    </td>

                    <td className="py-3.5 px-4">
                      {act.status_cache === 'APPROVED' ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-xs text-[10px] font-bold uppercase tracking-wider bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                          <CheckCircle2 className="w-3 h-3" />
                          RATIFIED
                        </span>
                      ) : act.status_cache === 'SUBMITTED' ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-xs text-[10px] font-bold uppercase tracking-wider bg-amber-100 dark:bg-amber-950/60 text-amber-900 dark:text-amber-300 border border-amber-300 dark:border-amber-800">
                          <Clock className="w-3 h-3" />
                          PENDING
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-xs text-[10px] font-bold uppercase tracking-wider bg-rose-100 dark:bg-rose-950/60 text-rose-900 dark:text-rose-300 border border-rose-300 dark:border-rose-800">
                          <XCircle className="w-3 h-3" />
                          DECLINED
                        </span>
                      )}
                    </td>

                    <td className="py-3.5 px-4 text-stone-500 text-[11px]">
                      <div>{formatTimestamp(act.submitted_at)}</div>
                      {act.approver_address && (
                        <div className="text-[10px] text-stone-400" title={act.approver_address}>
                          Auditor: {truncateAddress(act.approver_address, 5, 3)}
                        </div>
                      )}
                    </td>

                    <td className="py-3.5 px-4 text-stone-500">
                      {act.approval_tx_hash ? (
                        <div>
                          <div className="text-[9px] uppercase tracking-wider text-stone-400">Decision TX</div>
                          <a
                            href={`${EXPLORER_URL}/${act.approval_tx_hash}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-emerald-800 dark:text-emerald-400 hover:underline inline-flex items-center gap-1 font-bold"
                          >
                            <span>{truncateAddress(act.approval_tx_hash, 6, 4)}</span>
                            <ExternalLink className="w-2.5 h-2.5" />
                          </a>
                        </div>
                      ) : act.submission_tx_hash ? (
                        <div>
                          <div className="text-[9px] uppercase tracking-wider text-stone-400">Submission TX</div>
                          <a
                            href={`${EXPLORER_URL}/${act.submission_tx_hash}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-stone-800 dark:text-stone-300 hover:underline inline-flex items-center gap-1 font-bold"
                          >
                            <span>{truncateAddress(act.submission_tx_hash, 6, 4)}</span>
                            <ExternalLink className="w-2.5 h-2.5" />
                          </a>
                        </div>
                      ) : (
                        <span className="text-stone-400 text-[10px] uppercase">PENDING BLOCK</span>
                      )}
                    </td>

                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Link
                          to={`/activity/${act.activity_id}`}
                          className="p-1.5 rounded-xs border border-stone-300 dark:border-stone-800 hover:border-stone-600 text-stone-700 dark:text-stone-300 transition-colors"
                          title="Inspect activity dossier"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </Link>
                        <Link
                          to={`/verify?id=${act.activity_id}`}
                          className="p-1.5 rounded-xs border border-emerald-300 dark:border-emerald-800/80 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 transition-colors"
                          title="Public QR certificate"
                        >
                          <QrCode className="w-3.5 h-3.5" />
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        <div className="p-3 bg-stone-100/90 dark:bg-stone-900/90 border-t border-stone-300 dark:border-stone-800 flex items-center justify-between text-xs text-stone-600 dark:text-stone-400">
          <span>
            REGISTER FOLIO: <strong className="text-stone-900 dark:text-stone-100">{page + 1}</strong>
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((prev) => Math.max(0, prev - 1))}
              disabled={page === 0 || isLoading}
              className="flex items-center gap-1 px-3 py-1 rounded-xs border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-950 text-stone-800 dark:text-stone-200 disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-xs uppercase"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              <span>PREVIOUS</span>
            </button>
            <button
              onClick={() => setPage((prev) => prev + 1)}
              disabled={!hasMore || isLoading}
              className="flex items-center gap-1 px-3 py-1 rounded-xs border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-950 text-stone-800 dark:text-stone-200 disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-xs uppercase"
            >
              <span>NEXT</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
