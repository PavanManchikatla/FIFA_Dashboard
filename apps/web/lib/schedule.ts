import type { LiveSnapshot, Match } from './types';

// Pure scheduling helpers — no server-only deps, so both the cache-aside route
// (lib/live.ts) and the client poll hook (components/useLive.ts) can share them.

export const KICKOFF_WINDOW_MS = 30 * 60 * 1000;

/** Cache-aside refresh threshold: re-fetch upstream only when the snapshot is older. */
export const REFRESH_AFTER_MS = 45 * 1000;

/** Client poll cadence. */
export const POLL_ACTIVE_MS = 30 * 1000;
export const POLL_IDLE_MS = 5 * 60 * 1000;

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

/** Age of a snapshot in ms (Infinity if null/unparseable). */
export function snapshotAgeMs(snapshot: LiveSnapshot | null, now: number): number {
  if (!snapshot) return Infinity;
  const t = new Date(snapshot.generatedAt).getTime();
  return Number.isNaN(t) ? Infinity : now - t;
}
