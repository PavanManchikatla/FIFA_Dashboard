// Mock of the worldcup26.ir API, faithful to the REAL v1.0.5 payloads observed live on
// 2026-06-14 (supersedes the earlier doc-based guess; see docs/wc26ir-REAL-SHAPES.md).
// Used when WC26IR_BASE_URL is unset and as the fixture for normalize tests, so the
// normalizer we test is the normalizer we ship.
//
// Real-shape truths (verified against the live API):
//  - Every scalar is a STRING, including scores ("2") and `finished` ("TRUE"/"FALSE").
//  - `time_elapsed` is the authoritative state: "notstarted" | "live" | "finished"
//    (and may become a minute string during a live match — we parse numerics too).
//  - Team names ARE embedded on group games (home_team_name_en/_fa); the teams endpoint
//    is the reliable fallback (and source of flags). Stadiums are by id only → join.
//  - `local_date` is "MM/DD/YYYY HH:MM" (venue-local-ish, ambiguous TZ).

export type Wc26irGame = {
  _id: string;
  id: string;
  home_team_id: string;
  away_team_id: string;
  home_score: string;
  away_score: string;
  home_scorers: string;
  away_scorers: string;
  group: string | null;
  matchday: string;
  local_date: string;
  persian_date: string;
  stadium_id: string;
  finished: string; // "TRUE" | "FALSE"
  time_elapsed: string; // "notstarted" | "live" | "finished" | "<minute>"
  type: string;
  home_team_name_en?: string;
  home_team_name_fa?: string;
  away_team_name_en?: string;
  away_team_name_fa?: string;
};

export type Wc26irTeam = {
  _id: string;
  id: string;
  name_en: string;
  name_fa: string;
  flag: string;
  fifa_code: string;
  iso2: string;
  groups: string;
};

export type Wc26irStadium = {
  _id: string;
  id: string;
  name_en: string;
  name_fa: string;
  fifa_name: string;
  city_en: string;
  city_fa: string;
  country_en: string;
  country_fa: string;
  capacity: number;
  region: string;
};

export type Wc26irData = {
  games: Wc26irGame[];
  teams: Wc26irTeam[];
  stadiums: Wc26irStadium[];
};

const team = (id: string, name_en: string, fifa: string, iso2: string, groups: string): Wc26irTeam => ({
  _id: `t${id}`, id, name_en, name_fa: name_en, flag: `https://flagcdn.com/w80/${iso2}.png`,
  fifa_code: fifa, iso2, groups,
});

export const WC26IR_TEAMS: Wc26irTeam[] = [
  team('1', 'Mexico', 'MEX', 'mx', 'A'),
  team('2', 'South Africa', 'RSA', 'za', 'A'),
  team('3', 'Australia', 'AUS', 'au', 'B'),
  team('4', 'Turkey', 'TUR', 'tr', 'B'),
  team('5', 'United States', 'USA', 'us', 'D'),
  team('6', 'Wales', 'WAL', 'gb-wls', 'D'),
  team('7', 'Canada', 'CAN', 'ca', 'B'),
  team('8', 'Qatar', 'QAT', 'qa', 'B'),
];

const stadium = (
  id: string, name_en: string, fifa_name: string, city_en: string, country_en: string, capacity: number,
): Wc26irStadium => ({
  _id: `s${id}`, id, name_en, name_fa: name_en, fifa_name, city_en, city_fa: city_en,
  country_en, country_fa: country_en, capacity, region: '',
});

// Real ids + names (incl. the GEHA/Arrowhead naming quirk, to exercise the fuzzy join).
export const WC26IR_STADIUMS: Wc26irStadium[] = [
  stadium('1', 'Estadio Azteca', 'Mexico City Stadium', 'Mexico City', 'Mexico', 87523),
  stadium('6', 'GEHA Field at Arrowhead Stadium', 'Kansas City Stadium', 'Kansas City', 'United States', 76416),
  stadium('11', 'MetLife Stadium', 'New York/New Jersey Stadium', 'New York/New Jersey', 'United States', 82500),
  stadium('12', 'BMO Field', 'Toronto Stadium', 'Toronto', 'Canada', 30000),
  stadium('16', 'SoFi Stadium', 'Los Angeles Stadium', 'Los Angeles', 'United States', 70240),
];

const game = (g: Partial<Wc26irGame> & Pick<Wc26irGame, 'id' | 'home_team_id' | 'away_team_id' | 'stadium_id'>): Wc26irGame => ({
  _id: `g${g.id}`, home_score: '0', away_score: '0', home_scorers: 'null', away_scorers: 'null',
  group: null, matchday: '1', local_date: '06/11/2026 13:00', persian_date: '1405-03-21 13:00',
  finished: 'FALSE', time_elapsed: 'notstarted', type: 'group', ...g,
});

export const WC26IR_GAMES: Wc26irGame[] = [
  game({
    id: '1', home_team_id: '1', away_team_id: '2', stadium_id: '1', group: 'A',
    home_score: '2', away_score: '0', finished: 'TRUE', time_elapsed: 'finished',
    home_scorers: '{"J. Quiñones 9\'","R. Jiménez 67\'"}',
    local_date: '06/11/2026 13:00', home_team_name_en: 'Mexico', away_team_name_en: 'South Africa',
  }),
  game({
    id: '6', home_team_id: '3', away_team_id: '4', stadium_id: '12', group: 'B',
    home_score: '1', away_score: '0', finished: 'FALSE', time_elapsed: 'live',
    home_scorers: '{"M. Duke 23\'"}',
    local_date: '06/13/2026 21:00', home_team_name_en: 'Australia', away_team_name_en: 'Turkey',
  }),
  game({
    id: '9', home_team_id: '5', away_team_id: '6', stadium_id: '16', group: 'D',
    finished: 'FALSE', time_elapsed: 'notstarted', local_date: '06/14/2026 19:00',
    home_team_name_en: 'United States', away_team_name_en: 'Wales',
  }),
  game({
    id: '30', home_team_id: '7', away_team_id: '8', stadium_id: '6', group: 'B',
    finished: 'FALSE', time_elapsed: 'notstarted', local_date: '06/18/2026 15:00',
    home_team_name_en: 'Canada', away_team_name_en: 'Qatar',
  }),
];

export const WC26IR_FIXTURE: Wc26irData = {
  games: WC26IR_GAMES,
  teams: WC26IR_TEAMS,
  stadiums: WC26IR_STADIUMS,
};
