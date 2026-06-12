// A recorded-shape mock of the worldcup26.ir `/get/games` payload, used when
// WC26IR_BASE_URL is unset (Phase 1 default) and as the fixture for normalize tests.
//
// The real API is community-run and undocumented; this shape is our best model of it
// and is the single contract normalize.ts adapts. If the live shape differs, update
// BOTH this fixture and the adapter together (CLAUDE.md: one recorded payload per source).

export type Wc26irRawGame = {
  id: number;
  home: { name: string };
  away: { name: string };
  home_score: number | null;
  away_score: number | null;
  status: 'scheduled' | 'inplay' | 'finished';
  minute: number | null;
  /** ISO-8601 UTC kickoff. */
  utc_date: string;
  /** Stadium display name; mapped to our stadium id in normalize.ts. */
  stadium: string;
  group: string | null;
};

export type Wc26irRawPayload = { games: Wc26irRawGame[] };

// Opening-day-ish slate. One live match at the Azteca mirrors the prototype's demo feed.
export const WC26IR_FIXTURE: Wc26irRawPayload = {
  games: [
    {
      id: 1, home: { name: 'Mexico' }, away: { name: 'Croatia' },
      home_score: 1, away_score: 0, status: 'inplay', minute: 64,
      utc_date: '2026-06-11T19:00:00Z', stadium: 'Estadio Azteca', group: 'A',
    },
    {
      id: 2, home: { name: 'Canada' }, away: { name: 'Scotland' },
      home_score: null, away_score: null, status: 'scheduled', minute: null,
      utc_date: '2026-06-11T23:00:00Z', stadium: 'BMO Field', group: 'B',
    },
    {
      id: 3, home: { name: 'United States' }, away: { name: 'Wales' },
      home_score: null, away_score: null, status: 'scheduled', minute: null,
      utc_date: '2026-06-12T00:00:00Z', stadium: 'SoFi Stadium', group: 'D',
    },
    {
      id: 4, home: { name: 'Argentina' }, away: { name: 'Nigeria' },
      home_score: 2, away_score: 2, status: 'finished', minute: 90,
      utc_date: '2026-06-11T16:00:00Z', stadium: 'MetLife Stadium', group: 'C',
    },
  ],
};
