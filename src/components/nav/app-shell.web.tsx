import { type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { BottomBar } from '@/components/nav/bottom-bar.web';
import { Rail } from '@/components/nav/rail.web';
import { useIsWide } from '@/hooks/use-is-wide';

/**
 * Web: the nav chrome wraps every (app) screen, unlike native where only the
 * (tabs) group has any.
 *
 * Canvas 1h puts the switch at 768px — above it the rail, below it the bottom
 * bar. The rail is 198px, so rendering it on a phone-width browser would leave
 * almost nothing for the content column.
 *
 * The bar is a flex sibling rather than an overlay, so screens need no bottom
 * inset of their own.
 */
export default function AppShell({ children }: { children: ReactNode }) {
  const isWide = useIsWide();

  if (!isWide) {
    return (
      <View style={styles.column}>
        <View style={styles.content}>{children}</View>
        <BottomBar />
      </View>
    );
  }

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
  column: {
    flex: 1,
    flexDirection: 'column',
  },
  content: {
    flex: 1,
    // Without this the content column refuses to shrink below its children's
    // intrinsic width, and a wide table pushes the rail off-screen.
    minWidth: 0,
  },
});
