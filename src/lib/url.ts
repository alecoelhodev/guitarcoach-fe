/** Only absolute http(s) URLs: `javascript:`, `intent:` and app deep links are rejected. */
export function isWebUrl(value: string) {
  try {
    const { protocol } = new URL(value);
    return protocol === 'http:' || protocol === 'https:';
  } catch {
    return false;
  }
}
