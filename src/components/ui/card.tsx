import { View, type ViewProps } from 'react-native';

import { Colors, Radius, Shadow, Spacing } from '@/theme/tokens';

export type CardProps = ViewProps & {
  elevation?: 'sm' | 'md' | 'lg';
};

export function Card({ style, elevation = 'sm', ...rest }: CardProps) {
  return (
    <View
      style={[
        {
          backgroundColor: Colors.surface,
          borderRadius: Radius.md,
          padding: Spacing[4],
          ...Shadow[elevation],
        },
        style,
      ]}
      {...rest}
    />
  );
}
