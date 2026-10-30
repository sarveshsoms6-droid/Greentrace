import { BrowserRouter as Router, Routes, Route, Navigate, Link } from 'react-router-dom';
import { WalletProvider, useWallet } from './context/WalletContext';
import { ThemeProvider } from './context/ThemeContext';
import { Navbar } from './components/Navbar';
import { ProtectedRoute } from './components/ProtectedRoute';
import { LoginPage } from './pages/LoginPage';
import { StudentDashboard } from './pages/StudentDashboard';
import { SubmitActivityPage } from './pages/SubmitActivityPage';
import { OrganizerDashboard } from './pages/OrganizerDashboard';
import { ActivityDetailsPage } from './pages/ActivityDetailsPage';
import { ActivityHistoryPage } from './pages/ActivityHistoryPage';
import { PublicVerifyPage } from './pages/PublicVerifyPage';
import { Leaf, ExternalLink } from 'lucide-react';

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

function HomeRedirect() {
  const { wallet } = useWallet();
  if (wallet.isConnected && wallet.role !== 'GUEST') {
    return <Navigate to="/dashboard" replace />;
  }
  return <Navigate to="/login" replace />;
}

export function App() {
  return (
    <ThemeProvider>
      <WalletProvider>
        <Router>
          <div className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100 flex flex-col font-sans transition-colors duration-200 selection:bg-emerald-500 selection:text-slate-950">
            <Navbar />

            <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 pt-6 pb-12">
              <Routes>
                {/* Public Gateway */}
                <Route path="/" element={<HomeRedirect />} />
                <Route path="/login" element={<LoginPage />} />

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
                <Route
                  path="/activity/:id"
                  element={
                    <ProtectedRoute>
                      <ActivityDetailsPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/verify"
                  element={
                    <ProtectedRoute>
                      <PublicVerifyPage />
                    </ProtectedRoute>
                  }
                />

                {/* Fallback to Home / Login */}
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </main>

            {/* Footer */}
            <footer className="border-t border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-950/80 py-8 mt-auto text-xs text-slate-500 dark:text-slate-400 transition-colors duration-200">
              <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  <Leaf className="w-4 h-4 text-emerald-500 dark:text-emerald-400" />
                  <span className="font-semibold text-slate-800 dark:text-slate-200">GreenTrace 2.0</span>
                  <span>— Tezos Campus Sustainability Verification</span>
                </div>

                <div className="flex items-center gap-6">
                  <a
                    href="https://teztnets.com"
                    target="_blank"
                    rel="noreferrer"
                    className="hover:text-slate-900 dark:hover:text-slate-200 transition-colors flex items-center gap-1"
                  >
                    <span>Tezos Shadownet</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                  <Link to="/verify" className="hover:text-slate-900 dark:hover:text-slate-200 transition-colors">
                    Public QR Verification
                  </Link>
                  <Link to="/login" className="hover:text-slate-900 dark:hover:text-slate-200 transition-colors">
                    Campus Sign In
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
