import crypto from 'node:crypto';

const SECRET =
  import.meta.env.SUPABASE_SERVICE_ROLE_KEY ||
  import.meta.env.PUBLIC_SUPABASE_ANON_KEY ||
  'blossom-download-secret-2026';

export function createDownloadToken(bookId: string): string {
  const expiresAt = Math.floor(Date.now() / 1000) + 600; // valid for 10 minutes
  const payload = `${bookId}:${expiresAt}`;
  const hmac = crypto.createHmac('sha256', SECRET).update(payload).digest('hex').slice(0, 16);
  return `${payload}:${hmac}`;
}

export function verifyDownloadToken(bookId: string | undefined, token: string | null | undefined): boolean {
  if (!token || typeof token !== 'string') return false;
  const parts = token.split(':');
  if (parts.length !== 3) return false;

  const [tBookId, expiresAtStr, hmac] = parts;
  if (bookId && tBookId !== bookId) return false;

  const expiresAt = parseInt(expiresAtStr, 10);
  if (isNaN(expiresAt) || Math.floor(Date.now() / 1000) > expiresAt) return false;

  const expectedPayload = `${tBookId}:${expiresAtStr}`;
  const expectedHmac = crypto.createHmac('sha256', SECRET).update(expectedPayload).digest('hex').slice(0, 16);
  return hmac === expectedHmac;
}
