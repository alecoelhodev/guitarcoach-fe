import { ThemedText } from '@/components/themed-text';
import { Colors, Spacing } from '@/theme/tokens';

export type ValidationMessageProps = {
  children?: string;
};

export function ValidationMessage({ children }: ValidationMessageProps) {
  if (!children) return null;

  return (
    <ThemedText type="caption" style={{ color: Colors.accentRamp[700], marginTop: Spacing[1] }}>
      {children}
    </ThemedText>
  );
}
