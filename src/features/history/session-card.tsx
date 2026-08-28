import { Link } from 'expo-router';
import { StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Card } from '@/components/ui/card';
import { formatMinutes, sumSessionMinutes } from '@/lib/duration';
import { Spacing } from '@/theme/tokens';
import type { PracticeSession } from '@/types/session';

export function SessionCard({ session }: { session: PracticeSession }) {
  const minutes = sumSessionMinutes(session);

  return (
    <Link href={{ pathname: '/history/[id]', params: { id: session.id } }} asChild>
      <Card style={styles.card}>
        <ThemedText type="h5">{session.title ?? 'Practice session'}</ThemedText>
        <ThemedText type="caption" color="textMuted">
          {new Date(session.createdAt).toLocaleDateString()} · {formatMinutes(minutes)}
        </ThemedText>
      </Card>
    </Link>
  );
}

const styles = StyleSheet.create({
  card: { gap: Spacing[1] },
});
