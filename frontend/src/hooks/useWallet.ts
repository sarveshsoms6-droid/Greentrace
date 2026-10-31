/**
 * GreenTrace 2.0 - useWallet Hook & Context Provider
 * Handles Beacon wallet connection, account changes, network state, balance,
 * role resolution (STUDENT vs ORGANIZER), and safe error handling.
 */

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { ActivityRecord, UserRole, WalletState, OrganizerPermissionRequest } from '../types';
import {
  getBeaconWallet,
  resolveRole,
  fetchBalance,
  formatWalletError,
  RPC_URL,
  TEZOS_NETWORK_NAME,
} from '../services/tezos';
import {
  SAMPLE_STUDENT_ADDRESS,
  SAMPLE_ORGANIZER_ADDRESS,
} from '../utils/mockData';
import type { UserProfile } from '../services/api';

export interface WalletContextType {
  wallet: WalletState;
  activities: ActivityRecord[];
  organizerRequests: OrganizerPermissionRequest[];
  connectWallet: (preferredRole?: UserRole) => Promise<void>;
  disconnectWallet: () => Promise<void>;
  switchRole: (role: UserRole) => void;
  loginAsStudent: (name: string, studentId?: string, customAddress?: string) => void;
  loginAsOrganizer: (address?: string, name?: string) => void;
  loginWithBackendUser: (user: UserProfile, token: string) => void;
  submitOrganizerPermissionRequest: (
    req: Omit<OrganizerPermissionRequest, 'id' | 'status' | 'requestedAt'>
  ) => OrganizerPermissionRequest;
  approveOrganizerRequest: (id: string) => void;
  rejectOrganizerRequest: (id: string) => void;
  clearError: () => void;
  refreshBalance: () => Promise<void>;
  addActivity: (activity: ActivityRecord) => void;
  reviewActivity: (
    id: string,
    decision: 'APPROVED' | 'REJECTED',
    approver: string,
    rejectionReason?: string,
    txHash?: string
  ) => { success: boolean; error?: string; txHash?: string };
  isDuplicateHash: (hash: string) => boolean;
  getActivityById: (id: string) => ActivityRecord | undefined;
}

const INITIAL_ORGANIZER_REQUESTS: OrganizerPermissionRequest[] = [
  {
    id: 'req-2026-001',
    name: 'Prof. Marcus Vance',
    email: 'm.vance@campus.edu',
    department: 'School of Environmental Engineering',
    walletAddress: 'tz1VSUr8wwNhLAzempoch5d6hLRiTh8Cjcjb',
    reason: 'Faculty advisor overseeing campus carbon offsets and tree planting verification.',
    status: 'PENDING',
    requestedAt: '2026-10-28T14:30:00Z',
  },
];

const WalletContext = createContext<WalletContextType | undefined>(undefined);

export const WalletProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [wallet, setWallet] = useState<WalletState>(() => {
    const savedAuth = localStorage.getItem('greentrace_auth_user');
    if (savedAuth) {
      try {
        const u = JSON.parse(savedAuth);
        if (u && u.email && u.role) {
          const defAddress = u.wallet_address || (u.role === 'ORGANIZER' ? SAMPLE_ORGANIZER_ADDRESS : 'tz1stu' + String(u.id).padStart(4, '0') + '00000000000000000000');
          return {
            isConnected: true,
            address: defAddress,
            role: u.role,
            network: TEZOS_NETWORK_NAME,
            rpcUrl: RPC_URL,
            balance: u.role === 'ORGANIZER' ? '120.00 ꜩ' : '50.00 ꜩ',
            isConnecting: false,
            error: null,
            isSimulated: false,
            userName: u.name,
            userEmail: u.email,
            studentId: u.student_id || undefined,
            department: u.department || undefined,
          };
        }
      } catch {}
    }
    const saved = localStorage.getItem('greentrace_wallet');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        // fallback to default
      }
    }
    return {
      isConnected: false,
      address: null,
      role: 'GUEST',
      network: TEZOS_NETWORK_NAME,
      rpcUrl: RPC_URL,
      balance: null,
      isConnecting: false,
      error: null,
      isSimulated: false,
    };
  });

  const [organizerRequests, setOrganizerRequests] = useState<OrganizerPermissionRequest[]>(() => {
    const saved = localStorage.getItem('greentrace_org_requests');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return INITIAL_ORGANIZER_REQUESTS;
      }
    }
    return INITIAL_ORGANIZER_REQUESTS;
  });

  useEffect(() => {
    localStorage.setItem('greentrace_wallet', JSON.stringify(wallet));
  }, [wallet]);

  useEffect(() => {
    localStorage.setItem('greentrace_org_requests', JSON.stringify(organizerRequests));
  }, [organizerRequests]);

  const [activities, setActivities] = useState<ActivityRecord[]>(() => {
    const saved = localStorage.getItem('greentrace_activities');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          return parsed.filter((a: ActivityRecord) => !a.is_sample);
        }
      } catch {
        return [];
      }
    }
    return [];
  });

  useEffect(() => {
    localStorage.setItem('greentrace_activities', JSON.stringify(activities));
  }, [activities]);

  // Check for existing active Beacon session on mount
  useEffect(() => {
    let isMounted = true;

    async function checkExistingConnection() {
      try {
        // Only run in browser environment
        if (typeof window === 'undefined') return;

        const beaconWallet = getBeaconWallet();
        const activeAccount = await beaconWallet.client.getActiveAccount();

        if (activeAccount && isMounted) {
          const address = activeAccount.address;
          const role = await resolveRole(address);
          const balance = await fetchBalance(address);

          setWallet({
            isConnected: true,
            address,
            role,
            network: TEZOS_NETWORK_NAME,
            rpcUrl: RPC_URL,
            balance,
            isConnecting: false,
            error: null,
            isSimulated: false,
          });
        }
      } catch {
        // Silently ignore if active account lookup fails on cold start
      }
    }

    checkExistingConnection();

    return () => {
      isMounted = false;
    };
  }, []);

  const clearError = useCallback(() => {
    setWallet((prev) => ({ ...prev, error: null }));
  }, []);

  const refreshBalance = useCallback(async () => {
    if (!wallet.address) return;
    try {
      const balance = await fetchBalance(wallet.address);
      setWallet((prev) => ({ ...prev, balance }));
    } catch {
      // Ignore balance refresh failure
    }
  }, [wallet.address]);

  /**
   * Connect real Beacon wallet (e.g. Temple, Kukai).
   * If running in simulated mode or if preferredRole is provided for testing,
   * falls back safely if user has no extension installed.
   */
  const connectWallet = useCallback(async (preferredRole?: UserRole) => {
    setWallet((prev) => ({ ...prev, isConnecting: true, error: null }));

    try {
      const beaconWallet = getBeaconWallet();

      // Request permissions from Beacon on configured Tezos Shadownet
      await beaconWallet.requestPermissions();

      const address = await beaconWallet.getPKH();
      const role = await resolveRole(address);
      const balance = await fetchBalance(address);

      setWallet({
        isConnected: true,
        address,
        role,
        network: TEZOS_NETWORK_NAME,
        rpcUrl: RPC_URL,
        balance,
        isConnecting: false,
        error: null,
        isSimulated: false,
      });
    } catch (err: unknown) {
      const formattedError = formatWalletError(err);

      // If user cancelled or in test/headless environment without wallet extension,
      // and a preferredRole was explicitly passed (e.g. dev role switch), provide fallback test session
      if (preferredRole && preferredRole !== 'GUEST') {
        const mockAddress = preferredRole === 'ORGANIZER' ? SAMPLE_ORGANIZER_ADDRESS : SAMPLE_STUDENT_ADDRESS;
        setWallet({
          isConnected: true,
          address: mockAddress,
          role: preferredRole,
          network: `${TEZOS_NETWORK_NAME} (Dev Mode)`,
          rpcUrl: RPC_URL,
          balance: preferredRole === 'ORGANIZER' ? '120.00 ꜩ' : '48.50 ꜩ',
          isConnecting: false,
          error: null,
          isSimulated: true,
        });
        return;
      }

      setWallet((prev) => ({
        ...prev,
        isConnecting: false,
        error: formattedError,
      }));
    }
  }, []);

  /**
   * Disconnect the connected wallet.
   */
  const disconnectWallet = useCallback(async () => {
    try {
      const beaconWallet = getBeaconWallet();
      await beaconWallet.disconnect();
    } catch {
      // Clear local state even if Beacon call errors
    } finally {
      localStorage.removeItem('greentrace_wallet');
      localStorage.removeItem('greentrace_auth_user');
      localStorage.removeItem('greentrace_auth_token');
      setWallet({
        isConnected: false,
        address: null,
        role: 'GUEST',
        network: TEZOS_NETWORK_NAME,
        rpcUrl: RPC_URL,
        balance: null,
        isConnecting: false,
        error: null,
        isSimulated: false,
        userName: undefined,
        userEmail: undefined,
        studentId: undefined,
        department: undefined,
      });
    }
  }, []);

  /**
   * Immediate student account creation and login.
   * Student accounts require no waiting period or approval.
   */
  const loginAsStudent = useCallback((name: string, studentId?: string, customAddress?: string) => {
    const studentAddress =
      customAddress ||
      (studentId
        ? `tz1Stu${Math.abs(studentId.split('').reduce((acc, char) => acc * 31 + char.charCodeAt(0), 0))
            .toString(16)
            .padEnd(30, '0')
            .slice(0, 30)}`
        : SAMPLE_STUDENT_ADDRESS);

    setWallet({
      isConnected: true,
      address: studentAddress,
      role: 'STUDENT',
      network: `${TEZOS_NETWORK_NAME} (Active Student Session)`,
      rpcUrl: RPC_URL,
      balance: '50.00 ꜩ',
      isConnecting: false,
      error: null,
      isSimulated: true,
      userName: name.trim() || 'Campus Student',
    });
  }, []);

  /**
   * Login as authorized organizer using the pre-authorized dummy organizer account
   * or another pre-approved wallet address.
   */
  const loginAsOrganizer = useCallback((address?: string, name?: string) => {
    const orgAddress = address || SAMPLE_ORGANIZER_ADDRESS;
    setWallet({
      isConnected: true,
      address: orgAddress,
      role: 'ORGANIZER',
      network: `${TEZOS_NETWORK_NAME} (Authorized Organizer Session)`,
      rpcUrl: RPC_URL,
      balance: '120.00 ꜩ',
      isConnecting: false,
      error: null,
      isSimulated: true,
      userName: name || 'Dr. Aris Thorne (Lead Organizer)',
    });
  }, []);

  /**
   * Log in using a verified backend user profile from Supabase.
   */
  const loginWithBackendUser = useCallback((user: UserProfile, token: string) => {
    localStorage.setItem('greentrace_auth_token', token);
    localStorage.setItem('greentrace_auth_user', JSON.stringify(user));

    const defaultStudentAddress = `tz1stu${String(user.id).padStart(4, '0')}0000000000000000000000`;
    const defaultOrganizerAddress = SAMPLE_ORGANIZER_ADDRESS;
    const finalAddress = user.wallet_address || (user.role === 'ORGANIZER' ? defaultOrganizerAddress : defaultStudentAddress);

    setWallet({
      isConnected: true,
      address: finalAddress,
      role: user.role,
      network: `${TEZOS_NETWORK_NAME} (Active ${user.role} Session)`,
      rpcUrl: RPC_URL,
      balance: user.role === 'ORGANIZER' ? '120.00 ꜩ' : '50.00 ꜩ',
      isConnecting: false,
      error: null,
      isSimulated: false,
      userName: user.name,
      userEmail: user.email,
      studentId: user.student_id || undefined,
      department: user.department || undefined,
    });
  }, []);

  /**
   * Submits an organizer permission request seeking authorization from existing organizers.
   */
  const submitOrganizerPermissionRequest = useCallback(
    (req: Omit<OrganizerPermissionRequest, 'id' | 'status' | 'requestedAt'>): OrganizerPermissionRequest => {
      const newRequest: OrganizerPermissionRequest = {
        ...req,
        id: `req-${Date.now().toString(36)}`,
        status: 'PENDING',
        requestedAt: new Date().toISOString(),
      };
      setOrganizerRequests((prev) => [newRequest, ...prev]);
      return newRequest;
    },
    []
  );

  const approveOrganizerRequest = useCallback((id: string) => {
    setOrganizerRequests((prev) =>
      prev.map((r) => (r.id === id ? { ...r, status: 'APPROVED' as const } : r))
    );
  }, []);

  const rejectOrganizerRequest = useCallback((id: string) => {
    setOrganizerRequests((prev) =>
      prev.map((r) => (r.id === id ? { ...r, status: 'REJECTED' as const } : r))
    );
  }, []);

  /**
   * Switch active role for development/demo testing.
   */
  const switchRole = useCallback((role: UserRole) => {
    if (role === 'GUEST') {
      disconnectWallet();
      return;
    }

    const address = role === 'ORGANIZER' ? SAMPLE_ORGANIZER_ADDRESS : SAMPLE_STUDENT_ADDRESS;
    setWallet((prev) => ({
      ...prev,
      isConnected: true,
      role,
      address,
      balance: role === 'ORGANIZER' ? '120.00 ꜩ' : '48.50 ꜩ',
      network: `${TEZOS_NETWORK_NAME} (Dev Mode)`,
      error: null,
      isSimulated: true,
      userName: role === 'ORGANIZER' ? 'Dr. Aris Thorne (Lead Organizer)' : 'Student User',
    }));
  }, [disconnectWallet]);

  const addActivity = useCallback((activity: ActivityRecord) => {
    setActivities((prev) => [activity, ...prev]);
  }, []);

  const reviewActivity = useCallback(
    (
      id: string,
      decision: 'APPROVED' | 'REJECTED',
      approver: string,
      rejectionReason?: string,
      txHash?: string
    ): { success: boolean; error?: string; txHash?: string } => {
      const target = activities.find((a) => a.activity_id === id);
      if (!target) {
        return { success: false, error: 'Activity not found.' };
      }

      // Specification rule: Organizers cannot approve their own submissions (self-approval prevention)
      if (target.submitter_address.toLowerCase() === approver.toLowerCase()) {
        return {
          success: false,
          error: 'Self-approval prevention: Organizers cannot approve or reject their own submissions.',
        };
      }

      // Specification rule: Status transitions only from SUBMITTED
      if (target.status !== 'SUBMITTED') {
        return {
          success: false,
          error: `Invalid transition: Record is already ${target.status}. Prior decisions cannot be overwritten.`,
        };
      }

      const finalTxHash = txHash ?? (wallet.isSimulated ? `op_sim_${Math.random().toString(36).substring(2, 12)}...preview` : undefined);

      const updatedActivities = activities.map((item) => {
        if (item.activity_id === id) {
          return {
            ...item,
            status: decision,
            approver_address: approver,
            approved_at: new Date().toISOString(),
            approval_tx_hash: finalTxHash,
            rejection_reason: decision === 'REJECTED' ? rejectionReason || 'Rejected by organizer' : undefined,
          };
        }
        return item;
      });

      setActivities(updatedActivities);
      return { success: true, txHash: finalTxHash };
    },
    [activities, wallet.isSimulated]
  );

  const isDuplicateHash = useCallback(
    (hash: string): boolean => {
      if (!hash) return false;
      return activities.some((a) => a.evidence_hash.toLowerCase() === hash.toLowerCase());
    },
    [activities]
  );

  const getActivityById = useCallback(
    (id: string): ActivityRecord | undefined => {
      if (!id) return undefined;
      const clean = id.trim().toLowerCase();
      return activities.find((a) => a.activity_id.trim().toLowerCase() === clean);
    },
    [activities]
  );

  return React.createElement(
    WalletContext.Provider,
    {
      value: {
        wallet,
        activities,
        organizerRequests,
        connectWallet,
        disconnectWallet,
        switchRole,
        loginAsStudent,
        loginAsOrganizer,
        loginWithBackendUser,
        submitOrganizerPermissionRequest,
        approveOrganizerRequest,
        rejectOrganizerRequest,
        clearError,
        refreshBalance,
        addActivity,
        reviewActivity,
        isDuplicateHash,
        getActivityById,
      },
    },
    children
  );
};

export const useWallet = (): WalletContextType => {
  const context = useContext(WalletContext);
  if (!context) {
    throw new Error('useWallet must be used within a WalletProvider');
  }
  return context;
};
