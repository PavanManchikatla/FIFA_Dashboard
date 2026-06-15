'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import MapGL, { Marker, Popup, NavigationControl, type MapRef, type ErrorEvent } from 'react-map-gl/maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';
import { STADIUMS, stadiumById } from '@/lib/stadiums';
import { buildHoloStyle } from '@/lib/holoStyle';
import { TileBroker } from '@/lib/tileBroker';
import type { Match, Stadium } from '@/lib/types';
import { useLiveStream } from './useLiveStream';
import { Ticker } from './Ticker';
import { VenueCard } from './VenueCard';
import { MatchList } from './MatchList';

type Odds = Record<string, [number, number, number]>;

const HOME = { longitude: -96.5, latitude: 36.8, zoom: 3.5, pitch: 48, bearing: -8 } as const;

const liveByStadium = (matches: Match[]): Map<string, Match> => {
  const m = new Map<string, Match>();
  for (const match of matches) if (match.stadiumId && match.status === 'live') m.set(match.stadiumId, match);
  return m;
};

// Most relevant match for a venue card: live > next scheduled > last finished.
function matchForStadium(matches: Match[], stadiumId: string): Match | null {
  const here = matches.filter((m) => m.stadiumId === stadiumId);
  return (
    here.find((m) => m.status === 'live') ??
    here.filter((m) => m.status === 'scheduled').sort((a, b) => a.kickoffUtc.localeCompare(b.kickoffUtc))[0] ??
    here.find((m) => m.status === 'finished') ??
    null
  );
}

export function HoloMap({ insightLines = [], oddsByPair = {} }: { insightLines?: string[]; oddsByPair?: Odds }) {
  const mapRef = useRef<MapRef | null>(null);
  const brokerRef = useRef<TileBroker | null>(null);
  if (!brokerRef.current) brokerRef.current = new TileBroker();
  const broker = brokerRef.current;
  const [providerTick, setProviderTick] = useState(0);
  const [feedDown, setFeedDown] = useState(false);

  const [selected, setSelected] = useState<Stadium | null>(null);
  const [hovered, setHovered] = useState<Stadium | null>(null);
  const [showList, setShowList] = useState(true);

  const { snapshot } = useLiveStream();
  const matches = useMemo(() => snapshot?.matches ?? [], [snapshot]);
  const live = useMemo(() => liveByStadium(matches), [matches]);

  // The next kickoff (soonest scheduled match) — its venue gets the "next" attention ring.
  const nextMatch = useMemo(
    () => matches.filter((m) => m.status === 'scheduled').sort((a, b) => a.kickoffUtc.localeCompare(b.kickoffUtc))[0] ?? null,
    [matches],
  );

  // Per-stadium status for beacon styling: live > next > finished > idle.
  const stadiumState = useMemo(() => {
    const map = new Map<string, 'live' | 'next' | 'finished' | 'idle'>();
    for (const s of STADIUMS) {
      const here = matches.filter((m) => m.stadiumId === s.id);
      if (live.has(s.id)) map.set(s.id, 'live');
      else if (nextMatch?.stadiumId === s.id) map.set(s.id, 'next');
      else if (here.some((m) => m.status === 'scheduled')) map.set(s.id, 'idle');
      else if (here.some((m) => m.status === 'finished')) map.set(s.id, 'finished');
      else map.set(s.id, 'idle');
    }
    return map;
  }, [matches, live, nextMatch]);

  const flyTo = useCallback((s: Stadium, zoom = 15.2) => {
    setSelected(s);
    const idx = STADIUMS.indexOf(s);
    mapRef.current?.flyTo({
      center: [s.lon, s.lat],
      zoom,
      pitch: zoom > 10 ? 62 : 40,
      bearing: (idx * 47) % 360 - 180,
      speed: 0.9,
      curve: 1.5,
      essential: true,
    });
  }, []);

  const selectMatch = useCallback(
    (m: Match) => {
      const s = stadiumById(m.stadiumId);
      if (s) flyTo(s);
    },
    [flyTo],
  );

  // On first data load, orient the user toward the live match (or the next kickoff) so it's
  // obvious where the action is — gentle zoom, keeps regional context.
  const autoFocused = useRef(false);
  useEffect(() => {
    if (autoFocused.current || matches.length === 0) return;
    const focus = matches.find((m) => m.status === 'live') ?? nextMatch;
    const s = focus ? stadiumById(focus.stadiumId) : null;
    if (s) {
      autoFocused.current = true;
      flyTo(s, 5.6);
    }
  }, [matches, nextMatch, flyTo]);

  const mapStyle = useMemo(
    () => buildHoloStyle(broker.active()),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [broker, providerTick],
  );

  // Goal-event beacon flash on a score increase.
  const prevGoals = useRef<Map<string, number>>(new Map());
  const [flashing, setFlashing] = useState<Set<string>>(new Set());
  useEffect(() => {
    const justScored: string[] = [];
    for (const m of matches) {
      const total = (m.homeScore ?? 0) + (m.awayScore ?? 0);
      const prev = prevGoals.current.get(m.id);
      if (m.status === 'live' && m.stadiumId && prev != null && total > prev) justScored.push(m.stadiumId);
      prevGoals.current.set(m.id, total);
    }
    if (justScored.length === 0) return;
    setFlashing((s) => new Set([...s, ...justScored]));
    const t = setTimeout(() => setFlashing((s) => {
      const next = new Set(s);
      justScored.forEach((id) => next.delete(id));
      return next;
    }), 2000);
    return () => clearTimeout(t);
  }, [matches]);

  const overview = useCallback(() => {
    setSelected(null);
    mapRef.current?.flyTo({ ...HOME, center: [HOME.longitude, HOME.latitude], speed: 0.8, curve: 1.4, essential: true });
  }, []);

  const onError = useCallback((e: ErrorEvent) => {
    const status = (e.error as { status?: number })?.status;
    if (broker.recordError(status)) {
      setFeedDown(true);
      setProviderTick((t) => t + 1);
      setTimeout(() => setFeedDown(false), 600);
    }
  }, [broker]);

  const simulateFeedLoss = useCallback(() => {
    setFeedDown(true);
    setTimeout(() => {
      if (broker.failover()) setProviderTick((t) => t + 1);
      setFeedDown(false);
    }, 500);
  }, [broker]);

  const active = broker.active();
  const stale = snapshot?.stale ?? false;
  const selectedMatch = selected ? matchForStadium(matches, selected.id) : null;
  const selectedOdds = selectedMatch ? oddsByPair[`${selectedMatch.home}|${selectedMatch.away}`] : undefined;

  return (
    <div className="flex h-screen flex-col">
      <header className="relative z-10 flex flex-wrap items-center gap-4 px-6 py-[14px] after:absolute after:inset-x-0 after:bottom-0 after:h-px after:bg-holo-accent after:opacity-50 after:content-['']">
        <h1 className="holo-text-gradient font-display text-[clamp(15px,2.2vw,21px)] font-bold uppercase tracking-[0.14em]">
          Stadium map{' '}
          <span className="text-gold [-webkit-text-fill-color:rgb(var(--c-gold))]">{'// WC26'}</span>
        </h1>
        <nav className="ml-auto flex items-center gap-2 font-mono text-[12px]">
          <Link href="/" className="holo-btn px-3 py-[6px] uppercase tracking-[0.12em]">Home</Link>
          <Link href="/oracle" className="holo-btn px-3 py-[6px] uppercase tracking-[0.12em]">Oracle →</Link>
          <span className="holo-panel ml-1 px-[10px] py-[5px] text-[11px] uppercase tracking-[0.16em] text-ink-dim">
            {stale ? 'last update' : snapshot ? 'live' : 'connecting…'}
          </span>
        </nav>
      </header>

      <div className="relative min-h-0 flex-1">
        <MapGL
          ref={mapRef}
          initialViewState={HOME}
          mapStyle={mapStyle}
          maxPitch={75}
          antialias
          onError={onError}
          attributionControl={false}
          style={{ position: 'absolute', inset: 0 }}
        >
          <NavigationControl position="bottom-right" visualizePitch />
          {STADIUMS.map((s) => {
            const state = stadiumState.get(s.id) ?? 'idle';
            const cls = state === 'live' ? ' live' : state === 'next' ? ' next' : state === 'finished' ? ' finished' : '';
            return (
              <Marker key={s.id} longitude={s.lon} latitude={s.lat} anchor="center">
                <div
                  role="button"
                  tabIndex={0}
                  aria-label={`${s.name}, ${s.city}`}
                  className={`beacon${cls}${flashing.has(s.id) ? ' goal-flash' : ''}`}
                  onMouseEnter={() => setHovered(s)}
                  onMouseLeave={() => setHovered((h) => (h === s ? null : h))}
                  onClick={() => flyTo(s)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      flyTo(s);
                    }
                  }}
                />
              </Marker>
            );
          })}

          {hovered && (
            <Popup longitude={hovered.lon} latitude={hovered.lat} closeButton={false} closeOnClick={false} offset={16} anchor="bottom">
              <div className="font-semibold uppercase tracking-[0.05em] text-cyan">{hovered.name}</div>
              <div className="text-[13px] text-ink-dim">{hovered.city}, {hovered.country}</div>
              {(() => {
                const st = stadiumState.get(hovered.id);
                if (st === 'live') {
                  const m = live.get(hovered.id)!;
                  return <div className="mt-[3px] text-amber">LIVE · {m.homeScore ?? 0}–{m.awayScore ?? 0} · {m.minute ?? 0}′</div>;
                }
                if (st === 'next') return <div className="mt-[3px] text-azure">NEXT KICKOFF HERE</div>;
                if (st === 'finished') return <div className="mt-[3px] text-ink-dim">matches finished</div>;
                return null;
              })()}
            </Popup>
          )}
        </MapGL>

        <div className="holo-fx" />

        {/* Controls (top-left) */}
        <div className="absolute left-[14px] top-[14px] z-[5] flex flex-wrap gap-[10px]">
          <select
            aria-label="Fly to a venue"
            value={selected ? STADIUMS.indexOf(selected) : -1}
            onChange={(e) => { const i = Number(e.target.value); if (i >= 0) flyTo(STADIUMS[i]); }}
            className="holo-btn cursor-pointer px-[14px] py-2 text-[14px] font-semibold uppercase tracking-[0.08em]"
          >
            <option value={-1}>Find a stadium…</option>
            {STADIUMS.map((s, i) => (<option key={s.id} value={i}>{s.name} — {s.city}</option>))}
          </select>
          <button type="button" onClick={overview} className="holo-btn cursor-pointer px-[14px] py-2 text-[14px] font-semibold uppercase tracking-[0.08em]">
            Overview
          </button>
          <button type="button" onClick={simulateFeedLoss} className="holo-btn cursor-pointer px-[14px] py-2 text-[14px] font-semibold uppercase tracking-[0.08em]" title={`Map: ${active.name}${feedDown ? ' — switching to backup' : ''}`}>
            ⚡ Test map backup
          </button>
        </div>

        {/* Matches drawer (top-right, scrollable) */}
        {showList ? (
          <div className="holo-panel absolute right-[14px] top-[14px] z-[5] flex max-h-[calc(100%-110px)] w-[300px] max-w-[calc(100%-2rem)] flex-col p-3">
            <div className="mb-2 flex items-center justify-between">
              <span className="font-display text-[13px] font-medium uppercase tracking-[0.12em] text-cyan">Matches</span>
              <button type="button" onClick={() => setShowList(false)} aria-label="Hide matches" className="text-[14px] text-ink-dim hover:text-ink">✕</button>
            </div>
            <MatchList matches={matches} onSelect={selectMatch} />
          </div>
        ) : (
          <button type="button" onClick={() => setShowList(true)} className="holo-btn absolute right-[14px] top-[14px] z-[5] px-[14px] py-2 text-[13px] font-semibold uppercase tracking-[0.08em]">
            ▦ Matches
          </button>
        )}

        {selected && (
          <VenueCard stadium={selected} match={selectedMatch} odds={selectedOdds} onClose={() => setSelected(null)} />
        )}
      </div>

      <Ticker matches={matches} insightLines={insightLines} />
    </div>
  );
}
