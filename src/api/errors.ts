import { ApiError, OFFLINE_STATUS } from '@/api/client';

export type ErrorDescription = { title: string; message?: string };

const GENERIC_TITLE = 'Something went wrong';

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

  switch (true) {
    case error.status === OFFLINE_STATUS:
      return { title: 'No connection', message: 'Check your connection and try again.' };
    case error.status === 404:
      return { title: 'Not found', message: "This isn't here anymore." };
    case error.status === 403:
      return { title: "You don't have access", message: 'Ask an admin if you need it.' };
    case error.status === 429:
      return { title: 'Too many attempts', message: 'Try again in about a minute.' };
    case error.status >= 500:
      return { title: 'Something went wrong on our end', message: 'Try again in a moment.' };
    // The server's own message ("Routine name already taken") beats anything generic.
    case Boolean(error.message):
      return { title: fallbackTitle, message: error.message };
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
  return error.status >= 500;
}
