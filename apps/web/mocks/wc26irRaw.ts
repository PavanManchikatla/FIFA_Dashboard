// Mock of the worldcup26.ir API, faithful to the VERIFIED v1.0.5 contract
// (docs/wc26ir-REAL-SHAPES.md). Used when WC26IR_BASE_URL is unset and as the fixture
// for normalize tests, so the normalizer we test is the normalizer we ship.
//
// Key truths from the real schema:
//  - ALL ids are STRINGS; scores are numbers.
//  - Matches reference teams & stadiums by ID only (no embedded names) → 3-endpoint join.
//  - `local_date` is a human string ("June 11, 2026"), no time/UTC → kickoff comes from
//    our static lib/fixtures.ts, not the API.
//  - No documented "live" field (only `finished` + `type`); live is DERIVED. The optional
//    `minute`/`status` fields below model what the README promises to add during the
//    tournament — present ONLY in the MOCK_LIVE_GOALS demo path, gated on presence.

export type Wc26irGame = {
  id: string;
  home_team_id: string;
  away_team_id: string;
  home_score: number;
  away_score: number;
  group: string | null;
  matchday: string;
  local_date: string;
  stadium_id: string;
  finished: boolean;
  type: string;
  // Optional live-only fields (not in v1.0.5 schema). Plan for them; gate on presence.
  minute?: number;
  status?: string;
};

export type Wc26irTeam = {
  id: string;
  name_en: string;
  name_fa: string;
  fifa_code: string;
  groups: string;
  flag: string;
};

export type Wc26irStadium = {
  id: string;
  name_en: string;
  name_fa: string;
  fifa_name: string;
  city_en: string;
  country_en: string;
  capacity: number;
};

export type Wc26irData = {
  games: Wc26irGame[];
  teams: Wc26irTeam[];
  stadiums: Wc26irStadium[];
};

const flag = (code: string) => `https://worldcup26.ir/flags/${code}.svg`;

export const WC26IR_TEAMS: Wc26irTeam[] = [
  { id: '1', name_en: 'Mexico', name_fa: 'مکزیک', fifa_code: 'MEX', groups: 'A', flag: flag('MEX') },
  { id: '2', name_en: 'Croatia', name_fa: 'کرواسی', fifa_code: 'CRO', groups: 'A', flag: flag('CRO') },
  { id: '3', name_en: 'Canada', name_fa: 'کانادا', fifa_code: 'CAN', groups: 'B', flag: flag('CAN') },
  { id: '4', name_en: 'Scotland', name_fa: 'اسکاتلند', fifa_code: 'SCO', groups: 'B', flag: flag('SCO') },
  { id: '5', name_en: 'United States', name_fa: 'آمریکا', fifa_code: 'USA', groups: 'D', flag: flag('USA') },
  { id: '6', name_en: 'Wales', name_fa: 'ولز', fifa_code: 'WAL', groups: 'D', flag: flag('WAL') },
  { id: '7', name_en: 'Argentina', name_fa: 'آرژانتین', fifa_code: 'ARG', groups: 'C', flag: flag('ARG') },
  { id: '8', name_en: 'Nigeria', name_fa: 'نیجریه', fifa_code: 'NGA', groups: 'C', flag: flag('NGA') },
];

// Stadium ids are wc26ir's own ("11" = MetLife per the doc). name_en must match our
// lib/stadiums.ts names so the normalizer can resolve coords (the API has no lat/lon).
export const WC26IR_STADIUMS: Wc26irStadium[] = [
  { id: '1', name_en: 'Estadio Azteca', name_fa: 'آزتکا', fifa_name: 'Estadio Azteca', city_en: 'Mexico City', country_en: 'Mexico', capacity: 87523 },
  { id: '5', name_en: 'BMO Field', name_fa: 'بی‌ام‌او', fifa_name: 'Toronto Stadium', city_en: 'Toronto', country_en: 'Canada', capacity: 30000 },
  { id: '8', name_en: 'SoFi Stadium', name_fa: 'سوفای', fifa_name: 'Los Angeles Stadium', city_en: 'Inglewood, CA', country_en: 'United States', capacity: 70240 },
  { id: '11', name_en: 'MetLife Stadium', name_fa: 'متلایف', fifa_name: 'New York/New Jersey Stadium', city_en: 'East Rutherford, NJ', country_en: 'United States', capacity: 82500 },
];

export const WC26IR_GAMES: Wc26irGame[] = [
  { id: '1', home_team_id: '1', away_team_id: '2', home_score: 0, away_score: 0, group: 'A', matchday: '1', local_date: 'June 11, 2026', stadium_id: '1', finished: false, type: 'group' },
  { id: '2', home_team_id: '3', away_team_id: '4', home_score: 0, away_score: 0, group: 'B', matchday: '1', local_date: 'June 11, 2026', stadium_id: '5', finished: false, type: 'group' },
  { id: '3', home_team_id: '5', away_team_id: '6', home_score: 0, away_score: 0, group: 'D', matchday: '1', local_date: 'June 12, 2026', stadium_id: '8', finished: false, type: 'group' },
  { id: '4', home_team_id: '7', away_team_id: '8', home_score: 2, away_score: 2, group: 'C', matchday: '1', local_date: 'June 11, 2026', stadium_id: '11', finished: true, type: 'group' },
];

export const WC26IR_FIXTURE: Wc26irData = {
  games: WC26IR_GAMES,
  teams: WC26IR_TEAMS,
  stadiums: WC26IR_STADIUMS,
};
