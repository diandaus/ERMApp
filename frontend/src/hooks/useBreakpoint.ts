import React from 'react';

// Breakpoint 900px dipilih berdasarkan tablet kerja (10.61", 1200x2000 @ ~1.5 DPR):
// portrait ~800px CSS width (compact) vs landscape ~1333px CSS width (di atas 900, tetap desktop-like).
const COMPACT_BREAKPOINT = 900;

// useMediaQuery: hook generik untuk breakpoint custom (mis. grid form yang boleh
// tetap 2 kolom sampai lebih sempit dari breakpoint shell/sidebar di atas).
export function useMediaQuery(maxWidth: number) {
  const [matches, setMatches] = React.useState(
    () => typeof window !== 'undefined' && window.innerWidth <= maxWidth
  );

  React.useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${maxWidth}px)`);
    const handler = (e: MediaQueryListEvent) => setMatches(e.matches);
    setMatches(mql.matches);
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, [maxWidth]);

  return matches;
}

export function useBreakpoint() {
  const isCompact = useMediaQuery(COMPACT_BREAKPOINT);
  return { isCompact };
}
