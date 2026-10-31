/**
 * GreenTrace 2.0 - Typed FastAPI Client Service
 * Provides typed API calls with consistent error handling and network resilience.
 */

import type { TreeDetectionResult } from '../types';

export interface HealthCheckResponse {
  status: string;
  service: string;
  supported_network: string;
  rpc: string;
}

export interface DuplicateCheckResponse {
  is_duplicate: boolean;
  evidence_hash: string;
  existing_activity_id?: string | null;
  message?: string;
}

export interface EvidenceUploadResponse {
  evidence_hash: string;
  filename: string;
  file_size: number;
  mime_type: string;
  is_duplicate: boolean;
  existing_activity_id?: string | null;
  message: string;
}

export interface ActivityApiResponse {
  activity_id: string;
  submitter_address: string;
  category: string;
  quantity: number;
  unit: string;
  description?: string | null;
  evidence_hash: string;
  evidence_path?: string | null;
  status_cache: string;
  submission_tx_hash?: string | null;
  approval_tx_hash?: string | null;
  rejection_tx_hash?: string | null;
  approver_address?: string | null;
  submitted_at: string;
  approved_at?: string | null;
  rejected_at?: string | null;
  rejection_reason?: string | null;
  blockchain_confirmed?: number;
  reconciled_at?: string | null;
  // GreenAI Tree Detection fields
  ai_detected_count?: number | null;
  ai_confidence_score?: number | null;
  ai_model_name?: string | null;
  ai_model_version?: string | null;
  ai_annotated_path?: string | null;
  ai_detection_data?: string | null;
}

export interface PublicVerificationApiResponse {
  activity_id: string;
  category: string;
  quantity: number;
  unit: string;
  status: string;
  status_label: string;
  on_chain_status?: string | null;
  on_chain_verified: boolean;
  network: string;
  contract_address?: string | null;
  submission_tx_hash?: string | null;
  approval_tx_hash?: string | null;
  approver_address?: string | null;
  submitted_at?: string | null;
  decided_at?: string | null;
  evidence_hash: string;
  disclaimer: string;
  details?: string | null;
}

export interface ActivityFilterParams {
  status?: string;
  submitter_address?: string;
  category?: string;
  limit?: number;
  offset?: number;
}

export interface CategoryImpact {
  category: string;
  total_qty: number;
  unit: string;
}

export interface ActivityStatsApiResponse {
  total: number;
  approved: number;
  pending: number;
  rejected: number;
  impacts: CategoryImpact[];
}

export interface ActivityCreatePayload {
  activity_id: string;
  submitter_address: string;
  category: string;
  quantity: number;
  unit: string;
  description?: string;
  evidence_hash: string;
  submission_tx_hash?: string;
  submitted_at?: string;
  // GreenAI Tree Detection fields
  ai_detected_count?: number;
  ai_confidence_score?: number;
  ai_model_name?: string;
  ai_model_version?: string;
  ai_annotated_path?: string;
  ai_detection_data?: string;
}

export interface TransactionApiResponse {
  id: number;
  activity_id: string;
  tx_hash: string;
  tx_type: 'SUBMISSION' | 'APPROVAL' | 'REJECTION';
  wallet_address: string;
  confirmation_status: 'PENDING' | 'CONFIRMED' | 'FAILED';
  block_level?: number | null;
  created_at: string;
  confirmed_at?: string | null;
  error_message?: string | null;
}

export interface ActivityHistoryEvent {
  event_type: string;
  timestamp: string;
  actor_address: string;
  tx_hash?: string | null;
  status: string;
  rejection_reason?: string | null;
  description: string;
}

export interface ActivityHistoryApiResponse {
  activity: ActivityApiResponse;
  events: ActivityHistoryEvent[];
  transactions: TransactionApiResponse[];
}

export interface ReconciliationStatusApiResponse {
  total_activities: number;
  confirmed_activities: number;
  unconfirmed_activities: number;
  total_transactions: number;
  contract_address?: string | null;
  rpc_url: string;
  last_reconciliation?: Record<string, unknown> | null;
}

export interface ReconciliationSyncApiResponse {
  status: string;
  message: string;
  timestamp: string;
  total_activities: number;
  synced_count: number;
  mismatched_count: number;
  updated_count: number;
  contract_address?: string | null;
  discrepancies: Array<Record<string, unknown>>;
}

export interface RecoveryPayload {
  activity_id: string;
  tx_hash: string;
  tx_type: 'SUBMISSION' | 'APPROVAL' | 'REJECTION';
  wallet_address: string;
  approver_address?: string;
  rejection_reason?: string;
}

export interface RecoveryApiResponse {
  success: boolean;
  activity_id: string;
  tx_hash: string;
  tx_verified_on_chain: boolean;
  activity: ActivityApiResponse;
  message: string;
}

export interface DecisionPayload {
  decision: 'APPROVED' | 'REJECTED';
  approver_address: string;
  approval_tx_hash?: string;
  rejection_reason?: string;
}

export interface DecisionApiResponse {
  activity_id: string;
  status: string;
  approver_address: string;
  approval_tx_hash?: string | null;
  approved_at: string;
  rejection_reason?: string | null;
  message: string;
}

export interface OrganizerCheckResponse {
  address: string;
  is_organizer: boolean;
  message: string;
}

export interface UserProfile {
  id: number;
  email: string;
  name: string;
  role: 'STUDENT' | 'ORGANIZER';
  student_id?: string | null;
  department?: string | null;
  wallet_address?: string | null;
  created_at: string;
  last_login?: string | null;
}

export interface AuthResponse {
  success: boolean;
  message: string;
  user: UserProfile;
  token: string;
}

export interface SignUpPayload {
  email: string;
  name: string;
  password: string;
  role: 'STUDENT' | 'ORGANIZER';
  student_id?: string;
  department?: string;
  wallet_address?: string;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export class ApiError extends Error {
  status: number;
  detail: string;

  constructor(status: number, detail: string) {
    super(`API Error (${status}): ${detail}`);
    this.name = 'ApiError';
    this.status = status;
    this.detail = detail;
  }
}

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL !== undefined && import.meta.env.VITE_API_BASE_URL !== '')
  ? import.meta.env.VITE_API_BASE_URL
  : (typeof window !== 'undefined' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1'
      ? ''
      : 'http://localhost:8000');

async function fetchJson<T>(url: string, options?: RequestInit): Promise<T> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000);

  try {
    const res = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        'Accept': 'application/json',
        ...(options?.headers || {}),
      },
    });

    clearTimeout(timeoutId);

    if (!res.ok) {
      let detail = res.statusText;
      try {
        const errJson = await res.json();
        detail = errJson.detail || errJson.message || detail;
      } catch {
        // Use statusText if body is not JSON
      }
      throw new ApiError(res.status, detail);
    }

    return await res.json();
  } catch (err: unknown) {
    clearTimeout(timeoutId);
    if (err instanceof ApiError) {
      throw err;
    }
    const message = err instanceof Error ? err.message : 'Network request failed';
    throw new ApiError(0, message);
  }
}

export const api = {
  getBaseUrl(): string {
    return API_BASE_URL;
  },

  async getHealth(): Promise<HealthCheckResponse> {
    return fetchJson<HealthCheckResponse>(`${API_BASE_URL}/health`);
  },

  async uploadEvidence(file: File): Promise<EvidenceUploadResponse> {
    const formData = new FormData();
    formData.append('file', file);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s for upload

    try {
      const res = await fetch(`${API_BASE_URL}/api/evidence`, {
        method: 'POST',
        body: formData,
        signal: controller.signal,
        headers: { Accept: 'application/json' },
      });
      clearTimeout(timeoutId);

      if (!res.ok) {
        let detail = res.statusText;
        try {
          const errJson = await res.json();
          detail = errJson.detail || errJson.message || detail;
        } catch {
          // Use statusText if body is not JSON
        }
        throw new ApiError(res.status, detail);
      }

      return await res.json() as EvidenceUploadResponse;
    } catch (err: unknown) {
      clearTimeout(timeoutId);
      if (err instanceof ApiError) throw err;
      const message = err instanceof Error ? err.message : 'Network request failed';
      throw new ApiError(0, message);
    }
  },

  async uploadEvidenceBatch(files: File[]): Promise<EvidenceUploadResponse[]> {
    const formData = new FormData();
    files.forEach((file) => formData.append('files', file));

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000); // 60s for batch upload

    try {
      const res = await fetch(`${API_BASE_URL}/api/evidence/batch`, {
        method: 'POST',
        body: formData,
        signal: controller.signal,
        headers: { Accept: 'application/json' },
      });
      clearTimeout(timeoutId);

      if (!res.ok) {
        let detail = res.statusText;
        try {
          const errJson = await res.json();
          detail = errJson.detail || errJson.message || detail;
        } catch {
          // Use statusText if body is not JSON
        }
        throw new ApiError(res.status, detail);
      }

      return await res.json() as EvidenceUploadResponse[];
    } catch (err: unknown) {
      clearTimeout(timeoutId);
      if (err instanceof ApiError) throw err;
      const message = err instanceof Error ? err.message : 'Network request failed';
      throw new ApiError(0, message);
    }
  },

  async checkDuplicate(evidenceHash: string): Promise<DuplicateCheckResponse> {
    return fetchJson<DuplicateCheckResponse>(
      `${API_BASE_URL}/api/evidence/${encodeURIComponent(evidenceHash)}/duplicate-check`
    );
  },

  async getActivities(params?: string | ActivityFilterParams): Promise<ActivityApiResponse[]> {
    if (typeof params === 'string') {
      const query = params ? `?status=${encodeURIComponent(params)}` : '';
      return fetchJson<ActivityApiResponse[]>(`${API_BASE_URL}/api/activities${query}`);
    }
    const q = new URLSearchParams();
    if (params?.status) q.append('status', params.status);
    if (params?.submitter_address) q.append('submitter_address', params.submitter_address);
    if (params?.category) q.append('category', params.category);
    if (params?.limit !== undefined) q.append('limit', String(params.limit));
    if (params?.offset !== undefined) q.append('offset', String(params.offset));
    const qs = q.toString() ? `?${q.toString()}` : '';
    return fetchJson<ActivityApiResponse[]>(`${API_BASE_URL}/api/activities${qs}`);
  },

  async getActivityStats(submitterAddress?: string): Promise<ActivityStatsApiResponse> {
    const query = submitterAddress ? `?submitter_address=${encodeURIComponent(submitterAddress)}` : '';
    return fetchJson<ActivityStatsApiResponse>(`${API_BASE_URL}/api/activities/stats/summary${query}`);
  },

  async getActivityById(id: string): Promise<ActivityApiResponse> {
    return fetchJson<ActivityApiResponse>(`${API_BASE_URL}/api/activities/${encodeURIComponent(id)}`);
  },

  async recordDecision(
    activityId: string,
    payload: DecisionPayload
  ): Promise<DecisionApiResponse> {
    return fetchJson<DecisionApiResponse>(
      `${API_BASE_URL}/api/activities/${encodeURIComponent(activityId)}/decision`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }
    );
  },

  async verifyOrganizer(address: string): Promise<OrganizerCheckResponse> {
    return fetchJson<OrganizerCheckResponse>(
        `${API_BASE_URL}/api/activities/organizers/verify/${encodeURIComponent(address)}`
    );
  },

  async createActivity(payload: ActivityCreatePayload): Promise<ActivityApiResponse> {
    return fetchJson<ActivityApiResponse>(`${API_BASE_URL}/api/activities`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  },

  async getActivityHistory(id: string): Promise<ActivityHistoryApiResponse> {
    return fetchJson<ActivityHistoryApiResponse>(
      `${API_BASE_URL}/api/activities/${encodeURIComponent(id)}/history`
    );
  },

  async getActivityTransactions(id: string): Promise<TransactionApiResponse[]> {
    return fetchJson<TransactionApiResponse[]>(
      `${API_BASE_URL}/api/activities/${encodeURIComponent(id)}/transactions`
    );
  },

  async getReconciliationStatus(): Promise<ReconciliationStatusApiResponse> {
    return fetchJson<ReconciliationStatusApiResponse>(`${API_BASE_URL}/api/reconciliation/status`);
  },

  async triggerReconciliation(options?: {
    contract_address?: string;
    dry_run?: boolean;
  }): Promise<ReconciliationSyncApiResponse> {
    return fetchJson<ReconciliationSyncApiResponse>(`${API_BASE_URL}/api/reconciliation/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(options || {}),
    });
  },

  async recoverTransaction(payload: RecoveryPayload): Promise<RecoveryApiResponse> {
    return fetchJson<RecoveryApiResponse>(`${API_BASE_URL}/api/reconciliation/recover`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  },

  getProtectedEvidenceFileUrl(evidenceHash: string, organizerAddress?: string): string {
    const query = organizerAddress ? `?organizer_address=${encodeURIComponent(organizerAddress)}` : '';
    return `${API_BASE_URL}/api/evidence/${encodeURIComponent(evidenceHash)}/file${query}`;
  },

  getAnnotatedEvidenceFileUrl(pathOrFilename: string): string {
    if (!pathOrFilename) return '';
    if (pathOrFilename.startsWith('http://') || pathOrFilename.startsWith('https://')) {
      return pathOrFilename;
    }
    const cleanFilename = pathOrFilename.split('/').pop() || pathOrFilename;
    return `${API_BASE_URL}/api/evidence/annotated/${encodeURIComponent(cleanFilename)}`;
  },

  async detectTrees(file: File): Promise<TreeDetectionResult> {
    const formData = new FormData();
    formData.append('file', file);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s timeout for AI inference

    try {
      const res = await fetch(`${API_BASE_URL}/api/ai/detect-trees`, {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
        },
        body: formData,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!res.ok) {
        let detail = res.statusText;
        try {
          const errJson = await res.json();
          detail = errJson.detail || errJson.message || detail;
        } catch {
          // fallback
        }
        throw new ApiError(res.status, detail);
      }

      return await res.json();
    } catch (err: unknown) {
      clearTimeout(timeoutId);
      if (err instanceof ApiError) throw err;
      const msg = err instanceof Error ? err.message : 'AI tree detection request failed';
      throw new ApiError(0, msg);
    }
  },

  async getPublicActivity(id: string): Promise<PublicVerificationApiResponse> {
    return fetchJson<PublicVerificationApiResponse>(`${API_BASE_URL}/api/public/activities/${encodeURIComponent(id)}`);
  },

  async verifyPublicActivity(id: string): Promise<PublicVerificationApiResponse> {
    return fetchJson<PublicVerificationApiResponse>(`${API_BASE_URL}/api/public/verify/${encodeURIComponent(id)}`);
  },

  async signUp(payload: SignUpPayload): Promise<AuthResponse> {
    return fetchJson<AuthResponse>(`${API_BASE_URL}/api/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  },

  async login(payload: LoginPayload): Promise<AuthResponse> {
    return fetchJson<AuthResponse>(`${API_BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  },

  async tezosQuickLogin(walletAddress: string): Promise<AuthResponse> {
    return fetchJson<AuthResponse>(`${API_BASE_URL}/api/auth/tezos-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ wallet_address: walletAddress }),
    });
  },

  async getUserProfile(userId: number): Promise<UserProfile> {
    return fetchJson<UserProfile>(`${API_BASE_URL}/api/auth/user/${encodeURIComponent(userId)}`);
  },
};
