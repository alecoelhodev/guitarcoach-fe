import { NativeTabs } from 'expo-router/unstable-native-tabs';

import { PracticeFab } from '@/components/nav/practice-fab';
import { Colors } from '@/theme/tokens';

export default function AppNav() {
  return (
    <>
      <NativeTabs
        backgroundColor={Colors.surface}
        indicatorColor={Colors.accentRamp[200]}
        tintColor={Colors.accent}
      >
        <NativeTabs.Trigger name="index">
          <NativeTabs.Trigger.Label>Home</NativeTabs.Trigger.Label>
          <NativeTabs.Trigger.Icon sf={{ default: 'house', selected: 'house.fill' }} md="home" />
        </NativeTabs.Trigger>

        <NativeTabs.Trigger name="routines">
          <NativeTabs.Trigger.Label>Routines</NativeTabs.Trigger.Label>
          <NativeTabs.Trigger.Icon
            sf={{ default: 'list.bullet', selected: 'list.bullet' }}
            md="list"
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
