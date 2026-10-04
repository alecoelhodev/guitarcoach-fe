import { ApiError, OFFLINE_STATUS, TIMEOUT_STATUS } from '@/api/client';
import { describeError, shouldRetry } from '@/api/errors';
import { asShippedBuild } from '@/test/dev-flag';

describe('describeError', () => {
  it('names the connection as the cause rather than the caller context', () => {
    const { title, message } = describeError(
      new ApiError('No connection', OFFLINE_STATUS),
      "Couldn't load the library",
    );

    expect(title).toBe('No connection');
    expect(message).toContain('Check your connection and try again.');
  });

  /**
   * A dead network, a base URL pointing at the wrong backend, and a CORS rejection are all
   * status 0 — indistinguishable to the user and, until now, to the developer too. Dev builds
   * name the host; shipped builds must not, so both branches are pinned.
   */
  it('names the host it could not reach, in dev only', async () => {
    const offline = new ApiError('No connection', OFFLINE_STATUS);

    expect(describeError(offline).message).toBe(
      "Couldn't reach localhost:3000. Check your connection and try again.",
    );

    await asShippedBuild(() => {
      expect(describeError(offline).message).toBe('Check your connection and try again.');
    });
  });

  it.each([
    [404, 'Not found'],
    [403, "You don't have access"],
    [429, 'Too many attempts'],
    [500, 'Something went wrong on our end'],
    [503, 'Something went wrong on our end'],
  ])('names the cause for %i', (status, title) => {
    expect(describeError(new ApiError('boom', status), 'fallback').title).toBe(title);
  });

  /**
   * S6. A Nest validation message is a DTO path, not copy, and a conflict message can carry an
   * internal id — so for these statuses the server's text never reaches the screen.
   */
  it.each([
    [400, 'tasks.0.durationMinutes must not be less than 1', 'Check what you entered'],
    [422, 'title must be a string', 'Check what you entered'],
    [409, 'Routine with id "r1" has tasks assigned and cannot be deleted', 'clashes'],
  ])('replaces the server text of a %i with fixed copy', (status, serverText, copy) => {
    const { title, message } = describeError(new ApiError(serverText, status), "Couldn't save");

    expect(title).toBe("Couldn't save");
    expect(message).toContain(copy);
    expect(message).not.toContain(serverText);
  });

  it('does not show the server text for an unlisted status either', () => {
    expect(describeError(new ApiError('Payload Too Large', 413), "Couldn't save")).toEqual({
      title: "Couldn't save",
      message: 'Try again.',
    });
  });

  it.each([
    ['USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL', 422, 'That email already has an account'],
    ['USER_ALREADY_EXISTS', 422, 'That email already has an account'],
    ['INVALID_EMAIL', 400, "That email doesn't look right"],
    ['PASSWORD_TOO_SHORT', 400, 'That password is too short'],
    ['PASSWORD_TOO_LONG', 400, 'That password is too long'],
    ['INVALID_EMAIL_OR_PASSWORD', 401, 'Email or password is incorrect'],
  ])('names the better-auth code %s in its own words', (code, status, title) => {
    expect(describeError(new ApiError('server text', status, code), 'fallback').title).toBe(title);
  });

  it('ignores a code that is not on the allowlist, including prototype keys', () => {
    for (const code of ['FAILED_TO_CREATE_USER', 'toString', '__proto__']) {
      expect(describeError(new ApiError('server text', 400, code), "Couldn't sign up")).toEqual({
        title: "Couldn't sign up",
        message: 'Check what you entered and try again.',
      });
    }
  });

  it('tells a slow server apart from a dead network', () => {
    const timedOut = describeError(new ApiError('Timed out', TIMEOUT_STATUS));
    const offline = describeError(new ApiError('No connection', OFFLINE_STATUS));

    expect(timedOut.title).toBe('This is taking too long');
    // "Check your connection" is wrong advice when the connection is fine.
    expect(timedOut.message).not.toMatch(/connection/i);
    expect(timedOut.title).not.toBe(offline.title);
  });

  it('does not leak non-ApiError details to the user', () => {
    const { title, message } = describeError(new Error('connect ECONNREFUSED 10.0.0.4:5432'));

    expect(title).toBe('Something went wrong');
    expect(message).toBe('Try again.');
  });
});

describe('shouldRetry', () => {
  it.each([400, 401, 403, 404, 409, 429])('does not retry %i', (status) => {
    expect(shouldRetry(0, new ApiError('nope', status))).toBe(false);
  });

  it('retries offline and 5xx until the cap', () => {
    expect(shouldRetry(0, new ApiError('No connection', OFFLINE_STATUS))).toBe(true);
    expect(shouldRetry(1, new ApiError('boom', 500))).toBe(true);
    expect(shouldRetry(2, new ApiError('boom', 500))).toBe(false);
  });

  it('does not retry a timeout, which would cost the whole ceiling again', () => {
    expect(shouldRetry(0, new ApiError('Timed out', TIMEOUT_STATUS))).toBe(false);
  });

  it('does not retry a non-ApiError, which is a bug in our own code rather than the network', () => {
    expect(shouldRetry(0, new TypeError('undefined is not a function'))).toBe(false);
  });
});
