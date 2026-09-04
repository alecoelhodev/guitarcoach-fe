import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/theme/tokens';

export type FieldLabelProps = {
  children: string;
};

/** Canvas `.xs` — 9.5px uppercase with wide tracking, in neutral-700. */
export function FieldLabel({ children }: FieldLabelProps) {
  return (
    <ThemedText type="overline" color="textMuted" style={{ marginBottom: Spacing[1] }}>
      {children}
    </ThemedText>
  );
}
