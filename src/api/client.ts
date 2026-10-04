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

// A shipped build sends the session cookie on every call, so plain http would hand it to anyone
// on the path. `expo export` loads `.env` (`http://localhost:3000`), which is how one could ship.
if (!__DEV__ && new URL(target.url).protocol !== 'https:') {
  throw new Error('The API base URL must use https:// in a production build.');
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
  // eslint-disable-next-line no-console -- dev-only and deliberate, as above
  console.log(`[api] ${describeApiTarget(target)} — via ${target.source}`);
}

/** `ApiError.status` when the request never reached the server. */
export const OFFLINE_STATUS = 0;

/**
 * `ApiError.status` when we gave up waiting. Distinct from `OFFLINE_STATUS` because the
 * two need different copy: "check your connection" is wrong advice for a server that is
 * reachable and simply slow, which is what a stalled upload or a hung proxy looks like.
 * Not a real HTTP status — 408 is what a *server* sends, and nothing sent this.
 */
export const TIMEOUT_STATUS = -1;

/**
 * Ceilings, not expectations. Without one, `fetch` waits on the platform default (~60s on
 * iOS, indefinite on a black-holed socket), and the screen shows a spinner the user cannot
 * cancel. Callers that legitimately take longer pass their own: `coach.ts` allows 60s for
 * the planner, `auth.ts` allows the boot session only 5s because the splash waits on it.
 */
const DEFAULT_TIMEOUT_MS = 20_000;
/** A 50 MB recording over a slow uplink is minutes of legitimate transfer, not a stall. */
const UPLOAD_TIMEOUT_MS = 180_000;

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    /** better-auth's machine-readable `code` (e.g. `USER_ALREADY_EXISTS`), when the body has one. */
    public code?: string,
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

/** Ids that `encodeURIComponent` leaves intact but URL resolution treats as navigation. */
const UNSAFE_SEGMENTS = new Set(['', '.', '..']);

/**
 * Tag for API paths: each interpolated value is encoded as exactly one path segment, so a route
 * param like `../users/x` stays inside the resource it was meant for.
 */
export function apiPath(strings: TemplateStringsArray, ...segments: string[]) {
  return segments.reduce((path, segment, index) => {
    // No such resource can exist, and a 404 is what the screens already know how to show.
    if (UNSAFE_SEGMENTS.has(segment)) throw new ApiError('Not found', 404);
    return path + encodeURIComponent(segment) + strings[index + 1];
  }, strings[0]);
}

type RequestOptions = {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
  query?: Record<string, string | number | boolean | undefined>;
  /** /auth/* and /health/* sit outside the /api/v1 prefix. */
  unprefixed?: boolean;
  /** Abort after this many ms. Defaults to `DEFAULT_TIMEOUT_MS`; surfaces as `TIMEOUT_STATUS`. */
  timeoutMs?: number;
};

function buildUrl(path: string, query?: RequestOptions['query'], unprefixed?: boolean) {
  const url = new URL(`${baseUrl}${unprefixed ? '' : API_PREFIX}${path}`);
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined) url.searchParams.set(key, String(value));
  }
  return url.toString();
}

async function toApiError(response: Response) {
  try {
    const data = await response.json();
    const message = Array.isArray(data.message)
      ? data.message.join(', ')
      : (data.message ?? response.statusText);
    const code = typeof data.code === 'string' ? data.code : undefined;
    return new ApiError(message, response.status, code);
  } catch {
    return new ApiError(response.statusText, response.status);
  }
}

async function send(url: string, init: RequestInit, prefixed: boolean, timeoutMs: number) {
  // `AbortSignal.timeout` does not exist here: React Native polyfills AbortSignal from
  // abort-controller@3, which predates that static. whatwg-fetch does honour `signal`.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let response: Response;
  try {
    response = await fetch(url, { ...init, signal: controller.signal });
  } catch {
    // fetch only rejects when the request never completed — no route, DNS, TLS, or our
    // own abort above. Anything the server actually answered arrives as a non-ok
    // Response below. The signal is what separates our abort from a dead network; the
    // two used to collapse into one error and a timeout read as "no connection".
    throw controller.signal.aborted
      ? new ApiError('Timed out', TIMEOUT_STATUS)
      : new ApiError('No connection', OFFLINE_STATUS);
  } finally {
    clearTimeout(timer);
  }

  if (!response.ok) {
    // Only /api/v1 calls mean the session died. better-auth answers a wrong password
    // with 401 as well, and treating that as an expired session would sign the user
    // out in the middle of signing in.
    if (response.status === 401 && prefixed) onUnauthorized?.();
    throw await toApiError(response);
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
    options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
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
    UPLOAD_TIMEOUT_MS,
  );

  return response.json() as Promise<T>;
}
