'use client';

import { useMemo, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { STADIUMS } from '@/lib/stadiums';
import { PLANE_DEPTH, PLANE_WIDTH, projectLatLon } from '@/lib/geo';
import { useLive } from './useLive';

const CYAN = '#40E5D1';
const AMBER = '#FFB13B';

// Glow without a postprocessing/bloom pass (too heavy + fails on low-end/headless GL): bright
// `toneMapped={false}` colors with additive blending, plus a soft halo sphere on each orb.

function DotMatrix() {
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
      <meshBasicMaterial color="#2FD8C0" toneMapped={false} transparent opacity={0.85} blending={THREE.AdditiveBlending} depthWrite={false} />
    </instancedMesh>
  );
}

function Pillar({ x, z, live, seed }: { x: number; z: number; live: boolean; seed: number }) {
  const group = useRef<THREE.Group>(null);
  const halo = useRef<THREE.Mesh>(null);
  const color = live ? AMBER : CYAN;
  const height = live ? 4.2 : 2.6;

  useFrame(({ clock }) => {
    if (!live || !halo.current) return;
    const p = 0.7 + 0.3 * Math.sin(clock.getElapsedTime() * 3 + seed);
    halo.current.scale.setScalar(1 + p);
    (halo.current.material as THREE.MeshBasicMaterial).opacity = 0.15 + p * 0.25;
  });

  return (
    <group position={[x, 0, z]} ref={group}>
      {/* beam */}
      <mesh position={[0, height / 2, 0]}>
        <cylinderGeometry args={[0.025, 0.07, height, 8]} />
        <meshBasicMaterial color={color} toneMapped={false} transparent opacity={live ? 0.8 : 0.4} blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>
      {/* core orb */}
      <mesh position={[0, 0.06, 0]}>
        <sphereGeometry args={[0.12, 16, 16]} />
        <meshBasicMaterial color={color} toneMapped={false} />
      </mesh>
      {/* soft halo (fake bloom) */}
      <mesh ref={halo} position={[0, 0.06, 0]}>
        <sphereGeometry args={[0.28, 16, 16]} />
        <meshBasicMaterial color={color} toneMapped={false} transparent opacity={live ? 0.35 : 0.18} blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>
    </group>
  );
}

// Fires once on the first rendered frame — lets the parent confirm the GPU is actually
// drawing (vs. a context that died before any frame, which never ticks useFrame).
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

function Pillars({ liveIds }: { liveIds: Set<string> }) {
  return (
    <>
      {STADIUMS.map((s, i) => {
        const [x, z] = projectLatLon(s.lat, s.lon);
        return <Pillar key={s.id} x={x} z={z} live={liveIds.has(s.id)} seed={i} />;
      })}
    </>
  );
}

export function HoloLattice({ onContextLost, onReady }: { onContextLost?: () => void; onReady?: () => void }) {
  const { snapshot } = useLive();
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
        // Fall back to the static backdrop if the GPU drops the context (low-end / headless GL).
        gl.domElement.addEventListener('webglcontextlost', () => onContextLost?.(), { once: true });
      }}
    >
      <color attach="background" args={['#030B10']} />
      <fog attach="fog" args={['#030B10', 18, 44]} />
      {onReady && <ReadySignal onReady={onReady} />}
      <Pillars liveIds={liveIds} />
      <DotMatrix />
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
