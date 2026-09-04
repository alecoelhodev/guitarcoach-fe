import { NativeTabs } from 'expo-router/unstable-native-tabs';

import { PracticeFab } from '@/components/nav/practice-fab';
import { Colors } from '@/theme/tokens';
import { FontFamily } from '@/theme/typography';

export default function AppNav() {
  return (
    <>
      <NativeTabs
        backgroundColor={Colors.neutral[100]}
        shadowColor={Colors.neutral[300]}
        indicatorColor={Colors.accentRamp[200]}
        tintColor={Colors.accent}
        iconColor={Colors.neutral[600]}
        labelStyle={{ fontFamily: FontFamily.bodySemiBold, fontSize: 8.5 }}
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
