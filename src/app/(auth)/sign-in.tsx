import { useLocalSearchParams } from 'expo-router';
import { StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedView } from '@/components/themed-view';
import { KeyboardAwareScreen } from '@/components/ui/keyboard-aware-screen';
import { AuthForm } from '@/features/auth/auth-form';
import { MaxContentWidth, Spacing } from '@/theme/tokens';

/**
 * Sign in and create account are one screen with two states — the segmented control swaps
 * them in place (wireframes/authentication.png, "Stage 1 · Get in").
 */
export default function AuthScreen() {
  const { mode, next } = useLocalSearchParams<{ mode?: string; next?: string }>();

  return (
    <ThemedView style={styles.container}>
      <KeyboardAwareScreen>
        <SafeAreaView style={styles.safeArea}>
          <AuthForm initialMode={mode === 'create' ? 'create' : 'signin'} next={next} />
        </SafeAreaView>
      </KeyboardAwareScreen>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: {
    flex: 1,
    alignSelf: 'center',
    width: '100%',
    maxWidth: MaxContentWidth,
    paddingHorizontal: Spacing[6],
  },
});
