import { ApiError, OFFLINE_STATUS } from '@/api/client';
import { describeError, shouldRetry } from '@/api/errors';

describe('describeError', () => {
  it('names the connection as the cause rather than the caller context', () => {
    const { title, message } = describeError(
      new ApiError('No connection', OFFLINE_STATUS),
      "Couldn't load the library",
    );

    expect(title).toBe('No connection');
    expect(message).toBe('Check your connection and try again.');
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

  it("falls back to the caller's context and shows the server's own message", () => {
    const { title, message } = describeError(
      new ApiError('Routine name already taken', 409),
      "Couldn't save",
    );

    expect(title).toBe("Couldn't save");
    expect(message).toBe('Routine name already taken');
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

  it('does not retry a non-ApiError, which is a bug in our own code rather than the network', () => {
    expect(shouldRetry(0, new TypeError('undefined is not a function'))).toBe(false);
  });
});
