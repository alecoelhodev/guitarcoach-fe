import { useToastStore } from '@/stores/toast-store';
import { resetStores } from '@/test/reset-stores';

const state = () => useToastStore.getState();

beforeEach(async () => {
  await resetStores();
});

describe('useToastStore', () => {
  it('starts with nothing to show', () => {
    expect(state().toast).toBeNull();
  });

  it('defaults to the neutral variant', () => {
    state().show('Session saved');

    expect(state().toast).toEqual({ message: 'Session saved', variant: 'default' });
  });

  it('carries an explicit variant through', () => {
    state().show("Couldn't save", 'error');

    expect(state().toast).toEqual({ message: "Couldn't save", variant: 'error' });
  });

  it('replaces the current toast instead of queueing behind it', () => {
    // One slot by design: the newer message is the one worth reading. Auto-dismiss timing
    // lives in ToastHost, not here.
    state().show('First', 'success');
    state().show('Second', 'error');

    expect(state().toast).toEqual({ message: 'Second', variant: 'error' });
  });

  it('hides', () => {
    state().show('Session saved');

    state().hide();

    expect(state().toast).toBeNull();
  });

  it('tolerates hiding when nothing is showing', () => {
    state().hide();

    expect(state().toast).toBeNull();
  });
});
