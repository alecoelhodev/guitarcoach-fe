import { createContext, type ReactNode, useContext, useMemo, useState } from 'react';

import { PracticeSheet } from '@/features/session/practice-sheet';

const PracticeSheetContext = createContext<{ open: () => void } | null>(null);

/**
 * Practice is an action, not a destination (canvas 02b), and it is reachable from three places:
 * the native FAB, the web bottom bar and the web rail. One sheet, mounted once in the shell, so
 * the three cannot drift into three different behaviours the way their navigation already had —
 * `practice-fab.tsx` was pushing a hardcoded route while the web pair used `PRACTICE_HREF`.
 */
export function PracticeSheetProvider({ children }: { children: ReactNode }) {
  const [visible, setVisible] = useState(false);
  const value = useMemo(() => ({ open: () => setVisible(true) }), []);

  return (
    <PracticeSheetContext.Provider value={value}>
      {children}
      {/* Mounted only while open. The sheet queries the routine list, and mounting it beside
          every screen would fire that request on every screen for a sheet nobody opened. */}
      {visible && <PracticeSheet onClose={() => setVisible(false)} />}
    </PracticeSheetContext.Provider>
  );
}

/**
 * Returns a no-op opener when there is no provider above, rather than throwing. The nav chrome
 * is rendered in suites that mount it in isolation (`rail.web.test.tsx`, `shell.test.tsx`), and
 * a hard requirement here would turn those into provider-wiring tests.
 */
export function usePracticeSheet() {
  return useContext(PracticeSheetContext) ?? NO_PROVIDER;
}

const NO_PROVIDER = { open: () => {} };
