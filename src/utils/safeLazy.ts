/* eslint-disable @typescript-eslint/no-explicit-any */
import { lazy } from 'react';
import type { ComponentType, LazyExoticComponent } from 'react';
import { safeLocalStorage } from './storage';

export type PreloadableComponent<T extends ComponentType<any>> = LazyExoticComponent<T> & {
  preload: () => Promise<any>;
};

/**
 * A wrapper around React.lazy that catches chunk loading errors (which typically
 * happen when a new deployment goes live and replaces old build hashes) and
 * forces a page reload to fetch the new asset versions.
 * Exposes a .preload() method to trigger background preloading.
 */
export const safeLazy = <T extends ComponentType<any>>(
  importFunc: () => Promise<{ default: T } | { [key: string]: any }>
): PreloadableComponent<T> => {
  const LazyComponent = lazy(async () => {
    try {
      const module = await importFunc();
      if ('default' in module) {
        return module as { default: T };
      }
      return module as any;
    } catch (error) {
      const lastReload = safeLocalStorage.getItem('last-chunk-reload');
      const now = Date.now();

      // Avoid infinite reload loops: only reload if the last reload was > 10 seconds ago
      if (!lastReload || now - parseInt(lastReload, 10) > 10000) {
        safeLocalStorage.setItem('last-chunk-reload', now.toString());
        console.warn('Dynamic chunk import failed due to build update. Reloading page...', error);
        window.location.reload();
        // Return a pending promise to prevent rendering half-broken components
        return new Promise<{ default: T }>(() => { });
      }

      throw error;
    }
  });

  (LazyComponent as any).preload = () => {
    return importFunc().catch((error) => {
      console.warn('Failed to preload dynamic component:', error);
    });
  };

  return LazyComponent as PreloadableComponent<T>;
};
