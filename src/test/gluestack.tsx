import type { ReactNode } from 'react';

import { GluestackUIProvider } from '@/components/ui/gluestack-ui-provider';

/**
 * Wrap anything that renders `ConfirmDialog` (or any other Gluestack overlay) in this.
 *
 * Gluestack's `AlertDialog` renders its content through an `OverlayProvider` portal. Without
 * a provider above it there is no portal host, so the dialog mounts and renders **nothing** —
 * `visible` and `visible={false}` produce identical, empty output and an assertion that the
 * dialog is closed passes for the wrong reason. Verified: `getByText(title)` fails on a
 * `visible` dialog rendered bare, and passes once wrapped.
 *
 * Free side effect: this is also what covers `gluestack-ui-provider/index.tsx`.
 */
export function withGluestack(ui: ReactNode) {
  return <GluestackUIProvider>{ui}</GluestackUIProvider>;
}

export function gluestackWrapper({ children }: { children: ReactNode }) {
  return <GluestackUIProvider>{children}</GluestackUIProvider>;
}
