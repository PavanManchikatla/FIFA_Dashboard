import type { Match } from './types';

// The template madlibs engine — the ONLY place the comedy voice lives (CLAUDE.md).
// Python emits facts (insights.json params); these TypeScript templates turn facts
// into jokes. No LLM. Each template is a pure function of typed params.

export type TemplateParams = Record<string, string | number>;

// Catalog keyed by templateId. insights.json (Phase 3+) references these ids; for
// Phase 1 we drive the ticker from live match facts directly.
const TEMPLATES: Record<string, (p: TemplateParams) => string> = {
  goal: (p) =>
    `${p.minute}' GOAL :: ${p.team} strike at ${p.venue} and somewhere a group-stage spreadsheet bursts into flames`,
  kickoff_soon: (p) =>
    `${p.kickoff} :: ${p.home} vs ${p.away} at ${p.venue} — neutral fans calm, anyone with a bracket already sweating`,
  final_whistle: (p) =>
    `FT :: ${p.home} ${p.score} ${p.away}. The Oracle is updating its feelings about ${p.team}`,
  tile_broker: () =>
    'TILE BROKER :: openfreemap primary / stadia + maptiler on standby. one style JSON, three providers, $0',
  system: () =>
    'SYSTEM :: this ticker is template-powered madlibs. cost: $0. uptime: eternal',
  panic_index: (p) =>
    `PANIC INDEX :: neutral fans 0.0 / anyone whose team plays today ${p.level}`,
};

/** Render a template by id. Unknown ids return a labelled fallback (never throws). */
export function renderTemplate(templateId: string, params: TemplateParams = {}): string {
  const tpl = TEMPLATES[templateId];
  return tpl ? tpl(params) : `[${templateId}]`;
}

// Per-venue one-liners, keyed by stadium id (ported from the prototype jokes).
// Comedy lives here, not in any data file.
const VENUE_QUIPS: Record<string, string> = {
  azteca: 'The Azteca crowd is so loud the seismograph in Puebla just filed a complaint.',
  akron: 'Forecast: 100% chance of mariachi, scattered nutmegs after the 60th minute.',
  bbva: 'The mountain backdrop is undefeated. The visiting defense will not be.',
  bmo: 'Canada apologizes in advance for any goals scored against your team.',
  bcplace: 'Roof closed, expectations open.',
  metlife: 'Hosting the final. The traffic on Route 3 is already warming up.',
  att: 'The jumbotron is larger than some opponents’ entire game plan.',
  sofi: 'Players asked for shade. The stadium offered a 70,000-seat skylight.',
  mbs: 'The roof opens like a camera shutter, fitting for a tournament of dives.',
  gillette: 'New England weather: all four seasons scheduled before halftime.',
  nrg: 'Air conditioning rated man of the match, pre-emptively.',
  arrowhead: 'Loudest stadium on Earth meets a sport where you can hear the manager scream.',
  hardrock: 'Humidity at 94%. European midfielders are evaporating as we speak.',
  linc: 'Philly fans will boo the coin toss if it lands wrong.',
  levis: 'Tech bros in the suites are already A/B testing their chants.',
  lumen: 'It will not rain. (Brought to you by the Seattle tourism board.)',
};

/** A flavor quip for a venue card. Falls back to a generic line for unknown ids. */
export function venueQuip(stadiumId: string | null): string {
  if (stadiumId && VENUE_QUIPS[stadiumId]) return VENUE_QUIPS[stadiumId];
  return 'The pitch is immaculate. The vibes are immaculate. The bracket is in shambles.';
}

const fmtKickoff = (iso: string): string =>
  new Date(iso).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' }) + ' UTC';

/**
 * Build ticker lines from the current live snapshot. Facts come from matches; the
 * voice comes from the templates above. Always includes the two evergreen lines so
 * the ticker is never empty.
 */
export function buildTickerLines(matches: Match[]): string[] {
  const lines: string[] = [];

  for (const m of matches) {
    if (m.status === 'live') {
      const leader = (m.homeScore ?? 0) >= (m.awayScore ?? 0) ? m.home : m.away;
      lines.push(
        renderTemplate('goal', {
          minute: m.minute ?? 0,
          team: leader,
          venue: m.stadiumId ?? 'the venue',
        }),
      );
    } else if (m.status === 'scheduled') {
      lines.push(
        renderTemplate('kickoff_soon', {
          kickoff: fmtKickoff(m.kickoffUtc),
          home: m.home,
          away: m.away,
          venue: m.stadiumId ?? 'the venue',
        }),
      );
    } else {
      lines.push(
        renderTemplate('final_whistle', {
          home: m.home,
          away: m.away,
          score: `${m.homeScore ?? 0}–${m.awayScore ?? 0}`,
          team: m.home,
        }),
      );
    }
  }

  lines.push(renderTemplate('tile_broker'));
  lines.push(renderTemplate('system'));
  return lines;
}
