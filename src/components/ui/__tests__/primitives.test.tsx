import { fireEvent, render, screen } from '@testing-library/react-native';

import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Chip } from '@/components/ui/chip';
import { FieldLabel } from '@/components/ui/field-label';
import { Segmented } from '@/components/ui/segmented';
import { Toast } from '@/components/ui/toast';
import { ValidationMessage } from '@/components/ui/validation-message';
import { pressLinkTarget } from '@/test/press';

/**
 * The presentational primitives, grouped because each carries one or two branches. What is
 * asserted here is behaviour the canvas depends on — default variants, `accessibilityState`,
 * and which elements appear at all — never the `StyleSheet` values, which would just
 * re-assert `tokens.ts`.
 */

describe('Badge', () => {
  it('renders its label', async () => {
    await render(<Badge label="Technique" />);

    expect(screen.getByText('Technique')).toBeTruthy();
  });

  it.each(['category', 'difficulty', 'neutral'] as const)('accepts the %s variant', async (v) => {
    await render(<Badge label="Beginner" variant={v} />);

    expect(screen.getByText('Beginner')).toBeTruthy();
  });
});

describe('Card', () => {
  it('renders children in both the solid and quiet surfaces', async () => {
    const view = await render(<Card>{null}</Card>);
    await view.unmount();

    await render(
      <Card quiet>
        <Badge label="inside" />
      </Card>,
    );

    expect(screen.getByText('inside')).toBeTruthy();
  });

  // The reason `onPress` exists at all: a card handed to `<Link asChild>` receives the
  // router's press, and until it rendered a Pressable that press went nowhere on native.
  it('becomes a real touch target once it is given an onPress', async () => {
    const onPress = jest.fn();
    await render(
      <Card onPress={onPress}>
        <Badge label="inside" />
      </Card>,
    );

    await pressLinkTarget(screen.getByText('inside'));

    expect(onPress).toHaveBeenCalled();
  });

  it('stays an inert view without one, so a plain card traps no touches', async () => {
    await render(
      <Card>
        <Badge label="inside" />
      </Card>,
    );

    await expect(pressLinkTarget(screen.getByText('inside'))).rejects.toThrow(
      /no element with onPress or a touch responder/,
    );
  });
});

describe('Chip', () => {
  it('is unselected by default and reports selection to assistive tech', async () => {
    const view = await render(<Chip label="Theory only" />);
    expect(screen.getByRole('button').props.accessibilityState).toMatchObject({
      selected: false,
    });
    await view.unmount();

    await render(<Chip label="Theory only" selected />);

    expect(screen.getByRole('button').props.accessibilityState).toMatchObject({
      selected: true,
    });
  });

  it('calls onPress', async () => {
    const onPress = jest.fn();
    await render(<Chip label="30-min blues routine" onPress={onPress} />);

    await fireEvent.press(screen.getByText('30-min blues routine'));

    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('renders without an onPress', async () => {
    await render(<Chip label="Static" />);

    await fireEvent.press(screen.getByText('Static'));

    expect(screen.getByText('Static')).toBeTruthy();
  });
});

describe('FieldLabel', () => {
  it('renders its text', async () => {
    await render(<FieldLabel>Email</FieldLabel>);

    expect(screen.getByText('Email')).toBeTruthy();
  });
});

describe('Segmented', () => {
  const options = [
    { value: 'draft', label: 'Draft & Review' },
    { value: 'instant', label: 'Instant Create' },
  ] as const;

  it('marks only the current value as selected', async () => {
    await render(<Segmented options={[...options]} value="instant" onChange={jest.fn()} />);

    const [draft, instant] = screen.getAllByRole('button');
    expect(draft.props.accessibilityState).toMatchObject({ selected: false });
    expect(instant.props.accessibilityState).toMatchObject({ selected: true });
  });

  it('reports the value of the segment pressed, not its label', async () => {
    const onChange = jest.fn();
    await render(<Segmented options={[...options]} value="draft" onChange={onChange} />);

    await fireEvent.press(screen.getByText('Instant Create'));

    expect(onChange).toHaveBeenCalledWith('instant');
  });
});

describe('Toast', () => {
  it('defaults to the neutral variant and carries the alert role', async () => {
    await render(<Toast message="Session saved" />);

    expect(screen.getByText('Session saved')).toBeTruthy();
    // Queried by prop rather than `getByRole('alert')`: the View sets `accessibilityRole`
    // but not `accessible`, so RN never makes it an accessibility element and byRole cannot
    // match it. Same gap in `Banner` and `ErrorPanel` — reported, not fixed here.
    expect(screen.toJSON()).toMatchObject({ props: { accessibilityRole: 'alert' } });
  });

  it.each(['default', 'success', 'error'] as const)('renders the %s variant', async (variant) => {
    await render(<Toast message="Saved" variant={variant} />);

    expect(screen.getByText('Saved')).toBeTruthy();
  });
});

describe('ValidationMessage', () => {
  it('renders nothing at all when there is no message', async () => {
    await render(<ValidationMessage />);

    expect(screen.toJSON()).toBeNull();
  });

  it('renders the message when there is one', async () => {
    await render(<ValidationMessage>Enter a valid email</ValidationMessage>);

    expect(screen.getByText('Enter a valid email')).toBeTruthy();
  });
});
