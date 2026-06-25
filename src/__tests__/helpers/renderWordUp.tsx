import { render, type RenderOptions } from '@testing-library/react';
import { type ReactElement } from 'react';
import { seedStore } from './seedStore';

interface RenderWordUpOptions extends Omit<RenderOptions, 'wrapper'> {
  preloadStore?: Record<string, any>;
}

export function renderWordUp(ui: ReactElement, options: RenderWordUpOptions = {}) {
  if (options.preloadStore) {
    seedStore(options.preloadStore);
  }

  return render(ui, { ...options });
}
