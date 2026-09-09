import { Link } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { SessionCard } from '@/features/history/session-card';
import { countCompletedTasks, formatMinutes, sumSessionMinutes } from '@/lib/duration';
import { Colors, Spacing } from '@/theme/tokens';
import type { PracticeSession } from '@/types/session';

/** Canvas 2a's table lists three rows; mobile shows a single card. */
const WIDE_ROW_LIMIT = 3;

export type RecentSessionsProps = {
  sessions: PracticeSession[];
  /** Canvas 2a collapses the stacked cards into a table-like row set. */
  isWide?: boolean;
};

/** Canvas 02 "Recent session" (singular) and 2a "Recent sessions" (a table). */
export function RecentSessions({ sessions, isWide = false }: RecentSessionsProps) {
  if (sessions.length === 0) return null;

  return (
    <>
      <View style={styles.sectionHeader}>
        <ThemedText type="overline" color="textMuted">
          {isWide ? 'Recent sessions' : 'Recent session'}
        </ThemedText>
        <Link href="/(app)/(main)/history" asChild>
          <ThemedText type="label" style={styles.link}>
            {isWide ? 'History' : 'See all'}
          </ThemedText>
        </Link>
      </View>

      {isWide ? (
        <Card style={styles.table}>
          {sessions.slice(0, WIDE_ROW_LIMIT).map((session, index) => (
            <View key={session.id}>
              {index > 0 && <View style={styles.rule} />}
              <SessionRow session={session} />
            </View>
          ))}
        </Card>
      ) : (
        <SessionCard session={sessions[0]} />
      )}
    </>
  );
}

/**
 * The canvas also draws the routine's *name* in each row. It is not rendered
 * here: `PracticeSessionResponseDto` carries `routineId` but no title, so a name
 * per row would be a request per row. It needs a backend field to come back.
 */
function SessionRow({ session }: { session: PracticeSession }) {
  const minutes = sumSessionMinutes(session);
  const { completed, total } = countCompletedTasks(session);

  return (
    <Link href={{ pathname: '/history/[id]', params: { id: session.id } }} asChild>
      <View style={styles.row}>
        <ThemedText type="label" numberOfLines={1} style={styles.rowTitle}>
          {session.title ?? 'Practice session'}
        </ThemedText>
        {/* Per-task minutes are optional, so a session can legitimately have none. */}
        {minutes > 0 && <Badge label={formatMinutes(minutes)} />}
        {total > 0 && <Badge label={`${completed} of ${total}`} />}
      </View>
    </Link>
  );
}

const styles = StyleSheet.create({
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  // Canvas uses accent-700 for links and small accent text, never the base accent.
  link: { color: Colors.accentRamp[700] },
  table: { padding: 0, gap: 0 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing[2],
    paddingVertical: Spacing[3],
    paddingHorizontal: Spacing[3],
  },
  rowTitle: { flex: 1 },
  rule: { height: 1, backgroundColor: Colors.neutral[300] },
});
