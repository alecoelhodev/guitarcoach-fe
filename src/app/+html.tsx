import { ScrollViewStyleReset } from 'expo-router/html';
import type { PropsWithChildren } from 'react';

import { Colors } from '@/theme/tokens';

// Placeholder copy pending approval of the store/web listing text.
const TITLE = 'Guitar Coach';
const DESCRIPTION = 'Practice with a plan.';

/** Web-only root HTML for static rendering; runs in Node at build time, never on native. */
export default function Root({ children }: PropsWithChildren) {
  // No <title> here: the renderer always prepends Helmet's <title> to <head>, and the first one
  // wins. The default title comes from `expo-router/head` in `src/app/_layout.tsx`.
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no" />
        <meta name="description" content={DESCRIPTION} />
        <meta name="theme-color" content={Colors.bg} />
        <meta name="color-scheme" content="dark" />
        <meta property="og:type" content="website" />
        <meta property="og:title" content={TITLE} />
        <meta property="og:description" content={DESCRIPTION} />
        <meta property="og:site_name" content={TITLE} />
        <ScrollViewStyleReset />
      </head>
      <body>{children}</body>
    </html>
  );
}
