import { describeApiTarget } from '@/api/base-url';
import { ApiError, apiTarget, OFFLINE_STATUS, TIMEOUT_STATUS } from '@/api/client';

export type ErrorDescription = { title: string; message?: string };

const GENERIC_TITLE = 'Something went wrong';

const ACCOUNT_EXISTS: ErrorDescription = {
  title: 'That email already has an account',
  message: 'Sign in instead, or use another email.',
};

/**
 * better-auth codes worth naming to the user, keyed by the `code` in its error body. Nothing
 * else the server says reaches the screen: a Nest validation message is a DTO path
 * ("tasks.0.durationMinutes must not be less than 1"), not copy.
 */
const AUTH_ERRORS = new Map<string, ErrorDescription>([
  [
    'INVALID_EMAIL_OR_PASSWORD',
    { title: 'Email or password is incorrect', message: 'Check both and try again.' },
  ],
  ['USER_ALREADY_EXISTS', ACCOUNT_EXISTS],
  ['USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL', ACCOUNT_EXISTS],
  ['INVALID_EMAIL', { title: "That email doesn't look right", message: 'Check it and try again.' }],
  ['PASSWORD_TOO_SHORT', { title: 'That password is too short', message: 'Choose a longer one.' }],
  ['PASSWORD_TOO_LONG', { title: 'That password is too long', message: 'Choose a shorter one.' }],
]);

/**
 * The one place an `ApiError` becomes words a user reads. Screens pass the result straight
 * to `ErrorPanel`/`Banner` rather than inventing their own copy, so "no connection" reads
 * the same everywhere instead of hiding behind a per-screen "Couldn't load X".
 *
 * `fallbackTitle` is the caller's context ("Couldn't load the library") and is used only
 * when the cause is unrecognised — a known cause always names itself, because "No
 * connection" is what the user needs to read first.
 */
export function describeError(error: unknown, fallbackTitle = GENERIC_TITLE): ErrorDescription {
  if (!(error instanceof ApiError)) return { title: fallbackTitle, message: 'Try again.' };

  const known = error.code === undefined ? undefined : AUTH_ERRORS.get(error.code);
  if (known) return known;

  switch (true) {
    case error.status === OFFLINE_STATUS:
      return {
        title: 'No connection',
        // A dead network, a wrong base URL and a CORS rejection all arrive here as status 0.
        // In dev, name the host so the three are distinguishable; shipped copy is unchanged.
        message: __DEV__
          ? `Couldn't reach ${describeApiTarget(apiTarget)}. Check your connection and try again.`
          : 'Check your connection and try again.',
      };
    case error.status === TIMEOUT_STATUS:
      return {
        title: 'This is taking too long',
        message: 'The server is reachable but slow. Try again.',
      };
    case error.status === 404:
      return { title: 'Not found', message: "This isn't here anymore." };
    case error.status === 403:
      return { title: "You don't have access", message: 'Ask an admin if you need it.' };
    case error.status === 429:
      return { title: 'Too many attempts', message: 'Try again in about a minute.' };
    case error.status >= 500:
      return { title: 'Something went wrong on our end', message: 'Try again in a moment.' };
    case error.status === 400 || error.status === 422:
      return { title: fallbackTitle, message: 'Check what you entered and try again.' };
    case error.status === 409:
      return {
        title: fallbackTitle,
        message: 'That clashes with something already saved. Refresh and try again.',
      };
    default:
      return { title: fallbackTitle, message: 'Try again.' };
  }
}

const MAX_RETRIES = 2;

/**
 * `retry` for the query defaults. A 4xx is the server stating a fact — the id is gone, the
 * caller lacks access — so repeating the call only delays the error state by two round
 * trips. Offline and 5xx are the transient ones worth another go.
 */
export function shouldRetry(failureCount: number, error: unknown): boolean {
  if (failureCount >= MAX_RETRIES) return false;
  if (!(error instanceof ApiError)) return false;
  if (error.status === OFFLINE_STATUS) return true;
  // Deliberately not `TIMEOUT_STATUS`. An offline retry fails immediately, so it costs
  // nothing; a timeout retry costs the whole ceiling again, and two more of them would
  // leave the user watching a spinner for a minute before being told anything.
  return error.status >= 500;
}
