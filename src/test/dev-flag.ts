/**
 * `__DEV__` is a real runtime global under jest-expo, not a compile-time inline like
 * `process.env.EXPO_OS` — so unlike that one, a test *can* flip it. It is declared as a bare
 * global rather than a property of `globalThis`, hence the cast in one place instead of every
 * caller.
 */
const globals = globalThis as unknown as { __DEV__: boolean };

/**
 * Runs `body` with `__DEV__` false, the way a shipped build sees it, and restores the flag even
 * if an assertion throws — a leaked `false` would silently disable dev-only branches for every
 * later test in the file.
 */
export async function asShippedBuild(body: () => void | Promise<void>) {
  const previous = globals.__DEV__;
  globals.__DEV__ = false;
  try {
    await body();
  } finally {
    globals.__DEV__ = previous;
  }
}
