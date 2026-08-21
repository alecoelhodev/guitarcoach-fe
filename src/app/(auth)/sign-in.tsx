import { Link } from 'expo-router';
import { StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { SignInForm } from '@/features/auth/sign-in-form';
import { MaxContentWidth, Spacing } from '@/theme/tokens';

export default function SignInScreen() {
  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ThemedText type="h3">Welcome back</ThemedText>
        <SignInForm />
        <Link href="/(auth)/create-account" asChild>
          <ThemedText type="body" color="accent">
            Create an account
          </ThemedText>
        </Link>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: {
    flex: 1,
    justifyContent: 'center',
    alignSelf: 'center',
    width: '100%',
    maxWidth: MaxContentWidth,
    paddingHorizontal: Spacing[6],
    gap: Spacing[4],
  },
});
