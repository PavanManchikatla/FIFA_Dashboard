'use client';

import dynamic from 'next/dynamic';

// MapLibre touches `window`, so load HoloMap client-side only.
const HoloMap = dynamic(() => import('./HoloMap').then((m) => m.HoloMap), {
  ssr: false,
  loading: () => (
    <div className="grid h-screen place-items-center font-mono text-sm text-ink-dim">
      booting holo-pitch…
    </div>
  ),
});

export default function HoloMapClient({ insightLines = [] }: { insightLines?: string[] }) {
  return <HoloMap insightLines={insightLines} />;
}
