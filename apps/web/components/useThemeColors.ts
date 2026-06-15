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

export function useThemeColors(): { theme: string; colors: ThemeColors | null } {
  const [theme, setTheme] = useState('holo');
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const el = document.documentElement;
    const sync = () => setTheme(el.getAttribute('data-theme') || 'holo');
    sync();
    setReady(true);
    const obs = new MutationObserver(sync);
    obs.observe(el, { attributes: true, attributeFilter: ['data-theme'] });
    return () => obs.disconnect();
  }, []);

  // Recompute whenever the theme attribute changes — `theme` is the intentional trigger even
  // though readColors() pulls from the DOM, not from `theme` directly.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const colors = useMemo(() => (ready ? readColors() : null), [theme, ready]);
  return { theme, colors };
}
