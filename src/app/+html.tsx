import { ScrollViewStyleReset, useServerDocumentContext } from 'expo-router/html';
import type { PropsWithChildren } from 'react';

import { script as colorModeScript } from '@/components/ui/gluestack-ui-provider/script';
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
  // Since SDK 58 the renderer no longer splices the bundle into the HTML string: the script,
  // CSS and bootstrap tags arrive here as nodes, and dropping them serves a page with no JS.
  const { htmlAttributes, bodyAttributes, headNodes, bodyNodes } = useServerDocumentContext();
  // No <title> here: the default title comes from `expo-router/head` in `src/app/_layout.tsx`,
  // which sets it once the app hydrates.
  return (
    <html lang="en" {...htmlAttributes}>
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
        {/* Sets the `dark` class before first paint; must match `mode` in `_layout.tsx`. */}
        <script dangerouslySetInnerHTML={{ __html: `(${colorModeScript.toString()})('dark')` }} />
        {headNodes}
      </head>
      <body {...bodyAttributes}>
        {children}
        {bodyNodes}
      </body>
    </html>
  );
}
