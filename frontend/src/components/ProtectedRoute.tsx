import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useWallet } from '../context/WalletContext';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: 'STUDENT' | 'ORGANIZER';
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, requiredRole }) => {
  const { wallet } = useWallet();
  const location = useLocation();

  // If not logged in, force redirect to login screen
  if (!wallet.isConnected || wallet.role === 'GUEST' || !wallet.address) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }

  // If a specific role is required (e.g. Organizer Dashboard)
  if (requiredRole && wallet.role !== requiredRole) {
    if (wallet.role === 'STUDENT') {
      return <Navigate to="/student" replace />;
    }
    if (wallet.role === 'ORGANIZER') {
      return <Navigate to="/organizer" replace />;
    }
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};
