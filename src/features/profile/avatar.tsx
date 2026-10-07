import { useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';

import { useAvatarUrl } from '@/api/avatar.queries';
import { ThemedText } from '@/components/themed-text';
import { useGravatarUrl } from '@/features/profile/use-gravatar-url';
import { Colors, Radius } from '@/theme/tokens';
import { FontFamily, Typography } from '@/theme/typography';
import type { User } from '@/types/user';

export function initialsOf(name: string, count: number) {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, count)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

const SIZES = {
  // Profile (canvas 11): two initials, sized to the circle rather than the type ladder —
  // canvas 22 × 390/318, per theme/typography.ts.
  lg: {
    diameter: 66,
    initials: 2,
    text: { fontFamily: FontFamily.body, fontSize: 27, color: Colors.neutral[700] },
  },
  // Home header (canvas 2a): one initial, in the label role.
  sm: { diameter: 40, initials: 1, text: { ...Typography.label, color: Colors.textMuted } },
} as const;

/**
 * An uploaded photo wins; without one, the email's Gravatar. Either sits over the initials,
 * so they show while it loads, when it fails (an expired URL, or no Gravatar) and when
 * there is nothing to show.
 */
export function Avatar({ user, size }: { user: User; size: keyof typeof SIZES }) {
  const { diameter, initials, text } = SIZES[size];
  const uploaded = useAvatarUrl(user.image);
  const gravatar = useGravatarUrl(user.email, !user.image);
  const photoUrl = user.image ? uploaded.data?.url : gravatar.data;
  const [failedUrl, setFailedUrl] = useState<string>();
  const url = photoUrl !== failedUrl ? photoUrl : undefined;

  return (
    <View style={[styles.circle, { width: diameter, height: diameter }]}>
      <ThemedText style={text}>{initialsOf(user.name, initials)}</ThemedText>
      {url && (
        <Image
          testID="avatar-photo"
          source={{ uri: url }}
          style={StyleSheet.absoluteFill}
          accessibilityIgnoresInvertColors
          onError={() => setFailedUrl(url)}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  circle: {
    borderRadius: Radius.pill,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.neutral[300],
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
});
