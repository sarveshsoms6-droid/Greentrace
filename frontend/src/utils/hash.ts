/**
 * GreenTrace 2.0 - SHA-256 Evidence Hashing & Utilities
 * Computes lowercase hexadecimal SHA-256 fingerprints from actual file bytes.
 */

export async function calculateBytesSHA256(bytes: ArrayBuffer | Uint8Array): Promise<string> {
  const uint8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  const hashBuffer = await crypto.subtle.digest('SHA-256', uint8 as unknown as BufferSource);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('').toLowerCase();
}

export async function calculateFileSHA256(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  return calculateBytesSHA256(arrayBuffer);
}

export async function calculateStringSHA256(text: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  return calculateBytesSHA256(data);
}

export function truncateAddress(address: string, start: number = 6, end: number = 4): string {
  if (!address) return '';
  if (address.length <= start + end) return address;
  return `${address.substring(0, start)}...${address.substring(address.length - end)}`;
}

export function formatTimestamp(isoString: string): string {
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return isoString;
    return d.toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return isoString;
  }
}
