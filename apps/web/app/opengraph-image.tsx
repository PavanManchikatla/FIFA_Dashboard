import { ImageResponse } from 'next/og';

// Brand OG card for the landing (PLAN.md §7 Phase 5).
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';
export const alt = 'WC26 Continental Chaos Board';

export default function OgImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          background: 'radial-gradient(900px 600px at 75% -10%, #102b3c, #030B10 60%)',
          color: '#D8FFF8',
          padding: '0 80px',
          fontFamily: 'sans-serif',
        }}
      >
        <div style={{ display: 'flex', fontSize: 26, letterSpacing: 8, color: '#5E8B86' }}>
          JUNE 11 – JULY 19, 2026 · $0 INFRASTRUCTURE
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', fontSize: 92, fontWeight: 800, marginTop: 12, lineHeight: 1.05 }}>
          <span style={{ color: '#40E5D1' }}>Continental Chaos Board&nbsp;</span>
          <span style={{ color: '#FFC94D' }}>{'// WC26'}</span>
        </div>
        <div style={{ display: 'flex', fontSize: 34, marginTop: 24, color: '#5E8B86' }}>
          A live, funny World Cup dashboard with a real ML win-probability engine.
        </div>
      </div>
    ),
    size,
  );
}
