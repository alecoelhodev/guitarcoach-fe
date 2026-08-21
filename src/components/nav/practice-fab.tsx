import { useRouter } from 'expo-router';
import { Play } from 'lucide-react-native';
import { Pressable, StyleSheet } from 'react-native';

import { Colors, Radius, Shadow, TabBarInset } from '@/theme/tokens';

/**
 * NativeTabs renders the real OS tab bar, which has no slot for a dominant centre
 * action — this overlays Practice on top instead (plan/SETUP-PLAN.md step 8).
 */
export function PracticeFab() {
  const router = useRouter();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Start practice"
      onPress={() => router.push('/(app)/(tabs)/routines')}
      style={({ pressed }) => [styles.fab, pressed && styles.pressed]}
    >
      <Play color={Colors.bg} size={28} strokeWidth={2.75} fill={Colors.bg} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    alignSelf: 'center',
    bottom: TabBarInset - 28,
    width: 64,
    height: 64,
    borderRadius: Radius.pill,
    backgroundColor: Colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadow.lg,
  },
  pressed: {
    opacity: 0.85,
  },
});
