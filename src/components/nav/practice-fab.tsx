import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text } from 'react-native';

import { TabBarInset } from '@/theme/platform';
import { Colors, Radius } from '@/theme/tokens';
import { FontFamily } from '@/theme/typography';

const SIZE = 58;

/**
 * NativeTabs renders the real OS tab bar, which has no slot for a dominant centre
 * action — this overlays Practice on top instead.
 *
 * Canvas `.bnc`: a 58px accent circle carrying the word "Practice", not an icon,
 * lifted by an accent-tinted glow rather than a neutral drop shadow.
 */
export function PracticeFab() {
  const router = useRouter();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Start practice"
      onPress={() => router.push('/(app)/(main)/(tabs)/routines')}
      style={({ pressed }) => [styles.fab, pressed && styles.pressed]}
    >
      <Text style={styles.label}>Practice</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    alignSelf: 'center',
    // Centred on the tab bar's top edge, so it overlaps the bar as drawn.
    bottom: TabBarInset - SIZE / 2,
    width: SIZE,
    height: SIZE,
    borderRadius: Radius.pill,
    backgroundColor: Colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    // Canvas: 0 10px 26px rgba(47,136,240,.45) — an accent glow, so it is spelled
    // out here rather than taken from the neutral Shadow tokens.
    shadowColor: Colors.accent,
    shadowOpacity: 0.45,
    shadowRadius: 26,
    shadowOffset: { width: 0, height: 10 },
    elevation: 12,
  },
  pressed: {
    opacity: 0.85,
  },
  label: {
    fontFamily: FontFamily.heading,
    fontSize: 9.5,
    lineHeight: 9.5 * 1.1,
    color: '#ffffff',
    textAlign: 'center',
  },
});
