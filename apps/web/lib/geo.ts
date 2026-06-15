// Project stadium lat/lon onto the holo-lattice ground plane (x = east/west, z = north/south).
// North America bounding box with a little padding around the 16 WC26 venues.

export const LON_MIN = -125;
export const LON_MAX = -70;
export const LAT_MIN = 17;
export const LAT_MAX = 51;

export const PLANE_WIDTH = 22; // x extent (east–west)
export const PLANE_DEPTH = 15; // z extent (north–south)

/** Returns scene coordinates [x, z]: higher longitude → +x (east), higher latitude → −z (north). */
export function projectLatLon(lat: number, lon: number): [number, number] {
  const nx = (lon - LON_MIN) / (LON_MAX - LON_MIN); // 0 (west) … 1 (east)
  const nz = (lat - LAT_MIN) / (LAT_MAX - LAT_MIN); // 0 (south) … 1 (north)
  const x = (nx - 0.5) * PLANE_WIDTH;
  const z = (0.5 - nz) * PLANE_DEPTH; // north maps to −z (away from a south-facing camera)
  return [x, z];
}
