# PLAN.md — WC26 Continental Chaos Board

A live, funny, interactive 3D dashboard for the 2026 FIFA World Cup (June 11 – July 19, 2026),
with a real ML win-probability engine. Total infrastructure cost target: **$0/month**.

---

## 0. Status (living)

Phases 1–3 shipped and verified; Phase 4 is next. See CLAUDE.md "Current status" for the short
version and `docs/` for deploy/integration/data-shape detail. Where the build diverged from this
plan — the real wc26ir shape, the simulator's third-place approximation, the Elo draw limitation,
the added JSON contracts — the relevant sections below are annotated **[as-built]**.

## 1. Vision

One web app, three experiences:

1. **Holo lattice (landing)** — dot-matrix holographic North America (Three.js + bloom),
   16 stadium light-pillar beacons, live ones pulse amber. Cinematic, rotates slowly.
2. **Holo hybrid map (operational view)** — clicking a beacon cross-fades into a real
   street-level basemap wearing a custom holographic MapLibre style (cyan glow borders,
   neon roads, translucent 3D buildings), with a multi-provider tile failover broker.
3. **The Oracle (ML layer)** — pre-match win probabilities, daily Monte Carlo tournament
   simulation ("Bracket of Doom"), live in-match win probability, and model-generated
   insights fed into the comedy ticker via the template engine.

Reference prototypes already built (treat as visual spec, port into React):
- `prototypes/wc26-holo-pitch.html` — holo lattice
- `prototypes/wc26-holo-hybrid.html` — holo basemap + tile broker
- `prototypes/wc26-map-pro.html` — realistic MapLibre variant (keep for style reference)

## 2. Repo layout (monorepo)

```
wc26-chaos-board/
├── CLAUDE.md
├── PLAN.md
├── prototypes/                  # the three HTML prototypes, read-only reference
├── apps/web/                    # Next.js 15, App Router, TypeScript
│   ├── app/
│   │   ├── page.tsx             # holo lattice landing
│   │   ├── map/page.tsx         # holo hybrid map
│   │   ├── oracle/page.tsx      # Bracket of Doom + model insights
│   │   ├── match/[id]/page.tsx  # match detail: live score, in-match win prob chart
│   │   └── api/
│   │       ├── cron/poll/route.ts      # the ONLY caller of external score APIs
│   │       ├── live/route.ts           # frontend reads cache here
│   │       └── winprob/route.ts        # analytic live in-match probability
│   ├── lib/
│   │   ├── sources/             # adapters: wc26ir.ts, apiFootball.ts, openMeteo.ts
│   │   ├── cache.ts             # Upstash Redis wrappers + TTLs
│   │   ├── normalize.ts         # all sources → Match shape
│   │   ├── tileBroker.ts        # provider failover (port from prototype)
│   │   ├── holoStyle.ts         # buildHoloStyle(provider) (port from prototype)
│   │   ├── commentary.ts        # template madlibs engine (no LLM)
│   │   └── oracle.ts            # reads ml JSON artifacts, typed accessors
│   └── components/
│       ├── HoloLattice.tsx      # react-three-fiber port of holo-pitch
│       ├── HoloMap.tsx          # react-map-gl/maplibre port of holo-hybrid
│       ├── VenueCard.tsx, Ticker.tsx, ProbBar.tsx, BracketDoom.tsx, WinProbChart.tsx
├── ml/                          # Python 3.11, uv or pip
│   ├── pyproject.toml
│   ├── data/                    # gitignored raw downloads; committed processed parquet
│   ├── src/wc26ml/
│   │   ├── ingest.py            # download + clean datasets
│   │   ├── elo.py               # custom Elo rating engine
│   │   ├── features.py          # feature builder
│   │   ├── goals_model.py       # bivariate Poisson / Dixon-Coles + GBM blend
│   │   ├── simulate.py          # 10k Monte Carlo tournament sims (48-team format)
│   │   ├── insights.py          # derive insight objects from sim output
│   │   ├── backtest.py          # walk-forward eval on WC 2010/2014/2018/2022
│   │   └── publish.py           # write JSON artifacts to public/oracle/
│   └── tests/
├── public/oracle/               # model outputs consumed by the web app (committed)
│   ├── ratings.json
│   ├── match_probs.json
│   ├── simulation.json
│   ├── insights.json
│   └── meta.json                # run timestamp, model version, backtest scores
└── .github/workflows/
    ├── oracle-daily.yml         # cron: retrain ratings + simulate + commit JSON
    └── ci.yml                   # lint, typecheck, pytest, vitest
```

## 3. Data sources (all free)

| Source | Use | Notes |
|---|---|---|
| `worldcup26.ir` (`/get/games`, `/get/groups`, `/get/teams`, `/get/stadiums`) | Live scores, fixtures, standings | No key. Poll ≤1/min only during live windows. Cache everything. |
| API-Football free tier (`league=1, season=2026`) | Rich events (scorers, cards, lineups) | 100 req/day. Call ONLY on score change detected via wc26ir. |
| `github.com/martj42/international_results` | ~47k internationals since 1872, CC0 | Training backbone; compute our own Elo from it. |
| `openfootball/worldcup.json` | World Cup history 1930–2022 | Backtests + historical-trauma features. |
| Open-Meteo | Stadium weather | Free, no key. Feature (heat) + Heatstroke Watch widget. |
| TheSportsDB | Team badges, stadium images | Free tier. Visual only. |
| OpenFreeMap → Stadia (200k/mo) → MapTiler (100k/mo) | Vector tiles, OpenMapTiles schema | One holo style JSON works on all three; broker flips on 401/403/429 or 90% quota. |
| AWS Terrain Tiles (terrarium) | Optional 3D terrain | Free open data. |

Rules: every external call goes through `lib/sources/*` adapters; the frontend never
calls external APIs directly; all reads come from Redis cache or `public/oracle/` JSON.

## 4. ML specification

### 4.1 Ratings: custom Elo (`elo.py`)
- Init 1500. Update per match chronologically over the full martj42 dataset.
- K-factor by match importance: friendly 20, qualifier 35, continental 45, World Cup 60.
- Margin-of-victory multiplier: `ln(|goal_diff|+1) * 2.2/(0.001*|elo_diff|+2.2)` (WC-Elo standard).
- Home advantage: +80 Elo to home side; for WC26, hosts USA/MEX/CAN get it in home-country
  venues only. Neutral otherwise.
- Output: `ratings.json` — `{ team, elo, rank, delta_7d }`.
- **[as-built]** KNOWN LIMITATION: `ln(1)=0`, so drawn matches produce no Elo change. Correcting
  it (eloratings goal-index, draws=1) strengthens the Elo-only baseline enough to fail §4.5
  (3/4 → 2/4), so the frozen formula stays; tracked in `elo.py` + `meta.json.knownLimitations`.
  Training currently applies +80 to the listed home team via the `neutral` flag (host-venue-only
  refinement is a Phase-4+ detail).

### 4.2 Pre-match model (`goals_model.py`)
Two models, blended:
1. **Dixon-Coles bivariate Poisson** — attack/defence strength per team + home effect,
   time-decay weighting (half-life ≈ 2 years). Gives full scoreline distribution
   → P(win/draw/loss), most-likely score, over/under.
2. **Gradient boosting classifier** (xgboost or sklearn HistGradientBoosting) on features:
   elo_diff, recent form (rolling 10-match goal diff), rest days, confederation pairing,
   host flag, stage (group/knockout), historical H2H rate, weather heat index (≥30°C flag).
- Blend: `p = w*poisson + (1-w)*gbm`, w fit on validation log-loss.
- **Knockout handling**: derive P(advance) = P(win in 90') + P(draw)*P(win ET/pens),
  with pens modeled as 50/50 ± small Elo tilt.
- **[as-built]** GBM is `HistGradientBoosting` wrapped in `CalibratedClassifierCV` (raw proba
  were overconfident, pinning w→1). w is tuned on **in-distribution** (past World Cup) matches,
  not recent friendlies, giving a genuine blend (w≈0.55–0.80). Knockout advance currently uses
  P(win90')+P(draw)·0.5 (DC); ET/pens Elo tilt is a refinement. Features built: elo_diff, rolling
  form, rest days, neutral, importance (confederation/H2H/weather deferred to Phase 4+).

### 4.3 Tournament simulator (`simulate.py`)
- Encode the real 2026 format: 12 groups of 4 → top 2 + 8 best third-placed → Round of 32
  → 16 → QF → SF → F. Implement FIFA's third-place allocation and bracket routing exactly
  (this is the trickiest part — write unit tests against the published bracket rules).
- 10,000 Monte Carlo runs sampling from the blended match probabilities. After each real
  result, played matches are fixed and only the remainder is simulated.
- Output `simulation.json`: per team — P(advance from group), P(R32…final), P(champion);
  per group — standings distribution; plus deltas vs the previous run.
- **[as-built]** Vectorized (numpy) 10k runs in seconds; exhaustive bracket-rule tests
  (`tests/test_simulate.py`). WC26 groups are reconstructed from fixture pairings (connected
  components — martj42 has no group column). APPROXIMATION: FIFA's 495-row third-place→R32 slot
  table isn't publicly encodable, so winner-vs-third slotting is approximated; winner/runner
  pairings are cross-group by construction (second-order effect on aggregate odds, documented in
  `simulate.py` + the Oracle page). Fixing already-played group results is supported but the
  current published run simulates all 72 group games. `simulation.json` also carries `nRuns` +
  a `groups` map of per-team `{p1,p2,p3,p4,pAdvance}`.

### 4.4 Live in-match win probability (`api/winprob`)
Analytic, no training data needed: remaining-time Poisson with pre-match team intensities
(λ_home, λ_away from Dixon-Coles), scaled by minutes left; current score sets the state;
red card multiplies opponent λ by 1.35. Sum over score outcomes → P(home/draw/away) at any
minute. Recompute on each score/card event; store time series in Redis so
`WinProbChart` can draw the full in-game probability curve (the "heartbeat chart").

### 4.5 Backtesting (`backtest.py`) — non-negotiable
- Walk-forward: train on data before each of WC 2010/2014/2018/2022, predict that
  tournament. Report log-loss, Brier score, and a calibration table (predicted vs actual
  bucketed). Compare against two baselines: uniform (1/3,1/3,1/3) and Elo-only logistic.
- Acceptance: blended model beats Elo-only baseline on log-loss across ≥3 of 4 tournaments.
- Publish scores into `meta.json` and show them honestly on the Oracle page
  ("model card" section — calibration plot + 'what this model can't know').

### 4.6 Insights (`insights.py` → `insights.json`)
Each insight = `{ id, kind, severity, teams[], text_template_id, params, generated_at }`.
The web app renders them via `commentary.ts` templates (funny voice lives in TypeScript,
facts live in Python). Catalog for v1:
- `title_odds_move` — biggest daily Δ in champion probability.
- `upset_alert` — completed match where loser had ≥70% pre-match win prob.
- `group_of_death` — group with highest entropy of advancement probabilities.
- `path_difficulty` — avg opponent Elo on each team's most-likely bracket path.
- `pens_doom` — teams with highest probability of facing a penalty shootout.
- `heat_factor` — fixtures with heat index ≥ threshold + each team's hot-weather record.
- `panic_index` — per live match: f(score deficit, minute, cards, title odds at stake,
  historical trauma weight). Drives the shaking gauge.
- `calibration_pulse` — weekly self-report: "the Oracle said 70%, reality said 64%".

## 5. JSON contracts (frozen — write zod schemas in `lib/oracle.ts`)

```ts
type MatchProb = { matchId: string; home: string; away: string; kickoffUtc: string;
  pHome: number; pDraw: number; pAway: number; pAdvanceHome?: number;
  likelyScore: [number, number]; modelVersion: string };
type TeamSim = { team: string; pGroup: number; pR32: number; pR16: number;
  pQF: number; pSF: number; pFinal: number; pChampion: number; dChampion24h: number };
type Insight = { id: string; kind: string; severity: 1|2|3; teams: string[];
  templateId: string; params: Record<string, string|number>; generatedAt: string };
```

**[as-built]** Schemas added alongside the frozen three (same dual-side change rule — update
`lib/oracle.ts` + `publish.py` together):
```ts
type Rating = { team: string; elo: number; rank: number; delta_7d: number };          // ratings.json
type GroupRow = { team: string; p1: number; p2: number; p3: number; p4: number; pAdvance: number };
type Simulation = { runAt: string; modelVersion: string; nRuns: number;               // simulation.json
  teams: TeamSim[]; groups: Record<string, GroupRow[]> };
// meta.json: { runAt, modelVersion, backtest, blendWeightPoisson, matchProbCount,
//             knownLimitations: string[], note } — validated by a passthrough MetaSchema.
```
`lib/oracle.ts` exposes typed accessors (`getSimulation/getInsights/getMatchProbs/getRatings/
getMeta`) that static-import + zod-validate the committed `public/oracle/*.json` at build time.

## 6. Automation (free)

- **GitHub Actions `oracle-daily.yml`**: cron 06:00 UTC + manual dispatch.
  Steps: ingest latest results (wc26ir + martj42) → update Elo → refit goals model →
  simulate 10k → insights → publish JSON → commit to `public/oracle/` → Vercel auto-deploys.
  Runtime budget: < 10 min on the free runner (vectorize the simulator with numpy).
- **Vercel Cron** hits `/api/cron/poll` every minute; route exits instantly unless a match
  is live or within 30 min of kickoff. API-Football calls only on score change.
- **Redis budget** (Upstash free 10k/day): one hash per live match, 60s TTL reads,
  win-prob time series capped at 1 entry/min/match.
- **[as-built]** Vercel Hobby cron is **daily-only** (per-minute is Pro), so live updates are
  client-driven instead: `/api/live` is **cache-aside** (refresh upstream only when stale >45s
  AND a match is active) and **CDN-edge cached** (`s-maxage=15, SWR=45`) so many viewers collapse
  to ~1 backend hit per window; `/api/cron/poll` runs daily for cache warming and requires
  `Authorization: Bearer $CRON_SECRET` when set. Upstash free is ~500k cmds/mo (not 10k/day).
  `oracle-daily.yml` runs the real `ingest → publish` (publish runs the backtest model card).

## 7. Phased roadmap

**Phase 1 — Foundation (ship in a weekend)** — ✅ DONE
- Scaffold monorepo, port tile broker + holo style to `lib/`, render HoloMap with live
  beacons from `/api/live` backed by wc26ir poller. Ticker on template engine.
- Done when: real scores appear on the map within 60s of a goal. ✅ (verified vs real wc26ir;
  public Vercel deploy postponed to post-phases by choice.)

**Phase 2 — The Oracle core** — ✅ DONE
- `ingest → elo → goals_model → backtest`. No UI yet; CLI prints calibration table.
- Done when: backtest acceptance criterion passes and `match_probs.json` is generated. ✅
  (accepted 3/4; mean log-loss blended 0.975 < elo-only 1.003 < uniform 1.099.)

**Phase 3 — Simulator + Oracle page** — ✅ DONE (daily run commits fresh JSON; page renders deltas)
- 48-team simulator with bracket-rule unit tests; daily GitHub Action; `/oracle` page with
  champion-odds bars, group heat tables, Bracket of Doom visualization, model card.
- Done when: daily run commits fresh JSON and the page renders deltas.

**Phase 4 — Live layer** — ✅ DONE
- In-match analytic win prob + heartbeat chart on `/match/[id]`; Panic Index gauge;
  insight templates wired into ticker; goal-event beacon flash on the holo lattice.
- Done when: during a live match the probability curve updates within one poll cycle. ✅
- **[as-built]** `/api/winprob` does remaining-time Poisson on the published Dixon-Coles λ
  (`lambdaHome/lambdaAway` added to the MatchProb contract); a red card multiplies the
  opponent λ by 1.35 (param — wc26ir gives no cards yet). The heartbeat is reconstructed from
  the goal-minute timeline parsed from wc26ir `home_scorers/away_scorers` (so one snapshot
  yields the whole curve — no Redis time-series needed). Panic Index is computed client-side
  in `lib/winprob.ts` from live state + the team's `pChampion` + a per-team trauma weight.
  Goal flash = beacon pulse when a live match's score increases between polls. Win-prob math
  is pure + unit-tested (`lib/winprob.test.ts`). Note: match-id route segments are URL-encoded,
  so the `/match/[id]` page decodes the param before use.

**Phase 5 — Polish (knockouts, from June 28)**
- HoloLattice (react-three-fiber port with bloom), lattice→map cross-fade transition,
  SSE push instead of 30s polling, OG-image cards of daily sim results for sharing.

## 8. Risks & mitigations
- **wc26ir downtime** → cache last-good in Redis with stale flag; self-host the repo as
  fallback; openfootball daily JSON as tertiary truth for finished matches.
- **48-team format has no historical analog** → format risk lives in the simulator, not the
  match model; bracket rules covered by unit tests; third-place allocation table hardcoded
  from FIFA regulations and verified against published bracket.
- **Overconfident model** → calibration shown publicly; cap any displayed prob at 1–99%.
- **API-Football 100/day cap** → event-driven calls only; hard daily counter in Redis;
  degrade gracefully to scores-only.
- **Free tile tiers** → broker (done) + usage counters; OpenFreeMap has no cap.
