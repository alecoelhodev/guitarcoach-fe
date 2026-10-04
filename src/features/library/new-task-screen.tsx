import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'expo-router';
import ChevronLeft from 'lucide-react-native/icons/chevron-left';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { z } from 'zod';

import { describeError, type ErrorDescription } from '@/api/errors';
import { useCreateTask } from '@/api/tasks.queries';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Button } from '@/components/ui/button';
import { Chip } from '@/components/ui/chip';
import { ErrorPanel } from '@/components/ui/error-panel';
import { FieldLabel } from '@/components/ui/field-label';
import { Input } from '@/components/ui/input';
import { KeyboardAwareScreen } from '@/components/ui/keyboard-aware-screen';
import { ValidationMessage } from '@/components/ui/validation-message';
import { categoryLabels, difficultyLabels } from '@/features/library/task-labels';
import { useBottomInset } from '@/hooks/use-bottom-inset';
import { isWebUrl } from '@/lib/url';
import { useToastStore } from '@/stores/toast-store';
import { Colors, IconSize, IconStroke, MaxContentWidth, Spacing } from '@/theme/tokens';
import type { TaskCategory, TaskDifficulty } from '@/types/task';

/** Mirrors `CreateTaskDto`: title 2–200, an optional http(s) `@IsUrl` link. */
const schema = z.object({
  title: z
    .string()
    .trim()
    .min(2, 'Give the task a title before saving.')
    .max(200, 'Keep the title under 200 characters.'),
  description: z.string().max(2000, 'Keep the description under 2000 characters.'),
  referenceLink: z
    .string()
    .trim()
    .refine((value) => value === '' || isWebUrl(value), 'Use a full http:// or https:// link.'),
  category: z.custom<TaskCategory>().optional(),
  difficulty: z.custom<TaskDifficulty>().optional(),
});

type FormValues = z.infer<typeof schema>;

/** Admin-only: the Library shows the entry point to admins, and the backend 403s the rest. */
export function NewTaskScreen() {
  const router = useRouter();
  const bottomPad = useBottomInset() + Spacing[4];
  const showToast = useToastStore((state) => state.show);
  const createTask = useCreateTask();
  const [failure, setFailure] = useState<ErrorDescription | null>(null);

  const { control, formState, handleSubmit } = useForm<FormValues>({
    resolver: zodResolver(schema),
    mode: 'onBlur',
    defaultValues: { title: '', description: '', referenceLink: '' },
  });

  const submit = handleSubmit(async (values) => {
    setFailure(null);
    try {
      const task = await createTask.mutateAsync({
        title: values.title.trim(),
        category: values.category,
        difficulty: values.difficulty,
        description: values.description.trim() || undefined,
        referenceLink: values.referenceLink || undefined,
      });
      // `replace`: back from the new task should reach the Library, not an emptied form.
      router.replace({ pathname: '/library/[id]', params: { id: task.id } });
      showToast('Task created', 'success');
    } catch (error) {
      setFailure(describeError(error, "Couldn't save this task"));
    }
  });

  const disabled = createTask.isPending;

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
                New task
              </ThemedText>
              <Button
                variant="tertiary"
                loading={disabled}
                loadingLabel="Saving…"
                onPress={() => void submit()}
              >
                Save
              </Button>
            </View>

            <View>
              <FieldLabel>Title</FieldLabel>
              <Controller
                control={control}
                name="title"
                render={({ field }) => (
                  <Input
                    testID="task-title"
                    value={field.value}
                    onChangeText={field.onChange}
                    onBlur={field.onBlur}
                    editable={!disabled}
                    invalid={!!formState.errors.title}
                    placeholder="Chromatic warm-up"
                    autoCapitalize="sentences"
                    maxLength={200}
                  />
                )}
              />
              <ValidationMessage>{formState.errors.title?.message}</ValidationMessage>
            </View>

            <Controller
              control={control}
              name="category"
              render={({ field }) => (
                <View>
                  <FieldLabel>Category</FieldLabel>
                  <View style={styles.chips}>
                    {(Object.keys(categoryLabels) as TaskCategory[]).map((value) => (
                      <Chip
                        key={value}
                        label={categoryLabels[value]}
                        selected={field.value === value}
                        onPress={() => field.onChange(field.value === value ? undefined : value)}
                      />
                    ))}
                  </View>
                </View>
              )}
            />

            <Controller
              control={control}
              name="difficulty"
              render={({ field }) => (
                <View>
                  <FieldLabel>Difficulty</FieldLabel>
                  <View style={styles.chips}>
                    {(Object.keys(difficultyLabels) as TaskDifficulty[]).map((value) => (
                      <Chip
                        key={value}
                        label={difficultyLabels[value]}
                        selected={field.value === value}
                        onPress={() => field.onChange(field.value === value ? undefined : value)}
                      />
                    ))}
                  </View>
                </View>
              )}
            />

            <View>
              <FieldLabel>Description</FieldLabel>
              <Controller
                control={control}
                name="description"
                render={({ field }) => (
                  <Input
                    testID="task-description"
                    value={field.value}
                    onChangeText={field.onChange}
                    onBlur={field.onBlur}
                    editable={!disabled}
                    invalid={!!formState.errors.description}
                    placeholder="What to practise and how"
                    multiline
                    maxLength={2000}
                    style={styles.multiline}
                  />
                )}
              />
              <ValidationMessage>{formState.errors.description?.message}</ValidationMessage>
            </View>

            <View>
              <FieldLabel>Reference link</FieldLabel>
              <Controller
                control={control}
                name="referenceLink"
                render={({ field }) => (
                  <Input
                    testID="task-link"
                    value={field.value}
                    onChangeText={field.onChange}
                    onBlur={field.onBlur}
                    editable={!disabled}
                    invalid={!!formState.errors.referenceLink}
                    placeholder="https://"
                    autoCapitalize="none"
                    autoCorrect={false}
                    keyboardType="url"
                  />
                )}
              />
              <ValidationMessage>{formState.errors.referenceLink?.message}</ValidationMessage>
            </View>

            {failure && (
              <ErrorPanel
                title={failure.title}
                message={failure.message}
                onRetry={() => void submit()}
              />
            )}
          </ScrollView>
        </KeyboardAwareScreen>
      </SafeAreaView>
    </ThemedView>
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
