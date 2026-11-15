import { randomBytes } from 'node:crypto';

/**
 * UUIDv7: 48-bit millisecond timestamp + random bits. Sorts chronologically as a string, so
 * `ANALYSIS#<uuidv7>` sort keys come back newest-first with ScanIndexForward=false.
 */
export function uuidv7(now: number = Date.now()): string {
  const b = randomBytes(16);
  let ts = BigInt(now);
  for (let i = 5; i >= 0; i--) {
    b[i] = Number(ts & 0xffn);
    ts >>= 8n;
  }
  b[6] = (b[6]! & 0x0f) | 0x70; // version 7
  b[8] = (b[8]! & 0x3f) | 0x80; // RFC 4122 variant
  const h = b.toString('hex');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

/** Public share id: 72 random bits, URL-safe, 12 chars — unguessable. */
export function newShareId(): string {
  return randomBytes(9).toString('base64url');
}

export const SHARE_ID_RE = /^[A-Za-z0-9_-]{12}$/;
