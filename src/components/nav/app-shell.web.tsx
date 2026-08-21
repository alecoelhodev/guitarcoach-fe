import { type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { Rail } from '@/components/nav/rail.web';

/** Web: the rail wraps every (app) screen, unlike native where only the (tabs) group has chrome. */
export default function AppShell({ children }: { children: ReactNode }) {
  return (
    <View style={styles.row}>
      <Rail />
      <View style={styles.content}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flex: 1,
    flexDirection: 'row',
  },
  content: {
    flex: 1,
  },
});
