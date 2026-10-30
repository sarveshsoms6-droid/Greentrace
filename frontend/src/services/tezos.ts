/**
 * GreenTrace 2.0 - Tezos & Beacon Wallet Service
 * Configured for Tezos Shadownet with Taquito and Beacon SDK.
 */

import { TezosToolkit } from '@taquito/taquito';
import { BeaconWallet } from '@taquito/beacon-wallet';
import { NetworkType } from '@airgap/beacon-dapp';
import type { UserRole } from '../types';

// Verified Tezos Shadownet network settings
export const TEZOS_NETWORK = (import.meta.env.VITE_TEZOS_NETWORK || 'shadownet') as string;
export const TEZOS_NETWORK_NAME = (import.meta.env.VITE_TEZOS_NETWORK_NAME || 'Shadownet (Tezos Testnet)') as string;
export const RPC_URL = (import.meta.env.VITE_TEZOS_RPC_URL || 'https://rpc.shadownet.teztnets.com') as string;
export const EXPLORER_URL = (import.meta.env.VITE_EXPLORER_URL || 'https://shadownet.tzkt.io') as string;
export const CONTRACT_ADDRESS = (import.meta.env.VITE_CONTRACT_ADDRESS || '') as string;

// Configured authorized organizer wallets (comma-separated public key hashes)
const DEFAULT_ORGANIZERS = [
  'tz1aSkwEkv3Ax2bWZHvCaOKUMcqModq5RMqJ',
];

export function getAuthorizedOrganizerAddresses(): string[] {
  const envOrganizers = import.meta.env.VITE_ORGANIZER_ADDRESSES;
  if (envOrganizers && typeof envOrganizers === 'string') {
    const list = envOrganizers.split(',').map((s) => s.trim()).filter(Boolean);
    if (list.length > 0) return list;
  }
  return DEFAULT_ORGANIZERS;
}

// Singleton TezosToolkit instance
export const tezos = new TezosToolkit(RPC_URL);

// Lazy singleton BeaconWallet
let beaconWalletInstance: BeaconWallet | null = null;

export function getBeaconWallet(): BeaconWallet {
  if (!beaconWalletInstance) {
    beaconWalletInstance = new BeaconWallet({
      name: 'GreenTrace 2.0',
      network: {
        type: NetworkType.CUSTOM as unknown as any,
        name: TEZOS_NETWORK,
        rpcUrl: RPC_URL,
      },
    });
    tezos.setWalletProvider(beaconWalletInstance);
  }
  return beaconWalletInstance;
}

/**
 * Resolves user role based on address.
 * An address authorized in the contract (or the configured organizer list) resolves to ORGANIZER.
 * Any other connected wallet is a STUDENT.
 * Disconnected is GUEST.
 */
export async function resolveRole(address: string | null): Promise<UserRole> {
  if (!address) return 'GUEST';

  const normalized = address.toLowerCase();

  // If a smart contract address is configured, try querying on-chain storage
  if (CONTRACT_ADDRESS) {
    try {
      const contract = await tezos.wallet.at(CONTRACT_ADDRESS);
      const storage: unknown = await contract.storage();
      if (storage && typeof storage === 'object') {
        const anyStorage = storage as Record<string, unknown>;
        // Check if storage has organizers big_map or set
        if (anyStorage.organizers && typeof (anyStorage.organizers as { has?: unknown }).has === 'function') {
          const isOrg = await (anyStorage.organizers as { has: (key: string) => Promise<boolean> }).has(address);
          if (isOrg) return 'ORGANIZER';
        }
        // Check if address matches contract administrator
        if (anyStorage.administrator && typeof anyStorage.administrator === 'string') {
          if (anyStorage.administrator.toLowerCase() === normalized) {
            return 'ORGANIZER';
          }
        }
      }
    } catch {
      // If contract call fails or contract is not yet deployed, fallback to configured organizer list
    }
  }

  // Fallback to configured organizer addresses
  const organizers = getAuthorizedOrganizerAddresses().map((a) => a.toLowerCase());
  if (organizers.includes(normalized)) {
    return 'ORGANIZER';
  }

  return 'STUDENT';
}

/**
 * Fetches the active account balance in ꜩ formatted as a decimal string.
 */
export async function fetchBalance(address: string): Promise<string> {
  try {
    const mutezBalance = await tezos.tz.getBalance(address);
    const tez = mutezBalance.dividedBy(1_000_000).toFixed(2);
    return `${tez} ꜩ`;
  } catch {
    return '0.00 ꜩ';
  }
}

/**
 * Checks whether an address is an authorized organizer.
 */
export async function isAuthorizedOrganizer(address: string | null): Promise<boolean> {
  if (!address) return false;
  const role = await resolveRole(address);
  return role === 'ORGANIZER';
}

/**
 * Executes wallet-signed submit_activity on the SmartPy contract.
 * Requests signature from student's connected Beacon wallet and waits for 1 confirmation.
 */
export async function submitActivityOperation(params: {
  activityId: string;
  evidenceHash: string;
  category: string;
  quantity: number;
  unit: string;
}): Promise<string> {
  const wallet = getBeaconWallet();
  const activeAccount = await wallet.client.getActiveAccount();
  if (!activeAccount) {
    throw new Error('No active wallet connected. Please connect your Tezos wallet to sign the submission.');
  }

  if (!CONTRACT_ADDRESS) {
    throw new Error(
      'Contract address (VITE_CONTRACT_ADDRESS) is not configured in .env. A deployed SmartPy contract on Shadownet is required for on-chain transactions.'
    );
  }

  tezos.setWalletProvider(wallet);
  const contract = await tezos.wallet.at(CONTRACT_ADDRESS);
  const op = typeof (contract as any).methodsObject?.submit_activity === 'function'
    ? await (contract as any).methodsObject.submit_activity({
        activity_id: params.activityId,
        evidence_hash: params.evidenceHash,
        category: params.category,
        quantity: Math.max(1, Math.floor(params.quantity)),
        unit: params.unit,
      }).send()
    : await (contract as any).methods.submit_activity(
        params.activityId,
        params.category,
        params.evidenceHash,
        Math.max(1, Math.floor(params.quantity)),
        params.unit
      ).send();

  await op.confirmation(1);
  return op.opHash;
}

/**
 * Executes wallet-signed approve_activity on the Phase 3 SmartPy contract.
 * Requests signature from organizer's connected Beacon wallet and waits for 1 confirmation.
 */
export async function approveActivityOperation(activityId: string): Promise<string> {
  const wallet = getBeaconWallet();
  const activeAccount = await wallet.client.getActiveAccount();
  if (!activeAccount) {
    throw new Error('No active wallet connected. Please connect an authorized organizer wallet.');
  }

  const isOrg = await isAuthorizedOrganizer(activeAccount.address);
  if (!isOrg) {
    throw new Error(`Unauthorized: Wallet ${activeAccount.address} is not an authorized organizer on GreenTrace.`);
  }

  if (!CONTRACT_ADDRESS) {
    throw new Error(
      'Contract address (VITE_CONTRACT_ADDRESS) is not configured in .env. A deployed SmartPy contract on Shadownet is required for on-chain transactions.'
    );
  }

  tezos.setWalletProvider(wallet);
  const contract = await tezos.wallet.at(CONTRACT_ADDRESS);
  const op = await (contract as any).methods.approve_activity(activityId).send();
  await op.confirmation(1);
  return op.opHash;
}

/**
 * Executes wallet-signed reject_activity on the Phase 3 SmartPy contract.
 * Requests signature from organizer's connected Beacon wallet and waits for 1 confirmation.
 */
export async function rejectActivityOperation(activityId: string): Promise<string> {
  const wallet = getBeaconWallet();
  const activeAccount = await wallet.client.getActiveAccount();
  if (!activeAccount) {
    throw new Error('No active wallet connected. Please connect an authorized organizer wallet.');
  }

  const isOrg = await isAuthorizedOrganizer(activeAccount.address);
  if (!isOrg) {
    throw new Error(`Unauthorized: Wallet ${activeAccount.address} is not an authorized organizer on GreenTrace.`);
  }

  if (!CONTRACT_ADDRESS) {
    throw new Error(
      'Contract address (VITE_CONTRACT_ADDRESS) is not configured in .env. A deployed SmartPy contract on Shadownet is required for on-chain transactions.'
    );
  }

  tezos.setWalletProvider(wallet);
  const contract = await tezos.wallet.at(CONTRACT_ADDRESS);
  const op = await (contract as any).methods.reject_activity(activityId).send();
  await op.confirmation(1);
  return op.opHash;
}

/**
 * Format Tezos and Beacon error messages for end-user display.
 */
export function formatWalletError(error: unknown): string {
  if (!error) return 'An unknown wallet error occurred.';
  if (typeof error === 'string') return error;

  const errObj = error as { name?: string; message?: string; title?: string; description?: string };
  const message = errObj.message || errObj.description || '';

  if (message.includes('NOT_GRANTED') || message.includes('ABORTED') || message.includes('user cancelled')) {
    return 'Wallet connection was cancelled by the user.';
  }
  if (message.includes('NETWORK_NOT_SUPPORTED') || message.includes('network')) {
    return `Unsupported network. Please select ${TEZOS_NETWORK_NAME} in your wallet.`;
  }
  if (message.includes('Failed to fetch') || message.includes('NetworkError') || message.includes('RPC')) {
    return 'Unable to reach the Tezos RPC node. Please verify your internet connection.';
  }
  if (message.includes('empty_implicit_contract')) {
    return 'Account is empty or unfunded. Please request testnet funds from the faucet.';
  }

  return errObj.title || message || 'Wallet operation failed. Please check your wallet extension.';
}
