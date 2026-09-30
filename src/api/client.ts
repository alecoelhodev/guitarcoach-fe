import Constants from 'expo-constants';
import { Platform } from 'react-native';

import { type ApiTarget, describeApiTarget, resolveApiTarget } from '@/api/base-url';

const API_PREFIX = '/api/v1';

const target = resolveApiTarget({
  platform: Platform.OS,
  // Read from `process.env`, never `Constants.expoConfig.extra`. On web the app config is inlined
  // into expo-constants as a literal at Babel transform time, and Metro's transform cache key does
  // not include the config — so `extra` keeps whatever it held when that cache entry was written,
  // across restarts, until `--clear`. `EXPO_PUBLIC_*` is re-injected by the serializer on every
  // build instead. `hostUri` is safe: on native it comes from the per-request dev-server manifest,
  // and web never reads it.
  apiBaseUrl: process.env.EXPO_PUBLIC_API_BASE_URL,
  apiBaseUrlNative: process.env.EXPO_PUBLIC_API_BASE_URL_NATIVE,
  hostUri: Constants.expoConfig?.hostUri,
});

if (!target) {
  throw new Error(
    'EXPO_PUBLIC_API_BASE_URL is not set — run `npm run dev:local`, or check your .env file.',
  );
}

/** Which backend this build is talking to. Read by the dev-only row on the profile screen. */
export const apiTarget: ApiTarget = target;

const baseUrl = target.url;

// The only console call in `src/`, and deliberate: an unreachable backend and a wrong backend
// are the same `ApiError('No connection', 0)` at the UI, so the terminal has to say which one
// the app actually chose before the first screen renders.
// `NODE_ENV !== 'test'` because jest-expo leaves `__DEV__` true: without it this prints once
// per suite for all 47 of them.
if (__DEV__ && process.env.NODE_ENV !== 'test') {
  console.log(`[api] ${describeApiTarget(target)} — via ${target.source}`);
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
  /** Abort after this many ms. Surfaces as the same offline `ApiError` as an unreachable server. */
  timeoutMs?: number;
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

async function send(url: string, init: RequestInit, prefixed: boolean, timeoutMs?: number) {
  // `AbortSignal.timeout` does not exist here: React Native polyfills AbortSignal from
  // abort-controller@3, which predates that static. whatwg-fetch does honour `signal`.
  const controller = timeoutMs === undefined ? undefined : new AbortController();
  const timer =
    controller === undefined ? undefined : setTimeout(() => controller.abort(), timeoutMs);

  let response: Response;
  try {
    response = await fetch(url, { ...init, signal: controller?.signal });
  } catch {
    // fetch only rejects when the request never completed — no route, DNS, TLS, or our
    // own abort above. Anything the server actually answered arrives as a non-ok
    // Response below.
    throw new ApiError('No connection', OFFLINE_STATUS);
  } finally {
    clearTimeout(timer);
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
    options.timeoutMs,
  );

  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export type UploadFile = {
  uri: string;
  name: string;
  mimeType: string;
  /**
   * The browser's own `File`, when there is one. `expo-document-picker` sets it on web only
   * (SDK 57 `DocumentPickerAsset.file`), and on web it is the *only* usable form: a browser
   * `FormData.append` stringifies a plain object to "[object Object]", so the server received
   * a text field instead of a file and answered 400. React Native's `FormData` is the one that
   * understands `{ uri, name, type }`.
   */
  file?: Blob;
};

export async function upload<T>(path: string, file: UploadFile): Promise<T> {
  const formData = new FormData();

  if (file.file) {
    formData.append('file', file.file, file.name);
  } else {
    formData.append('file', {
      uri: file.uri,
      name: file.name,
      type: file.mimeType,
    } as unknown as Blob);
  }

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
