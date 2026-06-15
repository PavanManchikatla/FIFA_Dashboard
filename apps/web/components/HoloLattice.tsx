'use client';

import { useMemo, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { STADIUMS } from '@/lib/stadiums';
import { PLANE_DEPTH, PLANE_WIDTH, projectLatLon } from '@/lib/geo';
import { useLive } from './useLive';
import { useThemeColors, type ThemeColors } from './useThemeColors';

// Glow without a postprocessing/bloom pass (too heavy + fails on low-end/headless GL): bright
// `toneMapped={false}` colours with additive blending on dark themes, plus a soft halo sphere
// on each orb. On the light theme additive washes out, so we switch to solid normal blending.
const FALLBACK: ThemeColors = {
  bg: 'rgb(15, 21, 27)', panel: 'rgb(16, 30, 38)', line: 'rgb(79, 209, 197)',
  ink: 'rgb(230, 239, 236)', inkDim: 'rgb(124, 152, 148)', cyan: 'rgb(79, 209, 197)',
  azure: 'rgb(107, 168, 255)', mint: 'rgb(108, 235, 170)', amber: 'rgb(242, 200, 121)',
  gold: 'rgb(245, 201, 123)', violet: 'rgb(150, 122, 255)', magenta: 'rgb(255, 125, 168)',
};

function DotMatrix({ colors, light }: { colors: ThemeColors; light: boolean }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const COLS = 48;
  const ROWS = 30;
  const count = COLS * ROWS;
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const grid = useMemo(() => {
    const pts: [number, number][] = [];
    for (let i = 0; i < COLS; i++) {
      for (let j = 0; j < ROWS; j++) {
        pts.push([(i / (COLS - 1) - 0.5) * PLANE_WIDTH, (j / (ROWS - 1) - 0.5) * PLANE_DEPTH]);
      }
    }
    return pts;
  }, []);

  useFrame(({ clock }) => {
    const mesh = ref.current;
    if (!mesh) return;
    const t = clock.getElapsedTime();
    grid.forEach(([x, z], i) => {
      const y = Math.sin(t * 0.7 + x * 0.35 + z * 0.45) * 0.18;
      dummy.position.set(x, y, z);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={ref} args={[undefined, undefined, count]}>
      <sphereGeometry args={[0.045, 6, 6]} />
      <meshBasicMaterial
        color={colors.cyan}
        toneMapped={false}
        transparent
        opacity={light ? 0.9 : 0.85}
        blending={light ? THREE.NormalBlending : THREE.AdditiveBlending}
        depthWrite={light}
      />
    </instancedMesh>
  );
}

function Pillar({ x, z, live, seed, colors, light }: { x: number; z: number; live: boolean; seed: number; colors: ThemeColors; light: boolean }) {
  const halo = useRef<THREE.Mesh>(null);
  const color = live ? colors.amber : colors.cyan;
  const height = live ? 4.2 : 2.6;
  const blending = light ? THREE.NormalBlending : THREE.AdditiveBlending;

  useFrame(({ clock }) => {
    if (!live || !halo.current) return;
    const p = 0.7 + 0.3 * Math.sin(clock.getElapsedTime() * 3 + seed);
    halo.current.scale.setScalar(1 + p);
    (halo.current.material as THREE.MeshBasicMaterial).opacity = (light ? 0.1 : 0.15) + p * 0.25;
  });

  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, height / 2, 0]}>
        <cylinderGeometry args={[0.025, 0.07, height, 8]} />
        <meshBasicMaterial color={color} toneMapped={false} transparent opacity={live ? 0.8 : 0.45} blending={blending} depthWrite={false} />
      </mesh>
      <mesh position={[0, 0.06, 0]}>
        <sphereGeometry args={[0.12, 16, 16]} />
        <meshBasicMaterial color={light ? color : '#eafffb'} toneMapped={false} />
      </mesh>
      <mesh ref={halo} position={[0, 0.06, 0]}>
        <sphereGeometry args={[0.28, 16, 16]} />
        <meshBasicMaterial color={color} toneMapped={false} transparent opacity={live ? 0.35 : 0.18} blending={blending} depthWrite={false} />
      </mesh>
    </group>
  );
}

function Pillars({ liveIds, colors, light }: { liveIds: Set<string>; colors: ThemeColors; light: boolean }) {
  return (
    <>
      {STADIUMS.map((s, i) => {
        const [x, z] = projectLatLon(s.lat, s.lon);
        return <Pillar key={s.id} x={x} z={z} live={liveIds.has(s.id)} seed={i} colors={colors} light={light} />;
      })}
    </>
  );
}

// Fires once on the first rendered frame — lets the parent confirm the GPU is actually drawing.
function ReadySignal({ onReady }: { onReady: () => void }) {
  const done = useRef(false);
  useFrame(() => {
    if (!done.current) {
      done.current = true;
      onReady();
    }
  });
  return null;
}

export function HoloLattice({ onContextLost, onReady }: { onContextLost?: () => void; onReady?: () => void }) {
  const { snapshot } = useLive();
  const { theme, colors: themeColors } = useThemeColors();
  const colors = themeColors ?? FALLBACK;
  const light = theme === 'light';

  const liveIds = useMemo(() => {
    const set = new Set<string>();
    for (const m of snapshot?.matches ?? []) if (m.status === 'live' && m.stadiumId) set.add(m.stadiumId);
    return set;
  }, [snapshot]);

  return (
    <Canvas
      dpr={[1, 1.5]}
      camera={{ position: [0, 8, 15], fov: 50 }}
      gl={{ antialias: true }}
      onCreated={({ gl }) => {
        gl.domElement.addEventListener('webglcontextlost', () => onContextLost?.(), { once: true });
      }}
    >
      <color attach="background" args={[colors.bg]} />
      <fog attach="fog" args={[colors.bg, 18, 44]} />
      {onReady && <ReadySignal onReady={onReady} />}
      {/* Remount the scene on theme change so blending/colours re-apply cleanly. */}
      <group key={theme}>
        <Pillars liveIds={liveIds} colors={colors} light={light} />
        <DotMatrix colors={colors} light={light} />
      </group>
      <OrbitControls
        enableZoom={false}
        enablePan={false}
        autoRotate
        autoRotateSpeed={0.45}
        target={[0, 1, 0]}
        minPolarAngle={0.5}
        maxPolarAngle={1.25}
      />
    </Canvas>
  );
}
