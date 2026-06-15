import type { Config } from 'tailwindcss';

// Colors are driven by CSS variables (see globals.css) so the user can switch themes
// (softer-holo / warm-broadcast / light). Each token is an "R G B" triplet var so Tailwind's
// alpha utilities (e.g. bg-cyan/10) keep working.
const rgb = (v: string) => `rgb(var(${v}) / <alpha-value>)`;

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}', './lib/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: rgb('--c-bg'),
        panel: rgb('--c-panel'),
        line: rgb('--c-line'),
        cyan: rgb('--c-cyan'),
        azure: rgb('--c-azure'),
        mint: rgb('--c-mint'),
        amber: rgb('--c-amber'),
        violet: rgb('--c-violet'),
        magenta: rgb('--c-magenta'),
        gold: rgb('--c-gold'),
        ink: rgb('--c-ink'),
        'ink-dim': rgb('--c-ink-dim'),
      },
      backgroundImage: {
        // Theme-defined accent sweep (set per theme in globals.css).
        'holo-accent': 'var(--holo-accent)',
      },
      fontFamily: {
        display: ['Orbitron', 'sans-serif'],
        body: ['Rajdhani', 'system-ui', 'sans-serif'],
        mono: ['"Share Tech Mono"', 'monospace'],
      },
    },
  },
  plugins: [],
};

export default config;
