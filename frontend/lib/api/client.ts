import { supabase } from '@/supabase';
import { getOrCreateDeviceId } from '@/services/deviceId';

const BASE_URL = process.env.EXPO_PUBLIC_API_URL!;

let _refreshing: Promise<string | null> | null = null;

async function getBaseHeaders(): Promise<Record<string, string>> {
  const [{ data }, deviceId] = await Promise.all([
    supabase.auth.getSession(),
    getOrCreateDeviceId(),
  ]);

  let accessToken = data.session?.access_token ?? null;
  const session = data.session;

  if (session && session.expires_at !== undefined && session.expires_at - Math.floor(Date.now() / 1000) < 60) {
    if (!_refreshing) {
      _refreshing = supabase.auth.refreshSession()
        .then(({ data }) => data.session?.access_token ?? null)
        .finally(() => { _refreshing = null; });
    }
    const freshToken = await _refreshing;
    if (freshToken) accessToken = freshToken;
  }

  const headers: Record<string, string> = { 'X-Device-ID': deviceId };
  if (accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`;
  }
  return headers;
}

export async function getAuthHeader(): Promise<Record<string, string>> {
  return getBaseHeaders();
}

async function parseError(res: Response): Promise<Error> {
  const text = await res.text();
  try {
    const json = JSON.parse(text);
    return new Error(json.detail ?? text);
  } catch {
    return new Error(text);
  }
}

async function fetchWithRetryOn401(
  url: string,
  options: RequestInit,
): Promise<Response> {
  const res = await fetch(url, options);

  // On 401, refresh token and retry once
  if (res.status === 401) {
    console.log('[client] 401 received — refreshing token and retrying');
    const { data } = await supabase.auth.refreshSession();
    if (!data.session) {
      // Refresh failed — session is truly dead, sign out
      await supabase.auth.signOut();
      throw new Error('Session expired. Please sign in again.');
    }
    const newHeaders = {
      ...options.headers as Record<string, string>,
      'Authorization': `Bearer ${data.session.access_token}`,
    };
    const retryRes = await fetch(url, { ...options, headers: newHeaders });
    if (retryRes.status === 401) {
      await supabase.auth.signOut();
      throw new Error('Session expired. Please sign in again.');
    }
    return retryRes;
  }

  return res;
}

export async function apiGet<T>(path: string): Promise<T> {
  const headers = await getBaseHeaders();
  const res = await fetchWithRetryOn401(`${BASE_URL}${path}`, { headers });
  if (!res.ok) throw await parseError(res);
  return res.json();
}

export async function apiPost<T>(path: string, body?: unknown): Promise<T> {
  const headers = await getBaseHeaders();
  const res = await fetchWithRetryOn401(`${BASE_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw await parseError(res);
  return res.json();
}

export async function apiPatch<T>(path: string, body?: unknown): Promise<T> {
  const headers = await getBaseHeaders();
  const res = await fetchWithRetryOn401(`${BASE_URL}${path}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw await parseError(res);
  return res.json();
}

export async function apiDelete<T>(path: string): Promise<T> {
  const headers = await getBaseHeaders();
  const res = await fetchWithRetryOn401(`${BASE_URL}${path}`, {
    method: 'DELETE',
    headers,
  });
  if (!res.ok) throw await parseError(res);
  return res.json();
}

export async function apiStream(path: string, body?: unknown): Promise<Response> {
  const headers = await getBaseHeaders();
  const res = await fetchWithRetryOn401(`${BASE_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw await parseError(res);
  return res;
}

export async function apiPostBlob(path: string, body?: unknown): Promise<Blob> {
  const headers = await getBaseHeaders();
  const res = await fetchWithRetryOn401(`${BASE_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw await parseError(res);
  return res.blob();
}
