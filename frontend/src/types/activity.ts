export type ActivityCategory =
  | 'Recycling'
  | 'Tree planting'
  | 'Energy conservation'
  | 'Water conservation'
  | 'Waste collection'
  | 'Other';

export const CATEGORY_UNITS: Record<ActivityCategory, string[]> = {
  'Recycling': ['kg'],
  'Tree planting': ['saplings'],
  'Energy conservation': ['kWh', 'Wh'],
  'Water conservation': ['litres'],
  'Waste collection': ['kg'],
  'Other': ['units', 'items', 'hours'],
};

export type ActivityStatus = 'SUBMITTED' | 'APPROVED' | 'REJECTED';

export type UserRole = 'STUDENT' | 'ORGANIZER' | 'GUEST';

export interface ActivityRecord {
  activity_id: string;
  category: ActivityCategory;
  quantity: number;
  unit: string;
  description: string;
  evidence_hash: string;
  evidence_url?: string;
  evidence_filename?: string;
  status: ActivityStatus;
  submitter_address: string;
  approver_address?: string | null;
  submitted_at: string; // ISO string
  approved_at?: string | null; // ISO string
  activity_date?: string; // Optional reported date distinct from contract timestamp
  submission_tx_hash?: string;
  approval_tx_hash?: string;
  rejection_reason?: string | null;
  is_sample?: boolean;
  // GreenAI Tree Detection fields
  ai_detected_count?: number | null;
  ai_confidence_score?: number | null;
  ai_model_name?: string | null;
  ai_model_version?: string | null;
  ai_annotated_path?: string | null;
  ai_detection_data?: string | null;
}

export interface TreeDetectionBox {
  id: string;
  bbox: [number, number, number, number]; // [x1, y1, x2, y2]
  confidence: number;
  class_name: string;
}

export interface TreeDetectionResult {
  count: number;
  detections: TreeDetectionBox[];
  annotated_image_url: string;
  annotated_image_base64?: string;
  model_name: string;
  model_version: string;
  average_confidence: number;
  processing_time_ms: number;
  discrepancy_notice?: string;
}

export interface WalletState {
  isConnected: boolean;
  address: string | null;
  role: UserRole;
  network: string;
  rpcUrl: string;
  balance: string | null;
  isConnecting: boolean;
  error: string | null;
  isSimulated?: boolean;
  userName?: string;
}

export interface OrganizerPermissionRequest {
  id: string;
  name: string;
  email: string;
  department: string;
  walletAddress: string;
  reason: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  requestedAt: string;
}
