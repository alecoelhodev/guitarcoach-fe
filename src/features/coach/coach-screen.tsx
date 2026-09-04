import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  useInstantCreateRoutine,
  useRequestPracticePlan,
  useResolvePracticePlan,
} from '@/api/coach.queries';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Banner } from '@/components/ui/banner';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Chip } from '@/components/ui/chip';
import { Input } from '@/components/ui/input';
import { Segmented } from '@/components/ui/segmented';
import { PlanPreviewCard } from '@/features/coach/plan-preview-card';
import { MaxContentWidth, Spacing } from '@/theme/tokens';
import type { DraftPlanResponse } from '@/types/coach';

type Mode = 'draft' | 'instant';

/** Canvas 10 and 10c offer these as starting points rather than an empty box. */
const SUGGESTIONS: Record<Mode, string[]> = {
  draft: ['30-min blues routine', 'Fix my barre chords', 'Theory only'],
  instant: ["What I've skipped lately", '45 min, no repeats'],
};

export function CoachScreen() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>('draft');
  const [input, setInput] = useState('');
  const [draft, setDraft] =
    useState<Extract<DraftPlanResponse, { status: 'awaiting_confirmation' }>>();
  const [message, setMessage] = useState<string>();

  const requestPlanMutation = useRequestPracticePlan();
  const resolvePlanMutation = useResolvePracticePlan();
  const instantCreateMutation = useInstantCreateRoutine();
  const loading =
    requestPlanMutation.isPending ||
    resolvePlanMutation.isPending ||
    instantCreateMutation.isPending;

  async function handleSubmit() {
    if (!input.trim()) return;
    setMessage(undefined);
    if (mode === 'draft') {
      const response = await requestPlanMutation.mutateAsync(input.trim());
      if (response.status === 'awaiting_confirmation') {
        setDraft(response);
      } else if (response.status === 'created') {
        setMessage(`Routine "${response.routine.title}" created.`);
        setInput('');
      }
    } else {
      const response = await instantCreateMutation.mutateAsync(input.trim());
      setMessage(response.message);
      if (response.routineId) setInput('');
    }
  }

  async function handleConfirm(confirmation: boolean) {
    if (!draft) return;
    const response = await resolvePlanMutation.mutateAsync({
      previousResponseId: draft.previousResponseId,
      confirmation,
    });
    setDraft(undefined);
    if (response.status === 'created') {
      setMessage(`Routine "${response.routine.title}" created.`);
      setInput('');
    } else {
      setMessage('Plan declined.');
    }
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <ScrollView contentContainerStyle={styles.scroll}>
          <ThemedText type="h3">AI Coach</ThemedText>

          <Segmented
            options={[
              { value: 'draft', label: 'Draft & Review' },
              { value: 'instant', label: 'Instant Create' },
            ]}
            value={mode}
            onChange={(value) => {
              setMode(value);
              setDraft(undefined);
              setMessage(undefined);
            }}
          />

          {mode === 'draft' ? (
            <Card quiet>
              <ThemedText type="body" color="textMuted">
                Create a practice plan and review it before anything is saved.
              </ThemedText>
            </Card>
          ) : (
            /* Canvas 10c puts this warning above the composer, so it is read before
               sending — Instant Create writes a routine with no confirmation step. */
            <Banner
              tone="info"
              title="Saves straight away"
              message="The coach can review your recent practice and create a routine immediately. You'll be able to edit or delete it afterwards."
            />
          )}

          <View style={styles.suggestions}>
            <ThemedText type="overline" color="textMuted">
              Try
            </ThemedText>
            <View style={styles.chips}>
              {SUGGESTIONS[mode].map((suggestion) => (
                <Chip key={suggestion} label={suggestion} onPress={() => setInput(suggestion)} />
              ))}
            </View>
          </View>

          <View style={{ gap: Spacing[3] }}>
            <Input
              value={input}
              onChangeText={setInput}
              placeholder="e.g. 30 minutes of jazz comping basics"
              multiline
            />
            <Button block loading={loading} onPress={handleSubmit}>
              {mode === 'draft' ? 'Draft a plan' : 'Create routine'}
            </Button>
          </View>

          {draft && (
            <PlanPreviewCard
              plan={draft.plan}
              loading={loading}
              onConfirm={() => handleConfirm(true)}
              onDecline={() => handleConfirm(false)}
            />
          )}

          {message && (
            <View style={{ gap: Spacing[2] }}>
              <ThemedText type="body">{message}</ThemedText>
              <Button
                variant="secondary"
                onPress={() => router.push('/(app)/(main)/(tabs)/routines')}
              >
                View routines
              </Button>
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1, alignSelf: 'center', width: '100%', maxWidth: MaxContentWidth },
  scroll: { padding: Spacing[4], gap: Spacing[4] },
  suggestions: { gap: Spacing[2] },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing[2] },
});
