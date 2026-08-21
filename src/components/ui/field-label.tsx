import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/theme/tokens';

export type FieldLabelProps = {
  children: string;
};

export function FieldLabel({ children }: FieldLabelProps) {
  return (
    <ThemedText type="label" color="textMuted" style={{ marginBottom: Spacing[1] }}>
      {children}
    </ThemedText>
  );
}
