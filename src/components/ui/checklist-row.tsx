import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Colors, Radius, Spacing } from '@/theme/tokens';

export type ChecklistRowProps = {
  label: string;
  checked: boolean;
  onToggle: () => void;
};

export function ChecklistRow({ label, checked, onToggle }: ChecklistRowProps) {
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      onPress={onToggle}
      style={styles.row}
    >
      <View style={[styles.box, checked && styles.boxChecked]}>
        {checked && <ThemedText color="accent">✓</ThemedText>}
      </View>
      <ThemedText type="body" style={styles.label}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing[3],
    paddingVertical: Spacing[2],
  },
  box: {
    width: 22,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: Colors.divider,
  },
  boxChecked: {
    borderColor: Colors.accent,
    backgroundColor: Colors.accentRamp[100],
  },
  label: {
    flex: 1,
  },
});
