import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { instantCreateRoutine, requestPracticePlan, resolvePracticePlan } from '@/api/coach';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Segmented } from '@/components/ui/segmented';
import { PlanPreviewCard } from '@/features/coach/plan-preview-card';
import { MaxContentWidth, Spacing } from '@/theme/tokens';
import type { DraftPlanResponse } from '@/types/coach';

type Mode = 'draft' | 'instant';

export function CoachScreen() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>('draft');
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [draft, setDraft] =
    useState<Extract<DraftPlanResponse, { status: 'awaiting_confirmation' }>>();
  const [message, setMessage] = useState<string>();

  async function handleSubmit() {
    if (!input.trim()) return;
    setLoading(true);
    setMessage(undefined);
    try {
      if (mode === 'draft') {
        const response = await requestPracticePlan(input.trim());
        if (response.status === 'awaiting_confirmation') {
          setDraft(response);
        } else if (response.status === 'created') {
          setMessage(`Routine "${response.routine.title}" created.`);
          setInput('');
        }
      } else {
        const response = await instantCreateRoutine(input.trim());
        setMessage(response.message);
        if (response.routineId) setInput('');
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleConfirm(confirmation: boolean) {
    if (!draft) return;
    setLoading(true);
    try {
      const response = await resolvePracticePlan(draft.previousResponseId, confirmation);
      setDraft(undefined);
      if (response.status === 'created') {
        setMessage(`Routine "${response.routine.title}" created.`);
        setInput('');
      } else {
        setMessage('Plan declined.');
      }
    } finally {
      setLoading(false);
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

          <ThemedText type="body" color="textMuted">
            {mode === 'draft'
              ? 'Describe what you want to practice — nothing is created until you confirm.'
              : 'Describe what you want to practice — this creates a routine right away.'}
          </ThemedText>

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
              <Button variant="secondary" onPress={() => router.push('/(app)/(tabs)/routines')}>
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
});
