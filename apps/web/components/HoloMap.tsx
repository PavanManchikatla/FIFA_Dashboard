'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import MapGL, { Marker, Popup, NavigationControl, type MapRef, type ErrorEvent } from 'react-map-gl/maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';
import { STADIUMS } from '@/lib/stadiums';
import { buildHoloStyle } from '@/lib/holoStyle';
import { TileBroker } from '@/lib/tileBroker';
import type { Match, Stadium } from '@/lib/types';
import { useLiveStream } from './useLiveStream';
import { Ticker } from './Ticker';
import { VenueCard } from './VenueCard';

const HOME = { longitude: -96.5, latitude: 36.8, zoom: 3.5, pitch: 48, bearing: -8 } as const;

// Index live matches by stadium so beacons know when to glow amber.
function liveByStadium(matches: Match[]): Map<string, Match> {
  const m = new Map<string, Match>();
  for (const match of matches) {
    if (match.stadiumId && match.status === 'live') m.set(match.stadiumId, match);
  }
  return m;
}

// Pick the most relevant match for a venue card: live > next scheduled > last finished.
function matchForStadium(matches: Match[], stadiumId: string): Match | null {
  const here = matches.filter((m) => m.stadiumId === stadiumId);
  return (
    here.find((m) => m.status === 'live') ??
    here.filter((m) => m.status === 'scheduled').sort((a, b) => a.kickoffUtc.localeCompare(b.kickoffUtc))[0] ??
    here.find((m) => m.status === 'finished') ??
    null
  );
}

export function HoloMap({ insightLines = [] }: { insightLines?: string[] }) {
  const mapRef = useRef<MapRef | null>(null);
  // Broker is stable across renders; bump `providerTick` to recompute the style.
  const brokerRef = useRef<TileBroker | null>(null);
  if (!brokerRef.current) brokerRef.current = new TileBroker();
  const broker = brokerRef.current;
  const [providerTick, setProviderTick] = useState(0);
  const [feedDown, setFeedDown] = useState(false);

  const [selected, setSelected] = useState<Stadium | null>(null);
  const [hovered, setHovered] = useState<Stadium | null>(null);

  // Demo: poll faster when mock goals are ticking so the beacon flip is visible quickly.
  const { snapshot } = useLiveStream();
  const matches = useMemo(() => snapshot?.matches ?? [], [snapshot]);
  const live = useMemo(() => liveByStadium(matches), [matches]);

  // Goal-event beacon flash: detect a live match's score increasing between polls and pulse
  // that stadium's beacon for ~2s.
  const prevGoals = useRef<Map<string, number>>(new Map());
  const [flashing, setFlashing] = useState<Set<string>>(new Set());
  useEffect(() => {
    const justScored: string[] = [];
    for (const m of matches) {
      const total = (m.homeScore ?? 0) + (m.awayScore ?? 0);
      const prev = prevGoals.current.get(m.id);
      if (m.status === 'live' && m.stadiumId && prev != null && total > prev) {
        justScored.push(m.stadiumId);
      }
      prevGoals.current.set(m.id, total);
    }
    if (justScored.length === 0) return;
    setFlashing((s) => new Set([...s, ...justScored]));
    const t = setTimeout(() => {
      setFlashing((s) => {
        const next = new Set(s);
        justScored.forEach((id) => next.delete(id));
        return next;
      });
    }, 2000);
    return () => clearTimeout(t);
  }, [matches]);

  // Style is keyed on the active provider; providerTick forces recompute on failover.
  const mapStyle = useMemo(
    () => buildHoloStyle(broker.active()),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [broker, providerTick],
  );

  const flyTo = useCallback((s: Stadium) => {
    setSelected(s);
    const idx = STADIUMS.indexOf(s);
    mapRef.current?.flyTo({
      center: [s.lon, s.lat],
      zoom: 15.2,
      pitch: 62,
      bearing: (idx * 47) % 360 - 180,
      speed: 0.9,
      curve: 1.5,
      essential: true,
    });
  }, []);

  const overview = useCallback(() => {
    setSelected(null);
    mapRef.current?.flyTo({ ...HOME, center: [HOME.longitude, HOME.latitude], speed: 0.8, curve: 1.4, essential: true });
  }, []);

  const onError = useCallback(
    (e: ErrorEvent) => {
      const status = (e.error as { status?: number })?.status;
      if (broker.recordError(status)) {
        setFeedDown(true);
        setProviderTick((t) => t + 1);
        setTimeout(() => setFeedDown(false), 600);
      }
    },
    [broker],
  );

  const simulateFeedLoss = useCallback(() => {
    setFeedDown(true);
    setTimeout(() => {
      if (broker.failover()) setProviderTick((t) => t + 1);
      setFeedDown(false);
    }, 500);
  }, [broker]);

  const active = broker.active();
  const stale = snapshot?.stale ?? false;

  return (
    <div className="flex h-screen flex-col">
      <header className="relative z-10 flex flex-wrap items-center gap-[18px] px-6 py-[14px] after:absolute after:inset-x-0 after:bottom-0 after:h-px after:bg-holo-accent after:opacity-50 after:content-['']">
        <h1 className="holo-text-gradient font-display text-[clamp(15px,2.2vw,21px)] font-bold uppercase tracking-[0.14em] [filter:drop-shadow(0_0_14px_rgba(84,169,255,0.45))]">
          Holo-pitch hybrid{' '}
          <span className="text-gold [-webkit-text-fill-color:#FFC94D] [text-shadow:0_0_12px_rgba(255,201,77,0.55)]">
            {'// WC26'}
          </span>
        </h1>
        <div className="ml-auto flex items-center gap-[14px] font-mono text-[14px] text-cyan">
          <span className="holo-panel px-[12px] py-[5px] text-[11px] uppercase tracking-[0.18em] text-ink-dim">
            {stale ? 'stale cache' : snapshot ? 'live feed' : 'connecting…'}
          </span>
        </div>
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
            const isLive = live.has(s.id);
            const isFlashing = flashing.has(s.id);
            return (
              <Marker key={s.id} longitude={s.lon} latitude={s.lat} anchor="center">
                <div
                  role="button"
                  tabIndex={0}
                  aria-label={`${s.name}, ${s.city}`}
                  className={`beacon${isLive ? ' live' : ''}${isFlashing ? ' goal-flash' : ''}`}
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
            <Popup
              longitude={hovered.lon}
              latitude={hovered.lat}
              closeButton={false}
              closeOnClick={false}
              offset={16}
              anchor="bottom"
            >
              <div className="font-semibold uppercase tracking-[0.05em] text-cyan">{hovered.name}</div>
              <div className="text-[13px] text-ink-dim">
                {hovered.city}, {hovered.country}
              </div>
              {live.has(hovered.id) && (
                <div className="mt-[3px] text-amber">
                  LIVE · {live.get(hovered.id)!.homeScore ?? 0}–{live.get(hovered.id)!.awayScore ?? 0} ·{' '}
                  {live.get(hovered.id)!.minute ?? 0}′
                </div>
              )}
            </Popup>
          )}
        </MapGL>

        <div className="holo-fx" />

        {/* HUD controls */}
        <div className="absolute left-[14px] top-[14px] z-[5] flex flex-wrap gap-[10px]">
          <select
            aria-label="Fly to a venue"
            value={selected ? STADIUMS.indexOf(selected) : -1}
            onChange={(e) => {
              const i = Number(e.target.value);
              if (i >= 0) flyTo(STADIUMS[i]);
            }}
            className="holo-btn cursor-pointer px-[14px] py-2 text-[14px] font-semibold uppercase tracking-[0.08em]"
          >
            <option value={-1}>Target venue…</option>
            {STADIUMS.map((s, i) => (
              <option key={s.id} value={i}>
                {s.name} — {s.city}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={overview}
            className="holo-btn cursor-pointer px-[14px] py-2 text-[14px] font-semibold uppercase tracking-[0.08em]"
          >
            Overview
          </button>
          <button
            type="button"
            onClick={simulateFeedLoss}
            className="holo-btn cursor-pointer px-[14px] py-2 text-[14px] font-semibold uppercase tracking-[0.08em]"
          >
            ⚡ Simulate feed loss
          </button>
        </div>

        {/* Tile feed HUD */}
        <div className="holo-panel absolute right-[14px] top-[14px] z-[5] px-[14px] py-2 font-mono text-[12px] tracking-[0.08em] text-ink-dim">
          TILE FEED: <b className="font-normal text-cyan">{active.name}</b> ({active.quota}){' '}
          <span className={feedDown ? 'text-[#FF6B5C]' : 'text-mint'}>●</span>
          <br />
          <span>chain: {broker.chain()}</span>
        </div>

        {selected && (
          <VenueCard stadium={selected} match={matchForStadium(matches, selected.id)} onClose={() => setSelected(null)} />
        )}
      </div>

      <Ticker matches={matches} insightLines={insightLines} />
    </div>
  );
}
