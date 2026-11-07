'use client';
import { OverlayProvider } from '@gluestack-ui/core/overlay/creator';
import { ToastProvider } from '@gluestack-ui/core/toast/creator';
import React, { useEffect, useLayoutEffect } from 'react';

import { script } from './script';

export type ModeType = 'light' | 'dark' | 'system';

export const useSafeLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect;

export function GluestackUIProvider({
  mode = 'light',
  ...props
}: {
  mode?: ModeType;
  children?: React.ReactNode;
}) {
  const handleMediaQuery = React.useCallback((e: MediaQueryListEvent) => {
    script(e.matches ? 'dark' : 'light');
  }, []);

  useSafeLayoutEffect(() => {
    if (mode !== 'system') {
      const documentElement = document.documentElement;
      if (documentElement) {
        documentElement.classList.add(mode);
        documentElement.classList.remove(mode === 'light' ? 'dark' : 'light');
        documentElement.style.colorScheme = mode;
      }
    }
  }, [mode]);

  useSafeLayoutEffect(() => {
    if (mode !== 'system') return;
    const media = window.matchMedia('(prefers-color-scheme: dark)');

    media.addListener(handleMediaQuery);

    return () => media.removeListener(handleMediaQuery);
  }, [handleMediaQuery]);

  // The pre-paint `script` tag lives in `src/app/+html.tsx`: rendered here, React warns that a
  // client-rendered <script> never executes.
  return (
    <OverlayProvider>
      <ToastProvider>{props.children}</ToastProvider>
    </OverlayProvider>
  );
}
