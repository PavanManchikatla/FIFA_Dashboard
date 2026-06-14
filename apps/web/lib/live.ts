import 'server-only';
import { fetchData } from './sources/wc26ir';
import { normalizeWc26ir } from './normalize';
import { CACHE_KEYS, TTL, getJson, setJson } from './cache';
import { REFRESH_AFTER_MS, hasActiveWindow, snapshotAgeMs } from './schedule';
import type { LiveSnapshot } from './types';

// Orchestrates the live data path: wc26ir → normalize → cache. /api/live is cache-aside
// (DEPLOY.md Step 3a): it serves cache and only refreshes upstream when the snapshot is
// stale AND a match is active — so N viewers still produce ~1 upstream call per window,
// not N. On a source failure we keep the last-good snapshot and flag it stale rather than
// crashing (CLAUDE.md: never let a fetch failure crash poll).

// Re-export the shared scheduling helpers so existing importers (routes) keep working.
export { isActive, hasActiveWindow } from './schedule';

export async function readSnapshot(): Promise<LiveSnapshot | null> {
  return getJson<LiveSnapshot>(CACHE_KEYS.liveSnapshot);
}

/**
 * Fetch from wc26ir, normalize, and cache. On failure, returns the last-good snapshot
 * marked stale (or an empty stale snapshot if there is none). Never throws.
 */
export async function refreshSnapshot(now: number = Date.now()): Promise<LiveSnapshot> {
  const result = await fetchData();

  if (!result.ok) {
    const lastGood = await readSnapshot();
    const stale: LiveSnapshot = lastGood
      ? { ...lastGood, stale: true }
      : { generatedAt: new Date(now).toISOString(), stale: true, source: 'worldcup26.ir', matches: [] };
    return stale;
  }

  const matches = normalizeWc26ir(result.data);
  const snapshot: LiveSnapshot = {
    generatedAt: new Date(now).toISOString(),
    stale: false,
    source: 'worldcup26.ir',
    matches,
  };
  await setJson(CACHE_KEYS.liveSnapshot, snapshot, TTL.liveSnapshot);
  return snapshot;
}

/**
 * Cache-aside read for /api/live (DEPLOY.md Step 3a). Serves the cached snapshot and only
 * hits wc26ir when the snapshot is missing, or is older than REFRESH_AFTER_MS *and* a match
 * is active/near-kickoff. When idle, the cache is served until its TTL lapses — no upstream
 * churn. The shared cache key means many clients collapse to one upstream call per window.
 */
export async function getLive(now: number = Date.now()): Promise<LiveSnapshot> {
  const cached = await readSnapshot();
  if (!cached) return refreshSnapshot(now);

  const stale = snapshotAgeMs(cached, now) >= REFRESH_AFTER_MS;
  if (stale && hasActiveWindow(cached, now)) return refreshSnapshot(now);

  return cached;
}
