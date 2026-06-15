# CLAUDE.md — WC26 Continental Chaos Board

Read PLAN.md first. It is the source of truth for architecture, data contracts, and phases.
Work phase by phase; do not start a later phase before the current one's "Done when" passes.

## Current status (phases 1–4 shipped)

- ✅ **Phase 1 — Foundation**: holo `/map` with tile-broker failover + live beacons + ticker.
  Wired to **real wc26ir + Upstash** (verified on localhost); public Vercel deploy is
  intentionally **postponed until all phases are done** (DEPLOY.md Step 3).
- ✅ **Phase 2 — Oracle core**: `ingest → elo → goals_model → backtest`. Backtest **accepted**
  (blended beats Elo-only 3/4; mean log-loss 0.975 < 1.003). Publishes ratings/match_probs/meta.
- ✅ **Phase 3 — Simulator + Oracle page**: 48-team Monte Carlo (`simulate.py`) →
  `simulation.json` + `insights.json`; `/oracle` page (champion bars, group heat, Bracket of
  Doom survival heatmap, model card).
- ✅ **Phase 4 — Live layer**: `/api/winprob` analytic in-match prob (remaining-time Poisson on
  published Dixon-Coles λ); heartbeat chart on `/match/[id]` (rebuilt from goal-minute timeline,
  no per-minute storage); Panic Index gauge (shakes); goal-event beacon flash on the map;
  Oracle insights wired into the ticker.
- ⬜ **Phase 5 — Polish** (next): HoloLattice (r3f), lattice→map cross-fade, SSE, OG cards.

Tests: web vitest (`apps/web`) + ml pytest (`ml`) both green; CI runs them + the backtest gate.

## Project rules

- **$0 infrastructure is a hard constraint.** No paid APIs, no inference servers, no GPUs.
  ML runs offline in GitHub Actions and publishes static JSON to `public/oracle/`.
- **The frontend never calls external APIs.** All external data flows through
  `apps/web/app/api/cron/poll` → Redis, or the ML pipeline → `public/oracle/`. The browser
  reads `/api/live` (cache-aside, CDN-edge cached) and the committed `public/oracle/*.json`
  (imported at build time by `lib/oracle.ts`).
- **JSON contracts in PLAN.md §5 are frozen.** Changing them requires updating the zod
  schemas in `apps/web/lib/oracle.ts`, the Python publishers in `ml/src/wc26ml/publish.py`,
  and PLAN.md in the same commit. (Contracts added since: `RatingSchema`, `SimulationSchema`,
  `GroupRowSchema` — same dual-side rule applies.)
- **Honesty in the UI**: every probability shown links to the model card; demo/mock data is
  always labeled; displayed probabilities are clamped to 1–99%.
- The comedy voice lives ONLY in `apps/web/lib/commentary.ts` templates (TypeScript).
  Python emits facts (`insights.json` params), never jokes.

## Stack

- Web: Next.js 15 (App Router), TypeScript strict, react-map-gl/maplibre,
  react-three-fiber + drei + postprocessing (bloom), Tailwind. Deployed on Vercel.
- Cache: Upstash Redis REST (free tier — verified ~500k commands/mo, not the earlier
  10k/day worry; still budget keys). `lib/cache.ts` auto-falls back to an in-process Map when
  unset, and **degrades gracefully** (reads→null, writes→no-op) so a Redis outage never 500s.
- ML: Python 3.11, pandas, numpy, scipy, scikit-learn, xgboost (optional), pytest.
- Visual spec: `prototypes/*.html` — match their look when porting (colors, fonts,
  scanlines, beacon behavior). Fonts: Orbitron / Rajdhani / Share Tech Mono.
  Palette: bg #030B10, cyan #40E5D1, azure #54A9FF, mint #5CFFB1, amber #FFB13B (live).
  Extended with FIFA-WC26-inspired accents for glass panels/gradients: violet #8B6CFF,
  magenta #FF5CA8, gold #FFC94D (live beacons). Theme tokens live in `apps/web/tailwind.config.ts`
  + the `--holo-accent` sweep and `.holo-panel`/`.holo-btn`/`.holo-text-gradient` classes in
  `apps/web/app/globals.css` (single source of truth).

## Commands

- Web: `cd apps/web && npm run dev | npm run lint | npm run typecheck | npm test`
- ML: `cd ml && uv run pytest`, `uv run python -m wc26ml.backtest`,
  `uv run python -m wc26ml.publish`
- Never commit secrets. Keys live in `.env.local` (web) and GitHub Actions secrets (ml).
  Tile keys (Stadia/MapTiler) are domain-restricted and may ship client-side; everything
  else stays server-side.

## Testing expectations

- Simulator bracket routing (groups → third-place allocation → R32 paths) must have
  exhaustive unit tests before being trusted; this is the highest-risk code in the repo.
- `normalize.ts` adapters need fixture-based tests (one recorded raw payload per source).
- Backtest acceptance (PLAN.md §4.5) gates any model change: a PR that worsens log-loss
  on the walk-forward suite does not merge.

## Source data gotchas

- **worldcup26.ir** is community-run: tolerate timeouts (seen on cold loads), keep last-good
  cache with a stale flag, never crash the route. **Verified v1.0.5 reality** (see
  `docs/wc26ir-REAL-SHAPES.md`) differs from its own docs: JWT auth (Bearer + re-auth helper);
  responses wrapped `{games|teams|stadiums:[...]}`; **all scalars are strings** (scores too);
  `finished` is `"TRUE"/"FALSE"`; **state lives in `time_elapsed`** (`notstarted|live|finished|
  <minute>` — treat anything else non-finished as live, e.g. `HT`/`45+2`); team names are
  embedded on games; `local_date` is `"MM/DD/YYYY HH:MM"` (ambiguous TZ, display only); 15/16
  stadium `name_en` match ours (only "GEHA Field at Arrowhead Stadium" needs the substring join
  in `normalize.stadiumIdByName`). Adapter: `lib/sources/wc26ir.ts`; the only external caller.
- **martj42** dataset: ~49k internationals, **no group column** — WC26 groups are reconstructed
  from fixture pairings (connected components) in `ingest.derive_groups`. Team names need
  canonicalization; `ml/src/wc26ml/team_names.py` is the single mapping. `ml/data/` is
  gitignored (regenerated by `wc26ml.ingest`); the committed outputs are `public/oracle/*.json`.
- **API-Football** (Phase 4, not built): 100 req/day hard cap — increment a Redis counter
  before every call, refuse at 95, call only on a score change detected via wc26ir.

## Key decisions & learnings (phases 1–3)

- **Infra resilience**: `/api/live` is CDN-edge cached (`s-maxage=15, stale-while-revalidate=45`)
  so a traffic spike can't fan out to the function/Redis — do NOT revert it to `no-store`.
  `/api/cron/poll` requires `Authorization: Bearer $CRON_SECRET` when set (open locally).
- **ML known limitation (do not "fix" silently)**: the frozen Elo MOV term `ln(|gd|+1)` is 0 for
  draws, so drawn matches don't move ratings. Correcting it strengthens the Elo-only baseline
  enough to fail the 3/4 gate → kept as-is, tracked in `elo.py` + `meta.json.knownLimitations`.
- **Blend**: Dixon-Coles + a **calibrated** GBM (`CalibratedClassifierCV`), weight tuned on
  in-distribution (World Cup) validation. The simulator uses DC **scorelines** (the GBM only
  yields W/D/L, insufficient for goal-based group tiebreakers).
- **Simulator approximation (documented honesty)**: FIFA's 495-row third-place→R32 slot table
  isn't encodable here, so winner-vs-third slotting is approximated; winner/runner pairings are
  cross-group by construction. Second-order on aggregate odds. Noted in `simulate.py` + the page.
- **Secrets**: only `NEXT_PUBLIC_*` (tile keys) reach the client; everything else is server-only
  and gitignored in `.env.local`. Audited: 0 secret hits in the built client bundle / git history.
