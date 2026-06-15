# Integrations TOC — going from mocks to real

> **Status (as-built, phases 1–3):** ✅ **worldcup26.ir** wired to the real v1.0.5 API and
> verified (`docs/wc26ir-REAL-SHAPES.md`). ✅ **Upstash Redis** wired + verified. ✅ **ML
> sources** (martj42) fully used by the Phase 2/3 pipeline → `apps/web/oracle-data/*.json`. ⏸️
> **Vercel** deploy postponed until all phases done (code ready, incl. `CRON_SECRET` + CDN
> caching). ⬜ **API-Football, Open-Meteo, TheSportsDB, terrain** are Phase 4+. The per-item
> states below predate this and describe each integration's wiring; treat this banner as the
> source of truth for what's live.

This is the checklist to plug in every external service. Each item lists **what it powers**,
**where it plugs in** (the file that owns the call), **config** (env var / secret), **current
state**, and **work to do**.

Rule (CLAUDE.md): the frontend never calls these directly — every external call goes
through a `lib/sources/*` adapter on the server; the browser only reads `/api/*` or
`apps/web/oracle-data/`.

Legend: ✅ wired & switch-ready · 🟡 partially scaffolded · ⬜ not built yet

---

## A. Accounts to create (one-time signups)

- [ ] **Upstash** — free Redis (10k cmds/day). Get REST URL + token.
- [ ] **Vercel** — connect the GitHub repo; hosting + cron + env vars.
- [ ] **API-Football** (api-football.com or RapidAPI) — free tier key (100 req/day).
- [ ] **Stadia Maps** *(optional)* — tile key (200k/mo), domain-restricted.
- [ ] **MapTiler** *(optional)* — tile key (100k/mo), domain-restricted.
- [ ] **TheSportsDB** *(optional, visual)* — free tier key for badges/images.
- [ ] **GitHub** — repo Actions secrets for the daily ML run (see §E).

OpenFreeMap, worldcup26.ir, martj42, openfootball, Open-Meteo, AWS terrain → **no signup**.

---

## B. Infrastructure

### B1. Upstash Redis (cache) — ✅ switch-ready
- **Powers:** live snapshot cache, future win-prob time series, API-Football daily counter.
- **Plugs in:** [`apps/web/lib/cache.ts`](../apps/web/lib/cache.ts) — already auto-detects
  Upstash vs in-memory Map.
- **Config:** `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`.
- **To do:** set the two env vars (local `.env.local` + Vercel). No code change.
- **Budget watch:** one hash per live match, 60s read TTL, win-prob ≤1 entry/min/match.

### B2. Vercel (host + cron) — ⬜ not connected
- **Powers:** deploy, and the every-minute hit to `/api/cron/poll`.
- **Plugs in:** [`apps/web/vercel.json`](../apps/web/vercel.json) (cron already declared).
- **To do:** import repo into Vercel, set root dir `apps/web`, add all env vars, deploy.
  Confirm cron fires and exits fast outside live windows.
- **Caveat:** every-minute cron is a **Pro** feature; Hobby cron is daily-only. Decide:
  upgrade, or trigger polling another way (e.g. client-driven during live windows).

---

## C. External data sources (server adapters)

### C1. worldcup26.ir — 🟡 mocked, adapter real
- **Powers:** live scores, fixtures, standings, teams, stadiums (the live heartbeat).
- **Plugs in:** [`apps/web/lib/sources/wc26ir.ts`](../apps/web/lib/sources/wc26ir.ts) →
  [`lib/normalize.ts`](../apps/web/lib/normalize.ts) → [`lib/live.ts`](../apps/web/lib/live.ts).
- **Config:** `WC26IR_BASE_URL` (unset → serves `mocks/wc26irRaw.ts`).
- **To do:** ① confirm the **real payload shape** of `/get/games` and reconcile it with
  `mocks/wc26irRaw.ts` + the normalize adapter (community-run API, undocumented).
  ② add `/get/groups`, `/get/teams`, `/get/stadiums` if we want standings/metadata.
  ③ keep the last-good-cache-with-stale-flag behavior (already in `live.ts`).

### C2. API-Football (rich events) — ⬜ not built
- **Powers:** scorers, cards, lineups — feeds Panic Index + match detail (Phase 4).
- **Plugs in:** new `apps/web/lib/sources/apiFootball.ts` (listed in PLAN, not yet created).
- **Config:** `API_FOOTBALL_KEY` (in `.env.example`, not yet read by any code).
- **To do:** ① build the adapter. ② **Redis daily counter**: increment before every call,
  refuse politely at 95/100. ③ call **only on score change** detected via wc26ir.
  ④ degrade gracefully to scores-only when capped.

### C3. martj42/international_results — ⬜ not built (ML, Phase 2)
- **Powers:** training backbone (~47k internationals) for our Elo + goals model.
- **Plugs in:** `ml/src/wc26ml/ingest.py` (stub) → `elo.py` (math ready) → parquet in `ml/data/`.
- **Config:** none (CC0 download). Team names via `ml/src/wc26ml/team_names.py` (done).
- **To do:** implement `ingest.py` download/clean; commit processed parquet.

### C4. openfootball/worldcup.json — ⬜ not built (ML, Phase 2)
- **Powers:** WC history 1930–2022 → backtests + "historical-trauma" features.
- **Plugs in:** `ml/src/wc26ml/ingest.py` + `backtest.py`.
- **To do:** ingest; wire into the walk-forward backtest (2010/14/18/22).

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
| `UPSTASH_REDIS_REST_URL` / `_TOKEN` | `lib/cache.ts` | ✅ read | `.env.local` + Vercel |
| `WC26IR_BASE_URL` | `lib/sources/wc26ir.ts` | ✅ read | `.env.local` + Vercel |
| `MOCK_LIVE_GOALS` | `lib/sources/wc26ir.ts` | ✅ read | local only (demo) |
| `API_FOOTBALL_KEY` | *(adapter TBD)* | ⬜ declared | `.env.local` + Vercel |
| `NEXT_PUBLIC_STADIA_KEY` | `lib/tileBroker.ts` | ✅ read | `.env.local` + Vercel |
| `NEXT_PUBLIC_MAPTILER_KEY` | `lib/tileBroker.ts` | ✅ read | `.env.local` + Vercel |
| `THESPORTSDB_KEY` | *(adapter TBD)* | ⬜ future | later |

Template: [`apps/web/.env.example`](../apps/web/.env.example).

---

## G. Suggested order

1. **Upstash + Vercel** → real deploy with persistent cache (unblocks everything; B1, B2).
2. **worldcup26.ir real shape** → real live scores (C1). This alone satisfies Phase 1 for real.
3. **API-Football** → rich events for the live layer (C2), needed for Phase 4.
4. **ML sources (martj42 + openfootball)** → Phase 2 Oracle core (C3, C4).
5. **Open-Meteo** → heat feature + widget (C5).
6. **Tile keys, TheSportsDB, terrain** → polish (D2/D3, C6, D4).
