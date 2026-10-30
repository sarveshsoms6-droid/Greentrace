import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWallet } from '../context/WalletContext';
import { SAMPLE_ORGANIZER_ADDRESS, SAMPLE_STUDENT_ADDRESS } from '../utils/mockData';
import { truncateAddress } from '../utils/crypto';
import {
  ShieldCheck,
  Sparkles,
  ArrowRight,
  Lock,
  Clock,
  CheckCircle2,
  Wallet,
  BadgeCheck,
  KeyRound,
  GraduationCap
} from 'lucide-react';

export const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const {
    loginAsStudent,
    loginAsOrganizer,
    submitOrganizerPermissionRequest,
    connectWallet,
    organizerRequests,
  } = useWallet();

  const [activeTab, setActiveTab] = useState<'STUDENT' | 'ORGANIZER'>('STUDENT');

  // Student Sign-In Form State (empty by default)
  const [studentName, setStudentName] = useState('');
  const [studentId, setStudentId] = useState('');
  const [studentEmail, setStudentEmail] = useState('');

  // Organizer Sign-In Form State (empty by default)
  const [orgIdentifier, setOrgIdentifier] = useState('');
  const [orgLoginError, setOrgLoginError] = useState<string | null>(null);

  // Organizer Permission Request Form State
  const [showRequestForm, setShowRequestForm] = useState(false);
  const [orgName, setOrgName] = useState('');
  const [orgDept, setOrgDept] = useState('');
  const [orgEmail, setOrgEmail] = useState('');
  const [orgWallet, setOrgWallet] = useState('');
  const [orgReason, setOrgReason] = useState('');
  const [requestSubmitted, setRequestSubmitted] = useState<boolean>(false);
  const [submittedRequestId, setSubmittedRequestId] = useState<string | null>(null);

  // Handle student login/activation
  const handleStudentLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!studentName.trim()) return;

    const trimmedName = studentName.trim();
    const trimmedId = studentId.trim();

    // Check if user is entering the pre-configured student credentials
    const isAlexRivera =
      trimmedName.toLowerCase().includes('alex') &&
      trimmedName.toLowerCase().includes('rivera');
    const isAlexId = trimmedId.toUpperCase() === 'STU-2026-8941';

    if (isAlexRivera || isAlexId) {
      loginAsStudent('Alex Rivera', 'STU-2026-8941', SAMPLE_STUDENT_ADDRESS);
    } else {
      loginAsStudent(trimmedName, trimmedId || undefined);
    }

    navigate('/student');
  };

  // Handle organizer login
  const handleOrganizerLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setOrgLoginError(null);
    const id = orgIdentifier.trim();

    if (!id) {
      setOrgLoginError('Please enter your Tezos wallet address or campus email.');
      return;
    }

    // Check if entering the pre-authorized organizer credentials
    const isArisThorne =
      id.toLowerCase() === SAMPLE_ORGANIZER_ADDRESS.toLowerCase() ||
      id.toLowerCase() === 'a.thorne@campus.edu' ||
      id.toLowerCase().includes('aris') ||
      id.toLowerCase().includes('thorne');

    if (isArisThorne) {
      loginAsOrganizer(SAMPLE_ORGANIZER_ADDRESS, 'Dr. Aris Thorne');
      navigate('/organizer');
      return;
    }

    // If entering another valid tz1/tz2/tz3 address
    if (id.startsWith('tz1') || id.startsWith('tz2') || id.startsWith('tz3')) {
      loginAsOrganizer(id, 'Campus Organizer');
      navigate('/organizer');
      return;
    }

    // Non-wallet identifier provided that is not registered
    setOrgLoginError(
      'Account not recognized as a pre-authorized organizer. Enter your registered wallet address (tz1...) or submit a permission request below.'
    );
  };

  // Handle organizer permission request submission
  const handleOrganizerRequestSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!orgName.trim() || !orgDept.trim() || !orgEmail.trim()) return;

    const req = submitOrganizerPermissionRequest({
      name: orgName.trim(),
      email: orgEmail.trim(),
      department: orgDept.trim(),
      walletAddress: orgWallet.trim() || `tz1Req${Math.random().toString(36).substring(2, 10).padEnd(30, '0')}`,
      reason: orgReason.trim() || 'Faculty advisor for campus sustainability review.',
    });

    setSubmittedRequestId(req.id);
    setRequestSubmitted(true);
  };

  return (
    <div className="max-w-4xl mx-auto py-8 sm:py-12 space-y-8">
      {/* Top Header */}
      <div className="text-center space-y-3">
        <div className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/25 text-emerald-600 dark:text-emerald-400 text-xs font-bold tracking-wide uppercase">
          <Sparkles className="w-3.5 h-3.5" />
          <span>Campus Portal Authentication</span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 dark:text-white tracking-tight">
          Sign In to GreenTrace 2.0
        </h1>
        <p className="text-sm text-slate-600 dark:text-slate-400 max-w-2xl mx-auto leading-relaxed">
          Access your campus sustainability workspace to record impact actions, mint verifiable proofs, or manage authorized organizer approvals.
        </p>
      </div>

      {/* Role Navigation Tabs */}
      <div className="flex border-b border-slate-200 dark:border-slate-800 justify-center">
        <button
          onClick={() => {
            setActiveTab('STUDENT');
            setOrgLoginError(null);
          }}
          className={`flex items-center gap-2 px-6 py-3.5 text-sm font-semibold border-b-2 transition-all ${
            activeTab === 'STUDENT'
              ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400 bg-emerald-500/5'
              : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
          }`}
        >
          <GraduationCap className="w-4 h-4" />
          <span>Student Portal</span>
        </button>

        <button
          onClick={() => {
            setActiveTab('ORGANIZER');
            setOrgLoginError(null);
          }}
          className={`flex items-center gap-2 px-6 py-3.5 text-sm font-semibold border-b-2 transition-all ${
            activeTab === 'ORGANIZER'
              ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400 bg-indigo-500/5'
              : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
          }`}
        >
          <ShieldCheck className="w-4 h-4" />
          <span>Organizer Portal</span>
        </button>
      </div>

      {/* TAB 1: STUDENT LOGIN & INSTANT ACTIVATION */}
      {activeTab === 'STUDENT' && (
        <div className="grid md:grid-cols-5 gap-6">
          <div className="md:col-span-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-8 space-y-6 shadow-md">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-bold text-sm">
                <CheckCircle2 className="w-4 h-4" />
                <span>Instant Student Activation</span>
              </div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                Student Sign In
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Student accounts are activated immediately with zero admin approval needed. Enter your credentials to access your dashboard.
              </p>
            </div>

            <form onSubmit={handleStudentLogin} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Full Student Name *
                </label>
                <input
                  type="text"
                  required
                  value={studentName}
                  onChange={(e) => setStudentName(e.target.value)}
                  placeholder="e.g. Alex Rivera"
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2.5 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500 transition-colors"
                />
              </div>

              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    Student ID Number
                  </label>
                  <input
                    type="text"
                    value={studentId}
                    onChange={(e) => setStudentId(e.target.value)}
                    placeholder="e.g. STU-2026-8941"
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2.5 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500 font-mono transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    Campus Email
                  </label>
                  <input
                    type="email"
                    value={studentEmail}
                    onChange={(e) => setStudentEmail(e.target.value)}
                    placeholder="e.g. alex.rivera@campus.edu"
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2.5 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500 transition-colors"
                  />
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  className="w-full py-3 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-sm shadow-md shadow-emerald-500/20 transition-all flex items-center justify-center gap-2"
                >
                  <span>Sign In to Student Dashboard</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </form>
          </div>

          {/* Sidebar */}
          <div className="md:col-span-2 space-y-4">
            <div className="bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 space-y-3.5 shadow-sm">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <BadgeCheck className="w-4 h-4 text-emerald-500" />
                <span>Student Capabilities</span>
              </h3>
              <ul className="space-y-2.5 text-xs text-slate-600 dark:text-slate-300">
                <li className="flex items-start gap-2">
                  <span className="text-emerald-500 font-bold">•</span>
                  <span>Instant access without waiting for admin validation.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-emerald-500 font-bold">•</span>
                  <span>Direct photographic upload with instant SHA-256 fingerprinting.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-emerald-500 font-bold">•</span>
                  <span>Personal dashboard tracking approved trees, recycling, and carbon savings.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-emerald-500 font-bold">•</span>
                  <span>Downloadable and verifiable QR code proof badges.</span>
                </li>
              </ul>
            </div>

            {/* Beacon Wallet option */}
            <div className="bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 space-y-3 shadow-sm">
              <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <Wallet className="w-3.5 h-3.5 text-teal-500" />
                <span>Tezos Wallet Login</span>
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Sign in directly using Temple or Kukai browser wallet on Tezos Shadownet:
              </p>
              <button
                type="button"
                onClick={() => connectWallet('STUDENT')}
                className="w-full py-2.5 px-3 rounded-xl bg-teal-50 hover:bg-teal-100 dark:bg-teal-500/10 dark:hover:bg-teal-500/20 border border-teal-200 dark:border-teal-500/30 text-teal-700 dark:text-teal-300 text-xs font-semibold transition-colors"
              >
                Connect Temple / Beacon Wallet
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: ORGANIZER LOGIN & PERMISSION REQUEST */}
      {activeTab === 'ORGANIZER' && (
        <div className="space-y-6">
          {/* Organizer Sign-in Box */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-8 space-y-6 shadow-md">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 font-bold text-sm">
                <ShieldCheck className="w-4 h-4" />
                <span>Authorized Organizer Sign In</span>
              </div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                Organizer Access Portal
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Organizer accounts possess cryptographic signing rights to review and verify student activities on the Tezos smart contract.
              </p>
            </div>

            {orgLoginError && (
              <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 text-rose-700 dark:text-rose-300 text-xs">
                {orgLoginError}
              </div>
            )}

            <form onSubmit={handleOrganizerLogin} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Authorized Tezos Wallet Address or Registered Email *
                </label>
                <input
                  type="text"
                  required
                  value={orgIdentifier}
                  onChange={(e) => {
                    setOrgIdentifier(e.target.value);
                    setOrgLoginError(null);
                  }}
                  placeholder="Enter authorized wallet (tz1...) or registered faculty email"
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2.5 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500 font-mono transition-colors"
                />
              </div>

              <div className="pt-2 flex flex-col sm:flex-row gap-3">
                <button
                  type="submit"
                  className="flex-1 py-3 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-sm shadow-md shadow-indigo-600/20 transition-all flex items-center justify-center gap-2"
                >
                  <KeyRound className="w-4 h-4" />
                  <span>Sign In as Organizer</span>
                </button>

                <button
                  type="button"
                  onClick={() => connectWallet('ORGANIZER')}
                  className="py-3 px-5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 font-semibold text-xs transition-colors flex items-center justify-center gap-1.5"
                >
                  <Wallet className="w-4 h-4 text-indigo-500" />
                  <span>Connect Beacon Wallet</span>
                </button>
              </div>
            </form>
          </div>

          {/* Section to Request New Authorization */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-8 space-y-6 shadow-md">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 font-bold text-xs uppercase tracking-wider">
                  <Lock className="w-3.5 h-3.5" />
                  <span>Permission-Gated On-Chain Access</span>
                </div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                  Need Review Authorization? Request Organizer Permission
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 max-w-2xl leading-relaxed">
                  To prevent unauthorized approval authority on the Tezos smart contract, new organizer requests must be approved by an authorized campus organizer before privileges are granted.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setShowRequestForm(!showRequestForm)}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 text-xs font-semibold shrink-0"
              >
                {showRequestForm ? 'Hide Form' : 'Request Authorization →'}
              </button>
            </div>

            {showRequestForm && (
              <>
                {requestSubmitted ? (
                  <div className="p-6 rounded-2xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 text-amber-900 dark:text-amber-200 space-y-3">
                    <div className="flex items-center gap-2 font-bold text-sm text-amber-700 dark:text-amber-300">
                      <Clock className="w-5 h-5" />
                      <span>Permission Request Submitted — Awaiting Authorization</span>
                    </div>
                    <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                      Your request (ID: <code className="text-amber-600 dark:text-amber-400 font-mono font-bold">{submittedRequestId}</code>) has been logged in the verification queue. An authorized organizer can review and approve it.
                    </p>
                    <div className="pt-2">
                      <button
                        type="button"
                        onClick={() => setRequestSubmitted(false)}
                        className="text-xs text-amber-600 dark:text-amber-400 hover:underline font-semibold"
                      >
                        Submit another request
                      </button>
                    </div>
                  </div>
                ) : (
                  <form onSubmit={handleOrganizerRequestSubmit} className="space-y-4 pt-2">
                    <div className="grid sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                          Full Name & Title *
                        </label>
                        <input
                          type="text"
                          required
                          value={orgName}
                          onChange={(e) => setOrgName(e.target.value)}
                          placeholder="e.g. Prof. Marcus Vance"
                          className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2.5 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500 transition-colors"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                          Campus Office / Department *
                        </label>
                        <input
                          type="text"
                          required
                          value={orgDept}
                          onChange={(e) => setOrgDept(e.target.value)}
                          placeholder="e.g. Environmental Sciences"
                          className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2.5 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500 transition-colors"
                        />
                      </div>
                    </div>

                    <div className="grid sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                          Faculty Email Address *
                        </label>
                        <input
                          type="email"
                          required
                          value={orgEmail}
                          onChange={(e) => setOrgEmail(e.target.value)}
                          placeholder="faculty@campus.edu"
                          className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2.5 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500 transition-colors"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                          Tezos Wallet Address (tz1...)
                        </label>
                        <input
                          type="text"
                          value={orgWallet}
                          onChange={(e) => setOrgWallet(e.target.value)}
                          placeholder="tz1..."
                          className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2.5 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500 font-mono transition-colors"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                        Scope of Review Authority
                      </label>
                      <textarea
                        rows={2}
                        value={orgReason}
                        onChange={(e) => setOrgReason(e.target.value)}
                        placeholder="e.g. Overseeing campus recycling and community solar verification..."
                        className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500 transition-colors"
                      />
                    </div>

                    <div className="pt-2">
                      <button
                        type="submit"
                        className="px-6 py-2.5 rounded-xl bg-slate-900 dark:bg-slate-800 hover:bg-slate-800 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-700 text-xs text-white font-bold transition-all flex items-center gap-2 shadow-sm"
                      >
                        <span>Submit Request for Authorization</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </form>
                )}
              </>
            )}

            {/* Recorded Authorization Requests */}
            {organizerRequests.length > 0 && (
              <div className="pt-4 border-t border-slate-200 dark:border-slate-800 space-y-3">
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
                  Logged Authorization Requests ({organizerRequests.filter((r) => r.status === 'PENDING').length} Pending)
                </span>
                <div className="space-y-2">
                  {organizerRequests.map((req) => (
                    <div
                      key={req.id}
                      className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                    >
                      <div>
                        <div className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                          <span>{req.name}</span>
                          <span className="text-[10px] font-normal text-slate-500 dark:text-slate-400">({req.department})</span>
                        </div>
                        <div className="text-slate-500 dark:text-slate-400 font-mono text-[11px]">
                          Wallet: {truncateAddress(req.walletAddress, 8, 6)} • Email: {req.email}
                        </div>
                      </div>
                      <div>
                        {req.status === 'PENDING' ? (
                          <span className="px-2.5 py-1 rounded-full bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 text-amber-700 dark:text-amber-400 font-semibold text-[11px] flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            <span>Pending Organizer Review</span>
                          </span>
                        ) : req.status === 'APPROVED' ? (
                          <span className="px-2.5 py-1 rounded-full bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30 text-emerald-700 dark:text-emerald-400 font-semibold text-[11px] flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" />
                            <span>Authorized</span>
                          </span>
                        ) : (
                          <span className="px-2.5 py-1 rounded-full bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 text-rose-700 dark:text-rose-400 font-semibold text-[11px]">
                            Rejected
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
