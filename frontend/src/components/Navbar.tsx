import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useWallet } from '../hooks/useWallet';
import { useTheme } from '../context/ThemeContext';
import { 
  Leaf, 
  ShieldCheck, 
  LogOut, 
  CheckCircle2, 
  AlertTriangle,
  QrCode,
  User,
  Users,
  X,
  Sun,
  Moon
} from 'lucide-react';

export const Navbar: React.FC = () => {
  const { wallet, disconnectWallet, switchRole, clearError, activities } = useWallet();
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
      ? 'text-emerald-600 dark:text-emerald-400 border-b-2 border-emerald-500 font-semibold'
      : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-colors';
  };

  return (
    <header className="sticky top-0 z-50 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 transition-colors duration-200">
      {/* Wallet Error Alert Banner */}
      {wallet.error && (
        <div className="bg-rose-50 dark:bg-rose-950/90 border-b border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200 text-xs py-2 px-4 flex items-center justify-between gap-2 shadow-sm animate-fadeIn">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-500 dark:text-rose-400 shrink-0" />
            <span>
              <strong>Wallet Notice:</strong> {wallet.error}
            </span>
          </div>
          <button
            onClick={clearError}
            className="text-rose-600 dark:text-rose-300 hover:text-rose-900 dark:hover:text-white p-1 rounded hover:bg-rose-100 dark:hover:bg-rose-900/50"
            title="Dismiss error"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Protocol Limitation Banner */}
      <div className="bg-amber-50 dark:bg-amber-950/60 border-b border-amber-200 dark:border-amber-800/40 text-amber-800 dark:text-amber-200 text-xs py-1.5 px-4 text-center flex items-center justify-center gap-2">
        <AlertTriangle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
        <span>
          <strong>Limitation Notice:</strong> Blockchain proves recorded cryptographic signatures and contract state, not that a physical environmental activity definitely occurred.
        </span>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2.5 group">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-400 flex items-center justify-center shadow-md shadow-emerald-500/20 group-hover:scale-105 transition-transform">
              <Leaf className="w-5 h-5 text-slate-950" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-lg text-slate-900 dark:text-white tracking-tight">GreenTrace</span>
                <span className="text-[10px] bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 px-1.5 py-0.5 rounded font-mono font-semibold">
                  2.0
                </span>
              </div>
              <p className="text-[10px] text-slate-500 dark:text-slate-400">Tezos Campus Sustainability</p>
            </div>
          </Link>

          {/* Navigation Links - ONLY VISIBLE WHEN CONNECTED */}
          {wallet.isConnected && wallet.role !== 'GUEST' && (
            <nav className="hidden md:flex items-center gap-6 text-sm font-medium">
              {wallet.role === 'STUDENT' && (
                <>
                  <Link to="/student" className={`py-2 ${isActive('/student')}`}>
                    Student Dashboard
                  </Link>
                  <Link to="/submit" className={`py-2 ${isActive('/submit')}`}>
                    Submit Activity
                  </Link>
                </>
              )}

              {wallet.role === 'ORGANIZER' && (
                <>
                  <Link to="/organizer" className={`py-2 ${isActive('/organizer')}`}>
                    Organizer Dashboard
                  </Link>
                  <Link to="/organizer" className={`py-2 flex items-center gap-1.5 ${isActive('/organizer')}`}>
                    <span>Organizer Queue</span>
                    {pendingCount > 0 && (
                      <span className="bg-amber-500 text-slate-950 text-xs px-1.5 py-0.2 rounded-full font-bold">
                        {pendingCount}
                      </span>
                    )}
                  </Link>
                </>
              )}

              <Link to="/history" className={`py-2 ${isActive('/history')}`}>
                Activity History
              </Link>

              <Link to="/verify" className={`py-2 flex items-center gap-1 ${isActive('/verify')}`}>
                <QrCode className="w-4 h-4 text-emerald-500 dark:text-emerald-400" />
                <span>Public QR Verify</span>
              </Link>
            </nav>
          )}

          {/* Right Side Controls */}
          <div className="flex items-center gap-2.5 sm:gap-3">
            {/* Dark / Light Mode Toggle Button */}
            <button
              onClick={toggleTheme}
              className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 transition-colors"
              title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
              aria-label="Toggle Theme"
            >
              {theme === 'dark' ? (
                <Sun className="w-4 h-4 text-amber-400" />
              ) : (
                <Moon className="w-4 h-4 text-indigo-600" />
              )}
            </button>

            {wallet.isConnected && wallet.role !== 'GUEST' ? (
              <>
                {/* Network indicator */}
                <div className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[11px] text-slate-600 dark:text-slate-300">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                  <span>{wallet.network}</span>
                </div>

                {/* Role / Account Menu */}
                <div className="relative">
                  <button
                    onClick={() => setShowRoleMenu(!showRoleMenu)}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 transition-colors"
                    title="Account options"
                  >
                    {wallet.role === 'STUDENT' ? (
                      <>
                        <User className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                        <span className="font-semibold">{wallet.userName ? wallet.userName.split(' ')[0] : 'Student'}</span>
                      </>
                    ) : wallet.role === 'ORGANIZER' ? (
                      <>
                        <ShieldCheck className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                        <span className="font-semibold">{wallet.userName ? wallet.userName.split(' ')[0] : 'Organizer'}</span>
                      </>
                    ) : (
                      <>
                        <Users className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
                        <span>Guest</span>
                      </>
                    )}
                  </button>

                  {showRoleMenu && (
                    <div className="absolute right-0 mt-2 w-72 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl py-2 z-50 text-slate-800 dark:text-slate-100 animate-fadeIn">
                      <div className="px-3.5 py-2 text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
                        <span>Active Account</span>
                        <span className="font-mono text-emerald-600 dark:text-emerald-400">{wallet.role}</span>
                      </div>

                      <div className="px-3.5 py-2 text-xs border-b border-slate-100 dark:border-slate-800">
                        <div className="font-semibold text-slate-900 dark:text-white">{wallet.userName || 'Campus User'}</div>
                        <div className="font-mono text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                          {wallet.address || 'No wallet address'}
                        </div>
                      </div>

                      <div className="p-1.5 space-y-1">
                        <button
                          onClick={() => {
                            switchRole('STUDENT');
                            setShowRoleMenu(false);
                            navigate('/student');
                          }}
                          className={`w-full text-left px-3 py-2 text-xs rounded-xl flex items-center justify-between hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors ${
                            wallet.role === 'STUDENT' ? 'text-emerald-600 dark:text-emerald-400 font-semibold bg-emerald-50 dark:bg-emerald-500/10' : 'text-slate-700 dark:text-slate-300'
                          }`}
                        >
                          <div className="flex flex-col">
                            <span className="font-medium">Switch to Student View</span>
                            <span className="text-[10px] text-slate-500 dark:text-slate-400">Alex Rivera (STU-2026-8941)</span>
                          </div>
                          {wallet.role === 'STUDENT' && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />}
                        </button>

                        <button
                          onClick={() => {
                            switchRole('ORGANIZER');
                            setShowRoleMenu(false);
                            navigate('/organizer');
                          }}
                          className={`w-full text-left px-3 py-2 text-xs rounded-xl flex items-center justify-between hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors ${
                            wallet.role === 'ORGANIZER' ? 'text-indigo-600 dark:text-indigo-400 font-semibold bg-indigo-50 dark:bg-indigo-500/10' : 'text-slate-700 dark:text-slate-300'
                          }`}
                        >
                          <div className="flex flex-col">
                            <span className="font-medium">Switch to Organizer View</span>
                            <span className="text-[10px] text-slate-500 dark:text-slate-400">Dr. Aris Thorne (Authorized)</span>
                          </div>
                          {wallet.role === 'ORGANIZER' && <CheckCircle2 className="w-3.5 h-3.5 text-indigo-500" />}
                        </button>
                      </div>

                      <div className="pt-1 border-t border-slate-100 dark:border-slate-800 px-1.5">
                        <button
                          onClick={handleLogout}
                          className="w-full text-left px-3 py-2 text-xs text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-xl flex items-center justify-between transition-colors font-semibold"
                        >
                          <span>Log Out & Return to Login</span>
                          <LogOut className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Direct Logout / Disconnect Button */}
                <button
                  onClick={handleLogout}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-900/50 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs font-semibold transition-colors"
                  title="Log out and return to login screen"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Log Out</span>
                </button>
              </>
            ) : (
              /* Public / Logged Out View: Clean Login Button */
              <Link
                to="/login"
                className="flex items-center gap-1.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold px-4 py-2 rounded-xl text-xs shadow-md shadow-emerald-500/20 transition-all hover:scale-102"
              >
                <User className="w-3.5 h-3.5" />
                <span>Log In</span>
              </Link>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
