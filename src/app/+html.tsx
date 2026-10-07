import { ScrollViewStyleReset } from 'expo-router/html';
import type { PropsWithChildren } from 'react';

import { Colors } from '@/theme/tokens';

// Placeholder copy pending approval of the store/web listing text.
const TITLE = 'Progress Pick';
const DESCRIPTION = 'Practice with a plan.';

// Chrome and Safari paint autofilled inputs with their own background and text colour, which
// no inline style can override; an inset shadow is the only way to keep the field's tokens.
const AUTOFILL_RESET = `input:-webkit-autofill, input:-webkit-autofill:hover, input:-webkit-autofill:focus {
  -webkit-box-shadow: 0 0 0 1000px ${Colors.surface} inset;
  -webkit-text-fill-color: ${Colors.text};
  caret-color: ${Colors.text};
}`;

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
        <style dangerouslySetInnerHTML={{ __html: AUTOFILL_RESET }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
