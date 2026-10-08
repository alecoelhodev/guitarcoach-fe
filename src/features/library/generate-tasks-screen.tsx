import { useRouter } from 'expo-router';
import ChevronLeft from 'lucide-react-native/icons/chevron-left';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ApiError } from '@/api/client';
import { useGenerateTaskDrafts } from '@/api/coach.queries';
import { describeError, type ErrorDescription } from '@/api/errors';
import { useBulkCreateTasks } from '@/api/tasks.queries';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Checkbox, CheckboxIndicator, CheckboxLabel } from '@/components/ui/checkbox';
import { Chip } from '@/components/ui/chip';
import { ErrorPanel } from '@/components/ui/error-panel';
import { FieldLabel } from '@/components/ui/field-label';
import { Input } from '@/components/ui/input';
import { KeyboardAwareScreen } from '@/components/ui/keyboard-aware-screen';
import { Skeleton } from '@/components/ui/skeleton';
import { categoryLabels, difficultyLabels } from '@/features/library/task-labels';
import { useBottomInset } from '@/hooks/use-bottom-inset';
import { useToastStore } from '@/stores/toast-store';
import { Colors, IconSize, IconStroke, MaxContentWidth, Spacing } from '@/theme/tokens';
import type { CreateTaskInput, TaskDraft } from '@/types/task';

const COUNTS = [3, 5, 8, 10] as const;

function describeGeneratorError(error: unknown, fallback: string): ErrorDescription {
  // The AI window is an hour, so the generic 429 copy ("about a minute") would mislead.
  if (error instanceof ApiError && error.status === 429) {
    return { title: 'Too many AI requests', message: 'Try again later.' };
  }
  return describeError(error, fallback);
}

function toCreateInput(draft: TaskDraft): CreateTaskInput {
  return {
    title: draft.title,
    description: draft.description || undefined,
    category: draft.category,
    difficulty: draft.difficulty,
  };
}

/** Admin-only: the Library shows the entry point to admins, and the backend 403s the rest. */
export function GenerateTasksScreen() {
  const router = useRouter();
  const bottomPad = useBottomInset() + Spacing[4];
  const showToast = useToastStore((state) => state.show);
  const generate = useGenerateTaskDrafts();
  const bulkCreate = useBulkCreateTasks();

  const [prompt, setPrompt] = useState('');
  const [count, setCount] = useState<number>(5);
  const [drafts, setDrafts] = useState<TaskDraft[]>([]);
  const [chosen, setChosen] = useState<boolean[]>([]);
  const [failure, setFailure] = useState<ErrorDescription | null>(null);

  const busy = generate.isPending || bulkCreate.isPending;
  const selected = drafts.filter((_, index) => chosen[index]);

  async function runGenerate() {
    if (!prompt.trim() || busy) return;
    setFailure(null);
    try {
      const response = await generate.mutateAsync({ prompt: prompt.trim(), count });
      setDrafts(response.drafts);
      setChosen(response.drafts.map(() => true));
    } catch (error) {
      setFailure(describeGeneratorError(error, "Couldn't draft tasks"));
    }
  }

  async function runCreate() {
    if (selected.length === 0 || busy) return;
    setFailure(null);
    try {
      await bulkCreate.mutateAsync(selected.map(toCreateInput));
      showToast(
        selected.length === 1 ? '1 task created' : `${selected.length} tasks created`,
        'success',
      );
      router.back();
    } catch (error) {
      setFailure(describeGeneratorError(error, "Couldn't create these tasks"));
    }
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <KeyboardAwareScreen>
          <ScrollView
            contentContainerStyle={[styles.scroll, { paddingBottom: bottomPad }]}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.header}>
              <Button variant="icon" accessibilityLabel="Go back" onPress={() => router.back()}>
                <ChevronLeft color={Colors.text} size={IconSize.lg} strokeWidth={IconStroke} />
              </Button>
              <ThemedText type="h3" style={styles.heading}>
                Generate tasks
              </ThemedText>
            </View>

            <View>
              <FieldLabel>What do you want to practise?</FieldLabel>
              <Input
                testID="generate-prompt"
                value={prompt}
                onChangeText={setPrompt}
                editable={!busy}
                placeholder="e.g. Famous 7-string riffs by Dream Theater, Trivium and Periphery"
                multiline
                maxLength={2000}
                style={styles.multiline}
              />
            </View>

            <View>
              <FieldLabel>How many tasks</FieldLabel>
              <View style={styles.chips}>
                {COUNTS.map((value) => (
                  <Chip
                    key={value}
                    label={String(value)}
                    selected={count === value}
                    onPress={busy ? undefined : () => setCount(value)}
                  />
                ))}
              </View>
            </View>

            <Button
              block
              loading={generate.isPending}
              loadingLabel="Drafting…"
              disabled={!prompt.trim() || bulkCreate.isPending}
              onPress={() => void runGenerate()}
            >
              {drafts.length ? 'Generate again' : 'Generate'}
            </Button>

            {generate.isPending && (
              <Card accessibilityLiveRegion="polite">
                <ThemedText type="body" color="textMuted">
                  Drafting your tasks…
                </ThemedText>
                <Skeleton width="72%" />
                <Skeleton width="88%" />
                <Skeleton width="54%" />
              </Card>
            )}

            {failure && (
              <ErrorPanel
                title={failure.title}
                message={failure.message}
                onRetry={() => void (drafts.length ? runCreate() : runGenerate())}
              />
            )}

            {!generate.isPending &&
              drafts.map((draft, index) => (
                <DraftCard
                  key={`${index}-${draft.title}`}
                  draft={draft}
                  checked={chosen[index] ?? false}
                  onToggle={() =>
                    setChosen((current) =>
                      current.map((value, i) => (i === index ? !value : value)),
                    )
                  }
                />
              ))}

            {drafts.length > 0 && !generate.isPending && (
              <Button
                block
                loading={bulkCreate.isPending}
                loadingLabel="Creating…"
                disabled={selected.length === 0}
                onPress={() => void runCreate()}
              >
                {selected.length === 1 ? 'Create 1 task' : `Create ${selected.length} tasks`}
              </Button>
            )}
          </ScrollView>
        </KeyboardAwareScreen>
      </SafeAreaView>
    </ThemedView>
  );
}

function DraftCard({
  draft,
  checked,
  onToggle,
}: {
  draft: TaskDraft;
  checked: boolean;
  onToggle: () => void;
}) {
  return (
    <Card>
      <Checkbox value={draft.title} isChecked={checked} onChange={onToggle}>
        <CheckboxIndicator />
        <CheckboxLabel>{draft.title}</CheckboxLabel>
      </Checkbox>
      <ThemedText type="caption" color="textMuted">
        {`${categoryLabels[draft.category]} · ${difficultyLabels[draft.difficulty]}`}
      </ThemedText>
      {draft.description ? <ThemedText type="body">{draft.description}</ThemedText> : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1, alignSelf: 'center', width: '100%', maxWidth: MaxContentWidth },
  scroll: { padding: Spacing[4], gap: Spacing[4] },
  header: { flexDirection: 'row', alignItems: 'center', gap: Spacing[2] },
  heading: { flex: 1 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing[2] },
  multiline: { minHeight: 96, textAlignVertical: 'top' },
});
