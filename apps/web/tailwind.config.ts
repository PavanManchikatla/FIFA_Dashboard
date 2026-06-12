import type { Config } from 'tailwindcss';

// Palette + fonts from CLAUDE.md / the prototypes. Keep these the single source of
// truth for theme tokens so React components match the holo look.
const config: Config = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './lib/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        bg: '#030B10',
        panel: 'rgba(6,20,27,.9)',
        line: 'rgba(64,229,209,.25)',
        cyan: '#40E5D1',
        azure: '#54A9FF',
        mint: '#5CFFB1',
        amber: '#FFB13B',
        ink: '#D8FFF8',
        'ink-dim': '#5E8B86',
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
