import Constants from 'expo-constants';

const API_PREFIX = '/api/v1';

const baseUrl = Constants.expoConfig?.extra?.apiBaseUrl as string | undefined;

if (!baseUrl) {
  throw new Error('EXPO_PUBLIC_API_BASE_URL is not set — check your .env file.');
}

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

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

export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const response = await fetch(buildUrl(path, options.query, options.unprefixed), {
    method: options.method ?? 'GET',
    credentials: 'include',
    headers: options.body ? { 'Content-Type': 'application/json' } : undefined,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  if (!response.ok) {
    throw new ApiError(await parseErrorMessage(response), response.status);
  }

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

  const response = await fetch(buildUrl(path), {
    method: 'POST',
    credentials: 'include',
    body: formData,
  });

  if (!response.ok) {
    throw new ApiError(await parseErrorMessage(response), response.status);
  }

  return response.json() as Promise<T>;
}
