import 'server-only';
import {
  WC26IR_FIXTURE,
  type Wc26irData,
  type Wc26irGame,
  type Wc26irStadium,
  type Wc26irTeam,
} from '@/mocks/wc26irRaw';

// worldcup26.ir adapter — the ONLY place the raw API is fetched (PLAN.md §3).
// Verified contract: docs/wc26ir-REAL-SHAPES.md (API v1.0.5).
//  - JWT auth: Bearer token on every call; re-auth on 401 with stored email/password.
//  - Match shape is assembled from THREE endpoints (games + teams + stadiums).
//  - Community-run source: tolerate timeouts/429s, never throw — callers keep last-good
//    cache with a stale flag (CLAUDE.md).

const BASE = process.env.WC26IR_BASE_URL;
const FETCH_TIMEOUT_MS = 6_000;

export type Wc26irResult = { ok: true; data: Wc26irData } | { ok: false; error: string };

// ---- auth -------------------------------------------------------------------
// Token is a server-only secret. Cache it in module scope; refresh on 401 via re-auth.
let cachedToken: string | undefined = process.env.WC26IR_TOKEN || undefined;

async function reauth(): Promise<string | null> {
  const email = process.env.WC26IR_EMAIL;
  const password = process.env.WC26IR_PASSWORD;
  if (!BASE || !email || !password) return null;
  try {
    const res = await fetchWithTimeout(`${BASE}/auth/authenticate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { token?: string };
    if (json.token) {
      cachedToken = json.token;
      return json.token;
    }
    return null;
  } catch {
    return null;
  }
}

function fetchWithTimeout(url: string, init: RequestInit = {}): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  return fetch(url, { ...init, signal: ctrl.signal, cache: 'no-store' }).finally(() =>
    clearTimeout(timer),
  );
}

/** GET a wc26ir endpoint with auth + one re-auth retry on 401. Unwraps {data:[...]} too. */
async function getList<T>(path: string): Promise<T[]> {
  const attempt = async (token: string | undefined): Promise<Response> =>
    fetchWithTimeout(`${BASE}${path}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });

  let res = await attempt(cachedToken);
  if (res.status === 401) {
    const fresh = await reauth();
    if (fresh) res = await attempt(fresh);
  }
  if (!res.ok) throw new Error(`wc26ir ${path} ${res.status}`);

  const json = (await res.json()) as unknown;
  return unwrapList<T>(json);
}

/** Handle both a bare array and a {data:[...]}/{games:[...]} wrapper (UNVERIFIED at write time). */
function unwrapList<T>(json: unknown): T[] {
  if (Array.isArray(json)) return json as T[];
  if (json && typeof json === 'object') {
    for (const key of ['data', 'games', 'teams', 'stadiums', 'results']) {
      const v = (json as Record<string, unknown>)[key];
      if (Array.isArray(v)) return v as T[];
    }
  }
  return [];
}

// ---- public surface ---------------------------------------------------------
/** Fetch + join the three endpoints. Returns {ok:false} on any failure instead of throwing. */
export async function fetchData(): Promise<Wc26irResult> {
  // No base URL configured → serve the mock (optionally with ticking goals).
  if (!BASE) return { ok: true, data: mockData() };

  try {
    const [games, teams, stadiums] = await Promise.all([
      getList<Wc26irGame>('/get/games'),
      getList<Wc26irTeam>('/get/teams'),
      getList<Wc26irStadium>('/get/stadiums'),
    ]);
    return { ok: true, data: { games, teams, stadiums } };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'wc26ir fetch failed' };
  }
}

// ---- mock live ticking ------------------------------------------------------
// With MOCK_LIVE_GOALS=1, the opening match gains the optional live fields the real API
// is expected to add during the tournament (status:'live' + minute) and ticks goals, so
// the live beacon flip is demoable without a real fixture in the kickoff window.
function mockData(): Wc26irData {
  if (process.env.MOCK_LIVE_GOALS !== '1') return WC26IR_FIXTURE;

  const elapsed = Math.floor((Date.now() / 1000) % 90) + 1; // 1→90, off wall-clock
  const goalsSince = Math.floor(elapsed / 23);
  const games = WC26IR_FIXTURE.games.map((g) =>
    g.id === '1'
      ? { ...g, finished: false, status: 'live', minute: elapsed, home_score: goalsSince }
      : g,
  );
  return { ...WC26IR_FIXTURE, games };
}
