// `client.ts` imports expo-file-system for native uploads; the real module reaches into React
// Native, which `loadClient` stubs down to `Platform`. The upload suite re-points this per case.
jest.mock('expo-file-system', () => ({ File: jest.fn(), UploadType: { MULTIPART: 1 } }));

import { asShippedBuild } from '@/test/dev-flag';

type Client = typeof import('@/api/client');

type ApiEnv = { apiBaseUrl?: string; apiBaseUrlNative?: string };

/**
 * `client.ts` reads `Platform.OS` and the two environment variables once at module load, so each
 * platform — and each pair of values — needs a fresh copy. The default mirrors `jest.setup.ts`, so
 * a caller that does not care about the base URL gets the same value every other suite sees.
 *
 * The variables are set rather than mocked because that is how the app receives them: Metro's
 * serializer injects `EXPO_PUBLIC_*` into `process.env`, and under Jest `expo/virtual/env` is
 * literally `export const env = process.env`, so a write here is what the module reads.
 */
function loadClient(
  platform: 'ios' | 'web',
  env: ApiEnv = { apiBaseUrl: 'http://localhost:3000' },
): Client {
  jest.resetModules();
  setApiEnv(env);
  jest.doMock('react-native', () => ({ Platform: { OS: platform } }));
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require('@/api/client') as Client;
}

function setApiEnv({ apiBaseUrl, apiBaseUrlNative }: ApiEnv) {
  // Deleted rather than set to '', which `resolveApiTarget` treats as "configured but empty".
  if (apiBaseUrl === undefined) delete process.env.EXPO_PUBLIC_API_BASE_URL;
  else process.env.EXPO_PUBLIC_API_BASE_URL = apiBaseUrl;

  if (apiBaseUrlNative === undefined) delete process.env.EXPO_PUBLIC_API_BASE_URL_NATIVE;
  else process.env.EXPO_PUBLIC_API_BASE_URL_NATIVE = apiBaseUrlNative;
}

// Both variables are process-wide, so a suite that leaves one set would change what every later
// suite in this file resolves.
afterEach(() => setApiEnv({ apiBaseUrl: 'http://localhost:3000' }));

function jsonResponse(status: number, body: unknown = {}) {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: 'error',
    json: async () => body,
  } as Response;
}

describe('request', () => {
  afterEach(() => {
    jest.resetModules();
    jest.restoreAllMocks();
  });

  it('sends an Origin header on native so better-auth accepts cookie-bearing calls', async () => {
    const { request } = loadClient('ios');
    const fetchMock = jest.fn().mockResolvedValue(jsonResponse(200));
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    await request('/auth/sign-out', { method: 'POST', unprefixed: true });

    const [, init] = fetchMock.mock.calls[0];
    expect(init.headers.Origin).toBe('http://localhost:3000');
  });

  it('prefers the native base URL on iOS, where localhost would mean the phone itself', async () => {
    const { request } = loadClient('ios', {
      apiBaseUrl: 'http://localhost:3000',
      apiBaseUrlNative: 'https://api.example.com',
    });
    const fetchMock = jest.fn().mockResolvedValue(jsonResponse(200));
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    await request('/routines');

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.example.com/api/v1/routines');
    // The synthesized Origin has to follow the base URL, or better-auth rejects every
    // cookie-bearing call against the deployed backend.
    expect(init.headers.Origin).toBe('https://api.example.com');
  });

  it('ignores the native base URL on web, which reaches the local backend directly', async () => {
    const { request } = loadClient('web', {
      apiBaseUrl: 'http://localhost:3000',
      apiBaseUrlNative: 'https://api.example.com',
    });
    const fetchMock = jest.fn().mockResolvedValue(jsonResponse(200));
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    await request('/routines');

    expect(fetchMock.mock.calls[0][0]).toBe('http://localhost:3000/api/v1/routines');
  });

  it('omits Origin on web, where the browser owns it', async () => {
    const { request } = loadClient('web');
    const fetchMock = jest.fn().mockResolvedValue(jsonResponse(200));
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    await request('/auth/sign-out', { method: 'POST', unprefixed: true });

    const [, init] = fetchMock.mock.calls[0];
    expect(init.headers.Origin).toBeUndefined();
  });

  it('clears the session when an API call is rejected', async () => {
    const { request, setUnauthorizedHandler, ApiError } = loadClient('ios');
    globalThis.fetch = jest
      .fn()
      .mockResolvedValue(jsonResponse(401, { message: 'Unauthorized' })) as unknown as typeof fetch;
    const onUnauthorized = jest.fn();
    setUnauthorizedHandler(onUnauthorized);

    await expect(request('/routines')).rejects.toBeInstanceOf(ApiError);
    expect(onUnauthorized).toHaveBeenCalledTimes(1);
  });

  it('leaves the session alone when a sign-in attempt is rejected', async () => {
    const { request, setUnauthorizedHandler } = loadClient('ios');
    globalThis.fetch = jest
      .fn()
      .mockResolvedValue(
        jsonResponse(401, { message: 'Invalid email or password' }),
      ) as unknown as typeof fetch;
    const onUnauthorized = jest.fn();
    setUnauthorizedHandler(onUnauthorized);

    await expect(
      request('/auth/sign-in/email', { method: 'POST', body: {}, unprefixed: true }),
    ).rejects.toThrow('Invalid email or password');
    expect(onUnauthorized).not.toHaveBeenCalled();
  });

  it("carries better-auth's error code so the UI can word it without the server's text", async () => {
    const { request } = loadClient('ios');
    globalThis.fetch = jest.fn().mockResolvedValue(
      jsonResponse(422, {
        message: 'User already exists. Use another email.',
        code: 'USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL',
      }),
    ) as unknown as typeof fetch;

    await expect(
      request('/auth/sign-up/email', { method: 'POST', body: {}, unprefixed: true }),
    ).rejects.toMatchObject({ status: 422, code: 'USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL' });
  });

  it('leaves the code undefined for a Nest error, which has none', async () => {
    const { request } = loadClient('ios');
    globalThis.fetch = jest
      .fn()
      .mockResolvedValue(
        jsonResponse(400, { message: ['title should not be empty'], statusCode: 400 }),
      ) as unknown as typeof fetch;

    await expect(request('/routines', { method: 'POST', body: {} })).rejects.toMatchObject({
      status: 400,
      code: undefined,
      message: 'title should not be empty',
    });
  });

  it('aborts a request that outruns its timeout and reports it as a timeout, not offline', async () => {
    jest.useFakeTimers();
    const { request, OFFLINE_STATUS, TIMEOUT_STATUS } = loadClient('ios');
    // A server that never answers: the abort signal is the only thing that settles this.
    globalThis.fetch = jest.fn(
      (_url, init: RequestInit) =>
        new Promise((_resolve, reject) => {
          init.signal?.addEventListener('abort', () => reject(new Error('Aborted')));
        }),
    ) as unknown as typeof fetch;

    const pending = request('/auth/get-session', { unprefixed: true, timeoutMs: 5000 });
    jest.advanceTimersByTime(5000);

    // The distinction is the point: "check your connection" is wrong advice for a server
    // that is reachable and merely slow.
    await expect(pending).rejects.toMatchObject({ name: 'ApiError', status: TIMEOUT_STATUS });
    await expect(pending).rejects.not.toMatchObject({ status: OFFLINE_STATUS });
    jest.useRealTimers();
  });

  it('bounds a request that names no timeout of its own', async () => {
    jest.useFakeTimers();
    const { request, TIMEOUT_STATUS } = loadClient('ios');
    globalThis.fetch = jest.fn(
      (_url, init: RequestInit) =>
        new Promise((_resolve, reject) => {
          init.signal?.addEventListener('abort', () => reject(new Error('Aborted')));
        }),
    ) as unknown as typeof fetch;

    const pending = request('/routines');
    // Every transport but `coach.ts` and `getSession()` relies on this default; without it
    // a hung socket left the screen spinning with no cancel affordance.
    jest.advanceTimersByTime(20_000);

    await expect(pending).rejects.toMatchObject({ name: 'ApiError', status: TIMEOUT_STATUS });
    jest.useRealTimers();
  });

  it('reports an unreachable server as an offline ApiError', async () => {
    const { request, ApiError, OFFLINE_STATUS } = loadClient('ios');
    globalThis.fetch = jest
      .fn()
      .mockRejectedValue(new TypeError('Network request failed')) as unknown as typeof fetch;

    await expect(request('/routines')).rejects.toMatchObject({
      name: 'ApiError',
      status: OFFLINE_STATUS,
    });
    await expect(request('/routines')).rejects.toBeInstanceOf(ApiError);
  });
});

describe('upload', () => {
  afterEach(() => {
    jest.resetModules();
    jest.restoreAllMocks();
  });

  const TAKE = { uri: 'file:///take-1.m4a', name: 'take-1.m4a', mimeType: 'audio/x-m4a' };

  /** Native goes through expo-file-system's `File.upload`; the mock records what it was given. */
  function nativeUpload(result: { status: number; body?: string } | Error) {
    const uploadMock = jest.fn((_url: string, options: { signal?: AbortSignal }) =>
      result instanceof Error
        ? Promise.reject(result)
        : result.status === 0
          ? new Promise((_, reject) =>
              options.signal?.addEventListener('abort', () => reject(new Error('aborted'))),
            )
          : Promise.resolve({ headers: {}, body: '', ...result }),
    );
    const FileMock = jest.fn(() => ({ upload: uploadMock }));
    jest.doMock('expo-file-system', () => ({ File: FileMock, UploadType: { MULTIPART: 1 } }));
    return { FileMock, uploadMock };
  }

  /**
   * React Native's `FormData` `{ uri }` part never reached the API from an iPhone in Expo Go —
   * no native upload ever appeared in the Cloud Run logs — so native uses expo-file-system.
   */
  it('uploads natively as multipart, with the method, field, MIME type and Origin', async () => {
    const { FileMock, uploadMock } = nativeUpload({ status: 201, body: '{"id":"rec-1"}' });
    const { upload } = loadClient('ios');
    const fetchMock = jest.fn();
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const result = await upload('/users/me/avatar', TAKE, 'PUT');

    expect(result).toEqual({ id: 'rec-1' });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(FileMock).toHaveBeenCalledWith('file:///take-1.m4a');
    const [url, options] = uploadMock.mock.calls[0];
    expect(url).toBe('http://localhost:3000/api/v1/users/me/avatar');
    expect(options).toMatchObject({
      httpMethod: 'PUT',
      uploadType: 1,
      fieldName: 'file',
      mimeType: 'audio/x-m4a',
      headers: { Origin: 'http://localhost:3000' },
      sessionType: 'foreground',
    });
  });

  it('defaults to POST, as the recordings route expects', async () => {
    const { uploadMock } = nativeUpload({ status: 201, body: '{}' });
    const { upload } = loadClient('ios');

    await upload('/practice-sessions/s1/recordings', TAKE);

    expect(uploadMock.mock.calls[0][1]).toMatchObject({ httpMethod: 'POST' });
  });

  it('turns a rejected native upload into an ApiError with the server message', async () => {
    nativeUpload({ status: 413, body: '{"message":"File too large"}' });
    const { upload } = loadClient('ios');

    await expect(upload('/practice-sessions/s1/recordings', TAKE)).rejects.toMatchObject({
      name: 'ApiError',
      status: 413,
      message: 'File too large',
    });
  });

  it('treats a 401 as an expired session, like any other API call', async () => {
    nativeUpload({ status: 401, body: '{}' });
    const { upload, setUnauthorizedHandler } = loadClient('ios');
    const expired = jest.fn();
    setUnauthorizedHandler(expired);

    await expect(upload('/users/me/avatar', TAKE, 'PUT')).rejects.toMatchObject({ status: 401 });
    expect(expired).toHaveBeenCalledTimes(1);
  });

  it('reports a native transport failure as no connection', async () => {
    nativeUpload(new Error('The network connection was lost.'));
    const { upload, OFFLINE_STATUS } = loadClient('ios');

    await expect(upload('/users/me/avatar', TAKE, 'PUT')).rejects.toMatchObject({
      status: OFFLINE_STATUS,
    });
  });

  it('reports a native upload that outlives the deadline as a timeout', async () => {
    jest.useFakeTimers();
    try {
      nativeUpload({ status: 0 });
      const { upload, TIMEOUT_STATUS } = loadClient('ios');

      const sending = upload('/users/me/avatar', TAKE, 'PUT');
      const settled = expect(sending).rejects.toMatchObject({ status: TIMEOUT_STATUS });
      await jest.advanceTimersByTimeAsync(180_000);
      await settled;
    } finally {
      jest.useRealTimers();
    }
  });

  /**
   * QA-03. On web the `{ uri, name, type }` object is meaningless: a browser's `FormData`
   * coerces it to the string "[object Object]", the server answered 400, and the screen said
   * "That file can't be uploaded" for a valid WAV. The picker's own `File` is the only form
   * that survives, so web sends it through fetch.
   */
  it('sends the picker File itself through fetch on web', async () => {
    const { upload } = loadClient('web');
    const fetchMock = jest.fn().mockResolvedValue(jsonResponse(201, { id: 'rec-1' }));
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    const picked = new Blob(['RIFF'], { type: 'audio/wav' });

    await upload('/practice-sessions/s1/recordings', {
      uri: 'blob:http://localhost/abc',
      name: 'take-1.wav',
      mimeType: 'audio/wav',
      file: picked,
    });

    const [, init] = fetchMock.mock.calls[0];
    expect(init.method).toBe('POST');
    expect(init.credentials).toBe('include');
    // No Content-Type of our own: fetch has to set the multipart boundary itself.
    expect(init.headers).toBeUndefined();
    const sent = init.body.get('file');
    expect(sent).toBeInstanceOf(Blob);
    expect(sent).not.toBe('[object Object]');
  });
});

describe('the resolved base URL', () => {
  /**
   * `EXPO_PUBLIC_API_BASE_URL_NATIVE= expo start` is how `npm run dev:local` clears a stale
   * .env entry, and @expo/env treats an empty string as defined — so it reaches the app as `''`
   * rather than undefined. If a `??` ever chose it over the real URL, every request would go to a
   * relative URL and fail as "No connection" with nothing to point at.
   */
  it('ignores an empty native override rather than preferring it', async () => {
    const { request } = loadClient('ios', {
      apiBaseUrl: 'http://localhost:3000',
      apiBaseUrlNative: '',
    });
    const fetchMock = jest.fn().mockResolvedValue(jsonResponse(200));
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    await request('/tasks');

    expect(fetchMock.mock.calls[0][0]).toBe('http://localhost:3000/api/v1/tasks');
  });

  it('exposes which backend it chose, and which variable chose it', () => {
    const { apiTarget } = loadClient('ios', {
      apiBaseUrl: 'http://localhost:3000',
      apiBaseUrlNative: 'https://example.test',
    });

    expect(apiTarget).toEqual({
      url: 'https://example.test',
      source: 'EXPO_PUBLIC_API_BASE_URL_NATIVE',
      lanRewritten: false,
    });
  });

  it('refuses to load at all when nothing is configured', () => {
    expect(() => loadClient('web', {})).toThrow(/EXPO_PUBLIC_API_BASE_URL is not set/);
  });

  it('refuses to load in a shipped build pointed at plain http', async () => {
    await asShippedBuild(() => {
      expect(() => loadClient('web', { apiBaseUrl: 'http://localhost:3000' })).toThrow(
        /must use https/,
      );
    });
  });

  it('checks the URL the platform actually uses, not just the shared one', async () => {
    await asShippedBuild(() => {
      expect(() =>
        loadClient('ios', {
          apiBaseUrl: 'https://api.example.com',
          apiBaseUrlNative: 'http://192.168.1.20:3000',
        }),
      ).toThrow(/must use https/);
    });
  });

  it('loads in a shipped build pointed at https', async () => {
    await asShippedBuild(() => {
      expect(loadClient('ios', { apiBaseUrl: 'https://api.example.com' }).apiTarget.url).toBe(
        'https://api.example.com',
      );
    });
  });

  // jest-expo leaves `__DEV__` true, which is what every other case in this file relies on.
  it('still allows http in development, where the backend is local', () => {
    expect(() => loadClient('web', { apiBaseUrl: 'http://localhost:3000' })).not.toThrow();
  });
});
