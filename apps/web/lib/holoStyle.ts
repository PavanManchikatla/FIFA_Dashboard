import type { StyleSpecification } from 'maplibre-gl';
import type { TileProvider } from './tileBroker';

// Holographic MapLibre style, ported from prototypes/wc26-holo-hybrid.html. One style JSON works
// on every provider (all serve the OpenMapTiles schema). Colours come from a per-theme palette so
// the basemap follows the user's chosen theme (dark holo / warm / light street map).

export type MapPalette = {
  bg: string;
  water: string;
  waterway: string;
  park: string;
  boundary: string;
  roadMinor: string;
  roadGlow: string;
  roadMajor: string;
  rail: string;
  building: string;
  buildingOpacity: number;
  label: string;
  labelHalo: string;
};

const PALETTES: Record<string, MapPalette> = {
  holo: {
    bg: '#0A262E', water: '#02090D', waterway: '#0B3A44', park: '#0D3A35', boundary: '#2AD8C0',
    roadMinor: '#14554F', roadGlow: '#2AD8C0', roadMajor: '#3FE0C5', rail: '#1C6E78',
    building: '#1FB9A6', buildingOpacity: 0.45, label: '#7FEFE0', labelHalo: '#03141A',
  },
  warm: {
    bg: '#0E2230', water: '#04101A', waterway: '#0C3340', park: '#123A33', boundary: '#46C9B0',
    roadMinor: '#18514C', roadGlow: '#46C9B0', roadMajor: '#5BD3BC', rail: '#1F6A72',
    building: '#2A9E8C', buildingOpacity: 0.45, label: '#8FE6D6', labelHalo: '#06141C',
  },
  light: {
    bg: '#E9EEF2', water: '#C6DBEA', waterway: '#9DBFD6', park: '#D6E7CE', boundary: '#0D9488',
    roadMinor: '#C9D2DC', roadGlow: '#BFE3DE', roadMajor: '#0D9488', rail: '#AAB6C2',
    building: '#D5DDE6', buildingOpacity: 0.6, label: '#26323F', labelHalo: '#FFFFFF',
  },
};

export function mapPalette(theme: string): MapPalette {
  return PALETTES[theme] ?? PALETTES.holo;
}

export function buildHoloStyle(provider: TileProvider, palette: MapPalette = PALETTES.holo): StyleSpecification {
  const p = palette;
  return {
    version: 8,
    glyphs: 'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf',
    sources: { omt: { type: 'vector', url: provider.url } },
    layers: [
      { id: 'bg', type: 'background', paint: { 'background-color': p.bg } },
      { id: 'water', type: 'fill', source: 'omt', 'source-layer': 'water', paint: { 'fill-color': p.water } },
      {
        id: 'waterway', type: 'line', source: 'omt', 'source-layer': 'waterway', minzoom: 8,
        paint: { 'line-color': p.waterway, 'line-width': 1 },
      },
      {
        id: 'park', type: 'fill', source: 'omt', 'source-layer': 'park', minzoom: 10,
        paint: { 'fill-color': p.park, 'fill-opacity': 0.45 },
      },
      {
        id: 'boundary-glow', type: 'line', source: 'omt', 'source-layer': 'boundary',
        filter: ['<=', ['get', 'admin_level'], 2],
        paint: { 'line-color': p.boundary, 'line-width': 5, 'line-opacity': 0.12, 'line-blur': 3 },
      },
      {
        id: 'boundary', type: 'line', source: 'omt', 'source-layer': 'boundary',
        filter: ['<=', ['get', 'admin_level'], 2],
        paint: { 'line-color': p.boundary, 'line-width': 1, 'line-opacity': 0.55 },
      },
      {
        id: 'roads-minor', type: 'line', source: 'omt', 'source-layer': 'transportation', minzoom: 11,
        filter: ['in', ['get', 'class'], ['literal', ['secondary', 'tertiary', 'minor', 'service', 'residential']]],
        paint: { 'line-color': p.roadMinor, 'line-width': ['interpolate', ['linear'], ['zoom'], 11, 0.4, 16, 2.2] },
      },
      {
        id: 'roads-major-glow', type: 'line', source: 'omt', 'source-layer': 'transportation', minzoom: 6,
        filter: ['in', ['get', 'class'], ['literal', ['motorway', 'trunk', 'primary']]],
        paint: {
          'line-color': p.roadGlow, 'line-opacity': 0.18, 'line-blur': 3,
          'line-width': ['interpolate', ['linear'], ['zoom'], 6, 2, 12, 7, 16, 14],
        },
      },
      {
        id: 'roads-major', type: 'line', source: 'omt', 'source-layer': 'transportation', minzoom: 6,
        filter: ['in', ['get', 'class'], ['literal', ['motorway', 'trunk', 'primary']]],
        paint: { 'line-color': p.roadMajor, 'line-width': ['interpolate', ['linear'], ['zoom'], 6, 0.6, 12, 2, 16, 4] },
      },
      {
        id: 'rail', type: 'line', source: 'omt', 'source-layer': 'transportation', minzoom: 11,
        filter: ['==', ['get', 'class'], 'rail'],
        paint: { 'line-color': p.rail, 'line-width': 1, 'line-dasharray': [2, 3] },
      },
      {
        id: 'buildings', type: 'fill-extrusion', source: 'omt', 'source-layer': 'building', minzoom: 13,
        paint: {
          'fill-extrusion-color': p.building,
          'fill-extrusion-height': ['coalesce', ['get', 'render_height'], 8],
          'fill-extrusion-base': ['coalesce', ['get', 'render_min_height'], 0],
          'fill-extrusion-opacity': p.buildingOpacity,
          'fill-extrusion-vertical-gradient': true,
        },
      },
      {
        id: 'city-labels', type: 'symbol', source: 'omt', 'source-layer': 'place', minzoom: 4, maxzoom: 13,
        filter: ['in', ['get', 'class'], ['literal', ['city', 'town']]],
        layout: {
          'text-field': ['coalesce', ['get', 'name:latin'], ['get', 'name']],
          'text-font': ['Noto Sans Regular'],
          'text-size': ['interpolate', ['linear'], ['zoom'], 4, 10, 10, 14],
          'text-transform': 'uppercase',
          'text-letter-spacing': 0.12,
        },
        paint: { 'text-color': p.label, 'text-halo-color': p.labelHalo, 'text-halo-width': 1.4, 'text-opacity': 0.85 },
      },
    ],
  };
}
