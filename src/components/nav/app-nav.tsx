import { NativeTabs } from 'expo-router/unstable-native-tabs';

import { PracticeFab } from '@/components/nav/practice-fab';
import { Colors } from '@/theme/tokens';
import { Typography } from '@/theme/typography';

export default function AppNav() {
  return (
    <>
      <NativeTabs
        backgroundColor={Colors.neutral[100]}
        shadowColor={Colors.neutral[300]}
        indicatorColor={Colors.accentRamp[200]}
        tintColor={Colors.accent}
        iconColor={Colors.neutral[600]}
        labelStyle={{
          fontFamily: Typography.navLabel.fontFamily,
          fontSize: Typography.navLabel.fontSize,
        }}
      >
        <NativeTabs.Trigger name="index">
          <NativeTabs.Trigger.Label>Home</NativeTabs.Trigger.Label>
          <NativeTabs.Trigger.Icon sf={{ default: 'house', selected: 'house.fill' }} md="home" />
        </NativeTabs.Trigger>

        {/* The web rail and bottom bar draw lucide's `ListMusic` for this tab (see
            `destinations.ts`); a plain bullet list read as a different destination on
            native. `music.note.list` is SF's nearest equivalent, `queue_music` Material's.
            The other three already match their lucide counterparts closely enough. */}
        <NativeTabs.Trigger name="routines">
          <NativeTabs.Trigger.Label>Routines</NativeTabs.Trigger.Label>
          <NativeTabs.Trigger.Icon
            sf={{ default: 'music.note.list', selected: 'music.note.list' }}
            md="queue_music"
          />
        </NativeTabs.Trigger>

        <NativeTabs.Trigger name="library">
          <NativeTabs.Trigger.Label>Library</NativeTabs.Trigger.Label>
          <NativeTabs.Trigger.Icon sf={{ default: 'book', selected: 'book.fill' }} md="book" />
        </NativeTabs.Trigger>

        <NativeTabs.Trigger name="profile">
          <NativeTabs.Trigger.Label>Profile</NativeTabs.Trigger.Label>
          <NativeTabs.Trigger.Icon
            sf={{ default: 'person', selected: 'person.fill' }}
            md="person"
          />
        </NativeTabs.Trigger>
      </NativeTabs>

      <PracticeFab />
    </>
  );
}
