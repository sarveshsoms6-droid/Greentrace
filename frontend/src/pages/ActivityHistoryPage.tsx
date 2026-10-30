import React, { useState, useEffect, useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useWallet } from '../context/WalletContext';
import { truncateAddress, formatTimestamp } from '../utils/crypto';
import { api } from '../services/api';
import type { ActivityApiResponse } from '../services/api';
import { EXPLORER_URL } from '../services/tezos';
import {
  History,
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
  Leaf,
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
  const { wallet } = useWallet();
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

      const data = await api.getActivities(params);

      if (data.length > PAGE_SIZE) {
        setHasMore(true);
        setActivities(data.slice(0, PAGE_SIZE));
      } else {
        setHasMore(false);
        setActivities(data);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load activity history.';
      setErrorMessage(msg);
    } finally {
      setIsLoading(false);
    }
  }, [statusFilter, categoryFilter, onlyMine, wallet.address, page]);

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
    <div className="space-y-8 pb-16">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-800 pb-6">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight flex items-center gap-2.5">
              <History className="w-7 h-7 text-emerald-400" />
              <span>Activity History</span>
            </h1>
            <span className="text-[11px] bg-slate-800 border border-slate-700 text-slate-300 px-2.5 py-0.5 rounded-full font-mono">
              AUDIT TRAIL
            </span>
          </div>
          <p className="text-sm text-slate-400 mt-1">
            Browse all campus sustainability records with verifiable on-chain confirmations and transaction references.
          </p>
        </div>

        <button
          onClick={fetchActivities}
          disabled={isLoading}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition-colors w-fit"
          title="Refresh activity history"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-emerald-400' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Filter Toolbar */}
      <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
        <div className="flex items-center gap-2 text-xs font-semibold text-slate-300">
          <Filter className="w-4 h-4 text-emerald-400" />
          <span>Filters & Scope</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-4 gap-4 text-xs">
          {/* Status Filter */}
          <div>
            <label className="block text-slate-400 mb-1.5 font-medium">Status</label>
            <select
              value={statusFilter}
              onChange={(e) => updateFilters(e.target.value, categoryFilter, onlyMine)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-emerald-500 font-medium"
            >
              <option value="ALL">All Statuses</option>
              <option value="SUBMITTED">Pending Review (SUBMITTED)</option>
              <option value="APPROVED">Approved (APPROVED)</option>
              <option value="REJECTED">Rejected (REJECTED)</option>
            </select>
          </div>

          {/* Category Filter */}
          <div>
            <label className="block text-slate-400 mb-1.5 font-medium">Category</label>
            <select
              value={categoryFilter}
              onChange={(e) => updateFilters(statusFilter, e.target.value, onlyMine)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-emerald-500 font-medium"
            >
              {CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {cat === 'ALL' ? 'All Categories' : cat}
                </option>
              ))}
            </select>
          </div>

          {/* Submitter Scope Toggle */}
          <div>
            <label className="block text-slate-400 mb-1.5 font-medium">Scope</label>
            <button
              onClick={() => {
                if (!wallet.isConnected) return;
                updateFilters(statusFilter, categoryFilter, !onlyMine);
              }}
              disabled={!wallet.isConnected}
              className={`w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl border text-xs font-semibold transition-colors ${
                onlyMine
                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                  : 'bg-slate-950 text-slate-300 border-slate-800 hover:border-slate-700'
              } disabled:opacity-40 disabled:cursor-not-allowed`}
              title={wallet.isConnected ? 'Filter to submissions from your connected wallet' : 'Connect wallet to view your submissions only'}
            >
              <User className="w-3.5 h-3.5" />
              <span>{onlyMine ? 'Showing My Submissions' : 'All Submissions'}</span>
            </button>
          </div>

          {/* Reset Filters */}
          <div className="flex items-end">
            <button
              onClick={() => updateFilters('ALL', 'ALL', false)}
              className="w-full px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-colors"
            >
              Reset Filters
            </button>
          </div>
        </div>
      </div>

      {/* Error Banner */}
      {errorMessage && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{errorMessage}</span>
          </div>
          <button onClick={fetchActivities} className="underline text-rose-200 hover:text-white">
            Retry
          </button>
        </div>
      )}

      {/* Activities Table */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-300">
            <thead className="bg-slate-950/80 text-xs uppercase tracking-wider text-slate-400 border-b border-slate-800">
              <tr>
                <th className="py-3.5 px-4">Activity ID</th>
                <th className="py-3.5 px-4">Category & Unit</th>
                <th className="py-3.5 px-4">Submitter Address</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4">Date & Reviewer</th>
                <th className="py-3.5 px-4">Transaction Reference</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    <div className="flex items-center justify-center gap-2">
                      <RefreshCw className="w-4 h-4 animate-spin text-emerald-400" />
                      <span>Loading activity history...</span>
                    </div>
                  </td>
                </tr>
              ) : activities.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400 space-y-2">
                    <Leaf className="w-8 h-8 text-slate-600 mx-auto" />
                    <p className="font-semibold text-slate-300">No activities match your filters.</p>
                    <p className="text-xs text-slate-500">
                      Try adjusting the status or category filters, or submit a new activity.
                    </p>
                  </td>
                </tr>
              ) : (
                activities.map((act) => (
                  <tr key={act.activity_id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="py-3.5 px-4 font-mono font-medium text-white">
                      <Link
                        to={`/activity/${act.activity_id}`}
                        className="hover:text-emerald-400 transition-colors"
                      >
                        {act.activity_id}
                      </Link>
                    </td>

                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-white">{act.category}</div>
                      <div className="text-xs text-emerald-400 font-mono">
                        {act.quantity} {act.unit}
                      </div>
                    </td>

                    <td className="py-3.5 px-4 font-mono text-xs text-slate-300">
                      <span title={act.submitter_address}>
                        {truncateAddress(act.submitter_address, 6, 4)}
                      </span>
                      {wallet.address && act.submitter_address.toLowerCase() === wallet.address.toLowerCase() && (
                        <span className="ml-1.5 px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 text-[10px] font-semibold">
                          You
                        </span>
                      )}
                    </td>

                    <td className="py-3.5 px-4">
                      {act.status_cache === 'APPROVED' ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                          <CheckCircle2 className="w-3 h-3" />
                          Approved
                        </span>
                      ) : act.status_cache === 'SUBMITTED' ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/30">
                          <Clock className="w-3 h-3" />
                          Pending Review
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/30">
                          <XCircle className="w-3 h-3" />
                          Rejected
                        </span>
                      )}
                    </td>

                    <td className="py-3.5 px-4 text-xs text-slate-400">
                      <div>Submitted: {formatTimestamp(act.submitted_at)}</div>
                      {act.approved_at && (
                        <div className="text-[11px] text-emerald-400/90 font-mono">
                          Approved: {formatTimestamp(act.approved_at)}
                        </div>
                      )}
                      {act.rejected_at && (
                        <div className="text-[11px] text-rose-400/90 font-mono">
                          Rejected: {formatTimestamp(act.rejected_at)}
                        </div>
                      )}
                      {act.approver_address && (
                        <div className="text-[10px] text-slate-500 font-mono" title={act.approver_address}>
                          By: {truncateAddress(act.approver_address, 6, 4)}
                        </div>
                      )}
                    </td>

                    <td className="py-3.5 px-4 font-mono text-xs text-slate-400">
                      {act.approval_tx_hash ? (
                        <div>
                          <div className="text-[10px] text-slate-500">Decision TX:</div>
                          <a
                            href={`${EXPLORER_URL}/${act.approval_tx_hash}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-teal-400 hover:text-teal-300 inline-flex items-center gap-1"
                          >
                            <span>{truncateAddress(act.approval_tx_hash, 6, 4)}</span>
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        </div>
                      ) : act.submission_tx_hash ? (
                        <div>
                          <div className="text-[10px] text-slate-500">Submission TX:</div>
                          <a
                            href={`${EXPLORER_URL}/${act.submission_tx_hash}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-teal-400 hover:text-teal-300 inline-flex items-center gap-1"
                          >
                            <span>{truncateAddress(act.submission_tx_hash, 6, 4)}</span>
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        </div>
                      ) : (
                        <span className="text-slate-600">Pending Mining</span>
                      )}
                    </td>

                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Link
                          to={`/activity/${act.activity_id}`}
                          className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
                          title="View complete activity details"
                        >
                          <Eye className="w-4 h-4" />
                        </Link>
                        <Link
                          to={`/verify?id=${act.activity_id}`}
                          className="p-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 transition-colors"
                          title="Public verification badge"
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

        {/* Pagination Bar */}
        <div className="p-4 bg-slate-950/80 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
          <span>
            Page <span className="text-white font-bold">{page + 1}</span>
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((prev) => Math.max(0, prev - 1))}
              disabled={page === 0 || isLoading}
              className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              <span>Previous</span>
            </button>
            <button
              onClick={() => setPage((prev) => prev + 1)}
              disabled={!hasMore || isLoading}
              className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <span>Next</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
