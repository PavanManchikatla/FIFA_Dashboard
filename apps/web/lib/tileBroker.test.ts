import { describe, expect, it } from 'vitest';
import { TileBroker, availableProviders, type TileProvider } from './tileBroker';

const keyed: TileProvider[] = [
  { id: 'openfreemap', name: 'OPENFREEMAP', quota: 'unlimited', url: 'ofm', needsKey: false },
  { id: 'stadia', name: 'STADIA', quota: '200k/mo', url: 'stadia', needsKey: true, key: 'k1' },
  { id: 'maptiler', name: 'MAPTILER', quota: '100k/mo', url: 'mt', needsKey: true, key: 'k2' },
];

describe('availableProviders', () => {
  it('drops keyed providers whose key is missing', () => {
    const partial: TileProvider[] = [
      keyed[0],
      { ...keyed[1], key: '' },
      keyed[2],
    ];
    expect(availableProviders(partial).map((p) => p.id)).toEqual(['openfreemap', 'maptiler']);
  });
});

describe('TileBroker failover', () => {
  it('starts on the first available provider', () => {
    const b = new TileBroker(keyed, 0);
    expect(b.active().id).toBe('openfreemap');
  });

  it('advances providers and wraps around', () => {
    const b = new TileBroker(keyed, 0);
    expect(b.failover()).toBe(true);
    expect(b.active().id).toBe('stadia');
    b.failover();
    expect(b.active().id).toBe('maptiler');
    b.failover();
    expect(b.active().id).toBe('openfreemap');
  });

  it('does not fail over with a single provider', () => {
    const b = new TileBroker([keyed[0]], 0);
    expect(b.failover()).toBe(false);
    expect(b.active().id).toBe('openfreemap');
  });

  it('only counts auth/quota errors and debounces to 5 within 30s', () => {
    const b = new TileBroker(keyed, 0);
    expect(b.recordError(404, 0)).toBe(false); // not an auth/quota status
    for (let i = 0; i < 5; i++) expect(b.recordError(429, 1000 + i)).toBe(false);
    expect(b.recordError(429, 1006)).toBe(true); // 6th within window → failover
    expect(b.active().id).toBe('stadia');
  });

  it('resets the error window after 30s of quiet', () => {
    const b = new TileBroker(keyed, 0);
    for (let i = 0; i < 5; i++) b.recordError(401, 1000);
    // Far past the window → counter resets, single error does not trip.
    expect(b.recordError(401, 1000 + 31_000)).toBe(false);
    expect(b.active().id).toBe('openfreemap');
  });

  it('brackets the active provider in the chain string', () => {
    const b = new TileBroker(keyed, 0);
    expect(b.chain()).toBe('[OPENFREEMAP] → STADIA → MAPTILER');
    b.failover();
    expect(b.chain()).toBe('OPENFREEMAP → [STADIA] → MAPTILER');
  });
});
