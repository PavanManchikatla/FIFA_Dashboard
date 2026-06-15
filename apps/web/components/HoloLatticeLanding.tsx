'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { LatticeFallback } from './LatticeFallback';

// WebGL needs the browser — load the lattice client-only.
const HoloLattice = dynamic(() => import('./HoloLattice').then((m) => m.HoloLattice), {
  ssr: false,
  loading: () => (
    <div className="grid h-full place-items-center font-mono text-sm text-ink-dim">
      booting holo-lattice…
    </div>
  ),
});

function webglSupported(): boolean {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch {
    return false;
  }
}

export default function HoloLatticeLanding() {
  const router = useRouter();
  const [leaving, setLeaving] = useState(false);
  // Start with the 3D lattice; drop to the CSS fallback if WebGL is missing, its context dies,
  // or it never paints a frame within a few seconds (headless / underpowered GPUs).
  const [mode, setMode] = useState<'lattice' | 'static'>('lattice');
  const ready = useRef(false);
  useEffect(() => {
    if (!webglSupported()) {
      setMode('static');
      return;
    }
    const t = window.setTimeout(() => {
      if (!ready.current) setMode('static');
    }, 3500);
    return () => window.clearTimeout(t);
  }, []);

  // Lattice → map cross-fade: fade the scene to the void, then navigate.
  const enter = useCallback(
    (href: string) => {
      setLeaving(true);
      window.setTimeout(() => router.push(href), 650);
    },
    [router],
  );

  return (
    <main className="relative h-screen overflow-hidden">
      <div className="absolute inset-0">
        {mode === 'lattice' ? (
          <HoloLattice onReady={() => (ready.current = true)} onContextLost={() => setMode('static')} />
        ) : (
          <LatticeFallback />
        )}
      </div>
      <div className="holo-fx" />

      {/* Overlay — transparent to pointer events except the controls, so the lattice stays draggable. */}
      <div className="pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-end pb-[12vh] text-center">
        <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-ink-dim">
          June 11 – July 19, 2026 · $0 infrastructure
        </p>
        <h1 className="holo-text-gradient mt-3 font-display text-[clamp(26px,6vw,56px)] font-bold uppercase leading-tight tracking-[0.12em] [filter:drop-shadow(0_0_28px_rgba(84,169,255,0.5))]">
          Continental Chaos Board{' '}
          <span className="text-gold [-webkit-text-fill-color:#FFC94D] [filter:drop-shadow(0_0_18px_rgba(255,201,77,0.5))]">
            {'// WC26'}
          </span>
        </h1>
        <p className="mt-3 max-w-md px-6 text-[14px] leading-relaxed text-ink-dim">
          A live, funny World Cup dashboard that actually predicts matches. Drag to spin —
          glowing towers are the 16 stadiums, amber means a match is on right now.
        </p>
        <div className="pointer-events-auto mt-6 flex flex-wrap items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => enter('/map')}
            className="holo-btn px-6 py-3 font-display text-sm font-medium uppercase tracking-[0.12em]"
          >
            Enter the holo map →
          </button>
          <button
            type="button"
            onClick={() => enter('/oracle')}
            className="holo-btn px-6 py-3 font-display text-sm font-medium uppercase tracking-[0.12em]"
          >
            Consult the Oracle →
          </button>
        </div>
      </div>

      {/* Cross-fade veil */}
      <div
        className={`pointer-events-none fixed inset-0 z-20 bg-bg transition-opacity duration-700 ${
          leaving ? 'opacity-100' : 'opacity-0'
        }`}
      />
    </main>
  );
}
