import type { Breadcrumb, ErrorEvent } from '@sentry/react-native';
import * as Sentry from '@sentry/react-native';

const SENSITIVE_HEADERS = new Set(['cookie', 'authorization', 'set-cookie']);
const URL_KEYS = ['url', 'from', 'to'] as const;

function stripQuery(url: string): string {
  return url.replace(/[?#].*$/, '');
}

/** Drops credentials, bodies, query strings and every user field but the opaque id. */
export function scrubEvent(event: ErrorEvent): ErrorEvent {
  const { request } = event;
  if (request) {
    delete request.cookies;
    delete request.data;
    delete request.query_string;
    if (request.url) request.url = stripQuery(request.url);
    if (request.headers) {
      request.headers = Object.fromEntries(
        Object.entries(request.headers).filter(
          ([name]) => !SENSITIVE_HEADERS.has(name.toLowerCase()),
        ),
      );
    }
  }
  if (event.user) {
    event.user = event.user.id === undefined ? {} : { id: event.user.id };
  }
  // `beforeBreadcrumb` only sees breadcrumbs recorded in JS; native ones join the event later.
  event.breadcrumbs = event.breadcrumbs?.map(scrubBreadcrumb);
  return event;
}

/** Strips query strings from the URLs that fetch/xhr and navigation breadcrumbs carry. */
export function scrubBreadcrumb(breadcrumb: Breadcrumb): Breadcrumb {
  const { data } = breadcrumb;
  if (data) {
    for (const key of URL_KEYS) {
      const value = data[key];
      if (typeof value === 'string') data[key] = stripQuery(value);
    }
  }
  return breadcrumb;
}

/** Starts Sentry. Inert in development and whenever no DSN is configured. */
export function initMonitoring(): void {
  const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN;
  Sentry.init({
    dsn,
    enabled: !__DEV__ && Boolean(dsn),
    environment: process.env.EXPO_PUBLIC_SENTRY_ENVIRONMENT ?? 'production',
    sendDefaultPii: false,
    tracesSampleRate: 0.1,
    beforeSend: scrubEvent,
    beforeBreadcrumb: scrubBreadcrumb,
  });
}

/** Tags later events with the signed-in user's opaque id only; `null` clears it. */
export function setMonitoringUser(id: string | null): void {
  Sentry.setUser(id === null ? null : { id });
}

/** Sends an error caught by a boundary, which never reaches the global handler. */
export function reportError(error: unknown): void {
  Sentry.captureException(error);
}
