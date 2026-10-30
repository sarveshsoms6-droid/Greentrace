import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useWallet } from '../hooks/useWallet';
import { useTheme } from '../context/ThemeContext';
import { 
  ShieldCheck, 
  LogOut, 
  AlertTriangle,
  QrCode,
  User,
  UserPlus,
  X,
  Sun,
  Moon,
  Activity
} from 'lucide-react';

export const Navbar: React.FC = () => {
  const { wallet, disconnectWallet, activities } = useWallet();
  const { theme, toggleTheme } = useTheme();
  const location = useLocation();
  const navigate = useNavigate();
  const [showRoleMenu, setShowRoleMenu] = useState(false);

  const pendingCount = activities.filter((a) => a.status === 'SUBMITTED').length;

  const handleLogout = async () => {
    setShowRoleMenu(false);
    await disconnectWallet();
    navigate('/login');
  };

  const isActive = (path: string) => {
    return location.pathname === path
      ? 'text-emerald-800 dark:text-emerald-300 border-b-2 border-emerald-800 dark:border-emerald-400 font-bold'
      : 'text-stone-600 dark:text-stone-400 hover:text-stone-950 dark:hover:text-stone-100 transition-colors';
  };

  return (
    <header className="sticky top-0 z-50 bg-[#FAF7F2]/95 dark:bg-[#0E0D0C]/95 backdrop-blur-md border-b border-stone-300/80 dark:border-stone-800 transition-colors duration-200">
      {/* Wallet Error Alert Banner */}
      {wallet.error && (
        <div className="bg-rose-50 dark:bg-rose-950/90 border-b border-rose-300 dark:border-rose-900 text-rose-900 dark:text-rose-200 text-xs py-2 px-4 flex items-center justify-between gap-2 shadow-sm font-mono">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
            <span>
              <strong>[ PROTOCOL NOTICE ]</strong> {wallet.error}
            </span>
          </div>
          <button
            onClick={() => {}}
            className="text-rose-700 dark:text-rose-300 hover:text-rose-950 dark:hover:text-white p-1 rounded"
            title="Dismiss error"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Top Editorial Archival Strip */}
      <div className="border-b border-stone-200/90 dark:border-stone-800/80 py-1 px-4 sm:px-8 text-[11px] font-mono tracking-wider flex items-center justify-between text-stone-500 dark:text-stone-400 select-none bg-stone-100/60 dark:bg-stone-900/40">
        <div className="flex items-center gap-3">
          <span className="font-bold text-stone-800 dark:text-stone-200">[ ISSUE NO. 2026.IV ]</span>
          <span className="hidden md:inline text-stone-400 dark:text-stone-600">|</span>
          <span className="hidden md:inline uppercase">The Institutional Decentralized Archive</span>
        </div>
        <div className="flex items-center gap-4 text-[10px]">
          <span className="flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 dark:bg-emerald-400 animate-pulse"></span>
            <span>TEZOS SHADOWNET // SYNCHRONIZED</span>
          </span>
          <span className="hidden sm:inline text-stone-400 dark:text-stone-600">|</span>
          <span className="hidden sm:inline">STATE ENGINE: SMARTPY V2</span>
        </div>
      </div>

      {/* Main Masthead Header */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-20">
          {/* Masthead Logo */}
          <Link to="/" className="flex items-center gap-3 group">
            <div className="w-10 h-10 rounded-sm bg-stone-900 dark:bg-stone-100 text-stone-50 dark:text-stone-950 flex items-center justify-center font-serif-editorial text-2xl font-bold border border-stone-700 dark:border-stone-300 group-hover:bg-emerald-900 dark:group-hover:bg-emerald-300 group-hover:text-emerald-100 dark:group-hover:text-stone-950 transition-colors shadow-sm">
              GT
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-display-serif text-xl sm:text-2xl font-bold text-stone-950 dark:text-stone-100 tracking-tight">
                  GREENTRACE
                </span>
                <span className="text-[10px] font-mono tracking-widest px-1.5 py-0.5 border border-stone-400 dark:border-stone-700 text-stone-700 dark:text-stone-300 rounded-xs uppercase">
                  VER. 2.0
                </span>
              </div>
              <p className="text-[10px] font-mono tracking-widest text-stone-500 dark:text-stone-400 uppercase">
                Decentralized Ecological Chronicle
              </p>
            </div>
          </Link>

          {/* Navigation Links (Visible when authenticated) */}
          {wallet.isConnected && wallet.role !== 'GUEST' && (
            <nav className="hidden md:flex items-center gap-6 text-xs font-mono tracking-wider">
              {wallet.role === 'STUDENT' && (
                <>
                  <Link to="/student" className={`py-1.5 flex items-center gap-1.5 ${isActive('/student')}`}>
                    <span>[ 01 ]</span>
                    <span className="font-sans font-semibold">STUDENT DESK</span>
                  </Link>
                  <Link to="/submit" className={`py-1.5 flex items-center gap-1.5 ${isActive('/submit')}`}>
                    <span>[ 02 ]</span>
                    <span className="font-sans font-semibold">DEPOSIT PROOF</span>
                  </Link>
                </>
              )}

              {wallet.role === 'ORGANIZER' && (
                <>
                  <Link to="/organizer" className={`py-1.5 flex items-center gap-1.5 ${isActive('/organizer')}`}>
                    <span>[ 01 ]</span>
                    <span className="font-sans font-semibold">ORGANIZER FORUM</span>
                  </Link>
                  <Link to="/organizer" className={`py-1.5 flex items-center gap-1.5 ${isActive('/organizer')}`}>
                    <span>[ 02 ]</span>
                    <span className="font-sans font-semibold">RATIFICATION QUEUE</span>
                    {pendingCount > 0 && (
                      <span className="bg-amber-600 dark:bg-amber-500 text-stone-950 text-[10px] px-1.5 py-0.2 rounded-xs font-mono font-bold">
                        {pendingCount}
                      </span>
                    )}
                  </Link>
                </>
              )}

              <Link to="/history" className={`py-1.5 flex items-center gap-1.5 ${isActive('/history')}`}>
                <Activity className="w-3.5 h-3.5 text-stone-400" />
                <span className="font-sans font-semibold">CHRONICLE ARCHIVE</span>
              </Link>

              <Link to="/verify" className={`py-1.5 flex items-center gap-1.5 ${isActive('/verify')}`}>
                <QrCode className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                <span className="font-sans font-semibold">PUBLIC QR SCAN</span>
              </Link>
            </nav>
          )}

          {/* Right Controls */}
          <div className="flex items-center gap-3">
            {/* Theme Toggle Button (Editorial Stamp Style) */}
            <button
              onClick={toggleTheme}
              className="p-2 rounded-sm border border-stone-300 dark:border-stone-800 hover:border-stone-500 dark:hover:border-stone-600 bg-stone-100/80 dark:bg-stone-900/80 text-stone-700 dark:text-stone-300 transition-colors"
              title={theme === 'dark' ? 'Switch to Light Parchment' : 'Switch to Archival Dark'}
              aria-label="Toggle Theme"
            >
              {theme === 'dark' ? (
                <Sun className="w-4 h-4 text-amber-400" />
              ) : (
                <Moon className="w-4 h-4 text-stone-800" />
              )}
            </button>

            {wallet.isConnected && wallet.role !== 'GUEST' ? (
              <>
                {/* Account / Dossier Badge */}
                <div className="relative">
                  <button
                    onClick={() => setShowRoleMenu(!showRoleMenu)}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-sm border border-stone-300 dark:border-stone-800 bg-stone-100/90 dark:bg-stone-900/90 text-stone-900 dark:text-stone-100 text-xs font-mono hover:border-stone-500 transition-colors"
                    title="Account credentials"
                  >
                    {wallet.role === 'STUDENT' ? (
                      <>
                        <User className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                        <span className="font-bold tracking-wider">
                          CADRE: {wallet.userName ? wallet.userName.split(' ')[0].toUpperCase() : 'STUDENT'}
                        </span>
                      </>
                    ) : (
                      <>
                        <ShieldCheck className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                        <span className="font-bold tracking-wider">
                          ORGANIZER: {wallet.userName ? wallet.userName.split(' ')[0].toUpperCase() : 'COUNCIL'}
                        </span>
                      </>
                    )}
                  </button>

                  {showRoleMenu && (
                    <div className="absolute right-0 mt-2 w-80 rounded-sm bg-[#FAF7F2] dark:bg-[#141312] border border-stone-400 dark:border-stone-700 shadow-2xl py-3 z-50 text-stone-900 dark:text-stone-100 animate-fadeIn font-mono text-xs">
                      <div className="px-4 py-2 border-b border-stone-300 dark:border-stone-800 text-[10px] text-stone-500 dark:text-stone-400 uppercase tracking-widest">
                        Credentials Dossier
                      </div>
                      <div className="px-4 py-3 space-y-1.5">
                        <div className="text-sm font-serif-editorial font-bold text-stone-900 dark:text-stone-100">
                          {wallet.userName || 'Verified Participant'}
                        </div>
                        {wallet.userEmail && (
                          <div className="text-[11px] text-stone-600 dark:text-stone-400">
                            {wallet.userEmail}
                          </div>
                        )}
                        <div className="text-[10px] text-stone-500 break-all pt-1 border-t border-stone-200 dark:border-stone-800/80">
                          {wallet.address}
                        </div>
                      </div>

                      <div className="px-3 pt-2 border-t border-stone-300 dark:border-stone-800">
                        <button
                          onClick={handleLogout}
                          className="w-full text-left px-3 py-2 text-xs text-rose-700 dark:text-rose-400 hover:bg-rose-500/10 rounded-xs flex items-center justify-between transition-colors font-bold"
                        >
                          <span>[ DISENGAGE SESSION ]</span>
                          <LogOut className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Direct Logout Button */}
                <button
                  onClick={handleLogout}
                  className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-sm border border-rose-300 dark:border-rose-900/60 bg-rose-50/60 hover:bg-rose-100 dark:bg-rose-950/20 dark:hover:bg-rose-900/40 text-rose-800 dark:text-rose-300 text-xs font-mono transition-colors"
                  title="Sign out and return to portal"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>LOG OUT</span>
                </button>
              </>
            ) : (
              /* Public / Logged Out Controls */
              <div className="flex items-center gap-2 font-mono">
                <Link
                  to="/verify"
                  className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-sm border border-stone-300 dark:border-stone-800 hover:border-stone-500 dark:hover:border-stone-600 text-stone-700 dark:text-stone-300 text-xs font-semibold transition-colors"
                >
                  <QrCode className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  <span>PUBLIC VERIFY</span>
                </Link>
                <Link
                  to="/login?mode=signin"
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-sm border border-stone-300 dark:border-stone-800 hover:bg-stone-200/50 dark:hover:bg-stone-800/50 text-stone-800 dark:text-stone-200 text-xs font-semibold transition-colors"
                >
                  <User className="w-3.5 h-3.5" />
                  <span>SIGN IN</span>
                </Link>
                <Link
                  to="/login?mode=signup"
                  className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-sm bg-stone-900 hover:bg-stone-800 dark:bg-stone-100 dark:hover:bg-white text-stone-50 dark:text-stone-950 font-bold text-xs shadow-sm transition-all hover:translate-y-[-1px]"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>ENROLL NOW</span>
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
