# Integrations TOC — going from mocks to real

> **Status (as-built — DEPLOYED LIVE):** the app is public at
> **https://fifa-dashboard-chi.vercel.app** (Vercel Hobby, $0). ✅ **worldcup26.ir** wired to the
> real v1.0.5 API and verified (`docs/wc26ir-REAL-SHAPES.md`) — set in prod env (community API is
> intermittently down; the app degrades to FEED OFFLINE). ✅ **Upstash Redis** wired + verified,
> set in prod env. ✅ **ML sources** (martj42) fully used by the pipeline →
> `apps/web/oracle-data/*.json`. ✅ **Vercel** deployed (root dir `apps/web`, env set, daily cron
> secured with `CRON_SECRET`, `/api/live` CDN-cached). ⬜ **API-Football, Open-Meteo, TheSportsDB,
> terrain** remain optional/future. The per-item states below describe each integration's wiring;
> treat this banner as the source of truth for what's live.

This is the checklist to plug in every external service. Each item lists **what it powers**,
**where it plugs in** (the file that owns the call), **config** (env var / secret), **current
state**, and **work to do**.

Rule (CLAUDE.md): the frontend never calls these directly — every external call goes
through a `lib/sources/*` adapter on the server; the browser only reads `/api/*` or
`apps/web/oracle-data/`.

Legend: ✅ wired & switch-ready · 🟡 partially scaffolded · ⬜ not built yet

---

## A. Accounts to create (one-time signups)

- [x] **Upstash** — free Redis (~500k cmds/mo). REST URL + token set locally + in Vercel. ✅
- [x] **Vercel** — repo connected, deployed live (root dir `apps/web`, env + cron secret set). ✅
- [ ] **API-Football** (api-football.com or RapidAPI) — free tier key (100 req/day).
- [ ] **Stadia Maps** *(optional)* — tile key (200k/mo), domain-restricted.
- [ ] **MapTiler** *(optional)* — tile key (100k/mo), domain-restricted.
- [ ] **TheSportsDB** *(optional, visual)* — free tier key for badges/images.
- [ ] **GitHub** — repo Actions secrets for the daily ML run (see §E).

OpenFreeMap, worldcup26.ir, martj42, openfootball, Open-Meteo, AWS terrain → **no signup**.

---

## B. Infrastructure

### B1. Upstash Redis (cache) — ✅ live in prod
- **Powers:** live snapshot cache, future win-prob time series, API-Football daily counter.
- **Plugs in:** [`apps/web/lib/cache.ts`](../apps/web/lib/cache.ts) — auto-detects Upstash vs
  in-memory Map; degrades gracefully (reads→null, writes→no-op) on outage.
- **Config:** `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` — set locally + in Vercel.
- **Budget watch:** one hash per live match, 60s read TTL, win-prob ≤1 entry/min/match.

### B2. Vercel (host + cron) — ✅ deployed live
- **Powers:** hosting + the daily `/api/cron/poll` cache-warm.
- **Plugs in:** [`apps/web/vercel.json`](../apps/web/vercel.json) (daily cron declared).
- **Config:** Root Directory `apps/web`; all server env vars + `CRON_SECRET` set; framework
  auto-detected (Next.js). `/api/cron/poll` returns `401` without the bearer (verified).
- **Resolved caveat:** every-minute cron is **Pro**; Hobby is daily-only — so live updates are
  client-driven (cache-aside `/api/live` + CDN edge cache), and the daily cron just warms cache.
- **Deploy gotcha (resolved):** Root Directory MUST be `apps/web` or the build fails with
  `next: command not found`; model JSON lives in `apps/web/oracle-data/` so no "files outside
  root" toggle is needed.

---

## C. External data sources (server adapters)

### C1. worldcup26.ir — ✅ live (real v1.0.5 API, in prod)
- **Powers:** live scores, fixtures, standings, teams, stadiums (the live heartbeat).
- **Plugs in:** [`apps/web/lib/sources/wc26ir.ts`](../apps/web/lib/sources/wc26ir.ts) →
  [`lib/normalize.ts`](../apps/web/lib/normalize.ts) → [`lib/live.ts`](../apps/web/lib/live.ts).
- **Config:** `WC26IR_BASE_URL` + `WC26IR_TOKEN` + `WC26IR_EMAIL`/`WC26IR_PASSWORD` (re-auth on
  401). Unset base → serves `mocks/wc26irRaw.ts` (4-match fixture incl. a live game);
  `MOCK_LIVE_GOALS=1` ticks it. The real shape is verified in `docs/wc26ir-REAL-SHAPES.md`.
- **Done:** three-endpoint join (games+teams+stadiums), JWT auth + re-auth, last-good-cache +
  stale flag, server-only failure logging for outage diagnosis.
- **Reality:** community-run and **intermittently down** (host can be up while `/get/games` 500s).
  When down, the app shows FEED OFFLINE and recovers automatically — by design, not a bug.

### C2. API-Football (rich events) — ⬜ not built
- **Powers:** scorers, cards, lineups — feeds Panic Index + match detail (Phase 4).
- **Plugs in:** new `apps/web/lib/sources/apiFootball.ts` (listed in PLAN, not yet created).
- **Config:** `API_FOOTBALL_KEY` (in `.env.example`, not yet read by any code).
- **To do:** ① build the adapter. ② **Redis daily counter**: increment before every call,
  refuse politely at 95/100. ③ call **only on score change** detected via wc26ir.
  ④ degrade gracefully to scores-only when capped.

### C3. martj42/international_results — ✅ built & in use
- **Powers:** training backbone (~49k internationals) for the Elo + goals model.
- **Plugs in:** `ml/src/wc26ml/ingest.py` → `elo.py` → `goals_model.py` → `simulate.py` →
  `publish.py` → `apps/web/oracle-data/*.json` (consumed by `lib/oracle.ts`). `ml/data/` is
  gitignored (regenerated by ingest); committed outputs are the JSON artifacts.
- **Config:** none (CC0 download). Team names via `ml/src/wc26ml/team_names.py`. No group column
  in the dataset → WC26 groups reconstructed from fixture pairings (`ingest.derive_groups`).

### C4. openfootball/worldcup.json — ⬜ not used (martj42 covers history)
- **Powers (intended):** WC history for backtests + "historical-trauma" features.
- **Status:** the backtest walk-forward (2010/14/18/22) runs off the martj42 dataset, so
  openfootball wasn't needed. Left as a future enrichment source only.

### C5. Open-Meteo (weather) — ⬜ not built
- **Powers:** stadium heat index feature + "Heatstroke Watch" widget.
- **Plugs in:** new `apps/web/lib/sources/openMeteo.ts` (frontend widget) AND
  `ml/src/wc26ml/features.py` (heat ≥30°C flag for the model).
- **Config:** none (free, no key).
- **To do:** build adapter; cache per stadium/day; add widget + feature.

### C6. TheSportsDB (badges/images) — ⬜ not built, visual only
- **Powers:** team badges, stadium photos.
- **Plugs in:** new adapter or build-time fetch into `public/`.
- **Config:** `THESPORTSDB_KEY` (free tier). **To do:** low priority; nice-to-have polish.

---

## D. Map tiles (client-side, domain-restricted keys OK)

### D1. OpenFreeMap — ✅ working now
- Primary provider, keyless, uncapped. Already rendering. No action.

### D2. Stadia / D3. MapTiler — ✅ switch-ready (failover tiers)
- **Plugs in:** [`apps/web/lib/tileBroker.ts`](../apps/web/lib/tileBroker.ts) — broker already
  flips on 401/403/429 and skips keyless tiers when no key.
- **Config:** `NEXT_PUBLIC_STADIA_KEY`, `NEXT_PUBLIC_MAPTILER_KEY`.
- **To do:** add keys (domain-restricted) to enable failover; optional. Add usage counters
  later if we want quota-based flips (currently error-based only).

### D4. AWS Terrain Tiles (terrarium) — ⬜ optional
- Optional 3D terrain under the holo style. Free open data, no key. Polish-phase.

---

## E. GitHub Actions secrets (the daily ML run)

`oracle-daily.yml` is scaffolded but the pipeline is a no-op until Phase 2.

- [ ] `GITHUB_TOKEN` — default token has `contents:write` (already set in the workflow) to
  commit refreshed `apps/web/oracle-data/*.json`. Verify branch protection allows the bot push.
- [ ] Any source keys the ML run needs (Open-Meteo is keyless; martj42/openfootball are public)
  → likely **none** required for the core run. Add only if a source gains a key.

---

## F. Env var reference

| Var | Used by | State | Where to set |
|---|---|---|---|
| `UPSTASH_REDIS_REST_URL` / `_TOKEN` | `lib/cache.ts` | ✅ set (local + Vercel) | `.env.local` + Vercel |
| `WC26IR_BASE_URL` | `lib/sources/wc26ir.ts` | ✅ set (local + Vercel) | `.env.local` + Vercel |
| `WC26IR_TOKEN` | `lib/sources/wc26ir.ts` | ✅ set (server-only) | `.env.local` + Vercel |
| `WC26IR_EMAIL` / `WC26IR_PASSWORD` | `lib/sources/wc26ir.ts` (re-auth) | ✅ set (server-only) | `.env.local` + Vercel |
| `CRON_SECRET` | `app/api/cron/poll` | ✅ set in Vercel (route 401s without it) | Vercel (+ optional local) |
| `MOCK_LIVE_GOALS` | `lib/sources/wc26ir.ts` | ✅ read | local only (demo / `dev:mock`) |
| `NEXT_PUBLIC_ENABLE_SSE` | `useLiveStream` | ✅ read | optional (off by default) |
| `API_FOOTBALL_KEY` | *(adapter TBD)* | ⬜ declared | `.env.local` + Vercel |
| `NEXT_PUBLIC_STADIA_KEY` | `lib/tileBroker.ts` | ✅ read | `.env.local` + Vercel |
| `NEXT_PUBLIC_MAPTILER_KEY` | `lib/tileBroker.ts` | ✅ read | `.env.local` + Vercel |
| `THESPORTSDB_KEY` | *(adapter TBD)* | ⬜ future | later |

> Secret rule: only `NEXT_PUBLIC_*` (tile keys) reach the browser. `WC26IR_TOKEN`, the Upstash
> tokens, and `CRON_SECRET` are server-only and must never carry that prefix.

Template: [`apps/web/.env.example`](../apps/web/.env.example).

---

## G. Suggested order

1. **Upstash + Vercel** → real deploy with persistent cache (unblocks everything; B1, B2).
2. **worldcup26.ir real shape** → real live scores (C1). This alone satisfies Phase 1 for real.
3. **API-Football** → rich events for the live layer (C2), needed for Phase 4.
4. **ML sources (martj42 + openfootball)** → Phase 2 Oracle core (C3, C4).
5. **Open-Meteo** → heat feature + widget (C5).
6. **Tile keys, TheSportsDB, terrain** → polish (D2/D3, C6, D4).
