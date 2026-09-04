import { Link, usePathname } from 'expo-router';
import {
  BookOpen,
  History,
  ListMusic,
  MessageCircle,
  Play,
  User,
  House,
} from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Colors, Radius, Spacing } from '@/theme/tokens';

/** Destinations above the spacer (canvas 2a). */
const PRIMARY = [
  { href: '/(app)/(main)/(tabs)', label: 'Home', match: '/', Icon: House },
  {
    href: '/(app)/(main)/(tabs)/routines',
    label: 'Routines',
    match: '/routines',
    Icon: ListMusic,
  },
  {
    href: '/(app)/(main)/(tabs)/library',
    label: 'Library',
    match: '/library',
    Icon: BookOpen,
  },
  { href: '/(app)/(main)/history', label: 'History', match: '/history', Icon: History },
] as const;

/** Pushed to the bottom of the rail (canvas 2a). */
const SECONDARY = [
  { href: '/(app)/(main)/coach', label: 'AI Coach', match: '/coach', Icon: MessageCircle },
  {
    href: '/(app)/(main)/(tabs)/profile',
    label: 'Profile',
    match: '/profile',
    Icon: User,
  },
] as const;

/**
 * Left rail, shown at 768px+ per the web wireframes (canvas 2a).
 *
 * Practice leads the rail as a filled action rather than a destination — it is the
 * web counterpart of the mobile centre FAB, so it carries no active state.
 */
export function Rail() {
  const pathname = usePathname();
  const isActive = (match: string) =>
    match === '/' ? pathname === '/' : pathname.startsWith(match);

  return (
    <View style={styles.rail}>
      <ThemedText type="h5" style={styles.brand}>
        Guitar Coach
      </ThemedText>

      <Link href="/(app)/(main)/(tabs)/routines" asChild>
        <View style={practiceItemStyle}>
          <Play color="#ffffff" size={18} strokeWidth={2.75} fill="#ffffff" />
          <ThemedText type="button" style={styles.practiceLabel}>
            Practice
          </ThemedText>
        </View>
      </Link>

      <View style={styles.gap} />

      {PRIMARY.map((entry) => (
        <RailLink key={entry.href} {...entry} active={isActive(entry.match)} />
      ))}

      <View style={styles.spacer} />

      {SECONDARY.map((entry) => (
        <RailLink key={entry.href} {...entry} active={isActive(entry.match)} />
      ))}
    </View>
  );
}

// Derived from the const arrays so `href` keeps expo-router's typed-route literals.
type RailLinkProps = ((typeof PRIMARY)[number] | (typeof SECONDARY)[number]) & {
  active: boolean;
};

function RailLink({ href, label, active, Icon }: RailLinkProps) {
  return (
    <Link href={href} asChild>
      <View style={active ? activeItemStyle : styles.item}>
        <Icon color={active ? Colors.accent : Colors.neutral[700]} size={18} strokeWidth={2.75} />
        <ThemedText type="label" style={{ color: active ? Colors.text : Colors.neutral[700] }}>
          {label}
        </ThemedText>
      </View>
    </Link>
  );
}

const styles = StyleSheet.create({
  rail: {
    width: 198,
    paddingVertical: Spacing[4],
    paddingHorizontal: Spacing[3],
    gap: Spacing[1],
    backgroundColor: Colors.neutral[100],
    borderRightWidth: 1,
    borderRightColor: Colors.neutral[300],
  },
  brand: {
    paddingHorizontal: Spacing[3],
    marginBottom: Spacing[2],
  },
  item: {
    minHeight: 42,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing[2],
    paddingHorizontal: Spacing[3],
    borderRadius: Radius.sm,
  },
  itemActive: {
    backgroundColor: Colors.neutral[200],
  },
  practice: {
    minHeight: 48,
    backgroundColor: Colors.accent,
    // Canvas: 0 10px 26px rgba(47,136,240,.4)
    shadowColor: Colors.accent,
    shadowOpacity: 0.4,
    shadowRadius: 26,
    shadowOffset: { width: 0, height: 10 },
  },
  practiceLabel: {
    color: '#ffffff',
  },
  gap: {
    height: Spacing[2],
  },
  spacer: {
    flex: 1,
  },
});

// expo-router's <Link asChild> renders through a Slot that throws in development if its
// child receives an array style, so these are flattened once here rather than per render.
const practiceItemStyle = StyleSheet.flatten([styles.item, styles.practice]);
const activeItemStyle = StyleSheet.flatten([styles.item, styles.itemActive]);
