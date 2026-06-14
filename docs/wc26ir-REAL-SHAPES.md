# wc26ir — VERIFIED API contract (reconciled 2026-06-13)

Source of truth: rezarahiminia/worldcup2026 README, API v1.0.5. Replaces guessed mock.
Base URL: `https://worldcup26.ir`  (Swagger: `https://worldcup26.ir/api-docs/`)

> ## ⚠️ LIVE FINDINGS (observed 2026-06-14) — the running API differs from this README
> The adapter (`apps/web/lib/sources/wc26ir.ts`) + mock (`mocks/wc26irRaw.ts`) are reconciled
> to what the **live** API actually returns, which corrects several claims below:
> - **Every scalar is a STRING** — including scores (`"2"`) and `finished` (`"TRUE"`/`"FALSE"`),
>   not numbers/bools as stated below. Parse explicitly (a `"FALSE"` string is truthy!).
> - **`time_elapsed` exists and is the live signal**: `notstarted` | `live` | `finished` |
>   `<minute>`. Treat anything non-finished and not "notstarted" as live (covers `HT`/`45+2`).
>   This supersedes "no reliable live status field" below.
> - **Team names ARE embedded** on games (`home_team_name_en` / `away_team_name_en`) — contra
>   "no embedded names" below. We still keep the teams endpoint as a fallback + for flags.
> - **`local_date` is `"MM/DD/YYYY HH:MM"`** (it has a time; ambiguous TZ) — parsed for display
>   only; live state comes from `time_elapsed`, not kickoff windows. `lib/fixtures.ts` is now an
>   optional UTC override (empty by default), not the kickoff source.
> - Responses are wrapped `{games|teams|stadiums:[...]}` (the `unwrapList` helper handles it).
> - 15/16 stadium `name_en` match ours; only `"GEHA Field at Arrowhead Stadium"` needs the
>   substring fallback in `normalize.stadiumIdByName`. Stadiums still have no lat/lon → coords
>   stay in `lib/stadiums.ts`. Groups are derived from fixture pairings (no group field).
>
> The rest of this file (auth, endpoint list, third-place mechanics) remains accurate.

## Auth (CHANGED — was previously keyless)

All endpoints except `/auth/*` and `/health` require a JWT.

```
POST /auth/register   { name, email, password }  -> { user, token }
POST /auth/authenticate { email, password }       -> { user, token }
# then on every call:
Authorization: Bearer <token>      # token valid 84 days (covers whole tournament)
```

Integration: register ONCE manually, store token as server-only secret `WC26IR_TOKEN`.
Add a tiny re-auth helper in the adapter for when it eventually 401s (login with stored
`WC26IR_EMAIL`/`WC26IR_PASSWORD`, cache new token). Never ship the token client-side.
Rate limit: ~500/min default; handle 429 with backoff. 401 = bad/expired token.

## Endpoint shapes (ALL ids are STRINGS; scores are numbers)

### GET /get/games  (all 104) · GET /get/game/{id}
```json
{
  "id": "1",
  "home_team_id": "1",
  "away_team_id": "2",
  "home_score": 0,
  "away_score": 0,
  "group": "A",
  "matchday": "1",
  "local_date": "June 11, 2026",
  "stadium_id": "1",
  "finished": false,
  "type": "group"
}
```

### GET /get/teams · /get/team/{id} · /get/team/?name= · /get/teams/?group=
```json
{ "id": "37", "name_en": "Argentina", "name_fa": "آرژانتین",
  "fifa_code": "ARG", "groups": "J", "flag": "https://..." }
```

### GET /get/groups · /get/group/{id} · /get/group/?name=
```json
{ "group": "G", "teams": [ { "team_id": "25", "pts": "0", "gf": "0", "ga": "0" } ] }
```

### GET /get/stadiums · /get/stadium/{id}
```json
{ "id": "11", "name_en": "MetLife Stadium", "name_fa": "...",
  "fifa_name": "New York/New Jersey Stadium",
  "city_en": "East Rutherford, NJ", "country_en": "United States", "capacity": 82500 }
```

### GET /health  (no auth)
```json
{ "status": "healthy", "version": "1.0.5", "database": { "status": "connected" } }
```

## Normalizer implications (update lib/normalize.ts + mocks/wc26irRaw.ts)

1. **String IDs everywhere.** `id`, `home_team_id`, `stadium_id`, `matchday` are strings;
   `pts/gf/ga` in standings are strings too. Parse explicitly; don't assume numbers.
2. **Matches reference teams & stadiums by ID only — NO embedded names.** The normalizer
   must JOIN: fetch `/get/teams` and `/get/stadiums` once, build id→team and id→stadium
   maps, cache them (they don't change), then resolve every match. This is the biggest
   change — the Match shape is assembled from THREE endpoints, not one.
3. **`local_date` is a human string ("June 11, 2026"), not ISO, and has NO time/UTC.**
   Our `Match.kickoffUtc` cannot come from this field. Options: (a) keep our own fixture
   schedule with real UTC kickoffs as the source of kickoff times and join by match id,
   or (b) parse local_date to a date only and treat kickoff as unknown. Recommend (a) —
   we already have accurate coords/fixtures from the prototypes; make a static
   `fixtures.ts` (matchId -> { kickoffUtc, lat, lon }) and treat wc26ir as the *score/state*
   source, not the schedule/geo source.
4. **Stadiums have NO lat/lon.** Beacon coordinates must stay in our static stadium table
   (from the prototypes). wc26ir gives capacity + city names only.
5. **No reliable "live" status field in the documented schema** — only `finished: bool`
   and `type`. The README promises live status/elapsed-time/scorers during the tournament,
   but those fields aren't in the v1.0.5 schema. Treat "live" as DERIVED:
   `!finished && now >= kickoffUtc && now < kickoffUtc + ~150min`. When the tournament is
   live, log a raw payload and check for extra fields (minute, status, scorers) — if they
   appear, extend the adapter then. Do NOT assume they exist now.
6. **Team flags come free** (`flag` URL) — this partially removes the need for TheSportsDB
   badges (C6 can drop to "nice to have" or be dropped).

## What is still UNVERIFIED (can't be confirmed until a real live match)

- The exact extra fields present on a match object *while live* (minute, scorers, cards,
  status enum). Plan for them, gate on their presence, don't hard-depend.
- Whether `/get/games` returns the array directly or wrapped (e.g. `{ data: [...] }`).
  Log the first real response and adjust the array accessor in the adapter.

## Mock fixture to match reality (replace mocks/wc26irRaw.ts samples)

Use the exact field names/types above. Make MOCK_LIVE_GOALS flip `home_score` and, when
you add it, a derived/live marker — but keep the on-disk mock faithful to the v1.0.5 shape
so the normalizer you test against is the normalizer you ship.
