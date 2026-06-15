# DEPLOY.md — going live on $0

Execution order: **wc26ir (real data) → Upstash (real cache) → Vercel (public, client-driven polling)**.
Each step has a "done when" gate. Don't move on until it's green.

**🌐 Live:** https://fifa-dashboard-chi.vercel.app — all three steps below are ✅ DONE.

## Status (as-built)

- ✅ **Step 1 — wc26ir**: DONE and verified. The adapter is reconciled to the real v1.0.5 shape
  (see `wc26ir-REAL-SHAPES.md`); `/api/live` serves real matches when upstream is healthy, 0
  unmapped stadiums. Token lives in `apps/web/.env.local` (local) and Vercel env (prod).
- ✅ **Step 2 — Upstash**: DONE and verified — the live snapshot writes to real Redis and
  survives a dev-server restart. `lib/cache.ts` auto-switches and degrades gracefully on outage.
- ✅ **Step 3 — Vercel public deploy**: DONE (2026-06-15). Live at
  https://fifa-dashboard-chi.vercel.app on Hobby ($0). **Root Directory = `apps/web`**;
  `WC26IR_*` + `UPSTASH_*` + `CRON_SECRET` set in env; `/api/cron/poll` verified `401` without
  the bearer; `/api/live` CDN-cached (`s-maxage=15, SWR=45`). Model artifacts live inside the app
  (`apps/web/oracle-data/`) so no "files outside root" toggle is needed. The wc26ir token was
  **reused, not rotated** (owner's call — low-stakes read-only token; rotation still recommended).

---

## Step 1 — wc26ir: real live data

Reconcile the adapter against the verified contract in `wc26ir-REAL-SHAPES.md` FIRST,
then turn on the real source. Stay on localhost for this whole step.

### 1a. Register + get a token (one-time, manual)
```bash
curl -X POST https://worldcup26.ir/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"<you>","email":"<you@example.com>","password":"<strong-pw>"}'
# -> copy the "token" from the response. Valid 84 days (covers the whole tournament).
# If "User already exists", use /auth/authenticate with the same email+password instead.
```

### 1b. Local env (`apps/web/.env.local`)
```
WC26IR_BASE_URL=https://worldcup26.ir
WC26IR_TOKEN=<token from 1a>
WC26IR_EMAIL=<you@example.com>      # for the re-auth helper when token 401s
WC26IR_PASSWORD=<strong-pw>
# leave Upstash unset for now -> in-memory cache fallback
```

### 1c. Adapter work (hand wc26ir-REAL-SHAPES.md to Claude Code)
- Send `Authorization: Bearer ${WC26IR_TOKEN}` on every call; add a re-auth helper that
  logs in with EMAIL/PASSWORD and caches a fresh token on 401.
- Build the THREE-endpoint join: cache `/get/teams` + `/get/stadiums` id-maps, resolve each
  match. Keep kickoff times + lat/lon in a static `fixtures.ts` (NOT from the API).
- Derive `live` from your own kickoff time, not an API flag.
- Log the first raw `/get/games` response to confirm array vs `{data:[...]}` wrapping.
- Update `mocks/wc26irRaw.ts` to the real v1.0.5 field names/types so tests stay honest.

### 1d. Verify
```bash
cd apps/web && npm run dev
# /map should show beacons from REAL wc26ir data.
# Hit /api/live directly and eyeball the normalized JSON.
curl -s https://worldcup26.ir/health   # sanity: {"status":"healthy",...}
```
**Done when:** real teams/stadiums/scores render on `/map` from the live API (not mocks),
and `/api/live` returns correctly normalized matches. Note: until a match is actually live,
"scores" will be 0–0 fixtures — that's expected. Use `MOCK_LIVE_GOALS=1` to exercise the
live path.

---

## Step 2 — Upstash: real persistent cache

Free tier (confirmed): 256 MB · 10 GB/mo bandwidth · **500K commands/mo** (~16K/day) —
comfortably above our needs; the earlier 10k/day worry no longer applies.

### 2a. Create
- upstash.com → create a **Redis** database (pick a region near your Vercel region).
- Copy **REST URL** and **REST TOKEN** (the REST pair, not the redis:// URL — the app uses
  `@upstash/redis` over HTTP, which is what works in Vercel's serverless runtime).

### 2b. Env (add to `.env.local` now, and to Vercel in Step 3)
```
UPSTASH_REDIS_REST_URL=<rest url>
UPSTASH_REDIS_REST_TOKEN=<rest token>
```

### 2c. Verify
- Restart `npm run dev`. `lib/cache.ts` auto-switches from the Map to Upstash.
- Load `/map`, then check the Upstash console **Data Browser** — you should see live keys
  (e.g. the live snapshot hash) appear.
**Done when:** keys show up in the Upstash console after hitting the app, and data survives
a dev-server restart (it's now persistent, not in-process).

---

## Step 3 — Vercel: public deploy, client-driven polling (Hobby, $0)

### 3a. The polling decision (do the code change BEFORE deploying) — ✅ DONE in code
> Implemented: `/api/live` is cache-aside AND CDN-edge cached (`s-maxage=15,
> stale-while-revalidate=45`) so N viewers collapse to ~1 backend hit/window; `useLive` polls
> on a dynamic cadence (30s active / 5min idle, fast while recovering); `vercel.json` cron is
> daily; `/api/cron/poll` warms the cache and requires `CRON_SECRET`. Nothing to do here at
> deploy time except set the env vars in 3b.

Hobby cron is **daily-only**; every-minute cron is Pro ($20/mo). To stay $0, drop server
cron for live updates and poll from the client during live windows:
- `/api/live` becomes cache-aside: on request, if the cached snapshot is older than ~45s
  AND a match is live/near-kickoff, refresh from wc26ir, write cache, return; else return
  cache. (This is the only place that calls wc26ir.)
- Frontend: when any match is live (or within 30 min of kickoff), poll `/api/live` every
  30–60s; otherwise poll slowly (e.g. every 5 min) or not at all. A simple `useLivePoll`
  hook with a dynamic interval does it.
- Keep `vercel.json` cron but repoint it at daily housekeeping only (e.g. cache warm /
  fixture refresh), which Hobby allows. Remove the every-minute entry.

Guardrails so client polling can't stampede wc26ir:
- The cache-aside refresh is shared (all clients read the same cache key), so N viewers
  still produce ~1 upstream call per 45s, not N.
- Respect wc26ir 429s with backoff; never let a failed upstream fetch 500 `/api/live` —
  serve last-good with a `stale: true` flag.

### 3b. Import + configure
- vercel.com → New Project → import the GitHub repo.
- **Root Directory: `apps/web`** (monorepo). This is REQUIRED — without it Vercel builds the
  repo root, only installs the root `package.json` (which has no deps), and the build fails with
  `next: command not found` (exit 127). With it, Vercel installs `apps/web` deps and runs
  `next build` there.
- The ML artifacts live INSIDE `apps/web` (`apps/web/oracle-data/*.json`), so you do **not** need
  Vercel's "Include files outside of the Root Directory" toggle.
- Framework preset: Next.js (auto).
- Add env vars (Production + Preview): `WC26IR_BASE_URL`, `WC26IR_TOKEN`, `WC26IR_EMAIL`,
  `WC26IR_PASSWORD`, `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`, and **`CRON_SECRET`**
  (any strong random string — Vercel Cron auto-sends it as a bearer; the poll route 401s
  without it). Tile keys `NEXT_PUBLIC_STADIA_KEY` / `_MAPTILER_KEY` optional (broker runs
  without them). Use a **freshly rotated** wc26ir token here, not the one shared during dev.
- Deploy.

### 3c. Verify — ✅ done, here's what was checked in prod
- `/`, `/map`, `/oracle` all return `200`; `/oracle` renders the real simulation (champion odds,
  survival heatmap, model card) — confirms the `oracle-data` relocation works in the prod build.
- **No secrets in the served HTML** — grep for `WC26IR_TOKEN` / `UPSTASH` / JWT (`eyJ…`) on the
  landing page returns nothing. Only `NEXT_PUBLIC_*` (tile keys) can reach the client.
- **Cron locked:** `curl https://fifa-dashboard-chi.vercel.app/api/cron/poll` (no auth) → `401`.
- **Real data path:** `/api/live` returns `source:"worldcup26.ir"`; when upstream is healthy it's
  the real slate, when upstream is down it's `matches:0, stale:true` (NOT the 4-match demo
  fixture) — which proves `WC26IR_BASE_URL` is set (prod is not on mocks).

> ⚠️ **Reading `/api/live` to tell real-vs-mock:** the normalizer hardcodes
> `source:"worldcup26.ir"` even for the built-in fixture. The real tell is the **match count**:
> the demo fixture is exactly **4 matches incl. a live Australia–Turkey game**; the real slate is
> ~104 (or `0 + stale` during an upstream outage). 4 matches in prod ⇒ env vars not set ⇒ mocks.

### 3d. Diagnosing a feed outage (FEED OFFLINE)
worldcup26.ir is community-run and **intermittently down** (observed: host `200` but `/get/games`
`500`). When it's unreachable the app degrades correctly — `/api/live` → empty + stale, the map
shows **FEED OFFLINE** — and recovers automatically when upstream returns. To tell an upstream
outage from an expired token, check **Vercel → Logs** for the adapter's warning:
```
[wc26ir] fetch failed → serving stale/empty: wc26ir /get/games 500   ← upstream down (wait it out)
[wc26ir] fetch failed → serving stale/empty: wc26ir /get/games 401   ← token expired (re-auth, update env)
```

**Done when:** the public URL shows real data (when upstream is up), the token stays server-side,
the cron route is `401` without the bearer, and polling cadence matches live vs idle. ✅ All met.

---

## Secret hygiene (all steps)
- `.env.local` is gitignored; never commit it. Secrets live in Vercel env (server-side).
- Only `NEXT_PUBLIC_*` vars reach the browser. `WC26IR_TOKEN` and Upstash tokens must never
  carry that prefix.
- If a token leaks, rotate: re-auth wc26ir (new token), regenerate the Upstash token.

## Rollback
- Vercel keeps every deploy; "Promote to Production" on a previous deploy reverts instantly.
- If wc26ir misbehaves post-deploy, unset `WC26IR_BASE_URL` in Vercel to fall back to mocks
  without a code change (adapter serves `mocks/` when base url is absent).
