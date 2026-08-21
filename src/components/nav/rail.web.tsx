import { Link, usePathname } from 'expo-router';
import { BookOpen, History, ListMusic, MessageCircle, User, House } from 'lucide-react-native';
import { type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Colors, Radius, Spacing } from '@/theme/tokens';

const ENTRIES = [
  { href: '/(app)/(tabs)', label: 'Home', match: '/', Icon: House },
  { href: '/(app)/(tabs)/routines', label: 'Routines', match: '/routines', Icon: ListMusic },
  { href: '/(app)/(tabs)/library', label: 'Library', match: '/library', Icon: BookOpen },
  { href: '/(app)/history', label: 'History', match: '/history', Icon: History },
  { href: '/(app)/coach', label: 'AI Coach', match: '/coach', Icon: MessageCircle },
  { href: '/(app)/(tabs)/profile', label: 'Profile', match: '/profile', Icon: User },
] as const;

/** Left rail, shown at 768px+ per the web wireframes (option 2a) — plan/SETUP-PLAN.md step 8. */
export function Rail() {
  const pathname = usePathname();

  return (
    <View style={styles.rail}>
      <ThemedText type="h5" style={styles.brand}>
        Guitar Coach
      </ThemedText>

      {ENTRIES.map((entry) => {
        const active = entry.match === '/' ? pathname === '/' : pathname.startsWith(entry.match);
        return (
          <Link key={entry.href} href={entry.href} asChild>
            <RailItem
              active={active}
              label={entry.label}
              icon={
                <entry.Icon
                  color={active ? Colors.accent : Colors.textMuted}
                  size={20}
                  strokeWidth={2.75}
                />
              }
            />
          </Link>
        );
      })}
    </View>
  );
}

function RailItem({ active, label, icon }: { active: boolean; label: string; icon: ReactNode }) {
  return (
    <View style={[styles.item, active && styles.itemActive]}>
      {icon}
      <ThemedText type="body" color={active ? 'accent' : 'textMuted'}>
        {label}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  rail: {
    width: 220,
    paddingVertical: Spacing[6],
    paddingHorizontal: Spacing[4],
    gap: Spacing[1],
    backgroundColor: Colors.surface,
    borderRightWidth: 1,
    borderRightColor: Colors.divider,
  },
  brand: {
    marginBottom: Spacing[4],
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing[3],
    paddingHorizontal: Spacing[3],
    paddingVertical: Spacing[2],
    borderRadius: Radius.sm,
  },
  itemActive: {
    backgroundColor: Colors.accentRamp[100],
  },
});
