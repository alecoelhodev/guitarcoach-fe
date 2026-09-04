import { Link } from 'expo-router';
import { ChevronRight } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { countCompletedTasks, formatMinutes, sumSessionMinutes } from '@/lib/duration';
import { Colors, Spacing } from '@/theme/tokens';
import type { PracticeSession } from '@/types/session';

export function SessionCard({ session }: { session: PracticeSession }) {
  const minutes = sumSessionMinutes(session);
  const { completed, total } = countCompletedTasks(session);

  return (
    <Link href={{ pathname: '/history/[id]', params: { id: session.id } }} asChild>
      <Card>
        <View style={styles.row}>
          <ThemedText type="label" style={styles.title}>
            {session.title ?? 'Practice session'}
          </ThemedText>
          <ChevronRight color={Colors.neutral[700]} size={16} strokeWidth={2.75} />
        </View>

        {session.notes && (
          <ThemedText type="body" color="textMuted" numberOfLines={2}>
            {session.notes}
          </ThemedText>
        )}

        <View style={styles.badges}>
          {/* Per-task minutes are optional, so a session can legitimately have none. */}
          {minutes > 0 && <Badge label={formatMinutes(minutes)} />}
          {total > 0 && <Badge label={`${completed} of ${total} done`} />}
        </View>
      </Card>
    </Link>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { flex: 1 },
  badges: { flexDirection: 'row', gap: Spacing[2] },
});
