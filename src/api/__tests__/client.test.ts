type Client = typeof import('@/api/client');

/**
 * `client.ts` reads `Platform.OS` and the config once at module load, so each platform — and
 * each `extra` — needs a fresh copy. The default mirrors `jest.setup.ts`, so a caller that
 * does not care about the base URL gets the same value every other suite sees.
 */
function loadClient(
  platform: 'ios' | 'web',
  extra: Record<string, string> = { apiBaseUrl: 'http://localhost:3000' },
): Client {
  jest.resetModules();
  jest.doMock('react-native', () => ({ Platform: { OS: platform } }));
  jest.doMock('expo-constants', () => ({
    __esModule: true,
    default: { expoConfig: { extra } },
  }));
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require('@/api/client') as Client;
}

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

  it('aborts a request that outruns its timeout and reports it as offline', async () => {
    jest.useFakeTimers();
    const { request, OFFLINE_STATUS } = loadClient('ios');
    // A server that never answers: the abort signal is the only thing that settles this.
    globalThis.fetch = jest.fn(
      (_url, init: RequestInit) =>
        new Promise((_resolve, reject) => {
          init.signal?.addEventListener('abort', () => reject(new Error('Aborted')));
        }),
    ) as unknown as typeof fetch;

    const pending = request('/auth/get-session', { unprefixed: true, timeoutMs: 5000 });
    jest.advanceTimersByTime(5000);

    await expect(pending).rejects.toMatchObject({ name: 'ApiError', status: OFFLINE_STATUS });
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

  it('sends the file as multipart FormData in the shape React Native expects', async () => {
    const { upload } = loadClient('ios');
    const fetchMock = jest.fn().mockResolvedValue(jsonResponse(201, { id: 'rec-1' }));
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const result = await upload('/practice-sessions/s1/recordings', {
      uri: 'file:///take-1.m4a',
      name: 'take-1.m4a',
      mimeType: 'audio/x-m4a',
    });

    expect(result).toEqual({ id: 'rec-1' });
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain('/api/v1/practice-sessions/s1/recordings');
    expect(init.method).toBe('POST');
    expect(init.credentials).toBe('include');
    expect(init.body).toBeInstanceOf(FormData);
    // No Content-Type of our own: fetch has to set the multipart boundary itself.
    expect(init.headers).not.toHaveProperty('Content-Type');
    // The field is present but its value cannot be read back as an object here: production
    // uses React Native's FormData, which accepts `{ uri, name, type }`, while this
    // environment's FormData coerces any non-Blob value to a string. So only presence is
    // asserted — the shape itself is what the `as unknown as Blob` cast in `client.ts` exists
    // to express, and RN's own implementation is what honours it.
    expect(init.body.has('file')).toBe(true);
  });

  it('carries the Origin header on native, like every other request', async () => {
    const { upload } = loadClient('ios');
    const fetchMock = jest.fn().mockResolvedValue(jsonResponse(201));
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    await upload('/practice-sessions/s1/recordings', {
      uri: 'file:///a.m4a',
      name: 'a.m4a',
      mimeType: 'audio/x-m4a',
    });

    expect(fetchMock.mock.calls[0][1].headers).toMatchObject({
      Origin: 'http://localhost:3000',
    });
  });

  it('raises an ApiError when the upload is rejected', async () => {
    const { upload, ApiError } = loadClient('ios');
    globalThis.fetch = jest
      .fn()
      .mockResolvedValue(
        jsonResponse(413, { message: 'File too large' }),
      ) as unknown as typeof fetch;

    await expect(
      upload('/practice-sessions/s1/recordings', {
        uri: 'file:///big.m4a',
        name: 'big.m4a',
        mimeType: 'audio/x-m4a',
      }),
    ).rejects.toBeInstanceOf(ApiError);
  });
});
