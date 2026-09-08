// react-native-mmkv resolves to a native instance that does not exist under Node.
jest.mock('react-native-mmkv', () => {
  const store = new Map<string, string>();
  return {
    createMMKV: () => ({
      set: (key: string, value: string) => store.set(key, value),
      getString: (key: string) => store.get(key),
      remove: (key: string) => store.delete(key),
      clearAll: () => store.clear(),
    }),
  };
});

// `src/api/client.ts` reads the base URL at module load.
jest.mock('expo-constants', () => ({
  __esModule: true,
  default: { expoConfig: { extra: { apiBaseUrl: 'http://localhost:3000' } } },
}));

// `react-native-reanimated` self-detects Jest and takes its web path, but its `initializers`
// import `react-native-worklets`, whose `.native` variant wins under jest-expo's
// `haste.defaultPlatform: 'ios'` and dereferences a native proxy at module scope
// (NativeWorklets.native.ts:411 — "Cannot read properties of undefined (reading
// 'loadUnpackers')"). jest-expo mocks `ReanimatedModule` but not `WorkletsModule`, so this
// mock is what unblocks it. Mocking `react-native-reanimated/mock` instead does NOT work:
// that mock re-imports reanimated's real index, which loads worklets again.
// Reached by: ui/alert-dialog -> ui/confirm-dialog -> home + active-session screens.
jest.mock('react-native-worklets', () => require('react-native-worklets/lib/module/mock'));

// `expo-audio` ships no `mocks/` directory for jest-expo to find, and its ExpoAudio.ts
// dereferences `AudioModule.AudioPlayer.prototype` at module scope — so merely importing
// `src/features/history/recording-row.tsx` throws without this.
// Override per suite with `jest.mocked(useAudioPlayerStatus).mockReturnValue(...)`.
jest.mock('expo-audio', () => ({
  useAudioPlayer: jest.fn(() => ({
    play: jest.fn(),
    pause: jest.fn(),
    replace: jest.fn(),
  })),
  useAudioPlayerStatus: jest.fn(() => ({
    playing: false,
    isLoaded: false,
    currentTime: 0,
    duration: 0,
  })),
}));

// `src/api/query-client.ts` registers a NetInfo listener at module scope, and NetInfo's
// native module is absent under Jest. Unmocked it does not fail the test — it rejects
// asynchronously inside NetInfo's own reachability polling and **kills the worker process**
// ("Cannot read properties of undefined (reading 'isInternetReachable')"), which reads as an
// unrelated crash. Mocked globally rather than per suite because anything importing
// `src/app/_layout.tsx` reaches it transitively.
jest.mock('@react-native-community/netinfo', () => ({
  __esModule: true,
  default: {
    addEventListener: jest.fn(() => jest.fn()),
    fetch: jest.fn(async () => ({ isConnected: true, isInternetReachable: true })),
  },
}));

// Twelve files render `SafeAreaView`. It works unmocked, but the package's own mock pins
// deterministic 320x640 metrics with zero insets instead of whatever the host reports.
jest.mock(
  'react-native-safe-area-context',
  () => require('react-native-safe-area-context/jest/mock').default,
);

// Zustand stores are module singletons and the MMKV mock's `Map` is shared per file, so
// leftover state leaks between tests as a pass-alone / fail-in-company split. Every screen
// reads `useSessionStore`, which makes forgetting this the default mistake rather than an
// unusual one. Required lazily so suites that touch no store don't pull the store graph —
// and with it `@/api/auth` and `@/api/client` — in at load.
beforeEach(() => {
  require('@/test/reset-stores').resetStores();
});
