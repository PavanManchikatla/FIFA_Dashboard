import 'server-only';
import { WC26IR_FIXTURE, type Wc26irRawGame, type Wc26irRawPayload } from '@/mocks/wc26irRaw';

// worldcup26.ir adapter. The ONLY place the raw API is fetched (PLAN.md §3).
// Community-run source: tolerate timeouts, never throw — callers keep last-good cache
// with a stale flag (CLAUDE.md source-data gotchas).

const BASE = process.env.WC26IR_BASE_URL;
const FETCH_TIMEOUT_MS = 5_000;

export type Wc26irResult =
  | { ok: true; payload: Wc26irRawPayload }
  | { ok: false; error: string };

/** Fetch raw games. Returns {ok:false} on any failure instead of throwing. */
export async function fetchGames(): Promise<Wc26irResult> {
  // No base URL configured → serve the mock fixture (optionally with ticking goals).
  if (!BASE) {
    return { ok: true, payload: mockPayload() };
  }

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(`${BASE}/get/games`, { signal: ctrl.signal, cache: 'no-store' });
    if (!res.ok) return { ok: false, error: `wc26ir ${res.status}` };
    const payload = (await res.json()) as Wc26irRawPayload;
    return { ok: true, payload };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'wc26ir fetch failed' };
  } finally {
    clearTimeout(timer);
  }
}

// ---- mock live ticking ------------------------------------------------------
// With MOCK_LIVE_GOALS=1, the live Azteca match advances its clock and occasionally
// scores, so you can watch a beacon flip amber and the score update on the map.
function mockPayload(): Wc26irRawPayload {
  if (process.env.MOCK_LIVE_GOALS !== '1') return WC26IR_FIXTURE;

  const games: Wc26irRawGame[] = WC26IR_FIXTURE.games.map((g) => {
    if (g.status !== 'inplay') return g;
    // Drive the clock off wall-time so repeated polls show progression. Minute cycles
    // 1→90 over 90 "seconds"; a goal is added each time the minute crosses a multiple of 23.
    const elapsed = Math.floor((Date.now() / 1000) % 90) + 1;
    const goalsSince = Math.floor(elapsed / 23);
    return { ...g, minute: elapsed, home_score: (g.home_score ?? 0) + goalsSince };
  });
  return { games };
}
