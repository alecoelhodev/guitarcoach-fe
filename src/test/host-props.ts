import type { TestInstance } from 'test-renderer';

/**
 * Counts host elements carrying a given prop value.
 *
 * RNTL 14 removed `UNSAFE_getAllByProps` because it could match composite components, but
 * some props are only ever observable as props — `keyboardShouldPersistTaps` decides whether
 * the first tap on a control goes to the control or is spent dismissing the keyboard, and
 * Jest has no keyboard to dismiss. It lands on the host `RCTScrollView`, so a host-only walk
 * is enough and stays within what v14 supports.
 *
 * Use this only where behaviour genuinely cannot be driven. Prefer `fireEvent` everywhere else.
 */
export function countHostProp(root: TestInstance | null, prop: string, value: unknown): number {
  if (!root) return 0;
  let found = 0;

  const visit = (node: TestInstance) => {
    if (node.props?.[prop] === value) found += 1;
    for (const child of node.children) {
      if (typeof child !== 'string') visit(child);
    }
  };

  visit(root);
  return found;
}

/** The first host element carrying `prop`, or null. Same caveat as `countHostProp`. */
export function findHostWithProp(root: TestInstance | null, prop: string): TestInstance | null {
  if (!root) return null;
  if (root.props?.[prop] !== undefined) return root;

  for (const child of root.children) {
    if (typeof child === 'string') continue;
    const hit = findHostWithProp(child, prop);
    if (hit) return hit;
  }
  return null;
}
