import { fireEvent, render, screen } from '@testing-library/react-native';
import { createRef } from 'react';
import type { TextInput } from 'react-native';

import { Input } from '@/components/ui/input';
import { PasswordInput } from '@/components/ui/password-input';
import { Stepper } from '@/components/ui/stepper';

describe('Input', () => {
  it('forwards its ref to the underlying TextInput', async () => {
    const ref = createRef<TextInput>();
    await render(<Input ref={ref} testID="field" />);

    expect(ref.current).not.toBeNull();
  });

  it('tracks focus without swallowing the caller’s own handlers', async () => {
    const onFocus = jest.fn();
    const onBlur = jest.fn();
    await render(<Input testID="field" onFocus={onFocus} onBlur={onBlur} />);

    const field = screen.getByTestId('field');
    await fireEvent(field, 'focus');
    expect(onFocus).toHaveBeenCalledTimes(1);

    await fireEvent(field, 'blur');
    expect(onBlur).toHaveBeenCalledTimes(1);
  });

  it('focuses and blurs when the caller passes no handlers', async () => {
    await render(<Input testID="field" />);

    const field = screen.getByTestId('field');
    await fireEvent(field, 'focus');
    await fireEvent(field, 'blur');

    expect(field).toBeTruthy();
  });

  it('accepts the invalid flag', async () => {
    await render(<Input testID="field" invalid />);

    expect(screen.getByTestId('field')).toBeTruthy();
  });
});

describe('PasswordInput', () => {
  it('starts masked, and the toggle label describes the action, not the state', async () => {
    await render(<PasswordInput testID="password" />);

    expect(screen.getByTestId('password').props.secureTextEntry).toBe(true);
    expect(screen.getByLabelText('Show password')).toBeTruthy();
  });

  it('unmasks and re-masks, keeping the label and the visible word in step', async () => {
    await render(<PasswordInput testID="password" />);

    await fireEvent.press(screen.getByLabelText('Show password'));
    expect(screen.getByTestId('password').props.secureTextEntry).toBe(false);
    expect(screen.getByText('Hide')).toBeTruthy();
    expect(screen.getByLabelText('Hide password')).toBeTruthy();

    await fireEvent.press(screen.getByLabelText('Hide password'));
    expect(screen.getByTestId('password').props.secureTextEntry).toBe(true);
    expect(screen.getByText('Show')).toBeTruthy();
  });

  it('forwards its ref', async () => {
    const ref = createRef<TextInput>();
    await render(<PasswordInput ref={ref} testID="password" />);

    expect(ref.current).not.toBeNull();
  });
});

describe('Stepper', () => {
  it('steps by one minute in each direction by default', async () => {
    const onChange = jest.fn();
    await render(<Stepper minutes={10} onChange={onChange} />);

    await fireEvent.press(screen.getByLabelText('Increase minutes'));
    expect(onChange).toHaveBeenLastCalledWith(11);

    await fireEvent.press(screen.getByLabelText('Decrease minutes'));
    expect(onChange).toHaveBeenLastCalledWith(9);
  });

  it('honours a custom step', async () => {
    const onChange = jest.fn();
    await render(<Stepper minutes={10} step={5} onChange={onChange} />);

    await fireEvent.press(screen.getByLabelText('Increase minutes'));

    expect(onChange).toHaveBeenLastCalledWith(15);
  });

  it('disables decrease at the floor and increase at the ceiling', async () => {
    const view = await render(<Stepper minutes={0} onChange={jest.fn()} />);
    expect(screen.getByLabelText('Decrease minutes')).toBeDisabled();
    expect(screen.getByLabelText('Increase minutes')).not.toBeDisabled();
    await view.unmount();

    await render(<Stepper minutes={180} onChange={jest.fn()} />);
    expect(screen.getByLabelText('Increase minutes')).toBeDisabled();
    expect(screen.getByLabelText('Decrease minutes')).not.toBeDisabled();
  });

  it('clamps rather than overshooting when a step would cross a bound', async () => {
    const onChange = jest.fn();
    await render(<Stepper minutes={178} step={5} max={180} onChange={onChange} />);

    await fireEvent.press(screen.getByLabelText('Increase minutes'));

    // Math.min, not 183 — the clamp is the whole reason the arithmetic lives here and not
    // in each caller.
    expect(onChange).toHaveBeenCalledWith(180);
  });

  it('clamps at a custom floor too', async () => {
    const onChange = jest.fn();
    await render(<Stepper minutes={7} step={5} min={5} onChange={onChange} />);

    await fireEvent.press(screen.getByLabelText('Decrease minutes'));

    expect(onChange).toHaveBeenCalledWith(5);
  });

  it('shows the current value with its unit', async () => {
    await render(<Stepper minutes={45} onChange={jest.fn()} />);

    expect(screen.getByText('45 min')).toBeTruthy();
  });
});
