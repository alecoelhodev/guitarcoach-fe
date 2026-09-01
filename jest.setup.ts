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
