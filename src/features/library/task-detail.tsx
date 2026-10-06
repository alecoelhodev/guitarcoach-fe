import { Link, useRouter } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ApiError } from '@/api/client';
import { describeError, type ErrorDescription } from '@/api/errors';
import { useDeleteTask, useTask } from '@/api/tasks.queries';
import { ExternalLink } from '@/components/external-link';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { ErrorPanel } from '@/components/ui/error-panel';
import { QueryState } from '@/components/ui/query-state';
import { isWebUrl } from '@/lib/url';
import { useSessionStore } from '@/stores/session-store';
import { useToastStore } from '@/stores/toast-store';
import { Colors, MaxContentWidth, Spacing } from '@/theme/tokens';
import type { Task } from '@/types/task';

export function TaskDetail({ taskId }: { taskId: string }) {
  const query = useTask(taskId);
  // Hides controls that would only 403. The backend's admin gate is the enforcement.
  const isAdmin = useSessionStore((state) => state.user?.role === 'admin');

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <ScrollView contentContainerStyle={styles.scroll}>
          <QueryState query={query} errorTitle="Couldn't load this task">
            {(task) => (
              <>
                {/* Canvas 04 leads with the badges, then the title. */}
                <View style={styles.badges}>
                  {task.category && <Badge label={task.category} variant="category" />}
                  {task.difficulty && <Badge label={task.difficulty} variant="difficulty" />}
                </View>

                <ThemedText type="h3">{task.title}</ThemedText>

                {task.description ? (
                  <Card>
                    <ThemedText type="body" color="textMuted">
                      {task.description}
                    </ThemedText>
                  </Card>
                ) : null}

                {/* `ExternalLink` renders anything but an absolute http(s) URL as plain text. */}
                {task.referenceLink && isWebUrl(task.referenceLink) && (
                  <ExternalLink href={task.referenceLink as `${string}:${string}`}>
                    <Card>
                      <View style={styles.referenceRow}>
                        <ThemedText type="label">Reference link</ThemedText>
                        <ThemedText type="body" style={styles.link}>
                          ↗
                        </ThemedText>
                      </View>
                      <ThemedText type="body" color="textMuted">
                        Opens outside the app
                      </ThemedText>
                    </Card>
                  </ExternalLink>
                )}

                {isAdmin ? (
                  <AdminActions task={task} />
                ) : (
                  <ThemedText type="body" color="textMuted" style={styles.note}>
                    Tasks are shared and read-only.
                  </ThemedText>
                )}
              </>
            )}
          </QueryState>
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

function AdminActions({ task }: { task: Task }) {
  const router = useRouter();
  const showToast = useToastStore((state) => state.show);
  const deleteTask = useDeleteTask();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [failure, setFailure] = useState<(ErrorDescription & { retryable: boolean }) | null>(null);

  async function destroy() {
    setConfirmDelete(false);
    setFailure(null);
    try {
      await deleteTask.mutateAsync(task.id);
      showToast('Task deleted', 'success');
      router.replace('/(app)/(main)/(tabs)/library');
    } catch (error) {
      // There is no usage count on the DTO, so "in use" can only be learned from the 409.
      setFailure(
        error instanceof ApiError && error.status === 409
          ? {
              title: "Can't delete this task",
              message: "It's used by a routine or a logged session.",
              retryable: false,
            }
          : { ...describeError(error, "Couldn't delete this task"), retryable: true },
      );
    }
  }

  return (
    <>
      {/* Canvas 1h: the destructive action goes last. */}
      <View style={styles.actions}>
        <Link href={{ pathname: '/library/[id]/edit', params: { id: task.id } }} asChild>
          <Button variant="tertiary" style={styles.action} disabled={deleteTask.isPending}>
            Edit
          </Button>
        </Link>
        <Button
          variant="tertiary"
          style={styles.action}
          disabled={deleteTask.isPending}
          onPress={() => setConfirmDelete(true)}
        >
          <ThemedText type="label" style={styles.deleteLabel}>
            Delete
          </ThemedText>
        </Button>
      </View>

      {failure && (
        <ErrorPanel
          title={failure.title}
          message={failure.message}
          onRetry={failure.retryable ? () => void destroy() : undefined}
        />
      )}

      <ConfirmDialog
        visible={confirmDelete}
        title={`Delete "${task.title}"?`}
        message="It disappears from the library for everyone."
        destructive
        confirmLabel="Delete"
        onConfirm={() => void destroy()}
        onCancel={() => setConfirmDelete(false)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1, alignSelf: 'center', width: '100%', maxWidth: MaxContentWidth },
  scroll: { padding: Spacing[4], gap: Spacing[3] },
  badges: { flexDirection: 'row', gap: Spacing[2] },
  referenceRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  link: { color: Colors.accentRamp[700] },
  note: { textAlign: 'center' },
  actions: { flexDirection: 'row', gap: Spacing[2] },
  action: { flex: 1 },
  deleteLabel: { color: Colors.dangerRamp[700] },
});
