import Constants from 'expo-constants';
import { Platform } from 'react-native';

const API_PREFIX = '/api/v1';

const baseUrl = Constants.expoConfig?.extra?.apiBaseUrl as string | undefined;

if (!baseUrl) {
  throw new Error('EXPO_PUBLIC_API_BASE_URL is not set — check your .env file.');
}

/** `ApiError.status` when the request never reached the server. */
export const OFFLINE_STATUS = 0;

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

let onUnauthorized: (() => void) | undefined;

/**
 * Registered once at app start (see `src/app/_layout.tsx`) so an expired cookie
 * clears the session instead of leaving every screen erroring. Kept as a setter
 * rather than a direct import because `session-store` → `api/auth` → `api/client`
 * already runs one way, and importing back would cycle.
 */
export function setUnauthorizedHandler(handler: () => void) {
  onUnauthorized = handler;
}

/**
 * better-auth's `originCheckMiddleware` runs on every `/auth/*` route and rejects any
 * non-GET that carries a Cookie unless `Origin`/`Referer` matches `trustedOrigins`.
 * React Native's fetch attaches cookies from the native store but never sets `Origin`,
 * so sign-out and every other authenticated auth call would 403. On web the browser
 * owns this header and setting it here is a no-op.
 */
const originHeader = Platform.OS === 'web' ? undefined : { Origin: new URL(baseUrl).origin };

type RequestOptions = {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
  query?: Record<string, string | number | boolean | undefined>;
  /** /auth/* and /health/* sit outside the /api/v1 prefix. */
  unprefixed?: boolean;
};

function buildUrl(path: string, query?: RequestOptions['query'], unprefixed?: boolean) {
  const url = new URL(`${baseUrl}${unprefixed ? '' : API_PREFIX}${path}`);
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined) url.searchParams.set(key, String(value));
  }
  return url.toString();
}

async function parseErrorMessage(response: Response) {
  try {
    const data = await response.json();
    return Array.isArray(data.message)
      ? data.message.join(', ')
      : (data.message ?? response.statusText);
  } catch {
    return response.statusText;
  }
}

async function send(url: string, init: RequestInit, prefixed: boolean) {
  let response: Response;
  try {
    response = await fetch(url, init);
  } catch {
    // fetch only rejects when the request never completed — no route, DNS, TLS.
    // Anything the server actually answered arrives as a non-ok Response below.
    throw new ApiError('No connection', OFFLINE_STATUS);
  }

  if (!response.ok) {
    // Only /api/v1 calls mean the session died. better-auth answers a wrong password
    // with 401 as well, and treating that as an expired session would sign the user
    // out in the middle of signing in.
    if (response.status === 401 && prefixed) onUnauthorized?.();
    throw new ApiError(await parseErrorMessage(response), response.status);
  }

  return response;
}

export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const response = await send(
    buildUrl(path, options.query, options.unprefixed),
    {
      method: options.method ?? 'GET',
      credentials: 'include',
      headers: {
        ...(options.body ? { 'Content-Type': 'application/json' } : {}),
        ...originHeader,
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
    },
    !options.unprefixed,
  );

  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export async function upload<T>(
  path: string,
  file: { uri: string; name: string; mimeType: string },
): Promise<T> {
  const formData = new FormData();
  // React Native's FormData accepts this shape for file uploads; the DOM File type doesn't apply here.
  formData.append('file', {
    uri: file.uri,
    name: file.name,
    type: file.mimeType,
  } as unknown as Blob);

  const response = await send(
    buildUrl(path),
    {
      method: 'POST',
      credentials: 'include',
      headers: { ...originHeader },
      body: formData,
    },
    true,
  );

  return response.json() as Promise<T>;
}
