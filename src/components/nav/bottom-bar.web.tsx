import { Link, usePathname } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import {
  type Destination,
  isRouteActive,
  MOBILE_TABS,
  PRACTICE_HREF,
} from '@/components/nav/destinations';
import { ThemedText } from '@/components/themed-text';
import { Colors, Radius, Spacing } from '@/theme/tokens';
import { FontFamily } from '@/theme/typography';

const PRACTICE_SIZE = 58;

/**
 * Canvas `.bn` — the narrow-viewport nav, shown below 768px where the rail would
 * eat most of a phone-width browser.
 *
 * Web only. Native gets the real OS tab bar from `NativeTabs` plus `PracticeFab`;
 * neither renders here, so this is the web counterpart of both.
 *
 * It is a flex sibling of the content rather than an overlay, so screens need no
 * bottom inset — which is why `TabBarInset` is 0 on web.
 */
export function BottomBar() {
  const pathname = usePathname();
  const [home, routines, library, profile] = MOBILE_TABS;

  return (
    <View style={styles.bar}>
      <TabItem {...home} active={isRouteActive(pathname, home.match)} />
      <TabItem {...routines} active={isRouteActive(pathname, routines.match)} />

      {/* Canvas `.bnc`: an accent circle carrying the word "Practice", not an
          icon, riding above the bar's top edge. An action, so no active state. */}
      <Link href={PRACTICE_HREF} asChild>
        <View style={styles.practice} accessibilityRole="button">
          <ThemedText style={styles.practiceLabel}>Practice</ThemedText>
        </View>
      </Link>

      <TabItem {...library} active={isRouteActive(pathname, library.match)} />
      <TabItem {...profile} active={isRouteActive(pathname, profile.match)} />
    </View>
  );
}

function TabItem({ href, label, active, Icon }: Destination & { active: boolean }) {
  return (
    <Link href={href} asChild>
      <View style={styles.item}>
        <Icon color={active ? Colors.accent : Colors.neutral[600]} size={20} strokeWidth={2.75} />
        <ThemedText style={active ? activeTabLabelStyle : styles.itemLabel}>{label}</ThemedText>
      </View>
    </Link>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: Spacing[2],
    paddingBottom: Spacing[3],
    paddingHorizontal: Spacing[3],
    backgroundColor: Colors.neutral[100],
    borderTopWidth: 1,
    borderTopColor: Colors.neutral[300],
    borderTopLeftRadius: Radius.sheet,
    borderTopRightRadius: Radius.sheet,
    // The Practice circle is lifted past the bar's top edge, so it must not clip.
    overflow: 'visible',
  },
  item: {
    minWidth: 48,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing[1],
  },
  itemLabel: {
    fontFamily: FontFamily.bodySemiBold,
    fontSize: 8.5,
    color: Colors.neutral[600],
  },
  itemLabelActive: {
    color: Colors.accentRamp[700],
  },
  practice: {
    width: PRACTICE_SIZE,
    height: PRACTICE_SIZE,
    borderRadius: Radius.pill,
    backgroundColor: Colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    // Rides above the bar rather than sitting inside it, as the canvas draws.
    marginTop: -PRACTICE_SIZE / 2,
    // Canvas: 0 10px 26px rgba(47,136,240,.45) — an accent glow, so it is spelled
    // out here rather than taken from the neutral Shadow tokens.
    shadowColor: Colors.accent,
    shadowOpacity: 0.45,
    shadowRadius: 26,
    shadowOffset: { width: 0, height: 10 },
  },
  practiceLabel: {
    fontFamily: FontFamily.heading,
    fontSize: 9.5,
    lineHeight: 9.5 * 1.1,
    color: '#ffffff',
    textAlign: 'center',
  },
});

// <Link asChild> renders through a Slot that throws in development on an array
// style, so the one composed style is flattened here rather than per render.
const activeTabLabelStyle = StyleSheet.flatten([styles.itemLabel, styles.itemLabelActive]);
