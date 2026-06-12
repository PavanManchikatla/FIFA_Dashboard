import 'server-only';
import { fetchGames } from './sources/wc26ir';
import { normalizeWc26ir } from './normalize';
import { CACHE_KEYS, TTL, getJson, setJson } from './cache';
import type { LiveSnapshot, Match } from './types';

// Orchestrates the live data path: wc26ir → normalize → cache. The poll route writes
// snapshots; /api/live reads them. On a source failure we keep the last-good snapshot
// and flag it stale rather than crashing (CLAUDE.md: never let a fetch failure crash poll).

const KICKOFF_WINDOW_MS = 30 * 60 * 1000;

/** A match is "active" if live or within 30 min of kickoff — the only time we poll hard. */
export function isActive(m: Match, now: number): boolean {
  if (m.status === 'live') return true;
  if (m.status !== 'scheduled') return false;
  const delta = new Date(m.kickoffUtc).getTime() - now;
  return delta >= 0 && delta <= KICKOFF_WINDOW_MS;
}

/** True if the snapshot has any active match worth polling for. */
export function hasActiveWindow(snapshot: LiveSnapshot | null, now: number): boolean {
  return !!snapshot?.matches.some((m) => isActive(m, now));
}

export async function readSnapshot(): Promise<LiveSnapshot | null> {
  return getJson<LiveSnapshot>(CACHE_KEYS.liveSnapshot);
}

/**
 * Fetch from wc26ir, normalize, and cache. On failure, returns the last-good snapshot
 * marked stale (or an empty stale snapshot if there is none). Never throws.
 */
export async function refreshSnapshot(now: number = Date.now()): Promise<LiveSnapshot> {
  const result = await fetchGames();

  if (!result.ok) {
    const lastGood = await readSnapshot();
    const stale: LiveSnapshot = lastGood
      ? { ...lastGood, stale: true }
      : { generatedAt: new Date(now).toISOString(), stale: true, source: 'worldcup26.ir', matches: [] };
    return stale;
  }

  const matches = normalizeWc26ir(result.payload);
  const snapshot: LiveSnapshot = {
    generatedAt: new Date(now).toISOString(),
    stale: false,
    source: 'worldcup26.ir',
    matches,
  };
  await setJson(CACHE_KEYS.liveSnapshot, snapshot, TTL.liveSnapshot);
  return snapshot;
}

/** Cache-first read for /api/live: serve cache, else refresh once so first load has data. */
export async function getLive(now: number = Date.now()): Promise<LiveSnapshot> {
  const cached = await readSnapshot();
  if (cached) return cached;
  return refreshSnapshot(now);
}
