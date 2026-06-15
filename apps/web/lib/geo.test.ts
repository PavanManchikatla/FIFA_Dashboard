import { describe, expect, it } from 'vitest';
import { PLANE_WIDTH, projectLatLon } from './geo';

describe('projectLatLon', () => {
  it('puts western venues left and eastern venues right', () => {
    const [vancouverX] = projectLatLon(49.28, -123.11);
    const [bostonX] = projectLatLon(42.09, -71.26);
    expect(vancouverX).toBeLessThan(0);
    expect(bostonX).toBeGreaterThan(0);
    expect(bostonX).toBeGreaterThan(vancouverX);
  });

  it('puts northern venues toward -z and southern toward +z', () => {
    const [, vancouverZ] = projectLatLon(49.28, -123.11);
    const [, mexicoCityZ] = projectLatLon(19.3, -99.15);
    expect(vancouverZ).toBeLessThan(0);
    expect(mexicoCityZ).toBeGreaterThan(0);
  });

  it('keeps coordinates within the plane bounds', () => {
    for (const [lat, lon] of [[19.3, -99.15], [49.28, -123.11], [42.09, -71.26]] as const) {
      const [x] = projectLatLon(lat, lon);
      expect(Math.abs(x)).toBeLessThanOrEqual(PLANE_WIDTH / 2);
    }
  });
});
