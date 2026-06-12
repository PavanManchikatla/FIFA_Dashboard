import Link from 'next/link';

// Landing. The cinematic react-three-fiber holo lattice is Phase 5; this is the
// Phase 1 placeholder that routes into the operational holo map.
export default function Home() {
  return (
    <main className="relative grid h-screen place-items-center overflow-hidden px-6 text-center">
      <div className="holo-fx" />
      <div className="relative z-[5] max-w-2xl">
        <p className="font-mono text-[12px] uppercase tracking-[0.3em] text-ink-dim">
          June 11 – July 19, 2026 · $0 infrastructure
        </p>
        <h1 className="holo-text-gradient mt-4 font-display text-[clamp(28px,6vw,56px)] font-bold uppercase leading-tight tracking-[0.12em] [filter:drop-shadow(0_0_24px_rgba(84,169,255,0.45))]">
          Continental
          <br />
          Chaos Board{' '}
          <span className="text-gold [-webkit-text-fill-color:#FFC94D] [text-shadow:0_0_24px_rgba(255,201,77,0.5)]">
            {'// WC26'}
          </span>
        </h1>
        <p className="mx-auto mt-5 max-w-lg text-[16px] leading-relaxed text-ink-dim">
          A live, funny, interactive dashboard for the 2026 FIFA World Cup with a real ML
          win-probability engine. Holographic map, live beacons, and an Oracle that admits what it can’t know.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/map"
            className="holo-btn px-6 py-3 font-display text-sm font-medium uppercase tracking-[0.12em]"
          >
            Enter the holo map →
          </Link>
        </div>
        <p className="mt-6 font-mono text-[11px] uppercase tracking-[0.2em] text-ink-dim/70">
          Phase 1 · running on mock data
        </p>
      </div>
    </main>
  );
}
