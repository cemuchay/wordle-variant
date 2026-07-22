// src/hooks/useTheme.ts

import { useEffect, useCallback } from 'react';
import { applyTheme, type AppThemeValue } from '../utils/theme';

/**
 * Custom React hook for dynamic theme management.
 * @param theme - Optional theme value to apply automatically when mounted/changed.
 */
export function useTheme(theme?: AppThemeValue) {
  useEffect(() => {
    if (theme) {
      applyTheme(theme);
    }
  }, [theme]);

  const updateTheme = useCallback((newTheme: AppThemeValue) => {
    applyTheme(newTheme);
  }, []);

  return { updateTheme };
}
