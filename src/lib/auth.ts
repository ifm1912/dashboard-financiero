import { cookies } from 'next/headers';

// Credenciales (configurable via .env.local)
const VALID_CREDENTIALS = {
  email: process.env.AUTH_EMAIL || 'admin@gptfinance.com',
  password: process.env.AUTH_PASSWORD || 'admin123',
};

const SESSION_COOKIE_NAME = 'gpt-finance-session';
const SESSION_MAX_AGE = 60 * 60 * 24 * 7; // 7 días

function generateSessionToken(): string {
  return `session_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
}

export async function validateCredentials(email: string, password: string): Promise<boolean> {
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
  return sessionToken !== null && sessionToken.startsWith('session_');
}
