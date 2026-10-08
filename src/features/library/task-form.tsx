import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'expo-router';
import ChevronLeft from 'lucide-react-native/icons/chevron-left';
import { Controller, useForm } from 'react-hook-form';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { z } from 'zod';

import type { ErrorDescription } from '@/api/errors';
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
import { Colors, IconSize, IconStroke, MaxContentWidth, Spacing } from '@/theme/tokens';
import type { TaskCategory, TaskDifficulty } from '@/types/task';

/** Mirrors `CreateTaskDto`: title 2–200, an optional http(s) `@IsUrl` link. */
const taskSchema = z.object({
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

export type TaskFormValues = z.infer<typeof taskSchema>;

type TaskFormProps = {
  heading: string;
  defaultValues: TaskFormValues;
  pending: boolean;
  failure: ErrorDescription | null;
  onSubmit: (values: TaskFormValues) => Promise<void>;
};

/** The create and edit screens for a task. Admin-only; the backend 403s everyone else. */
export function TaskForm({ heading, defaultValues, pending, failure, onSubmit }: TaskFormProps) {
  const router = useRouter();
  const bottomPad = useBottomInset() + Spacing[4];

  const { control, formState, handleSubmit } = useForm<TaskFormValues>({
    resolver: zodResolver(taskSchema),
    mode: 'onBlur',
    defaultValues,
  });

  const submit = handleSubmit(onSubmit);

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
                {heading}
              </ThemedText>
              <Button
                variant="tertiary"
                loading={pending}
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
                    editable={!pending}
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
                    editable={!pending}
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
                    editable={!pending}
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
