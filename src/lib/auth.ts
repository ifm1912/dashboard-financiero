import { cookies } from 'next/headers';
import { randomBytes, createHmac } from 'crypto';

// Credenciales (REQUIERE .env.local — no hay fallback inseguro)
const VALID_CREDENTIALS = {
  email: process.env.AUTH_EMAIL?.trim(),
  password: process.env.AUTH_PASSWORD?.trim(),
};

const SESSION_SECRET = (process.env.SESSION_SECRET || randomBytes(32).toString('hex')).trim();
const SESSION_COOKIE_NAME = 'gpt-finance-session';
const SESSION_MAX_AGE = 60 * 60 * 24 * 7; // 7 días

function generateSessionToken(): string {
  const payload = randomBytes(32).toString('hex');
  const signature = createHmac('sha256', SESSION_SECRET).update(payload).digest('hex');
  return `${payload}.${signature}`;
}

export async function validateCredentials(email: string, password: string): Promise<boolean> {
  if (!VALID_CREDENTIALS.email || !VALID_CREDENTIALS.password) {
    console.error('[auth] AUTH_EMAIL y AUTH_PASSWORD deben estar definidos en .env.local');
    return false;
  }
  return email === VALID_CREDENTIALS.email && password === VALID_CREDENTIALS.password;
}

export async function createSession(): Promise<string> {
  const token = generateSessionToken();
  const cookieStore = await cookies();

  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: SESSION_MAX_AGE,
    path: '/',
  });

  return token;
}

export async function getSession(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get(SESSION_COOKIE_NAME)?.value || null;
}

export async function destroySession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
}

export function isAuthenticated(sessionToken: string | null): boolean {
  if (!sessionToken) return false;
  const parts = sessionToken.split('.');
  if (parts.length !== 2) return false;
  const [payload, signature] = parts;
  const expectedSignature = createHmac('sha256', SESSION_SECRET).update(payload).digest('hex');
  // Constant-time comparison to prevent timing attacks
  if (signature.length !== expectedSignature.length) return false;
  let mismatch = 0;
  for (let i = 0; i < signature.length; i++) {
    mismatch |= signature.charCodeAt(i) ^ expectedSignature.charCodeAt(i);
  }
  return mismatch === 0;
}
