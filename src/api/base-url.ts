/**
 * Where the app points, and why.
 *
 * `EXPO_PUBLIC_API_BASE_URL` and `EXPO_PUBLIC_API_BASE_URL_NATIVE` are resolved on the dev machine
 * and inlined into the bundle the device downloads — so a phone receives whatever `localhost`
 * meant on the Mac, i.e. itself. The native override exists to point iOS/Android somewhere
 * reachable while the browser keeps the local one; the LAN rewrite below covers the case where you
 * want both on local Docker.
 */

/** Hosts that mean "this device", and therefore the wrong thing on a phone. */
const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);

/** `hostUri` is `host:port`; a bare IPv4 is the only shape safe to graft onto a loopback URL. */
const IPV4 = /^\d{1,3}(\.\d{1,3}){3}$/;

export type ApiTargetSource = 'EXPO_PUBLIC_API_BASE_URL' | 'EXPO_PUBLIC_API_BASE_URL_NATIVE';

export type ApiTarget = {
  url: string;
  /** Which variable produced it — i.e. what to change to move the app. */
  source: ApiTargetSource;
  /** True when a loopback host was swapped for the dev machine's LAN address. */
  lanRewritten: boolean;
};

export type ApiTargetInput = {
  platform: string;
  apiBaseUrl?: string;
  apiBaseUrlNative?: string;
  /**
   * `Constants.expoConfig.hostUri` — `192.168.1.20:8081` under `expo start`. Its JSDoc says
   * "Only present during development using @expo/cli", and the format is documented nowhere on
   * docs.expo.dev, so every read of it here is best-effort.
   */
  hostUri?: string;
};

/**
 * The dev machine's LAN address, or undefined when `hostUri` is absent, unparseable, or not an
 * IP. Under `expo start --tunnel` it is a public `*.exp.direct` host that serves the bundler and
 * nothing else — grafting that onto an API URL would point the app at a server with no API, so
 * the IPv4 test is a guard, not a formality.
 */
function lanAddressOf(hostUri: string | undefined) {
  if (!hostUri) return undefined;
  // No scheme, so `new URL` cannot parse it; `hostUri` has no userinfo or path in practice.
  const host = hostUri.split('/')[0].split(':')[0];
  return IPV4.test(host) ? host : undefined;
}

/**
 * Resolves the API origin for one platform, plus enough context to show the user which backend
 * they are on. Returns undefined when nothing is configured — `client.ts` owns that failure.
 */
export function resolveApiTarget({
  platform,
  apiBaseUrl,
  apiBaseUrlNative,
  hostUri,
}: ApiTargetInput): ApiTarget | undefined {
  if (platform === 'web') {
    return apiBaseUrl
      ? { url: apiBaseUrl, source: 'EXPO_PUBLIC_API_BASE_URL', lanRewritten: false }
      : undefined;
  }

  const source: ApiTargetSource = apiBaseUrlNative
    ? 'EXPO_PUBLIC_API_BASE_URL_NATIVE'
    : 'EXPO_PUBLIC_API_BASE_URL';
  const configured = apiBaseUrlNative || apiBaseUrl;
  if (!configured) return undefined;

  let url: URL;
  try {
    url = new URL(configured);
  } catch {
    // Let the caller's own validation report a malformed value rather than throwing from here.
    return { url: configured, source, lanRewritten: false };
  }

  const lan = LOOPBACK_HOSTS.has(url.hostname) ? lanAddressOf(hostUri) : undefined;
  if (!lan) return { url: configured, source, lanRewritten: false };

  // Only the host moves. The port belongs to the API (3000), not to the bundler (8081).
  url.hostname = lan;
  return { url: url.origin, source, lanRewritten: true };
}

/** One line for a debug row or a dev log: `localhost:3000` / `192.168.1.20:3000 (LAN)`. */
export function describeApiTarget(target: ApiTarget) {
  let host: string;
  try {
    host = new URL(target.url).host;
  } catch {
    host = target.url;
  }
  return target.lanRewritten ? `${host} (LAN)` : host;
}
