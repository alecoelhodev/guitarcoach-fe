import X from 'lucide-react-native/icons/x';
import { Pressable, StyleSheet, View } from 'react-native';

import { Input } from '@/components/ui/input';
import { Colors, IconSize, IconStroke, Spacing, TapSlop } from '@/theme/tokens';

const CLEAR_WIDTH = 44;

/** A text input with a ✕ that empties it, shown once there is something to clear. */
export function SearchField({
  value,
  onChangeText,
  label = 'Search tasks',
}: {
  value: string;
  onChangeText: (text: string) => void;
  /** Placeholder and accessibility label. */
  label?: string;
}) {
  return (
    <View>
      <Input
        value={value}
        onChangeText={onChangeText}
        placeholder={label}
        accessibilityLabel={label}
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="search"
        maxLength={100}
        style={styles.input}
      />
      {value !== '' && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Clear search"
          onPress={() => onChangeText('')}
          hitSlop={TapSlop}
          style={styles.clear}
        >
          <X color={Colors.neutral[600]} size={IconSize.md} strokeWidth={IconStroke} />
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  input: { paddingRight: CLEAR_WIDTH + Spacing[1] },
  clear: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: CLEAR_WIDTH,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
