// Multi-provider vector-tile failover broker, ported from
// prototypes/wc26-holo-hybrid.html. One holo style works on all three providers;
// the broker advances to the next provider on 401/403/429 or quota exhaustion.
//
// OpenFreeMap is keyless and uncapped, so it is always the primary and the app
// renders with zero configuration. Stadia/MapTiler are opt-in failover tiers,
// enabled only when their keys are present.

export type TileProvider = {
  id: string;
  name: string;
  quota: string;
  url: string;
  needsKey: boolean;
  key?: string;
};

// Tile keys are domain-restricted, so shipping them client-side (NEXT_PUBLIC_*) is OK
// per CLAUDE.md. Read at module load; empty string when unset.
const STADIA_KEY = process.env.NEXT_PUBLIC_STADIA_KEY ?? '';
const MAPTILER_KEY = process.env.NEXT_PUBLIC_MAPTILER_KEY ?? '';

export const PROVIDERS: TileProvider[] = [
  {
    id: 'openfreemap', name: 'OPENFREEMAP', quota: 'unlimited',
    url: 'https://tiles.openfreemap.org/planet', needsKey: false,
  },
  {
    id: 'stadia', name: 'STADIA', quota: '200k/mo',
    url: `https://tiles.stadiamaps.com/data/openmaptiles.json?api_key=${STADIA_KEY}`,
    needsKey: true, key: STADIA_KEY,
  },
  {
    id: 'maptiler', name: 'MAPTILER', quota: '100k/mo',
    url: `https://api.maptiler.com/tiles/v3/tiles.json?key=${MAPTILER_KEY}`,
    needsKey: true, key: MAPTILER_KEY,
  },
];

/** Providers usable right now (keyless, or keyed with a key present). */
export function availableProviders(providers: TileProvider[] = PROVIDERS): TileProvider[] {
  return providers.filter((p) => !p.needsKey || !!p.key);
}

/**
 * Stateful failover broker. The map component drives it: read `active()` for the
 * current provider, call `failover()` when MapLibre emits enough auth/quota errors
 * (or when the user forces it), then re-apply the style for the new provider.
 */
export class TileBroker {
  private index = 0;
  private errCount = 0;
  private errWindowStart: number;
  private readonly providers: TileProvider[];

  constructor(providers: TileProvider[] = PROVIDERS, now: number = Date.now()) {
    this.providers = availableProviders(providers);
    this.errWindowStart = now;
  }

  available(): TileProvider[] {
    return this.providers;
  }

  active(): TileProvider {
    return this.providers[this.index % this.providers.length];
  }

  /** Human-readable failover chain with the active provider bracketed. */
  chain(): string {
    return this.providers
      .map((p, i) => (i === this.index % this.providers.length ? `[${p.name}]` : p.name))
      .join(' → ');
  }

  /**
   * Record a MapLibre error. Returns true if it triggered a failover (caller should
   * re-apply the style). Only auth/quota statuses count, and only after 5 within a
   * 30s window — matches the prototype's debounce so transient blips don't flip tiers.
   */
  recordError(status: number | undefined, now: number = Date.now()): boolean {
    if (status !== 401 && status !== 403 && status !== 429) return false;
    if (now - this.errWindowStart > 30_000) {
      this.errCount = 0;
      this.errWindowStart = now;
    }
    if (++this.errCount > 5) {
      this.errCount = 0;
      return this.failover();
    }
    return false;
  }

  /** Advance to the next provider. Returns true if the active provider changed. */
  failover(): boolean {
    if (this.providers.length < 2) return false;
    this.index = (this.index + 1) % this.providers.length;
    return true;
  }
}
