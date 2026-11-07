import { useEffect, useState } from 'react';

const SEARCH_DEBOUNCE_MS = 300;

/**
 * The `q` to send for what is typed in a search field: trimmed, and only once typing pauses.
 * Emptying the field applies at once. `undefined` rather than `''`, which the API rejects.
 */
export function useSearchQuery(search: string): string | undefined {
  const term = search.trim();
  const [debounced, setDebounced] = useState(term);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(term), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [term]);

  return term === '' ? undefined : debounced || undefined;
}
