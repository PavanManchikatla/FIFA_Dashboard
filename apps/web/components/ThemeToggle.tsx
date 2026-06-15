'use client';

import { useEffect, useState } from 'react';

// Lets the user pick a colour theme (PLAN/CLAUDE: research-driven, eye-strain-friendly).
// Persisted to localStorage; applied pre-paint by the bootstrap script in layout.tsx.
const THEMES = [
  { id: 'holo', label: 'Holo', swatch: '#4fd1c5' },
  { id: 'warm', label: 'Warm', swatch: '#ffb454' },
  { id: 'light', label: 'Light', swatch: '#2563eb' },
] as const;

type ThemeId = (typeof THEMES)[number]['id'];

export function ThemeToggle() {
  const [theme, setTheme] = useState<ThemeId>('holo');
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const current = (document.documentElement.getAttribute('data-theme') as ThemeId) || 'holo';
    setTheme(current);
  }, []);

  const pick = (id: ThemeId) => {
    setTheme(id);
    setOpen(false);
    document.documentElement.setAttribute('data-theme', id);
    try {
      localStorage.setItem('wc26-theme', id);
    } catch {
      /* ignore */
    }
  };

  return (
    <div className="fixed bottom-4 right-4 z-[80] flex flex-col items-end gap-2">
      {open && (
        <div className="holo-panel flex flex-col gap-1 p-2">
          {THEMES.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => pick(t.id)}
              className={`flex items-center gap-2 rounded-md px-3 py-1.5 text-left text-[12px] uppercase tracking-[0.1em] transition-colors hover:bg-cyan/10 ${
                theme === t.id ? 'text-cyan' : 'text-ink-dim'
              }`}
            >
              <span className="h-3 w-3 rounded-full" style={{ backgroundColor: t.swatch }} />
              {t.label}
              {theme === t.id ? ' ✓' : ''}
            </button>
          ))}
        </div>
      )}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label="Change colour theme"
        className="holo-btn flex h-10 w-10 items-center justify-center text-[16px]"
        title="Theme"
      >
        🎨
      </button>
    </div>
  );
}
