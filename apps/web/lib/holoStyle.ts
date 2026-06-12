import type { StyleSpecification } from 'maplibre-gl';
import type { TileProvider } from './tileBroker';

// Ported verbatim from prototypes/wc26-holo-hybrid.html buildHoloStyle().
// One style JSON works on every provider (all serve the OpenMapTiles schema).
// Keep colors in sync with the prototype: cyan borders/roads, near-black water,
// translucent teal 3D buildings, uppercase teal city labels.
export function buildHoloStyle(provider: TileProvider): StyleSpecification {
  return {
    version: 8,
    glyphs: 'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf',
    sources: { omt: { type: 'vector', url: provider.url } },
    layers: [
      { id: 'bg', type: 'background', paint: { 'background-color': '#0A262E' } },
      { id: 'water', type: 'fill', source: 'omt', 'source-layer': 'water', paint: { 'fill-color': '#02090D' } },
      {
        id: 'waterway', type: 'line', source: 'omt', 'source-layer': 'waterway', minzoom: 8,
        paint: { 'line-color': '#0B3A44', 'line-width': 1 },
      },
      {
        id: 'park', type: 'fill', source: 'omt', 'source-layer': 'park', minzoom: 10,
        paint: { 'fill-color': '#0D3A35', 'fill-opacity': 0.45 },
      },
      {
        id: 'boundary-glow', type: 'line', source: 'omt', 'source-layer': 'boundary',
        filter: ['<=', ['get', 'admin_level'], 2],
        paint: { 'line-color': '#2AD8C0', 'line-width': 5, 'line-opacity': 0.12, 'line-blur': 3 },
      },
      {
        id: 'boundary', type: 'line', source: 'omt', 'source-layer': 'boundary',
        filter: ['<=', ['get', 'admin_level'], 2],
        paint: { 'line-color': '#2AD8C0', 'line-width': 1, 'line-opacity': 0.55 },
      },
      {
        id: 'roads-minor', type: 'line', source: 'omt', 'source-layer': 'transportation', minzoom: 11,
        filter: ['in', ['get', 'class'], ['literal', ['secondary', 'tertiary', 'minor', 'service', 'residential']]],
        paint: { 'line-color': '#14554F', 'line-width': ['interpolate', ['linear'], ['zoom'], 11, 0.4, 16, 2.2] },
      },
      {
        id: 'roads-major-glow', type: 'line', source: 'omt', 'source-layer': 'transportation', minzoom: 6,
        filter: ['in', ['get', 'class'], ['literal', ['motorway', 'trunk', 'primary']]],
        paint: {
          'line-color': '#2AD8C0', 'line-opacity': 0.18, 'line-blur': 3,
          'line-width': ['interpolate', ['linear'], ['zoom'], 6, 2, 12, 7, 16, 14],
        },
      },
      {
        id: 'roads-major', type: 'line', source: 'omt', 'source-layer': 'transportation', minzoom: 6,
        filter: ['in', ['get', 'class'], ['literal', ['motorway', 'trunk', 'primary']]],
        paint: { 'line-color': '#3FE0C5', 'line-width': ['interpolate', ['linear'], ['zoom'], 6, 0.6, 12, 2, 16, 4] },
      },
      {
        id: 'rail', type: 'line', source: 'omt', 'source-layer': 'transportation', minzoom: 11,
        filter: ['==', ['get', 'class'], 'rail'],
        paint: { 'line-color': '#1C6E78', 'line-width': 1, 'line-dasharray': [2, 3] },
      },
      {
        id: 'buildings', type: 'fill-extrusion', source: 'omt', 'source-layer': 'building', minzoom: 13,
        paint: {
          'fill-extrusion-color': '#1FB9A6',
          'fill-extrusion-height': ['coalesce', ['get', 'render_height'], 8],
          'fill-extrusion-base': ['coalesce', ['get', 'render_min_height'], 0],
          'fill-extrusion-opacity': 0.45,
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
        paint: { 'text-color': '#7FEFE0', 'text-halo-color': '#03141A', 'text-halo-width': 1.4, 'text-opacity': 0.85 },
      },
    ],
  };
}
