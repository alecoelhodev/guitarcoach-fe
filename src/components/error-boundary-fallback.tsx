import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedView } from '@/components/themed-view';
import { ErrorPanel } from '@/components/ui/error-panel';
import { Spacing } from '@/theme/tokens';

/** Expo Router's file-based `ErrorBoundary` convention: rendered in place of a screen
 * that threw during render, with `retry` re-mounting the subtree. */
export function ErrorBoundaryFallback({ error, retry }: { error: Error; retry: () => void }) {
  return (
    <ThemedView style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1, justifyContent: 'center', padding: Spacing[6] }}>
        <ErrorPanel
          title="Something went wrong"
          message={error.message}
          onRetry={retry}
        />
      </SafeAreaView>
    </ThemedView>
  );
}
