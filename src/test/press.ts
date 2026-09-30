import { fireEvent, type screen } from '@testing-library/react-native';

type Instance = ReturnType<typeof screen.getByText>;

/**
 * The nearest host element above `element` that either claims the touch responder or merely
 * carries an `onPress` prop — whichever comes first.
 */
function nearestTouchTarget(element: Instance): Instance | null {
  for (let node: Instance | null = element; node; node = node.parent) {
    if (typeof node.type !== 'string') continue;
    const props = node.props as { onPress?: unknown; onStartShouldSetResponder?: unknown };
    if (props.onStartShouldSetResponder || props.onPress) return node;
  }
  return null;
}

/**
 * Press the card or row that an `<Link asChild>` wraps, the way a device would.
 *
 * `fireEvent.press` on its own is not evidence. RNTL invokes an `onPress` prop wherever it
 * finds one, including on a plain `View` — which React Native never delivers a press to. Only
 * a host view that claims the touch responder is pressable on a device: `Pressable` sets
 * `onStartShouldSetResponder`, a `View` handed an `onPress` sets nothing. That gap is the whole
 * reason `<Link asChild><Card>` shipped dead in Expo Go while every suite stayed green (QA-02).
 *
 * Do not use this for a `Text` child. RN `Text` handles press without those props, so this
 * would report a false failure — and `Text` is a perfectly valid `asChild` child.
 */
export async function pressLinkTarget(element: Instance) {
  const target = nearestTouchTarget(element);

  if (!target) {
    throw new Error('pressLinkTarget: no element with onPress or a touch responder above this.');
  }

  if (!(target.props as { onStartShouldSetResponder?: unknown }).onStartShouldSetResponder) {
    throw new Error(
      `pressLinkTarget: <${String(target.type)}> carries an onPress prop but never claims the ` +
        'touch responder, so React Native drops the press and this navigates on web only. ' +
        'Give <Link asChild> a Pressable (or a Card with onPress).',
    );
  }

  await fireEvent.press(target);
}
