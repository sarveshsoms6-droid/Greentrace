import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useWallet } from '../hooks/useWallet';
import { api, ApiError } from '../services/api';
import { SAMPLE_ORGANIZER_ADDRESS, SAMPLE_STUDENT_ADDRESS } from '../utils/mockData';
import {
  ShieldCheck,
  Sparkles,
  ArrowRight,
  Mail,
  User,
  GraduationCap,
  Building2,
  Wallet,
  AlertCircle,
  CheckCircle2,
  Loader2,
  KeyRound,
  UserPlus,
  LogIn,
  Zap,
} from 'lucide-react';

export const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { loginWithBackendUser, loginWithTezosId, connectWallet, loginAsStudent, loginAsOrganizer } = useWallet();

  // Mode: 'SIGNIN' | 'SIGNUP'
  const initialMode = searchParams.get('mode') === 'signup' ? 'SIGNUP' : 'SIGNIN';
  const initialRole = searchParams.get('role')?.toUpperCase() === 'ORGANIZER' ? 'ORGANIZER' : 'STUDENT';

  const [authMode, setAuthMode] = useState<'SIGNIN' | 'SIGNUP'>(initialMode);
  const [role, setRole] = useState<'STUDENT' | 'ORGANIZER'>(initialRole);

  // Common Form States
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [studentId, setStudentId] = useState('');
  const [department, setDepartment] = useState('');
  const [walletAddress, setWalletAddress] = useState('');

  // Tezos Quick Access States
  const [tezosAddressInput, setTezosAddressInput] = useState('');
  const [isTezosLoading, setIsTezosLoading] = useState(false);
  const [tezosErrorMessage, setTezosErrorMessage] = useState<string | null>(null);

  // UI state
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Sync mode from search params if query changes
  useEffect(() => {
    const qMode = searchParams.get('mode');
    if (qMode === 'signup') {
      setAuthMode('SIGNUP');
    } else if (qMode === 'signin') {
      setAuthMode('SIGNIN');
    }
    const qRole = searchParams.get('role')?.toUpperCase();
    if (qRole === 'ORGANIZER' || qRole === 'STUDENT') {
      setRole(qRole);
    }
  }, [searchParams]);

  // Handle Login submission via Email or Student ID + Password
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    const cleanIdentifier = identifier.trim();
    if (!cleanIdentifier || !password) {
      setErrorMessage('Please enter your Campus Email or Student ID, and your passphrase.');
      return;
    }

    setIsLoading(true);
    try {
      const res = await api.login({
        email: cleanIdentifier,
        password: password,
      });

      setSuccessMessage(`Session ratified for ${res.user.name}. Entering portal...`);
      loginWithBackendUser(res.user, res.token);

      setTimeout(() => {
        if (res.user.role === 'ORGANIZER') {
          navigate('/organizer');
        } else {
          navigate('/student');
        }
      }, 500);
    } catch (err) {
      if (err instanceof ApiError) {
        setErrorMessage(err.message || 'Authentication rejected. Verify credentials.');
      } else {
        // Fallback for simulated offline credentials if backend server is not running
        if (cleanIdentifier.toLowerCase().includes('thorne') || cleanIdentifier.toLowerCase() === 'a.thorne@campus.edu') {
          loginAsOrganizer(SAMPLE_ORGANIZER_ADDRESS, 'Dr. Aris Thorne');
          navigate('/organizer');
          return;
        }
        if (
          cleanIdentifier.toLowerCase().includes('alex') ||
          cleanIdentifier.toLowerCase() === 'alex.rivera@campus.edu' ||
          cleanIdentifier.toLowerCase() === 'stu-2026-8941'
        ) {
          loginAsStudent('Alex Rivera', 'STU-2026-8941', SAMPLE_STUDENT_ADDRESS);
          navigate('/student');
          return;
        }
        setErrorMessage('Unable to contact authentication server. Check network connectivity.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Handle Sign-Up submission with strict role segregation
  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    const cleanName = name.trim();
    const cleanEmail = identifier.trim();
    const cleanPassword = password;
    const isStudent = role === 'STUDENT';

    if (!cleanName || !cleanEmail || !cleanPassword) {
      setErrorMessage('Please provide full name, institutional email, and access credential.');
      return;
    }

    if (cleanPassword.length < 6) {
      setErrorMessage('Access credential must contain at least 6 characters.');
      return;
    }

    if (isStudent && !studentId.trim()) {
      setErrorMessage('Student Matriculation ID is required for Student Cadre registration.');
      return;
    }

    if (!isStudent && !department.trim()) {
      setErrorMessage('Academic Department is required for Faculty Organizer registration.');
      return;
    }

    setIsLoading(true);
    try {
      const res = await api.signUp({
        name: cleanName,
        email: cleanEmail,
        password: cleanPassword,
        role: isStudent ? 'STUDENT' : 'ORGANIZER',
        student_id: isStudent ? studentId.trim() : undefined,
        department: !isStudent ? department.trim() : undefined,
        wallet_address: walletAddress.trim() || undefined,
      });

      setSuccessMessage(`Cadre record created successfully for ${res.user.name}. Initializing workspace...`);
      loginWithBackendUser(res.user, res.token);

      setTimeout(() => {
        if (res.user.role === 'ORGANIZER') {
          navigate('/organizer');
        } else {
          navigate('/student');
        }
      }, 500);
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 409) {
          setErrorMessage(err.message || 'An account with this email or Student ID already exists. Please switch to Sign In.');
        } else {
          setErrorMessage(err.message || 'Cadre enrollment failed. Please verify submission fields.');
        }
      } else {
        setErrorMessage('Failed to connect to authentication server. Please retry.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Handle Organizer Quick Access via Tezos ID
  const handleTezosQuickLogin = async (addressToUse?: string) => {
    const targetAddr = (addressToUse || tezosAddressInput).trim();
    if (!targetAddr) {
      setTezosErrorMessage('Please provide an accredited Tezos ID (tz1...).');
      return;
    }
    setTezosErrorMessage(null);
    setIsTezosLoading(true);

    try {
      const res = await loginWithTezosId(targetAddr);
      if (res.success) {
        setSuccessMessage('Organizer access ratified via Tezos ID. Entering Council Forum...');
        setTimeout(() => {
          navigate('/organizer');
        }, 500);
      } else {
        setTezosErrorMessage(res.error || 'Verification failed. Address is not an accredited Organizer.');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Tezos Quick Access verification failed.';
      setTezosErrorMessage(msg);
    } finally {
      setIsTezosLoading(false);
    }
  };

  // Fast Fill Demo Accounts
  const handleDemoFill = (demoRole: 'STUDENT' | 'ORGANIZER') => {
    setErrorMessage(null);
    if (authMode === 'SIGNIN') {
      if (demoRole === 'STUDENT') {
        setIdentifier('STU-2026-8941');
        setPassword('Pass@123');
      } else {
        setIdentifier('a.thorne@campus.edu');
        setPassword('Pass@123');
      }
    } else {
      setRole(demoRole);
      if (demoRole === 'STUDENT') {
        setName('Alex Rivera');
        setIdentifier(`student.${Math.floor(1000 + Math.random() * 9000)}@campus.edu`);
        setPassword('StudentPass@2026');
        setStudentId(`STU-2026-${Math.floor(1000 + Math.random() * 9000)}`);
      } else {
        setName('Dr. Elena Rostova');
        setIdentifier(`organizer.${Math.floor(1000 + Math.random() * 9000)}@campus.edu`);
        setPassword('OrganizerPass@2026');
        setDepartment('School of Earth & Environmental Sciences');
      }
    }
  };

  return (
    <div className="max-w-4xl mx-auto py-6 sm:py-10 space-y-8 animate-fadeIn">
      {/* Top Archival Header */}
      <div className="text-center space-y-3">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-xs bg-stone-200/80 dark:bg-stone-800/80 border border-stone-300 dark:border-stone-700 text-stone-800 dark:text-stone-200 text-xs font-mono font-bold tracking-widest uppercase">
          <Sparkles className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
          <span>INSTITUTIONAL CADRE REGISTRATION // PROTOCOL 2.0</span>
        </div>
        <h1 className="text-3xl sm:text-5xl font-display-serif font-bold text-stone-950 dark:text-stone-100 tracking-tight">
          {authMode === 'SIGNIN' ? 'Access the Protocol Archive' : 'Enroll in the Sustainability Cadre'}
        </h1>
        <p className="text-sm sm:text-base text-stone-600 dark:text-stone-400 max-w-xl mx-auto leading-relaxed font-sans">
          {authMode === 'SIGNIN'
            ? 'Present your registered student ID, campus email, or accredited Tezos ID to access your verified ecological records and workspace.'
            : 'Register with your Student ID to deposit proof of physical ecological action, or register with your Faculty Email to oversee on-chain ratification.'}
        </p>
      </div>

      {/* Mode Switch Tabs (Sign In vs Sign Up) */}
      <div className="flex border-b border-stone-300 dark:border-stone-800 justify-center font-mono">
        <button
          type="button"
          onClick={() => {
            setAuthMode('SIGNIN');
            setErrorMessage(null);
            setSuccessMessage(null);
          }}
          className={`flex items-center gap-2 px-8 py-3 text-xs tracking-wider uppercase font-bold border-b-2 transition-all ${
            authMode === 'SIGNIN'
              ? 'border-stone-900 dark:border-stone-100 text-stone-950 dark:text-stone-50 bg-stone-200/40 dark:bg-stone-800/40'
              : 'border-transparent text-stone-500 hover:text-stone-900 dark:hover:text-stone-200'
          }`}
        >
          <LogIn className="w-4 h-4" />
          <span>[ 01 // AUTHENTICATE ]</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setAuthMode('SIGNUP');
            setErrorMessage(null);
            setSuccessMessage(null);
          }}
          className={`flex items-center gap-2 px-8 py-3 text-xs tracking-wider uppercase font-bold border-b-2 transition-all ${
            authMode === 'SIGNUP'
              ? 'border-stone-900 dark:border-stone-100 text-stone-950 dark:text-stone-50 bg-stone-200/40 dark:bg-stone-800/40'
              : 'border-transparent text-stone-500 hover:text-stone-900 dark:hover:text-stone-200'
          }`}
        >
          <UserPlus className="w-4 h-4" />
          <span>[ 02 // CADRE ENROLLMENT ]</span>
        </button>
      </div>

      {/* Error & Success Feedback Banners */}
      {errorMessage && (
        <div className="p-4 rounded-xs bg-rose-50 dark:bg-rose-950/40 border border-rose-300 dark:border-rose-900 text-rose-900 dark:text-rose-200 text-xs font-mono flex items-start gap-3 shadow-xs animate-fadeIn">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-semibold">{errorMessage}</p>
            {errorMessage.includes('already exists') && (
              <button
                type="button"
                onClick={() => setAuthMode('SIGNIN')}
                className="mt-1 text-[11px] text-rose-700 dark:text-rose-300 underline font-bold hover:text-rose-950"
              >
                Switch to Sign In &rarr;
              </button>
            )}
          </div>
        </div>
      )}

      {successMessage && (
        <div className="p-4 rounded-xs bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200 text-xs font-mono flex items-center gap-3 shadow-xs animate-fadeIn">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <p className="font-semibold">{successMessage}</p>
        </div>
      )}

      <div className="grid md:grid-cols-5 gap-8">
        {/* Main Form Box (Editorial Card) */}
        <div className="md:col-span-3 bg-white dark:bg-[#141312] border border-stone-300 dark:border-stone-800 rounded-xs p-6 sm:p-8 space-y-6 shadow-sm">
          {/* TAB 1: SIGN IN */}
          {authMode === 'SIGNIN' ? (
            <div className="space-y-6">
              <form onSubmit={handleLogin} className="space-y-4 font-mono">
                <div className="space-y-1 pb-1 border-b border-stone-200 dark:border-stone-800">
                  <h2 className="text-xl font-display-serif font-bold text-stone-900 dark:text-stone-100">
                    Institutional Dossier Access
                  </h2>
                  <p className="text-xs text-stone-500 font-sans">
                    Log in with your Student ID (for students) or campus email (for students / organizers).
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-1.5 uppercase tracking-wider flex items-center gap-1.5">
                    <Mail className="w-3.5 h-3.5 text-stone-400" />
                    <span>Campus Email or Student ID *</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    placeholder="e.g. STU-2026-8941 or alex.rivera@campus.edu"
                    className="w-full bg-stone-50 dark:bg-stone-950 border border-stone-300 dark:border-stone-800 rounded-xs px-4 py-2.5 text-xs text-stone-900 dark:text-stone-100 focus:outline-none focus:border-stone-900 dark:focus:border-stone-100 transition-colors"
                  />
                  <span className="text-[10px] text-stone-500 mt-1 block">
                    Students can enter either Student ID or email. Organizers enter their faculty email.
                  </span>
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-1.5 uppercase tracking-wider flex items-center gap-1.5">
                    <KeyRound className="w-3.5 h-3.5 text-stone-400" />
                    <span>Access Credential (Passphrase) *</span>
                  </label>
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-stone-50 dark:bg-stone-950 border border-stone-300 dark:border-stone-800 rounded-xs px-4 py-2.5 text-xs text-stone-900 dark:text-stone-100 focus:outline-none focus:border-stone-900 dark:focus:border-stone-100 transition-colors"
                  />
                </div>

                {/* Quick Demo Accounts Helper */}
                <div className="p-3.5 rounded-xs bg-stone-100/70 dark:bg-stone-950/70 border border-stone-300 dark:border-stone-800 space-y-2">
                  <span className="text-[10px] font-bold text-stone-500 uppercase tracking-widest block">
                    [ SPECIMEN CREDENTIALS // PRE-SEEDED ]
                  </span>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => handleDemoFill('STUDENT')}
                      className="text-[11px] px-2.5 py-1 rounded-xs bg-white dark:bg-stone-900 border border-stone-300 dark:border-stone-700 hover:border-emerald-700 text-stone-800 dark:text-stone-200 transition-colors"
                    >
                      Student ID: STU-2026-8941
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDemoFill('ORGANIZER')}
                      className="text-[11px] px-2.5 py-1 rounded-xs bg-white dark:bg-stone-900 border border-stone-300 dark:border-stone-700 hover:border-amber-700 text-stone-800 dark:text-stone-200 transition-colors"
                    >
                      Organizer: a.thorne@campus.edu
                    </button>
                  </div>
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full py-3.5 px-4 rounded-xs bg-stone-900 hover:bg-stone-800 dark:bg-stone-100 dark:hover:bg-white text-stone-50 dark:text-stone-950 font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 shadow-sm disabled:opacity-50"
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>AUTHENTICATING WITH ARCHIVE...</span>
                      </>
                    ) : (
                      <>
                        <span>SIGN IN TO WORKSPACE</span>
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </div>
              </form>

              {/* Dedicated Organizer Quick Access Card */}
              <div className="border-t border-stone-200 dark:border-stone-800 pt-6 space-y-3 font-mono">
                <div className="flex items-center gap-2">
                  <Zap className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                  <span className="text-xs font-bold text-stone-900 dark:text-stone-100 uppercase tracking-wider">
                    Organizer Quick Access via Tezos ID
                  </span>
                </div>
                <p className="text-[11px] text-stone-500 font-sans">
                  Accredited faculty organizers can enter their authorized Tezos public key hash (`tz1...`) for instant access without a password.
                </p>

                {tezosErrorMessage && (
                  <div className="p-2.5 rounded-xs bg-rose-50 dark:bg-rose-950/40 border border-rose-300 dark:border-rose-900 text-rose-900 dark:text-rose-200 text-[11px]">
                    {tezosErrorMessage}
                  </div>
                )}

                <div className="space-y-2">
                  <input
                    type="text"
                    value={tezosAddressInput}
                    onChange={(e) => setTezosAddressInput(e.target.value)}
                    placeholder="e.g. tz1aSkwEkv3Ax2bWZHvCaOKUMcqModq5RMqJ"
                    className="w-full bg-stone-50 dark:bg-stone-950 border border-stone-300 dark:border-stone-800 rounded-xs px-3.5 py-2 text-xs text-stone-900 dark:text-stone-100 focus:outline-none focus:border-stone-900 dark:focus:border-stone-100 transition-colors font-mono"
                  />

                  <div className="flex flex-col sm:flex-row gap-2">
                    <button
                      type="button"
                      disabled={isTezosLoading}
                      onClick={() => handleTezosQuickLogin()}
                      className="flex-1 py-2.5 px-3 rounded-xs bg-amber-700 hover:bg-amber-800 text-amber-50 font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      {isTezosLoading ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span>VERIFYING TEZOS ID...</span>
                        </>
                      ) : (
                        <>
                          <ShieldCheck className="w-3.5 h-3.5" />
                          <span>Enter as Faculty Organizer</span>
                        </>
                      )}
                    </button>

                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setTezosAddressInput(SAMPLE_ORGANIZER_ADDRESS);
                          handleTezosQuickLogin(SAMPLE_ORGANIZER_ADDRESS);
                        }}
                        className="py-2.5 px-3 rounded-xs border border-amber-600/40 bg-amber-50/50 dark:bg-amber-950/20 text-amber-800 dark:text-amber-300 text-[11px] font-mono hover:bg-amber-100 dark:hover:bg-amber-950/40 transition-colors"
                        title="Quick Fill Lead Organizer tz1aSkw...RMqJ"
                      >
                        ⚡ Specimen 1: tz1aSk...RMqJ
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const newAuthWallet = 'tz1eJkP2sfw6LnrvijT4u3UcBXKpJxXmAQxw';
                          setTezosAddressInput(newAuthWallet);
                          handleTezosQuickLogin(newAuthWallet);
                        }}
                        className="py-2.5 px-3 rounded-xs border border-amber-600/40 bg-amber-50/50 dark:bg-amber-950/20 text-amber-800 dark:text-amber-300 text-[11px] font-mono hover:bg-amber-100 dark:hover:bg-amber-950/40 transition-colors"
                        title="Quick Fill Authorized Organizer tz1eJkP...AQxw"
                      >
                        ⚡ Council Wallet: tz1eJk...AQxw
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <div className="text-center pt-2 text-xs font-sans text-stone-500 border-t border-stone-200 dark:border-stone-800">
                <span>Not registered in the institutional cadre? </span>
                <button
                  type="button"
                  onClick={() => setAuthMode('SIGNUP')}
                  className="text-stone-900 dark:text-stone-100 font-bold underline font-mono text-[11px]"
                >
                  [ ENROLL CADRE ACCOUNT ]
                </button>
              </div>
            </div>
          ) : (
            /* TAB 2: SIGN UP */
            <form onSubmit={handleSignUp} className="space-y-4 font-mono">
              <div className="space-y-1 pb-1 border-b border-stone-200 dark:border-stone-800">
                <h2 className="text-xl font-display-serif font-bold text-stone-900 dark:text-stone-100">
                  Cadre Enrollment Registry
                </h2>
                <p className="text-xs text-stone-500 font-sans">
                  Register as a Student using your Student ID, or as a Faculty Organizer using your Department Email.
                </p>
              </div>

              {/* Role Selection Tabs */}
              <div>
                <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-2 uppercase tracking-wider">
                  Select Institutional Cadre *
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setRole('STUDENT')}
                    className={`p-3 rounded-xs border text-left transition-all ${
                      role === 'STUDENT'
                        ? 'border-emerald-600 bg-emerald-50/60 dark:bg-emerald-950/30 text-stone-950 dark:text-stone-50 ring-1 ring-emerald-600'
                        : 'border-stone-300 dark:border-stone-800 bg-stone-50/50 dark:bg-stone-950/50 text-stone-600 dark:text-stone-400'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <GraduationCap className="w-4 h-4 text-emerald-700 dark:text-emerald-400" />
                      <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400">[ STUDENT ACCOUNT ]</span>
                    </div>
                    <div className="text-xs font-bold font-display-serif">Student Researcher</div>
                    <div className="text-[10px] text-stone-500 font-sans">Requires Student ID &bull; Student Desk</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setRole('ORGANIZER')}
                    className={`p-3 rounded-xs border text-left transition-all ${
                      role === 'ORGANIZER'
                        ? 'border-amber-600 bg-amber-50/60 dark:bg-amber-950/30 text-stone-950 dark:text-stone-50 ring-1 ring-amber-600'
                        : 'border-stone-300 dark:border-stone-800 bg-stone-50/50 dark:bg-stone-950/50 text-stone-600 dark:text-stone-400'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <ShieldCheck className="w-4 h-4 text-amber-700 dark:text-amber-400" />
                      <span className="text-[10px] font-bold text-amber-700 dark:text-amber-400">[ ORGANIZER ACCOUNT ]</span>
                    </div>
                    <div className="text-xs font-bold font-display-serif">Faculty Organizer</div>
                    <div className="text-[10px] text-stone-500 font-sans">Requires Department Email &bull; Council Forum</div>
                  </button>
                </div>
              </div>

              {/* Explicit Student ID input when Student cadre is chosen */}
              {role === 'STUDENT' && (
                <div className="p-3.5 rounded-xs bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-300 dark:border-emerald-800/60 space-y-2">
                  <label className="block text-xs font-bold text-emerald-900 dark:text-emerald-200 uppercase tracking-wider flex items-center gap-1.5">
                    <GraduationCap className="w-3.5 h-3.5 text-emerald-700 dark:text-emerald-400" />
                    <span>Student ID / Matriculation Number * (Defines Student Account)</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={studentId}
                    onChange={(e) => setStudentId(e.target.value)}
                    placeholder="e.g. STU-2026-8941"
                    className="w-full bg-white dark:bg-stone-950 border border-emerald-300 dark:border-emerald-700 rounded-xs px-4 py-2.5 text-xs text-stone-900 dark:text-stone-100 focus:outline-none focus:border-emerald-600 transition-colors font-mono font-bold"
                  />
                  <span className="text-[10px] text-emerald-700 dark:text-emerald-300 font-sans block">
                    Accounts registered with a Student ID are strictly created as <strong>STUDENT</strong> accounts with access to the Student Desk.
                  </span>
                </div>
              )}

              {/* Explicit Department input when Organizer cadre is chosen */}
              {role === 'ORGANIZER' && (
                <div className="p-3.5 rounded-xs bg-amber-50/50 dark:bg-amber-950/20 border border-amber-300 dark:border-amber-800/60 space-y-2">
                  <label className="block text-xs font-bold text-amber-900 dark:text-amber-200 uppercase tracking-wider flex items-center gap-1.5">
                    <Building2 className="w-3.5 h-3.5 text-amber-700 dark:text-amber-400" />
                    <span>Academic Department / Council Division * (Defines Organizer Account)</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                    placeholder="e.g. School of Environmental Science & Sustainability"
                    className="w-full bg-white dark:bg-stone-950 border border-amber-300 dark:border-amber-700 rounded-xs px-4 py-2.5 text-xs text-stone-900 dark:text-stone-100 focus:outline-none focus:border-amber-600 transition-colors font-sans"
                  />
                  <span className="text-[10px] text-amber-700 dark:text-amber-300 font-sans block">
                    Faculty organizer accounts possess on-chain ratification authorization for the Council Forum.
                  </span>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-1.5 uppercase tracking-wider flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-stone-400" />
                  <span>Full Legal / Academic Name *</span>
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={role === 'STUDENT' ? 'e.g. Alex Rivera' : 'e.g. Dr. Aris Thorne'}
                  className="w-full bg-stone-50 dark:bg-stone-950 border border-stone-300 dark:border-stone-800 rounded-xs px-4 py-2.5 text-xs text-stone-900 dark:text-stone-100 focus:outline-none focus:border-stone-900 dark:focus:border-stone-100 transition-colors font-sans"
                />
              </div>

              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-1.5 uppercase tracking-wider flex items-center gap-1.5">
                    <Mail className="w-3.5 h-3.5 text-stone-400" />
                    <span>{role === 'STUDENT' ? 'Student Email *' : 'Organizer Faculty Email *'}</span>
                  </label>
                  <input
                    type="email"
                    required
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    placeholder={role === 'STUDENT' ? 'student@campus.edu' : 'faculty.organizer@campus.edu'}
                    className="w-full bg-stone-50 dark:bg-stone-950 border border-stone-300 dark:border-stone-800 rounded-xs px-4 py-2.5 text-xs text-stone-900 dark:text-stone-100 focus:outline-none focus:border-stone-900 dark:focus:border-stone-100 transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-1.5 uppercase tracking-wider flex items-center gap-1.5">
                    <KeyRound className="w-3.5 h-3.5 text-stone-400" />
                    <span>Passphrase (min 6) *</span>
                  </label>
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-stone-50 dark:bg-stone-950 border border-stone-300 dark:border-stone-800 rounded-xs px-4 py-2.5 text-xs text-stone-900 dark:text-stone-100 focus:outline-none focus:border-stone-900 dark:focus:border-stone-100 transition-colors"
                  />
                </div>
              </div>

              {/* Optional Wallet */}
              <div>
                <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-1.5 uppercase tracking-wider flex items-center gap-1.5">
                  <Wallet className="w-3.5 h-3.5 text-stone-400" />
                  <span>Tezos Address (Optional)</span>
                </label>
                <input
                  type="text"
                  value={walletAddress}
                  onChange={(e) => setWalletAddress(e.target.value)}
                  placeholder="e.g. tz1... (leave blank to auto-generate)"
                  className="w-full bg-stone-50 dark:bg-stone-950 border border-stone-300 dark:border-stone-800 rounded-xs px-4 py-2.5 text-[11px] text-stone-900 dark:text-stone-100 focus:outline-none focus:border-stone-900 dark:focus:border-stone-100 transition-colors"
                />
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-3.5 px-4 rounded-xs bg-stone-900 hover:bg-stone-800 dark:bg-stone-100 dark:hover:bg-white text-stone-50 dark:text-stone-950 font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 shadow-sm disabled:opacity-50"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>INITIALIZING {role} RECORD...</span>
                    </>
                  ) : (
                    <>
                      <span>[ COMPLETE {role} ENROLLMENT ]</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>

              <div className="text-center pt-2 text-xs font-sans text-stone-500">
                <span>Already enrolled in the registry? </span>
                <button
                  type="button"
                  onClick={() => setAuthMode('SIGNIN')}
                  className="text-stone-900 dark:text-stone-100 font-bold underline font-mono text-[11px]"
                >
                  [ SIGN IN TO DOSSIER ]
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Informational Sidebar (Editorial Specimen Card) */}
        <div className="md:col-span-2 space-y-4 font-mono text-xs">
          <div className="bg-white dark:bg-[#141312] border border-stone-300 dark:border-stone-800 rounded-xs p-6 space-y-4 shadow-xs">
            <div className="text-[10px] text-stone-500 uppercase tracking-widest border-b border-stone-200 dark:border-stone-800 pb-2">
              [ SPECIFICATION // {role === 'STUDENT' ? 'STUDENT CADRE' : 'FACULTY ORGANIZER'} ]
            </div>
            <h3 className="text-base font-display-serif font-bold text-stone-900 dark:text-stone-100">
              {role === 'STUDENT' ? 'Student Privileges & Scope' : 'Organizer Powers & Protocol Governance'}
            </h3>
            <ul className="space-y-3 text-stone-600 dark:text-stone-400 font-sans leading-relaxed">
              {role === 'STUDENT' ? (
                <>
                  <li className="flex items-start gap-2">
                    <span className="font-mono text-emerald-700 font-bold">&bull;</span>
                    <span>Sign up with your Student ID to open your dedicated <strong>Student Desk</strong>.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="font-mono text-emerald-700 font-bold">&bull;</span>
                    <span>Direct submission of empirical evidence with instant SHA-256 fingerprinting.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="font-mono text-emerald-700 font-bold">&bull;</span>
                    <span>GreenAI neural vision automatically counts saplings and estimates recycling mass.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="font-mono text-emerald-700 font-bold">&bull;</span>
                    <span>Verifiable public QR badges anchored to real Tezos blockchain blocks.</span>
                  </li>
                </>
              ) : (
                <>
                  <li className="flex items-start gap-2">
                    <span className="font-mono text-amber-700 font-bold">&bull;</span>
                    <span>Sign up with Faculty Email to access the <strong>Council Forum</strong>.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="font-mono text-amber-700 font-bold">&bull;</span>
                    <span>Quick Access using your accredited Tezos ID (`tz1...`) without passwords.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="font-mono text-amber-700 font-bold">&bull;</span>
                    <span>Ratify or reject submissions on-chain via Tezos smart contract.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="font-mono text-amber-700 font-bold">&bull;</span>
                    <span>Strict mathematical zero self-approval rule prevents review tampering.</span>
                  </li>
                </>
              )}
            </ul>
          </div>

          {/* Direct Beacon Option */}
          <div className="bg-stone-100/70 dark:bg-stone-950/70 border border-stone-300 dark:border-stone-800 rounded-xs p-5 space-y-2.5">
            <div className="text-[10px] text-stone-500 uppercase tracking-widest font-bold">
              [ WEB3 BEACON WALLET ]
            </div>
            <p className="text-[11px] text-stone-600 dark:text-stone-400 font-sans leading-relaxed">
              Prefer authenticating with your Temple, Kukai, or Beacon browser wallet?
            </p>
            <button
              type="button"
              onClick={() => connectWallet(role)}
              className="w-full py-2.5 px-3 rounded-xs border border-stone-400 dark:border-stone-700 bg-white dark:bg-stone-900 text-stone-900 dark:text-stone-100 font-mono text-[11px] uppercase tracking-wider font-bold transition-colors hover:border-stone-700"
            >
              Connect Temple / Kukai Wallet
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
