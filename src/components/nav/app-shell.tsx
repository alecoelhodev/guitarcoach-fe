import { type ReactNode } from 'react';

import { PracticeSheetProvider } from '@/features/session/practice-sheet-provider';

/** Native: NativeTabs (inside (tabs)/_layout.tsx) already draws the nav chrome. */
export default function AppShell({ children }: { children: ReactNode }) {
  return <PracticeSheetProvider>{children}</PracticeSheetProvider>;
}
