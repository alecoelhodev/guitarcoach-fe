type Client = typeof import('@/api/client');

/** `client.ts` reads `Platform.OS` once at module load, so each platform needs a fresh copy. */
function loadClient(platform: 'ios' | 'web'): Client {
  jest.resetModules();
  jest.doMock('react-native', () => ({ Platform: { OS: platform } }));
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
