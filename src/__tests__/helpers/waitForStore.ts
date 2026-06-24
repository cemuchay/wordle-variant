import { waitFor } from '@testing-library/react';
import { useWordUpStore } from '../../store/useWordUpStore';

export async function waitForStore(predicate: (state: ReturnType<typeof useWordUpStore.getState>) => boolean, timeout = 3000) {
  await waitFor(
    () => {
      const state = useWordUpStore.getState();
      if (!predicate(state)) {
        throw new Error('Store state did not match predicate');
      }
    },
    { timeout, interval: 50 }
  );
}
