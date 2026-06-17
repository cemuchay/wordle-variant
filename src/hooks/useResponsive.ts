import { useState, useEffect } from 'react';

/**
 * A simple custom hook to check for responsive breakpoints across the application.
 */
export const useIsResponsive = () => {
  const [state, setState] = useState({
    isDesktop: window.innerWidth >= 640,
    isSmall: window.innerWidth <= 375 && window.innerHeight <= 667,
    isSuperTiny: window.innerWidth <= 350 && window.innerHeight <= 500
  });

  useEffect(() => {
    const handleResize = () => setState({
      isDesktop: window.innerWidth >= 640,
      isSmall: window.innerWidth <= 375 && window.innerHeight <= 667,
      isSuperTiny: window.innerWidth <= 350 && window.innerHeight <= 500
    });
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return state;
};
