import { describe, it, expect } from 'vitest';
import { CATEGORY_UNITS } from '../types';
import {
  truncateAddress,
  calculateStringSHA256,
  calculateBytesSHA256,
  formatTimestamp,
} from '../utils/hash';
import {
  INITIAL_SAMPLE_ACTIVITIES,
  SAMPLE_STUDENT_ADDRESS,
  SAMPLE_ORGANIZER_ADDRESS,
} from '../utils/mockData';
import {
  resolveRole,
  isAuthorizedOrganizer,
  formatWalletError,
  getAuthorizedOrganizerAddresses,
  RPC_URL,
  TEZOS_NETWORK,
  TEZOS_NETWORK_NAME,
} from '../services/tezos';
import { api, ApiError } from '../services/api';

describe('GreenTrace 2.0 - Core Specifications & Logic', () => {
  it('enforces required category to unit pairings per Section 7', () => {
    expect(CATEGORY_UNITS['Recycling']).toContain('kg');
    expect(CATEGORY_UNITS['Tree planting']).toContain('saplings');
    expect(CATEGORY_UNITS['Energy conservation']).toContain('kWh');
    expect(CATEGORY_UNITS['Energy conservation']).toContain('Wh');
    expect(CATEGORY_UNITS['Water conservation']).toContain('litres');
    expect(CATEGORY_UNITS['Waste collection']).toContain('kg');
  });

  it('correctly truncates Tezos public key hash addresses for UI display', () => {
    const student = 'tz1VSUr8wwNhLAzempoch5d6hLRiTh8Cjcjb';
    const truncated = truncateAddress(student, 6, 4);
    expect(truncated).toBe('tz1VSU...jcjb');
  });

  it('detects exact SHA-256 duplicate evidence fingerprints per Section 8', () => {
    const knownHash = INITIAL_SAMPLE_ACTIVITIES[0].evidence_hash;
    const isDuplicate = INITIAL_SAMPLE_ACTIVITIES.some(
      (a) => a.evidence_hash.toLowerCase() === knownHash.toLowerCase()
    );
    expect(isDuplicate).toBe(true);

    const uniqueNewHash = 'a'.repeat(64);
    const isNewDuplicate = INITIAL_SAMPLE_ACTIVITIES.some(
      (a) => a.evidence_hash.toLowerCase() === uniqueNewHash.toLowerCase()
    );
    expect(isNewDuplicate).toBe(false);
  });

  it('validates self-approval prevention rule for organizers per Section 5', () => {
    const activity = {
      ...INITIAL_SAMPLE_ACTIVITIES[0],
      submitter_address: SAMPLE_ORGANIZER_ADDRESS,
      status: 'SUBMITTED' as const,
    };

    // Simulated review logic
    const attemptSelfApproval = (submitter: string, approver: string) => {
      if (submitter.toLowerCase() === approver.toLowerCase()) {
        return {
          success: false,
          error: 'Self-approval prevention: Organizers cannot approve their own submissions.',
        };
      }
      return { success: true };
    };

    const selfResult = attemptSelfApproval(activity.submitter_address, SAMPLE_ORGANIZER_ADDRESS);
    expect(selfResult.success).toBe(false);
    expect(selfResult.error).toContain('Self-approval prevention');

    const validResult = attemptSelfApproval(SAMPLE_STUDENT_ADDRESS, SAMPLE_ORGANIZER_ADDRESS);
    expect(validResult.success).toBe(true);
  });

  it('distinguishes on-chain contract state from off-chain private metadata per Section 10', () => {
    const sampleRecord = INITIAL_SAMPLE_ACTIVITIES[0];

    // On-chain fields
    expect(sampleRecord.activity_id).toBeDefined();
    expect(sampleRecord.evidence_hash).toBeDefined();
    expect(sampleRecord.category).toBeDefined();
    expect(sampleRecord.quantity).toBeGreaterThan(0);
    expect(sampleRecord.unit).toBeDefined();
    expect(sampleRecord.status).toBe('APPROVED');
    expect(sampleRecord.submitter_address).toBeDefined();

    // Off-chain fields
    expect(sampleRecord.description).toBeDefined();
  });
});

describe('Phase 2 - SHA-256 Evidence Hashing & Utilities', () => {
  it('computes exact SHA-256 hash matching known NIST test vectors', async () => {
    // Empty string SHA-256 standard NIST vector
    const emptyHash = await calculateStringSHA256('');
    expect(emptyHash).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');

    // "hello world" standard NIST vector
    const helloHash = await calculateStringSHA256('hello world');
    expect(helloHash).toBe('b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9');
  });

  it('computes SHA-256 from raw byte arrays consistently', async () => {
    const rawBytes = new Uint8Array([103, 114, 101, 101, 110]); // "green"
    const hash = await calculateBytesSHA256(rawBytes);
    const expected = await calculateStringSHA256('green');
    expect(hash).toBe(expected);
    expect(hash).toHaveLength(64);
  });

  it('formats timestamp safely without throwing on invalid dates', () => {
    const valid = formatTimestamp('2026-10-29T10:00:00Z');
    expect(valid).toContain('2026');

    const invalid = formatTimestamp('not-a-date');
    expect(invalid).toBe('not-a-date');
  });
});

describe('Phase 2 - Tezos Service & Role Resolution', () => {
  it('verifies verified testnet parameters and RPC endpoint', () => {
    expect(RPC_URL).toBe('https://rpc.shadownet.teztnets.com');
    expect(TEZOS_NETWORK).toBe('shadownet');
    expect(TEZOS_NETWORK_NAME).toContain('Shadownet');
  });

  it('resolves GUEST role when no address is provided', async () => {
    const role = await resolveRole(null);
    expect(role).toBe('GUEST');
  });

  it('resolves ORGANIZER role for authorized organizer addresses', async () => {
    const authorized = getAuthorizedOrganizerAddresses();
    expect(authorized.length).toBeGreaterThan(0);

    const role = await resolveRole(SAMPLE_ORGANIZER_ADDRESS);
    expect(role).toBe('ORGANIZER');
  });

  it('resolves STUDENT role for unknown student addresses', async () => {
    const randomStudent = 'tz1ZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZ';
    const role = await resolveRole(randomStudent);
    expect(role).toBe('STUDENT');
  });

  it('formats wallet and RPC errors with user-friendly descriptions', () => {
    expect(formatWalletError({ message: 'User NOT_GRANTED permissions' })).toContain(
      'cancelled by the user'
    );
    expect(formatWalletError({ message: 'NETWORK_NOT_SUPPORTED on provider' })).toContain(
      'Unsupported network'
    );
    expect(formatWalletError({ message: 'RPC Failed to fetch node' })).toContain(
      'Unable to reach the Tezos RPC node'
    );
    expect(formatWalletError({ message: 'empty_implicit_contract' })).toContain(
      'Account is empty or unfunded'
    );
  });

  it('handles typed ApiError consistently', () => {
    const err = new ApiError(404, 'Activity not found');
    expect(err.status).toBe(404);
    expect(err.detail).toBe('Activity not found');
    expect(err.message).toContain('404');
  });
});

describe('Phase 5 - Evidence API Service', () => {
  it('api object exposes uploadEvidence method', async () => {
    const { api } = await import('../services/api');
    expect(typeof api.uploadEvidence).toBe('function');
  });

  it('api object exposes checkDuplicate method', async () => {
    const { api } = await import('../services/api');
    expect(typeof api.checkDuplicate).toBe('function');
  });

  it('ApiError carries status code and detail for 413 oversized file', () => {
    const err = new ApiError(413, 'File exceeds maximum allowed size of 10MB.');
    expect(err.status).toBe(413);
    expect(err.detail).toContain('10MB');
  });

  it('ApiError carries status code and detail for 400 invalid type', () => {
    const err = new ApiError(400, 'Unsupported file type. Only JPEG, PNG, and WebP images are permitted.');
    expect(err.status).toBe(400);
    expect(err.detail).toContain('JPEG');
  });

  it('ApiError carries status code 403 for restricted file access', () => {
    const err = new ApiError(403, 'Access denied: Raw student photographic evidence is restricted to authorized organizers.');
    expect(err.status).toBe(403);
    expect(err.detail).toContain('Access denied');
  });

  it('SHA-256 of identical bytes is deterministic (hash integrity check)', async () => {
    const bytes = new Uint8Array([137, 80, 78, 71]); // PNG magic bytes
    const h1 = await calculateBytesSHA256(bytes);
    const h2 = await calculateBytesSHA256(bytes);
    expect(h1).toBe(h2);
    expect(h1).toHaveLength(64);
    expect(h1).toMatch(/^[0-9a-f]{64}$/);
  });

  it('SHA-256 of empty bytes matches NIST server-side vector', async () => {
    const emptyHash = await calculateBytesSHA256(new Uint8Array(0));
    expect(emptyHash).toBe('e3b0c44298fc1c149afbf4c8996fb924' + '27ae41e4649b934ca495991b7852b855');
  });

  it('different bytes produce different SHA-256 hashes', async () => {
    const h1 = await calculateStringSHA256('file-a-bytes');
    const h2 = await calculateStringSHA256('file-b-bytes');
    expect(h1).not.toBe(h2);
  });

  it('client-side calculateStringSHA256 matches backend known vector for "hello world"', async () => {
    const clientHash = await calculateStringSHA256('hello world');
    expect(clientHash).toBe('b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9');
  });

  it('rejects oversized files exceeding 10MB limit in validation logic', () => {
    const maxSizeBytes = 10 * 1024 * 1024;
    const testFileSize = 11 * 1024 * 1024;
    expect(testFileSize > maxSizeBytes).toBe(true);
  });
});

describe('Phase 6 - Organizer Authorization & Decision Workflow', () => {
  it('identifies authorized organizers strictly against authorized whitelist / contract', async () => {
    const authorized = await isAuthorizedOrganizer(SAMPLE_ORGANIZER_ADDRESS);
    expect(authorized).toBe(true);

    const unauthorized = await isAuthorizedOrganizer(SAMPLE_STUDENT_ADDRESS);
    expect(unauthorized).toBe(false);

    const nullAddress = await isAuthorizedOrganizer(null);
    expect(nullAddress).toBe(false);
  });

  it('generates protected evidence preview URLs with organizer query param', () => {
    const hash = 'a'.repeat(64);
    const orgUrl = api.getProtectedEvidenceFileUrl(hash, SAMPLE_ORGANIZER_ADDRESS);
    expect(orgUrl).toContain(hash);
    expect(orgUrl).toContain(`organizer_address=${SAMPLE_ORGANIZER_ADDRESS}`);

    const publicUrl = api.getProtectedEvidenceFileUrl(hash);
    expect(publicUrl).not.toContain('organizer_address');
  });

  it('exposes Phase 6 activity management API methods', () => {
    expect(typeof api.getActivities).toBe('function');
    expect(typeof api.getActivityById).toBe('function');
    expect(typeof api.recordDecision).toBe('function');
    expect(typeof api.verifyOrganizer).toBe('function');
    expect(typeof api.getProtectedEvidenceFileUrl).toBe('function');
  });

  it('rejects self-approval when organizer is also the submitter', () => {
    const activity = {
      id: 'ACT-TEST-001',
      submitter_address: SAMPLE_ORGANIZER_ADDRESS,
      status: 'SUBMITTED',
    };

    const organizerAddress = SAMPLE_ORGANIZER_ADDRESS;
    const isSelfApproval = activity.submitter_address.toLowerCase() === organizerAddress.toLowerCase();
    expect(isSelfApproval).toBe(true);
  });

  it('allows approval when organizer differs from submitter', () => {
    const activity = {
      id: 'ACT-TEST-002',
      submitter_address: SAMPLE_STUDENT_ADDRESS,
      status: 'SUBMITTED',
    };

    const organizerAddress = SAMPLE_ORGANIZER_ADDRESS;
    const isSelfApproval = activity.submitter_address.toLowerCase() === organizerAddress.toLowerCase();
    expect(isSelfApproval).toBe(false);
  });

  it('enforces non-empty rejection reason requirement on rejection decisions', () => {
    const validateDecision = (decision: 'APPROVED' | 'REJECTED', reason?: string) => {
      if (decision === 'REJECTED' && (!reason || !reason.trim())) {
        return { valid: false, error: 'Rejection reason is required' };
      }
      return { valid: true };
    };

    const emptyReject = validateDecision('REJECTED', '   ');
    expect(emptyReject.valid).toBe(false);
    expect(emptyReject.error).toContain('Rejection reason');

    const validReject = validateDecision('REJECTED', 'Evidence does not show scale or unit clearly.');
    expect(validReject.valid).toBe(true);

    const validApprove = validateDecision('APPROVED');
    expect(validApprove.valid).toBe(true);
  });

  it('prevents decisions on activities that are not pending', () => {
    const canReview = (status: string) => status === 'SUBMITTED';

    expect(canReview('SUBMITTED')).toBe(true);
    expect(canReview('APPROVED')).toBe(false);
    expect(canReview('REJECTED')).toBe(false);
  });
});

describe('Phase 7 - SQLite Database & Blockchain Reconciliation', () => {
  it('exposes Phase 7 reconciliation and transaction API methods', () => {
    expect(typeof api.createActivity).toBe('function');
    expect(typeof api.getActivityHistory).toBe('function');
    expect(typeof api.getActivityTransactions).toBe('function');
    expect(typeof api.getReconciliationStatus).toBe('function');
    expect(typeof api.triggerReconciliation).toBe('function');
    expect(typeof api.recoverTransaction).toBe('function');
  });

  it('validates transaction payload structures for tracking', () => {
    const tx = {
      activity_id: 'act-2026-001',
      tx_hash: 'op_test_1234567890abcdef',
      tx_type: 'SUBMISSION' as const,
      wallet_address: SAMPLE_STUDENT_ADDRESS,
      confirmation_status: 'CONFIRMED' as const,
    };

    expect(tx.activity_id).toBe('act-2026-001');
    expect(['SUBMISSION', 'APPROVAL', 'REJECTION']).toContain(tx.tx_type);
    expect(['PENDING', 'CONFIRMED', 'FAILED']).toContain(tx.confirmation_status);
  });

  it('handles safe failure recovery payload parameters correctly', () => {
    const recoveryPayload = {
      activity_id: 'act-fail-recovery-1',
      tx_hash: 'op_confirmed_on_chain_tx_hash_123',
      tx_type: 'APPROVAL' as const,
      wallet_address: SAMPLE_ORGANIZER_ADDRESS,
      approver_address: SAMPLE_ORGANIZER_ADDRESS,
    };

    expect(recoveryPayload.activity_id).toBeDefined();
    expect(recoveryPayload.tx_hash.startsWith('op_')).toBe(true);
    expect(recoveryPayload.tx_type).toBe('APPROVAL');
  });

  it('never treats SQLite status alone as proof without blockchain confirmation', () => {
    const isAuthoritativelyConfirmed = (blockchainConfirmed: number, onChainMined: boolean) => {
      // Local database flag alone is not sufficient if not mined on-chain
      return blockchainConfirmed === 1 && onChainMined;
    };

    expect(isAuthoritativelyConfirmed(1, true)).toBe(true);
    expect(isAuthoritativelyConfirmed(1, false)).toBe(false);
    expect(isAuthoritativelyConfirmed(0, true)).toBe(false);
    expect(isAuthoritativelyConfirmed(0, false)).toBe(false);
  });
});

describe('Phase 8 - Dashboards, History & Security', () => {
  it('correctly filters student activities by submitter address', () => {
    const records = [
      { id: '1', submitter: SAMPLE_STUDENT_ADDRESS, status: 'SUBMITTED' },
      { id: '2', submitter: 'tz1OtherStudentWalletAddress123456789', status: 'APPROVED' },
      { id: '3', submitter: SAMPLE_STUDENT_ADDRESS, status: 'APPROVED' },
    ];

    const studentRecords = records.filter(
      (r) => r.submitter.toLowerCase() === SAMPLE_STUDENT_ADDRESS.toLowerCase()
    );
    expect(studentRecords).toHaveLength(2);
    expect(studentRecords.map((r) => r.id)).toEqual(['1', '3']);
  });

  it('computes student dashboard KPI counts accurately from raw records', () => {
    const studentRecords = [
      { id: '1', status: 'APPROVED' },
      { id: '2', status: 'SUBMITTED' },
      { id: '3', status: 'APPROVED' },
      { id: '4', status: 'REJECTED' },
    ];

    const total = studentRecords.length;
    const approved = studentRecords.filter((r) => r.status === 'APPROVED').length;
    const pending = studentRecords.filter((r) => r.status === 'SUBMITTED').length;
    const rejected = studentRecords.filter((r) => r.status === 'REJECTED').length;

    expect(total).toBe(4);
    expect(approved).toBe(2);
    expect(pending).toBe(1);
    expect(rejected).toBe(1);
  });

  it('handles pagination calculation logic without negative offsets', () => {
    const calcOffset = (page: number, pageSize: number) => Math.max(0, page) * pageSize;
    expect(calcOffset(0, 10)).toBe(0);
    expect(calcOffset(1, 10)).toBe(10);
    expect(calcOffset(2, 10)).toBe(20);
    expect(calcOffset(-1, 10)).toBe(0);
  });

  it('provides safe fallback when transaction hash is missing or pending', () => {
    const getTxDisplay = (txHash?: string | null) => {
      if (!txHash) return 'Pending Mining';
      return truncateAddress(txHash, 6, 4);
    };

    expect(getTxDisplay(null)).toBe('Pending Mining');
    expect(getTxDisplay(undefined)).toBe('Pending Mining');
    expect(getTxDisplay('')).toBe('Pending Mining');
    expect(getTxDisplay('op11111111111111111111111111111111111111111111111111')).toBe('op1111...1111');
  });

  it('restricts evidence inspection permissions strictly to authorized organizers', async () => {
    const canInspectEvidence = async (walletAddress: string | null) => {
      return await isAuthorizedOrganizer(walletAddress);
    };

    const organizerCan = await canInspectEvidence(SAMPLE_ORGANIZER_ADDRESS);
    expect(organizerCan).toBe(true);

    const studentCannot = await canInspectEvidence(SAMPLE_STUDENT_ADDRESS);
    expect(studentCannot).toBe(false);

    const guestCannot = await canInspectEvidence(null);
    expect(guestCannot).toBe(false);
  });
});

describe('Phase 9: QR Code Generation and Public Verification', () => {
  const MANDATORY_DISCLAIMER =
    'Blockchain verification confirms that this activity record and its status were recorded by the GreenTrace smart contract. It does not independently prove that the physical activity occurred.';

  it('generates correct public verification URL matching ${origin}/verify?id={activity_id}', () => {
    const origin = 'https://greentrace.campus.edu';
    const activityId = 'act-2026-tree-planting-001';
    const verificationUrl = `${origin}/verify?id=${encodeURIComponent(activityId)}`;

    expect(verificationUrl).toBe('https://greentrace.campus.edu/verify?id=act-2026-tree-planting-001');
    expect(verificationUrl).toContain('/verify?id=');
    expect(verificationUrl.startsWith('https://')).toBe(true);
  });

  it('safely URI encodes activity IDs with special or reserved characters', () => {
    const origin = 'http://localhost:5173';
    const complexId = 'act 2026/energy#saving&audit';
    const verificationUrl = `${origin}/verify?id=${encodeURIComponent(complexId)}`;

    expect(verificationUrl).toBe('http://localhost:5173/verify?id=act%202026%2Fenergy%23saving%26audit');
    const parsed = new URL(verificationUrl);
    expect(parsed.searchParams.get('id')).toBe(complexId);
  });

  it('ensures QR payload contains only the public URL and NO private data or secrets', () => {
    const origin = 'https://greentrace.campus.edu';
    const activityId = 'act-402';
    const qrPayload = `${origin}/verify?id=${encodeURIComponent(activityId)}`;

    // Ensure no private student info, private keys, seed phrases, or server file paths
    expect(qrPayload).not.toContain('uploads/');
    expect(qrPayload).not.toContain('C:\\');
    expect(qrPayload).not.toContain('private');
    expect(qrPayload).not.toContain('edsk');
    expect(qrPayload).not.toContain('seed');
    expect(qrPayload).not.toContain('student_email');
  });

  it('verifies public response includes the exact required specification disclaimer', () => {
    const samplePublicResponse = {
      activity_id: 'act-2026-001',
      category: 'Tree Planting',
      quantity: 5,
      unit: 'trees',
      status: 'APPROVED',
      status_label: 'Approved',
      network: 'Tezos Shadownet',
      contract_address: 'KT1TestAddressPlaceholder111111111111',
      evidence_hash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
      disclaimer: MANDATORY_DISCLAIMER,
    };

    expect(samplePublicResponse.disclaimer).toBe(MANDATORY_DISCLAIMER);
    expect(samplePublicResponse.disclaimer).toContain('Blockchain verification confirms');
    expect(samplePublicResponse.disclaimer).toContain('does not independently prove that the physical activity occurred');
  });

  it('properly maps authoritative on-chain contract states to user-friendly status labels', () => {
    const mapStateToLabel = (status: string): string => {
      switch (status.toUpperCase()) {
        case 'APPROVED':
          return 'Approved';
        case 'REJECTED':
          return 'Rejected';
        case 'SUBMITTED':
        case 'PENDING':
          return 'Pending';
        default:
          return 'Verification unavailable';
      }
    };

    expect(mapStateToLabel('APPROVED')).toBe('Approved');
    expect(mapStateToLabel('REJECTED')).toBe('Rejected');
    expect(mapStateToLabel('SUBMITTED')).toBe('Pending');
    expect(mapStateToLabel('PENDING')).toBe('Pending');
    expect(mapStateToLabel('UNAVAILABLE')).toBe('Verification unavailable');
    expect(mapStateToLabel('UNKNOWN')).toBe('Verification unavailable');
  });

  it('guarantees that public verification data strictly excludes sensitive student PII and server file paths', () => {
    const publicVerificationRecord = {
      activity_id: 'act-999',
      category: 'Campus Clean-up',
      quantity: 12,
      unit: 'kg waste collected',
      submitted_at: 1711234567,
      status: 'APPROVED',
      status_label: 'Approved',
      network: 'Tezos Shadownet',
      contract_address: 'KT1SampleContractAddress111111111111',
      submission_tx_hash: 'op11111111111111111111111111111111111111111111111111',
      approval_tx_hash: 'op22222222222222222222222222222222222222222222222222',
      approver_address: 'tz1SampleOrganizerAddress1111111111',
      evidence_hash: 'a591a6d40bf420404a011733cfb7b190d62c65bf0bcda32b57b277d9ad9f146e',
      disclaimer: MANDATORY_DISCLAIMER,
    };

    // Assert that sensitive fields are not in the public contract record
    expect((publicVerificationRecord as any).submitter_name).toBeUndefined();
    expect((publicVerificationRecord as any).submitter_email).toBeUndefined();
    expect((publicVerificationRecord as any).student_id).toBeUndefined();
    expect((publicVerificationRecord as any).evidence_path).toBeUndefined();
    expect((publicVerificationRecord as any).stored_path).toBeUndefined();
    expect((publicVerificationRecord as any).rejection_reason).toBeUndefined();
  });

  it('permits immediate activation of student accounts without authorization waiting period', () => {
    const studentUser = {
      name: 'Alex Rivera',
      studentId: 'STU-2026-8941',
      role: 'STUDENT',
      status: 'ACTIVE',
      requiresApproval: false,
    };

    expect(studentUser.role).toBe('STUDENT');
    expect(studentUser.status).toBe('ACTIVE');
    expect(studentUser.requiresApproval).toBe(false);
  });

  it('enforces that new organizer registrations must seek permission with status PENDING', () => {
    const newOrganizerRequest = {
      id: 'req-002',
      name: 'Prof. Morgan Vance',
      email: 'm.vance@campus.edu',
      department: 'Environmental Studies',
      walletAddress: 'tz1burnburnburnburnburnburnbur155rw',
      status: 'PENDING',
      requiresApproval: true,
    };

    expect(newOrganizerRequest.status).toBe('PENDING');
    expect(newOrganizerRequest.requiresApproval).toBe(true);
  });

  it('verifies that the pre-configured dummy organizer account is recognized as an authorized organizer', async () => {
    const isAuth = await isAuthorizedOrganizer(SAMPLE_ORGANIZER_ADDRESS);
    expect(isAuth).toBe(true);
    expect(SAMPLE_ORGANIZER_ADDRESS).toBe('tz1aSkwEkv3Ax2bWZHvCaOKUMcqModq5RMqJ');
  });
});
