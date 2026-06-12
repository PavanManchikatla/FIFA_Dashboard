import type { Stadium } from './types';

// The 16 WC26 host venues. Coordinates ported verbatim from
// prototypes/wc26-holo-hybrid.html so beacons land in the right spot.
export const STADIUMS: Stadium[] = [
  { id: 'azteca', name: 'Estadio Azteca', city: 'Mexico City', country: 'Mexico', lat: 19.3029, lon: -99.1505 },
  { id: 'akron', name: 'Estadio Akron', city: 'Guadalajara', country: 'Mexico', lat: 20.6817, lon: -103.4626 },
  { id: 'bbva', name: 'Estadio BBVA', city: 'Monterrey', country: 'Mexico', lat: 25.6692, lon: -100.2447 },
  { id: 'bmo', name: 'BMO Field', city: 'Toronto', country: 'Canada', lat: 43.6332, lon: -79.4186 },
  { id: 'bcplace', name: 'BC Place', city: 'Vancouver', country: 'Canada', lat: 49.2768, lon: -123.1119 },
  { id: 'metlife', name: 'MetLife Stadium', city: 'New York / New Jersey', country: 'USA', lat: 40.8128, lon: -74.0742 },
  { id: 'att', name: 'AT&T Stadium', city: 'Dallas (Arlington)', country: 'USA', lat: 32.7473, lon: -97.0945 },
  { id: 'sofi', name: 'SoFi Stadium', city: 'Los Angeles', country: 'USA', lat: 33.9535, lon: -118.3392 },
  { id: 'mbs', name: 'Mercedes-Benz Stadium', city: 'Atlanta', country: 'USA', lat: 33.7554, lon: -84.4008 },
  { id: 'gillette', name: 'Gillette Stadium', city: 'Boston (Foxborough)', country: 'USA', lat: 42.0909, lon: -71.2643 },
  { id: 'nrg', name: 'NRG Stadium', city: 'Houston', country: 'USA', lat: 29.6847, lon: -95.4107 },
  { id: 'arrowhead', name: 'Arrowhead Stadium', city: 'Kansas City', country: 'USA', lat: 39.0489, lon: -94.4839 },
  { id: 'hardrock', name: 'Hard Rock Stadium', city: 'Miami', country: 'USA', lat: 25.958, lon: -80.2389 },
  { id: 'linc', name: 'Lincoln Financial Field', city: 'Philadelphia', country: 'USA', lat: 39.9008, lon: -75.1675 },
  { id: 'levis', name: "Levi's Stadium", city: 'San Francisco Bay Area', country: 'USA', lat: 37.4032, lon: -121.9698 },
  { id: 'lumen', name: 'Lumen Field', city: 'Seattle', country: 'USA', lat: 47.5952, lon: -122.3316 },
];

const BY_ID = new Map(STADIUMS.map((s) => [s.id, s]));
export const stadiumById = (id: string | null): Stadium | undefined =>
  id == null ? undefined : BY_ID.get(id);
