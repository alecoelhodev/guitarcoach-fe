import { render } from '@testing-library/react-native';

import { ErrorBoundaryFallback } from '@/components/error-boundary-fallback';
import { reportError } from '@/lib/monitoring';

jest.mock('@/lib/monitoring', () => ({ reportError: jest.fn() }));

describe('ErrorBoundaryFallback reporting', () => {
  beforeEach(() => jest.mocked(reportError).mockClear());

  it('reports the error once, however often it re-renders', async () => {
    const error = new Error('Boom');
    const retry = jest.fn();
    const { rerender } = await render(<ErrorBoundaryFallback error={error} retry={retry} />);
    await rerender(<ErrorBoundaryFallback error={error} retry={jest.fn()} />);
    await rerender(<ErrorBoundaryFallback error={error} retry={retry} />);

    expect(reportError).toHaveBeenCalledTimes(1);
    expect(reportError).toHaveBeenCalledWith(error);
  });

  it('reports a different error that replaces the first', async () => {
    const first = new Error('first');
    const second = new Error('second');
    const { rerender } = await render(<ErrorBoundaryFallback error={first} retry={jest.fn()} />);
    await rerender(<ErrorBoundaryFallback error={second} retry={jest.fn()} />);

    expect(jest.mocked(reportError).mock.calls).toEqual([[first], [second]]);
  });
});
