/**
 * The `next` param on the sign-in route is attacker-controllable through a crafted link,
 * so only same-app absolute paths are honoured — anything else falls back to Home rather
 * than becoming an open redirect.
 */
export function safeNextPath(next: string | undefined, fallback = '/'): string {
  if (!next) return fallback;

  // Must be rooted, and must not be protocol-relative ("//evil.com") or carry a scheme.
  if (!next.startsWith('/')) return fallback;
  if (next.startsWith('//')) return fallback;
  if (next.includes('\\') || next.includes(':')) return fallback;

  return next;
}
