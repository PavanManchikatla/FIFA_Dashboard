'use client';

import { useEffect, useMemo, useState } from 'react';

// Reads the active theme's colours from the CSS variables (globals.css) as real rgb() strings,
// so canvas/WebGL (HoloLattice) and MapLibre (basemap) — which can't use CSS classes — can
// match the theme, and re-render when the user switches it.

export type ThemeColors = {
  bg: string;
  panel: string;
  line: string;
  ink: string;
  inkDim: string;
  cyan: string;
  azure: string;
  mint: string;
  amber: string;
  gold: string;
  violet: string;
  magenta: string;
};

function readColors(): ThemeColors {
  const s = getComputedStyle(document.documentElement);
  // Comma form (rgb(r, g, b)) — three.js + MapLibre colour parsers expect commas, not spaces.
  const v = (name: string) => {
    const triplet = s.getPropertyValue(name).trim() || '0 0 0';
    return `rgb(${triplet.split(/\s+/).join(', ')})`;
  };
  return {
    bg: v('--c-bg'),
    panel: v('--c-panel'),
    line: v('--c-line'),
    ink: v('--c-ink'),
    inkDim: v('--c-ink-dim'),
    cyan: v('--c-cyan'),
    azure: v('--c-azure'),
    mint: v('--c-mint'),
    amber: v('--c-amber'),
    gold: v('--c-gold'),
    violet: v('--c-violet'),
    magenta: v('--c-magenta'),
  };
}

function currentTheme(): string {
  return typeof document !== 'undefined' ? document.documentElement.getAttribute('data-theme') || 'holo' : 'holo';
}

export function useThemeColors(): { theme: string; colors: ThemeColors | null } {
  // Lazy-init from the live DOM attribute so the FIRST render is already the correct theme —
  // otherwise consumers (map basemap, lattice) build with the default theme on mount and the
  // correction races their init. Consumers are client-only (dynamic ssr:false), so document exists.
  const [theme, setTheme] = useState(currentTheme);

  useEffect(() => {
    const el = document.documentElement;
    const sync = () => setTheme(el.getAttribute('data-theme') || 'holo');
    sync(); // catch any change between first render and this effect attaching
    const obs = new MutationObserver(sync);
    obs.observe(el, { attributes: true, attributeFilter: ['data-theme'] });
    return () => obs.disconnect();
  }, []);

  // Recompute whenever the theme attribute changes — `theme` is the intentional trigger even
  // though readColors() pulls from the DOM, not from `theme` directly.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const colors = useMemo(() => (typeof window === 'undefined' ? null : readColors()), [theme]);
  return { theme, colors };
}
