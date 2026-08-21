import { type ReactNode } from 'react';

/** Native: NativeTabs (inside (tabs)/_layout.tsx) already draws the nav chrome. */
export default function AppShell({ children }: { children: ReactNode }) {
  return children;
}
