import { BrowserRouter as Router, Routes, Route, Navigate, Link } from 'react-router-dom';
import { WalletProvider, useWallet } from './context/WalletContext';
import { ThemeProvider } from './context/ThemeContext';
import { Navbar } from './components/Navbar';
import { ProtectedRoute } from './components/ProtectedRoute';
import { LoginPage } from './pages/LoginPage';
import { LandingPage } from './pages/LandingPage';
import { StudentDashboard } from './pages/StudentDashboard';
import { SubmitActivityPage } from './pages/SubmitActivityPage';
import { OrganizerDashboard } from './pages/OrganizerDashboard';
import { ActivityDetailsPage } from './pages/ActivityDetailsPage';
import { ActivityHistoryPage } from './pages/ActivityHistoryPage';
import { PublicVerifyPage } from './pages/PublicVerifyPage';
import { ExternalLink } from 'lucide-react';

function DashboardRedirect() {
  const { wallet } = useWallet();
  if (!wallet.isConnected || wallet.role === 'GUEST') {
    return <Navigate to="/login" replace />;
  }
  if (wallet.role === 'ORGANIZER') {
    return <Navigate to="/organizer" replace />;
  }
  if (wallet.role === 'STUDENT') {
    return <Navigate to="/student" replace />;
  }
  return <Navigate to="/login" replace />;
}

export function App() {
  return (
    <ThemeProvider>
      <WalletProvider>
        <Router>
          <div className="min-h-screen bg-[#FAF7F2] text-stone-900 dark:bg-[#0E0D0C] dark:text-stone-100 flex flex-col font-sans transition-colors duration-200 selection:bg-emerald-900 selection:text-emerald-100 paper-grid">
            <Navbar />

            <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 pt-6 pb-12">
              <Routes>
                {/* Public Gateway */}
                <Route path="/" element={<LandingPage />} />
                <Route path="/login" element={<LoginPage />} />
                <Route path="/signup" element={<Navigate to="/login?mode=signup" replace />} />
                <Route path="/verify" element={<PublicVerifyPage />} />
                <Route path="/activity/:id" element={<ActivityDetailsPage />} />

                {/* Dashboard Dispatcher */}
                <Route
                  path="/dashboard"
                  element={
                    <ProtectedRoute>
                      <DashboardRedirect />
                    </ProtectedRoute>
                  }
                />

                {/* Student Protected Routes */}
                <Route
                  path="/student"
                  element={
                    <ProtectedRoute requiredRole="STUDENT">
                      <StudentDashboard />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/submit"
                  element={
                    <ProtectedRoute requiredRole="STUDENT">
                      <SubmitActivityPage />
                    </ProtectedRoute>
                  }
                />

                {/* Organizer Protected Routes */}
                <Route
                  path="/organizer"
                  element={
                    <ProtectedRoute requiredRole="ORGANIZER">
                      <OrganizerDashboard />
                    </ProtectedRoute>
                  }
                />

                {/* Common Protected Features */}
                <Route
                  path="/history"
                  element={
                    <ProtectedRoute>
                      <ActivityHistoryPage />
                    </ProtectedRoute>
                  }
                />

                {/* Fallback to Home / Landing */}
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </main>

            {/* Editorial Colophon Footer */}
            <footer className="border-t border-stone-300 dark:border-stone-800 bg-[#F5F2EA]/90 dark:bg-[#121110]/90 py-8 mt-auto text-xs font-mono text-stone-500 dark:text-stone-400 transition-colors duration-200">
              <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  <span className="font-serif-editorial text-base font-bold text-stone-900 dark:text-stone-100">GREENTRACE 2.0</span>
                  <span>//</span>
                  <span className="uppercase text-[11px]">The Institutional Ecological Chronicle</span>
                </div>

                <div className="flex items-center gap-6 text-[11px] uppercase tracking-wider">
                  <a
                    href="https://teztnets.com"
                    target="_blank"
                    rel="noreferrer"
                    className="hover:text-stone-900 dark:hover:text-stone-100 transition-colors flex items-center gap-1"
                  >
                    <span>Tezos Shadownet</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                  <Link to="/verify" className="hover:text-stone-900 dark:hover:text-stone-100 transition-colors">
                    Public QR Verification
                  </Link>
                  <Link to="/login" className="hover:text-stone-900 dark:hover:text-stone-100 transition-colors">
                    Portal Sign In
                  </Link>
                </div>
              </div>
            </footer>
          </div>
        </Router>
      </WalletProvider>
    </ThemeProvider>
  );
}

export default App;
