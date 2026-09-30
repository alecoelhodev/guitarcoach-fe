import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

/**
 * Haptic feedback, safe to call from anywhere.
 *
 * `expo-haptics` has no web implementation and its calls reject there, so every entry point
 * short-circuits rather than leaving a floating rejection per tap. The promises are
 * deliberately not awaited: feedback that arrives a frame late is worse than none, and a
 * device with haptics disabled resolves without doing anything.
 *
 * Reserved for moments the user caused and would otherwise only learn about by reading:
 * a task ticked off, a session saved, a destructive confirmation. Not for navigation.
 */
const enabled = Platform.OS === 'ios' || Platform.OS === 'android';

/** A control responded — ticking a task, stepping minutes. */
export function tapped() {
  if (enabled) void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
}

/** Something the user asked for landed — a session saved, a recording uploaded. */
export function succeeded() {
  if (enabled) void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
}

/** A destructive confirmation is about to happen. */
export function warned() {
  if (enabled) void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
}
