import { describe, expect, it } from 'vitest';
import { buildTickerLines, renderTemplate, venueQuip } from './commentary';
import { normalizeWc26ir } from './normalize';
import { WC26IR_FIXTURE } from '@/mocks/wc26irRaw';

describe('commentary engine', () => {
  it('renders a known template with params', () => {
    const line = renderTemplate('goal', { minute: 64, team: 'Mexico', venue: 'azteca' });
    expect(line).toContain('64');
    expect(line).toContain('Mexico');
  });

  it('returns a labelled fallback for unknown templates', () => {
    expect(renderTemplate('nope')).toBe('[nope]');
  });

  it('always includes the evergreen lines and one per match', () => {
    const matches = normalizeWc26ir(WC26IR_FIXTURE);
    const lines = buildTickerLines(matches);
    // one per match + tile_broker + system
    expect(lines).toHaveLength(matches.length + 2);
    expect(lines.some((l) => l.startsWith('TILE BROKER'))).toBe(true);
    expect(lines.some((l) => l.startsWith('SYSTEM'))).toBe(true);
  });

  it('gives a quip for known and unknown venues', () => {
    expect(venueQuip('azteca')).toContain('seismograph');
    expect(venueQuip(null)).toContain('shambles');
  });
});
