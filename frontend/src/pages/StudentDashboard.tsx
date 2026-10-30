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
  Sparkles,
  Zap,
  ExternalLink,
  History,
  RefreshCw,
  AlertCircle,
  User,
} from 'lucide-react';
import type { ActivityStatus } from '../types';

export const StudentDashboard: React.FC = () => {
  const { wallet } = useWallet();
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
      // Fetch only this student's real activities from backend SQLite
      const [activitiesData, statsData] = await Promise.all([
        api.getActivities({ submitter_address: wallet.address }),
        api.getActivityStats(wallet.address),
      ]);
      setStudentActivities(activitiesData);
      setStats(statsData);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load student activity records.';
      setErrorMessage(msg);
    } finally {
      setIsLoading(false);
    }
  }, [wallet.isConnected, wallet.address]);

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
    <div className="space-y-8 pb-16">
      {/* Header with Title and CTAs */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-6">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
              {wallet.userName ? `${wallet.userName}'s Dashboard` : 'Student Dashboard'}
            </h1>
            <span className="text-[11px] bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 px-2.5 py-0.5 rounded-full font-mono font-medium">
              ROLE: STUDENT
            </span>
          </div>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
            Student Account:{' '}
            {wallet.isConnected && wallet.address ? (
              <span className="font-mono text-emerald-600 dark:text-emerald-400 font-medium">
                {wallet.address} ({truncateAddress(wallet.address, 8, 6)})
              </span>
            ) : (
              <span className="text-amber-500">Not Connected — Sign in or create a student account below</span>
            )}
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            onClick={fetchStudentData}
            disabled={isLoading || !wallet.isConnected}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold border border-slate-200 dark:border-slate-700 transition-colors disabled:opacity-50"
            title="Refresh student submissions"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-emerald-500' : ''}`} />
            <span>Refresh</span>
          </button>

          <Link
            to="/history?mine=true"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold border border-slate-200 dark:border-slate-700 transition-colors"
          >
            <History className="w-3.5 h-3.5 text-teal-500" />
            <span>All My Submissions</span>
          </Link>

          <Link
            to="/submit"
            className="inline-flex items-center justify-center gap-2 px-5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs shadow-md shadow-emerald-500/20 transition-all hover:scale-102"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Submit New Activity</span>
          </Link>
        </div>
      </div>

      {/* Organizer Context Banner if active role is Organizer */}
      {wallet.role === 'ORGANIZER' && (
        <div className="p-4 rounded-2xl bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-200 dark:border-indigo-500/30 flex items-center justify-between gap-4">
          <div className="text-xs text-indigo-700 dark:text-indigo-300">
            <strong>Logged in as Organizer:</strong> You are currently viewing the Student personal submissions view.
          </div>
          <Link
            to="/organizer"
            className="text-xs font-bold px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white transition-colors"
          >
            Go to Organizer Review Queue →
          </Link>
        </div>
      )}

      {/* Account Login Prompt if Disconnected */}
      {!wallet.isConnected && (
        <div className="p-6 rounded-2xl bg-white dark:bg-gradient-to-r dark:from-emerald-950/40 dark:to-slate-900 border border-emerald-500/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-md">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0">
              <User className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 dark:text-white text-sm">Student Account Not Connected</h3>
              <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">
                Sign in to view your verified activities and personal impact badges.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Link
              to="/login"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs shadow-md shadow-emerald-500/20 transition-all shrink-0"
            >
              <User className="w-4 h-4" />
              <span>Login / Create Student Account</span>
            </Link>
          </div>
        </div>
      )}

      {/* Error Message */}
      {errorMessage && (
        <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 text-rose-800 dark:text-rose-300 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
            <span>{errorMessage}</span>
          </div>
          <button onClick={fetchStudentData} className="underline text-rose-700 dark:text-rose-200 hover:text-rose-900">
            Retry
          </button>
        </div>
      )}

      {/* KPI Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 space-y-1 shadow-sm">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 font-medium">
            <span>Approved Actions</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-bold text-slate-900 dark:text-white">{stats.approved}</div>
          <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">Verified on-chain</p>
        </div>

        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 space-y-1 shadow-sm">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 font-medium">
            <span>Pending Review</span>
            <Clock className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-2xl font-bold text-slate-900 dark:text-white">{stats.pending}</div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">{stats.rejected} rejected</p>
        </div>

        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 space-y-1 shadow-sm">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 font-medium">
            <span>Trees Planted</span>
            <Sparkles className="w-4 h-4 text-teal-500" />
          </div>
          <div className="text-2xl font-bold text-slate-900 dark:text-white">{totalTrees} saplings</div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">{totalWasteSorted} kg waste sorted</p>
        </div>

        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 space-y-1 shadow-sm">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 font-medium">
            <span>Resource Savings</span>
            <Zap className="w-4 h-4 text-cyan-500" />
          </div>
          <div className="text-2xl font-bold text-slate-900 dark:text-white">{totalEnergySaved} kWh</div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">{totalWaterSaved} litres water conserved</p>
        </div>
      </div>

      {/* Table Section */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">My Submissions</h2>
            <span className="text-xs text-slate-500 dark:text-slate-400 font-mono">({filteredActivities.length} total)</span>
          </div>

          {/* Filter Pills */}
          <div className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs">
            <button
              onClick={() => setFilter('ALL')}
              className={`px-3 py-1 rounded-lg transition-colors font-medium ${
                filter === 'ALL' ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              All ({studentActivities.length})
            </button>
            <button
              onClick={() => setFilter('APPROVED')}
              className={`px-3 py-1 rounded-lg transition-colors font-medium ${
                filter === 'APPROVED' ? 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 font-bold' : 'text-slate-600 dark:text-slate-400 hover:text-emerald-600'
              }`}
            >
              Approved ({stats.approved})
            </button>
            <button
              onClick={() => setFilter('SUBMITTED')}
              className={`px-3 py-1 rounded-lg transition-colors font-medium ${
                filter === 'SUBMITTED' ? 'bg-amber-500/20 text-amber-700 dark:text-amber-400 font-bold' : 'text-slate-600 dark:text-slate-400 hover:text-amber-600'
              }`}
            >
              Pending ({stats.pending})
            </button>
            <button
              onClick={() => setFilter('REJECTED')}
              className={`px-3 py-1 rounded-lg transition-colors font-medium ${
                filter === 'REJECTED' ? 'bg-rose-500/20 text-rose-700 dark:text-rose-400 font-bold' : 'text-slate-600 dark:text-slate-400 hover:text-rose-600'
              }`}
            >
              Rejected ({stats.rejected})
            </button>
          </div>
        </div>

        {/* Activities Table */}
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 overflow-hidden shadow-md">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-700 dark:text-slate-300">
              <thead className="bg-slate-50 dark:bg-slate-950/80 text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="py-3.5 px-4">Activity ID</th>
                  <th className="py-3.5 px-4">Category & Quantity</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4">Submitted At</th>
                  <th className="py-3.5 px-4">Transaction Reference</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {isLoading ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-slate-500 dark:text-slate-400">
                      <div className="flex items-center justify-center gap-2">
                        <RefreshCw className="w-4 h-4 animate-spin text-emerald-500" />
                        <span>Loading your activity submissions...</span>
                      </div>
                    </td>
                  </tr>
                ) : filteredActivities.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-slate-500 dark:text-slate-400 space-y-2">
                      <p className="font-semibold text-slate-700 dark:text-slate-300">No activity submissions found.</p>
                      <p className="text-xs text-slate-500">
                        {filter !== 'ALL'
                          ? `No submissions currently in ${filter} state.`
                          : 'You have not submitted any sustainability activities yet.'}
                      </p>
                      <Link
                        to="/submit"
                        className="inline-flex items-center gap-1.5 px-4 py-2 mt-2 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 text-xs font-semibold"
                      >
                        <PlusCircle className="w-4 h-4" />
                        <span>Submit your first activity</span>
                      </Link>
                    </td>
                  </tr>
                ) : (
                  filteredActivities.map((act) => (
                    <tr key={act.activity_id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                      <td className="py-3.5 px-4 font-mono font-medium text-slate-900 dark:text-white">
                        <Link
                          to={`/activity/${act.activity_id}`}
                          className="hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors flex items-center gap-1"
                        >
                          <span>{act.activity_id}</span>
                        </Link>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-slate-900 dark:text-white">{act.category}</div>
                        <div className="text-xs text-emerald-600 dark:text-emerald-400 font-mono">
                          {act.quantity} {act.unit}
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        {act.status_cache === 'APPROVED' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/30">
                            <CheckCircle2 className="w-3 h-3" />
                            Approved
                          </span>
                        ) : act.status_cache === 'SUBMITTED' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-500/30">
                            <Clock className="w-3 h-3" />
                            Pending Review
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-50 dark:bg-rose-500/10 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-500/30">
                            <XCircle className="w-3 h-3" />
                            Rejected
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-xs text-slate-500 dark:text-slate-400">
                        {formatTimestamp(act.submitted_at)}
                      </td>
                      <td className="py-3.5 px-4 font-mono text-xs text-slate-500 dark:text-slate-400">
                        {act.submission_tx_hash ? (
                          <a
                            href={`${EXPLORER_URL}/${act.submission_tx_hash}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-teal-600 dark:text-teal-400 hover:underline inline-flex items-center gap-1"
                            title={act.submission_tx_hash}
                          >
                            <span>{truncateAddress(act.submission_tx_hash, 8, 4)}</span>
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        ) : (
                          <span className="text-slate-400 dark:text-slate-600">Pending Mining</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Link
                            to={`/activity/${act.activity_id}`}
                            className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-colors"
                            title="View audit details"
                          >
                            <Eye className="w-4 h-4" />
                          </Link>
                          <Link
                            to={`/verify?id=${act.activity_id}`}
                            className="p-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-500/10 dark:hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20 transition-colors"
                            title="Open public QR verification badge"
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
