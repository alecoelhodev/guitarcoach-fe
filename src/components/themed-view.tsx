import { View, type ViewProps } from 'react-native';

import { Colors } from '@/theme/tokens';

export type ThemedViewBackground = 'bg' | 'surface';

export type ThemedViewProps = ViewProps & {
  type?: ThemedViewBackground;
};

export function ThemedView({ style, type = 'bg', ...rest }: ThemedViewProps) {
  return <View style={[{ backgroundColor: Colors[type] }, style]} {...rest} />;
}
