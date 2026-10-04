export const script = (mode: string) => {
  const documentElement = document.documentElement;

  function getSystemColorMode() {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  try {
    const isSystem = mode === 'system';
    const theme = isSystem ? getSystemColorMode() : mode;
    documentElement.classList.remove(theme === 'light' ? 'dark' : 'light');
    documentElement.classList.add(theme);
    documentElement.style.colorScheme = theme;
  } catch {
    // Deliberately silent in a shipped build. This was the one ungated `console.error` in
    // the repo, and it runs in production web: the page renders correctly on the dark
    // default without a colour-scheme class, so there is nothing here for a user to act on
    // and nothing collecting it.
    if (__DEV__) {
      // eslint-disable-next-line no-console
      console.warn('[gluestack] could not set the colour scheme class');
    }
  }
};
