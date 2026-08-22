export interface StoredTokens {
  prodToken?: string;
  sandboxToken?: string;
  celigoStack?: 'us' | 'eu';
  gchatWebhookUrl?: string;
}

const STORAGE_KEY = 'celigo_user_tokens';

export function getStoredTokens(): StoredTokens {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

export function saveTokens(tokens: StoredTokens): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tokens));
  } catch (err) {
    console.error('Failed to save tokens to localStorage:', err);
  }
}

export function clearTokens(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (err) {
    console.error('Failed to clear tokens from localStorage:', err);
  }
}

export function getCeligoHeaders(): Record<string, string> {
  const tokens = getStoredTokens();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (tokens.prodToken) {
    headers['x-celigo-prod-token'] = tokens.prodToken;
  }
  if (tokens.sandboxToken) {
    headers['x-celigo-sandbox-token'] = tokens.sandboxToken;
  }
  if (tokens.celigoStack) {
    headers['x-celigo-stack'] = tokens.celigoStack;
  }

  return headers;
}

export async function testCeligoTokens(prodToken: string, sandboxToken: string, stack: 'us' | 'eu' = 'us'): Promise<{
  prod?: { connected: boolean; message?: string };
  sandbox?: { connected: boolean; message?: string };
}> {
  const res = await fetch('/api/celigo/test-connection', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prodToken, sandboxToken, stack }),
  });

  if (!res.ok) {
    throw new Error(`Token verification failed: ${res.statusText}`);
  }

  return await res.json();
}
