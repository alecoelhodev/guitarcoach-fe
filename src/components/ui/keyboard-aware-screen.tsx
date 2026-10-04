import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet } from 'react-native';

/**
 * Lifts a screen's content clear of the software keyboard.
 *
 * Three screens put their primary action directly under a text field — the coach composer
 * and its Draft button, the routine builder's notes and Save, the session notes and Finish —
 * and none of them avoided the keyboard, so on a handset the button the user was reaching
 * for was the thing the keyboard covered.
 *
 * `behavior` differs by platform and both arms matter: iOS needs `padding` because the
 * keyboard overlays the window, while Android resizes it already under `adjustResize` and
 * `padding` there double-counts. `height` is the arm that works when Android is in
 * full-screen/immersive mode. Web needs neither — the browser scrolls the focused field into
 * view itself — and `undefined` makes this a plain flex container.
 */
export function KeyboardAwareScreen({ children }: { children: ReactNode }) {
  return (
    <KeyboardAvoidingView
      style={styles.fill}
      behavior={Platform.select({ ios: 'padding', android: 'height' })}
    >
      {children}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({ fill: { flex: 1 } });
