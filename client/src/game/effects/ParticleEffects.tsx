import { useRef, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { useTexture } from '@react-three/drei';
import * as THREE from 'three';

interface HitParticlesProps {
  position: [number, number, number];
  active: boolean;
  color?: string;
}

export function HitParticles({ position, active, color = '#ff6600' }: HitParticlesProps) {
  const COUNT = 45;
  const pointsRef = useRef<THREE.Points>(null);
  const activeRef = useRef(false);
  const prevActiveRef = useRef(false);
  const hitTex = useTexture('/textures/vfx/hit_02.png');

  const { positions, velocities, lifetimes, colors } = useMemo(() => {
    const positions = new Float32Array(COUNT * 3);
    const velocities = new Float32Array(COUNT * 3);
    const lifetimes = new Float32Array(COUNT);
    const colors = new Float32Array(COUNT * 3);
    const baseColor = new THREE.Color(color);
    for (let i = 0; i < COUNT; i++) {
      lifetimes[i] = -1;
      colors[i * 3] = baseColor.r;
      colors[i * 3 + 1] = baseColor.g;
      colors[i * 3 + 2] = baseColor.b;
    }
    return { positions, velocities, lifetimes, colors };
  }, [color]);

  useFrame((_, delta) => {
    if (!pointsRef.current) return;
    const geom = pointsRef.current.geometry;

    if (active && !prevActiveRef.current) {
      activeRef.current = true;
      const baseColor = new THREE.Color(color);
      const redColor = new THREE.Color('#ff0000');
      for (let i = 0; i < COUNT; i++) {
        positions[i * 3] = position[0];
        positions[i * 3 + 1] = position[1];
        positions[i * 3 + 2] = position[2];
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.random() * Math.PI;
        const speed = 2 + Math.random() * 4;
        velocities[i * 3] = Math.sin(phi) * Math.cos(theta) * speed;
        velocities[i * 3 + 1] = Math.sin(phi) * Math.sin(theta) * speed;
        velocities[i * 3 + 2] = Math.cos(phi) * speed;
        lifetimes[i] = 0.3 + Math.random() * 0.2;
        const c = Math.random() > 0.5 ? baseColor : redColor;
        colors[i * 3] = c.r;
        colors[i * 3 + 1] = c.g;
        colors[i * 3 + 2] = c.b;
      }
    }
    prevActiveRef.current = active;

    let allDead = true;
    for (let i = 0; i < COUNT; i++) {
      if (lifetimes[i] <= 0) continue;
      allDead = false;
      lifetimes[i] -= delta;
      positions[i * 3] += velocities[i * 3] * delta;
      positions[i * 3 + 1] += velocities[i * 3 + 1] * delta;
      positions[i * 3 + 2] += velocities[i * 3 + 2] * delta;
      velocities[i * 3 + 1] -= 5 * delta;
    }
    if (allDead) activeRef.current = false;

    geom.attributes.position.needsUpdate = true;
    geom.attributes.color.needsUpdate = true;

    const mat = pointsRef.current.material as THREE.PointsMaterial;
    mat.opacity = activeRef.current ? 1 : 0;
  });

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          args={[positions, 3]}
        />
        <bufferAttribute
          attach="attributes-color"
          args={[colors, 3]}
        />
      </bufferGeometry>
      <pointsMaterial
        map={hitTex}
        size={0.35}
        transparent
        vertexColors
        sizeAttenuation
        depthWrite={false}
        opacity={0}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}

interface PortalParticlesProps {
  position: [number, number, number];
  color?: string;
}

export function PortalParticles({ position, color = '#9933ff' }: PortalParticlesProps) {
  const COUNT = 50;
  const pointsRef = useRef<THREE.Points>(null);
  const glowTex = useTexture('/textures/vfx/glow_point2_purple.png');

  const { positions, velocities, lifetimes, colors } = useMemo(() => {
    const positions = new Float32Array(COUNT * 3);
    const velocities = new Float32Array(COUNT * 3);
    const lifetimes = new Float32Array(COUNT);
    const colors = new Float32Array(COUNT * 3);
    const baseColor = new THREE.Color(color);
    const lightColor = new THREE.Color('#cc99ff');

    for (let i = 0; i < COUNT; i++) {
      const angle = Math.random() * Math.PI * 2;
      const radius = 0.3 + Math.random() * 0.7;
      positions[i * 3] = position[0] + Math.cos(angle) * radius;
      positions[i * 3 + 1] = position[1] + Math.random() * 3;
      positions[i * 3 + 2] = position[2] + Math.sin(angle) * radius;

      velocities[i * 3] = (Math.random() - 0.5) * 0.2;
      velocities[i * 3 + 1] = 0.5 + Math.random() * 1.0;
      velocities[i * 3 + 2] = (Math.random() - 0.5) * 0.2;

      lifetimes[i] = Math.random() * 3;

      const c = Math.random() > 0.5 ? baseColor : lightColor;
      colors[i * 3] = c.r;
      colors[i * 3 + 1] = c.g;
      colors[i * 3 + 2] = c.b;
    }
    return { positions, velocities, lifetimes, colors };
  }, [position, color]);

  useFrame((_, delta) => {
    if (!pointsRef.current) return;

    for (let i = 0; i < COUNT; i++) {
      lifetimes[i] -= delta;
      if (lifetimes[i] <= 0) {
        const angle = Math.random() * Math.PI * 2;
        const radius = 0.3 + Math.random() * 0.7;
        positions[i * 3] = position[0] + Math.cos(angle) * radius;
        positions[i * 3 + 1] = position[1];
        positions[i * 3 + 2] = position[2] + Math.sin(angle) * radius;
        velocities[i * 3] = (Math.random() - 0.5) * 0.2;
        velocities[i * 3 + 1] = 0.5 + Math.random() * 1.0;
        velocities[i * 3 + 2] = (Math.random() - 0.5) * 0.2;
        lifetimes[i] = 2 + Math.random() * 1;
      } else {
        positions[i * 3] += velocities[i * 3] * delta;
        positions[i * 3 + 1] += velocities[i * 3 + 1] * delta;
        positions[i * 3 + 2] += velocities[i * 3 + 2] * delta;
      }
    }

    pointsRef.current.geometry.attributes.position.needsUpdate = true;
  });

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          args={[positions, 3]}
        />
        <bufferAttribute
          attach="attributes-color"
          args={[colors, 3]}
        />
      </bufferGeometry>
      <pointsMaterial
        map={glowTex}
        size={0.2}
        transparent
        vertexColors
        sizeAttenuation
        depthWrite={false}
        opacity={0.8}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}

interface TorchParticlesProps {
  position: [number, number, number];
}

export function TorchParticles({ position }: TorchParticlesProps) {
  const COUNT = 20;
  const pointsRef = useRef<THREE.Points>(null);
  const flameTex = useTexture('/textures/vfx/FlameDecal04.png');

  const { positions, velocities, lifetimes, colors } = useMemo(() => {
    const positions = new Float32Array(COUNT * 3);
    const velocities = new Float32Array(COUNT * 3);
    const lifetimes = new Float32Array(COUNT);
    const colors = new Float32Array(COUNT * 3);
    const orangeColor = new THREE.Color('#ff6600');
    const redColor = new THREE.Color('#ff2200');
    const yellowColor = new THREE.Color('#ffaa00');

    for (let i = 0; i < COUNT; i++) {
      positions[i * 3] = position[0] + (Math.random() - 0.5) * 0.1;
      positions[i * 3 + 1] = position[1];
      positions[i * 3 + 2] = position[2] + (Math.random() - 0.5) * 0.1;

      velocities[i * 3] = (Math.random() - 0.5) * 0.3;
      velocities[i * 3 + 1] = 1 + Math.random() * 1.5;
      velocities[i * 3 + 2] = (Math.random() - 0.5) * 0.3;

      lifetimes[i] = Math.random() * 1.5;

      const colorOptions = [orangeColor, redColor, yellowColor];
      const c = colorOptions[Math.floor(Math.random() * 3)];
      colors[i * 3] = c.r;
      colors[i * 3 + 1] = c.g;
      colors[i * 3 + 2] = c.b;
    }
    return { positions, velocities, lifetimes, colors };
  }, [position]);

  useFrame((_, delta) => {
    if (!pointsRef.current) return;

    for (let i = 0; i < COUNT; i++) {
      lifetimes[i] -= delta;
      if (lifetimes[i] <= 0) {
        positions[i * 3] = position[0] + (Math.random() - 0.5) * 0.1;
        positions[i * 3 + 1] = position[1];
        positions[i * 3 + 2] = position[2] + (Math.random() - 0.5) * 0.1;
        velocities[i * 3] = (Math.random() - 0.5) * 0.3;
        velocities[i * 3 + 1] = 1 + Math.random() * 1.5;
        velocities[i * 3 + 2] = (Math.random() - 0.5) * 0.3;
        lifetimes[i] = 0.8 + Math.random() * 0.7;
      } else {
        positions[i * 3] += velocities[i * 3] * delta;
        positions[i * 3 + 1] += velocities[i * 3 + 1] * delta;
        positions[i * 3 + 2] += velocities[i * 3 + 2] * delta;
      }
    }

    pointsRef.current.geometry.attributes.position.needsUpdate = true;
  });

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          args={[positions, 3]}
        />
        <bufferAttribute
          attach="attributes-color"
          args={[colors, 3]}
        />
      </bufferGeometry>
      <pointsMaterial
        map={flameTex}
        size={0.15}
        transparent
        vertexColors
        sizeAttenuation
        depthWrite={false}
        opacity={0.9}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}

interface FireflyParticlesProps {
  position: [number, number, number];
  count?: number;
  radius?: number;
  color?: string;
}

export function FireflyParticles({ position, count = 40, radius = 8, color = '#aaff44' }: FireflyParticlesProps) {
  const pointsRef = useRef<THREE.Points>(null);
  const glowTex = useTexture('/textures/vfx/glow_ball2_grey.png');

  const data = useMemo(() => {
    const positions = new Float32Array(count * 3);
    const basePositions = new Float32Array(count * 3);
    const phases = new Float32Array(count * 3);
    const speeds = new Float32Array(count);
    const sizes = new Float32Array(count);
    const colors = new Float32Array(count * 3);
    const baseColor = new THREE.Color(color);
    const warmColor = new THREE.Color('#ffee88');
    for (let i = 0; i < count; i++) {
      const bx = position[0] + (Math.random() - 0.5) * radius * 2;
      const by = position[1] + Math.random() * 4 + 0.5;
      const bz = position[2] + (Math.random() - 0.5) * radius * 2;
      basePositions[i * 3] = bx; basePositions[i * 3 + 1] = by; basePositions[i * 3 + 2] = bz;
      positions[i * 3] = bx; positions[i * 3 + 1] = by; positions[i * 3 + 2] = bz;
      phases[i * 3]     = Math.random() * Math.PI * 2;
      phases[i * 3 + 1] = Math.random() * Math.PI * 2;
      phases[i * 3 + 2] = Math.random() * Math.PI * 2;
      speeds[i] = 0.3 + Math.random() * 0.8;
      sizes[i] = 0.08 + Math.random() * 0.12;
      const c = Math.random() > 0.3 ? baseColor : warmColor;
      colors[i * 3] = c.r; colors[i * 3 + 1] = c.g; colors[i * 3 + 2] = c.b;
    }
    return { positions, basePositions, phases, speeds, sizes, colors };
  }, [position, count, radius, color]);

  useFrame(({ clock }) => {
    if (!pointsRef.current) return;
    const t = clock.getElapsedTime();
    const geo = pointsRef.current.geometry;
    const pos = geo.attributes.position.array as Float32Array;

    for (let i = 0; i < count; i++) {
      const s = data.speeds[i];
      const px = data.phases[i * 3], py = data.phases[i * 3 + 1], pz = data.phases[i * 3 + 2];
      pos[i * 3]     = data.basePositions[i * 3]     + Math.sin(t * s + px) * 0.8;
      pos[i * 3 + 1] = data.basePositions[i * 3 + 1] + Math.sin(t * s * 0.7 + py) * 0.5;
      pos[i * 3 + 2] = data.basePositions[i * 3 + 2] + Math.cos(t * s + pz) * 0.8;
    }
    geo.attributes.position.needsUpdate = true;

    const mat = pointsRef.current.material as THREE.PointsMaterial;
    mat.size = 0.12 * (0.6 + 0.4 * Math.sin(t * 1.5));
  });

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[data.positions, 3]} />
        <bufferAttribute attach="attributes-color" args={[data.colors, 3]} />
      </bufferGeometry>
      <pointsMaterial
        map={glowTex}
        size={0.12}
        transparent vertexColors sizeAttenuation
        depthWrite={false} opacity={0.85}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}

interface SmokeEmitterProps {
  position: [number, number, number];
  count?: number;
  active?: boolean;
  color?: string;
  speed?: number;
  spread?: number;
}

export function SmokeEmitter({ position, count = 30, active = true, color = '#888888', speed = 1.2, spread = 0.4 }: SmokeEmitterProps) {
  const pointsRef = useRef<THREE.Points>(null);
  const smokeTex = useTexture('/textures/vfx/FX_smoke_02.png');

  const data = useMemo(() => {
    const positions = new Float32Array(count * 3);
    const velocities = new Float32Array(count * 3);
    const lifetimes = new Float32Array(count);
    const maxLifetimes = new Float32Array(count);
    const sizes = new Float32Array(count);
    const colors = new Float32Array(count * 3);
    const baseColor = new THREE.Color(color);
    for (let i = 0; i < count; i++) {
      positions[i * 3 + 1] = -999;
      lifetimes[i] = -1;
      maxLifetimes[i] = 2 + Math.random() * 2;
      sizes[i] = 0.3 + Math.random() * 0.5;
      colors[i * 3] = baseColor.r * (0.8 + Math.random() * 0.4);
      colors[i * 3 + 1] = baseColor.g * (0.8 + Math.random() * 0.4);
      colors[i * 3 + 2] = baseColor.b * (0.8 + Math.random() * 0.4);
    }
    return { positions, velocities, lifetimes, maxLifetimes, sizes, colors };
  }, [count, color]);

  const spawnIdx = useRef(0);

  useFrame((_, delta) => {
    if (!pointsRef.current) return;
    const d = data;
    const mat = pointsRef.current.material as THREE.PointsMaterial;

    if (active) {
      const toSpawn = Math.ceil(count * delta * 2);
      for (let s = 0; s < toSpawn; s++) {
        const i = spawnIdx.current % count;
        spawnIdx.current++;
        d.positions[i * 3]     = position[0] + (Math.random() - 0.5) * spread;
        d.positions[i * 3 + 1] = position[1];
        d.positions[i * 3 + 2] = position[2] + (Math.random() - 0.5) * spread;
        d.velocities[i * 3]     = (Math.random() - 0.5) * 0.3;
        d.velocities[i * 3 + 1] = speed + Math.random() * 0.5;
        d.velocities[i * 3 + 2] = (Math.random() - 0.5) * 0.3;
        d.lifetimes[i] = d.maxLifetimes[i];
      }
    }

    let anyAlive = false;
    for (let i = 0; i < count; i++) {
      if (d.lifetimes[i] <= 0) continue;
      anyAlive = true;
      d.lifetimes[i] -= delta;
      const drift = delta * 0.15;
      d.positions[i * 3]     += d.velocities[i * 3] * delta;
      d.positions[i * 3 + 1] += d.velocities[i * 3 + 1] * delta;
      d.positions[i * 3 + 2] += d.velocities[i * 3 + 2] * delta;
      d.velocities[i * 3]     += (Math.random() - 0.5) * drift;
      d.velocities[i * 3 + 1] *= 0.995;
    }

    mat.opacity = anyAlive || active ? 0.5 : 0;
    pointsRef.current.geometry.attributes.position.needsUpdate = true;
  });

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[data.positions, 3]} />
        <bufferAttribute attach="attributes-color" args={[data.colors, 3]} />
      </bufferGeometry>
      <pointsMaterial
        map={smokeTex}
        size={0.6}
        transparent vertexColors sizeAttenuation
        depthWrite={false} opacity={0}
        blending={THREE.NormalBlending}
      />
    </points>
  );
}

interface WeatherParticlesProps {
  type: 'rain' | 'snow';
  intensity?: number;
  area?: number;
}

export function WeatherParticles({ type, intensity = 1, area = 40 }: WeatherParticlesProps) {
  const count = type === 'rain' ? Math.floor(800 * intensity) : Math.floor(400 * intensity);
  const pointsRef = useRef<THREE.Points>(null);
  const tex = useTexture(type === 'rain' ? '/textures/vfx/trail_CPdr_Rm_01.png' : '/textures/vfx/Soft_Circle_Pulse.png');

  const data = useMemo(() => {
    const positions = new Float32Array(count * 3);
    const velocities = new Float32Array(count);
    const phases = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      positions[i * 3]     = (Math.random() - 0.5) * area;
      positions[i * 3 + 1] = Math.random() * 25;
      positions[i * 3 + 2] = (Math.random() - 0.5) * area;
      velocities[i] = type === 'rain'
        ? 12 + Math.random() * 8
        : 1.0 + Math.random() * 1.5;
      phases[i] = Math.random() * Math.PI * 2;
    }
    return { positions, velocities, phases };
  }, [count, area, type]);

  useFrame(({ camera, clock }) => {
    if (!pointsRef.current) return;
    const t = clock.getElapsedTime();
    const pos = data.positions;
    const cx = camera.position.x, cz = camera.position.z;
    const half = area / 2;

    for (let i = 0; i < count; i++) {
      pos[i * 3 + 1] -= data.velocities[i] * 0.016;

      if (type === 'snow') {
        pos[i * 3]     += Math.sin(t * 0.5 + data.phases[i]) * 0.01;
        pos[i * 3 + 2] += Math.cos(t * 0.4 + data.phases[i]) * 0.008;
      } else {
        pos[i * 3] += 0.005;
      }

      if (pos[i * 3 + 1] < -1) {
        pos[i * 3 + 1] = 22 + Math.random() * 5;
        pos[i * 3]     = cx + (Math.random() - 0.5) * area;
        pos[i * 3 + 2] = cz + (Math.random() - 0.5) * area;
      }

      if (pos[i * 3] > cx + half) pos[i * 3] -= area;
      if (pos[i * 3] < cx - half) pos[i * 3] += area;
      if (pos[i * 3 + 2] > cz + half) pos[i * 3 + 2] -= area;
      if (pos[i * 3 + 2] < cz - half) pos[i * 3 + 2] += area;
    }

    pointsRef.current.geometry.attributes.position.needsUpdate = true;
    pointsRef.current.position.set(0, 0, 0);
  });

  const isRain = type === 'rain';
  return (
    <points ref={pointsRef} frustumCulled={false}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[data.positions, 3]} />
      </bufferGeometry>
      <pointsMaterial
        map={tex}
        size={isRain ? 0.08 : 0.15}
        transparent sizeAttenuation
        depthWrite={false}
        opacity={isRain ? 0.4 : 0.7}
        color={isRain ? '#aaccff' : '#ffffff'}
        blending={isRain ? THREE.AdditiveBlending : THREE.NormalBlending}
      />
    </points>
  );
}

interface FireworkBurstProps {
  position: [number, number, number];
  active: boolean;
  color?: string;
}

export function FireworkBurst({ position, active, color = '#ff6644' }: FireworkBurstProps) {
  const COUNT = 120;
  const pointsRef = useRef<THREE.Points>(null);
  const prevActive = useRef(false);
  const isLive = useRef(false);
  const sparkTex = useTexture('/textures/vfx/star_06.png');

  const data = useMemo(() => {
    const positions = new Float32Array(COUNT * 3);
    const velocities = new Float32Array(COUNT * 3);
    const lifetimes = new Float32Array(COUNT);
    const colors = new Float32Array(COUNT * 3);
    for (let i = 0; i < COUNT; i++) {
      positions[i * 3 + 1] = -999;
      lifetimes[i] = -1;
    }
    return { positions, velocities, lifetimes, colors };
  }, []);

  useFrame((_, delta) => {
    if (!pointsRef.current) return;
    const d = data;
    const mat = pointsRef.current.material as THREE.PointsMaterial;

    if (active && !prevActive.current) {
      isLive.current = true;
      const base = new THREE.Color(color);
      const gold = new THREE.Color('#ffdd44');
      const white = new THREE.Color('#ffffff');
      const palette = [base, gold, white];
      for (let i = 0; i < COUNT; i++) {
        d.positions[i * 3]     = position[0];
        d.positions[i * 3 + 1] = position[1];
        d.positions[i * 3 + 2] = position[2];
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(2 * Math.random() - 1);
        const spd = 3 + Math.random() * 6;
        d.velocities[i * 3]     = Math.sin(phi) * Math.cos(theta) * spd;
        d.velocities[i * 3 + 1] = Math.sin(phi) * Math.sin(theta) * spd;
        d.velocities[i * 3 + 2] = Math.cos(phi) * spd;
        d.lifetimes[i] = 1.0 + Math.random() * 1.5;
        const c = palette[Math.floor(Math.random() * palette.length)];
        d.colors[i * 3] = c.r; d.colors[i * 3 + 1] = c.g; d.colors[i * 3 + 2] = c.b;
      }
      pointsRef.current.geometry.attributes.color.needsUpdate = true;
    }
    prevActive.current = active;

    if (!isLive.current) { mat.opacity = 0; return; }

    let allDead = true;
    for (let i = 0; i < COUNT; i++) {
      if (d.lifetimes[i] <= 0) continue;
      allDead = false;
      d.lifetimes[i] -= delta;
      d.positions[i * 3]     += d.velocities[i * 3] * delta;
      d.positions[i * 3 + 1] += d.velocities[i * 3 + 1] * delta;
      d.positions[i * 3 + 2] += d.velocities[i * 3 + 2] * delta;
      d.velocities[i * 3]     *= 0.97;
      d.velocities[i * 3 + 1] -= 4 * delta;
      d.velocities[i * 3 + 2] *= 0.97;
    }

    if (allDead) isLive.current = false;
    mat.opacity = isLive.current ? 1 : 0;
    pointsRef.current.geometry.attributes.position.needsUpdate = true;
  });

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[data.positions, 3]} />
        <bufferAttribute attach="attributes-color" args={[data.colors, 3]} />
      </bufferGeometry>
      <pointsMaterial
        map={sparkTex}
        size={0.25}
        transparent vertexColors sizeAttenuation
        depthWrite={false} opacity={0}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}

interface StarFountainProps {
  position: [number, number, number];
  active?: boolean;
  color?: string;
}

export function StarFountain({ position, active = true, color = '#ffcc00' }: StarFountainProps) {
  const COUNT = 80;
  const pointsRef = useRef<THREE.Points>(null);
  const starTex = useTexture('/textures/vfx/star_06.png');
  const spawnIdx = useRef(0);

  const data = useMemo(() => {
    const positions = new Float32Array(COUNT * 3);
    const velocities = new Float32Array(COUNT * 3);
    const lifetimes = new Float32Array(COUNT);
    const colors = new Float32Array(COUNT * 3);
    const baseColor = new THREE.Color(color);
    for (let i = 0; i < COUNT; i++) {
      positions[i * 3 + 1] = -999;
      lifetimes[i] = -1;
      colors[i * 3] = baseColor.r; colors[i * 3 + 1] = baseColor.g; colors[i * 3 + 2] = baseColor.b;
    }
    return { positions, velocities, lifetimes, colors };
  }, [color]);

  useFrame((_, delta) => {
    if (!pointsRef.current) return;
    const d = data;
    const mat = pointsRef.current.material as THREE.PointsMaterial;

    if (active) {
      const toSpawn = Math.ceil(40 * delta);
      for (let s = 0; s < toSpawn; s++) {
        const i = spawnIdx.current % COUNT;
        spawnIdx.current++;
        d.positions[i * 3]     = position[0];
        d.positions[i * 3 + 1] = position[1];
        d.positions[i * 3 + 2] = position[2];
        const angle = Math.random() * Math.PI * 2;
        const upSpeed = 5 + Math.random() * 4;
        const outSpeed = 1 + Math.random() * 2;
        d.velocities[i * 3]     = Math.cos(angle) * outSpeed;
        d.velocities[i * 3 + 1] = upSpeed;
        d.velocities[i * 3 + 2] = Math.sin(angle) * outSpeed;
        d.lifetimes[i] = 1.5 + Math.random() * 1;
      }
    }

    let anyAlive = false;
    for (let i = 0; i < COUNT; i++) {
      if (d.lifetimes[i] <= 0) continue;
      anyAlive = true;
      d.lifetimes[i] -= delta;
      d.positions[i * 3]     += d.velocities[i * 3] * delta;
      d.positions[i * 3 + 1] += d.velocities[i * 3 + 1] * delta;
      d.positions[i * 3 + 2] += d.velocities[i * 3 + 2] * delta;
      d.velocities[i * 3 + 1] -= 6 * delta;
    }

    mat.opacity = anyAlive ? 0.9 : 0;
    pointsRef.current.geometry.attributes.position.needsUpdate = true;
  });

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[data.positions, 3]} />
        <bufferAttribute attach="attributes-color" args={[data.colors, 3]} />
      </bufferGeometry>
      <pointsMaterial
        map={starTex}
        size={0.2}
        transparent vertexColors sizeAttenuation
        depthWrite={false} opacity={0}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}

interface CandleFlameProps {
  position: [number, number, number];
}

export function CandleFlame({ position }: CandleFlameProps) {
  const COUNT = 15;
  const pointsRef = useRef<THREE.Points>(null);
  const lightRef = useRef<THREE.PointLight>(null);
  const flameTex = useTexture('/textures/vfx/FlameDecal04.png');

  const data = useMemo(() => {
    const positions = new Float32Array(COUNT * 3);
    const velocities = new Float32Array(COUNT * 3);
    const lifetimes = new Float32Array(COUNT);
    const colors = new Float32Array(COUNT * 3);
    const yellow = new THREE.Color('#ffcc44');
    const orange = new THREE.Color('#ff8800');
    const white = new THREE.Color('#ffffdd');
    const palette = [yellow, orange, white];
    for (let i = 0; i < COUNT; i++) {
      positions[i * 3]     = position[0] + (Math.random() - 0.5) * 0.02;
      positions[i * 3 + 1] = position[1];
      positions[i * 3 + 2] = position[2] + (Math.random() - 0.5) * 0.02;
      velocities[i * 3]     = (Math.random() - 0.5) * 0.05;
      velocities[i * 3 + 1] = 0.4 + Math.random() * 0.5;
      velocities[i * 3 + 2] = (Math.random() - 0.5) * 0.05;
      lifetimes[i] = Math.random() * 0.8;
      const c = palette[Math.floor(Math.random() * 3)];
      colors[i * 3] = c.r; colors[i * 3 + 1] = c.g; colors[i * 3 + 2] = c.b;
    }
    return { positions, velocities, lifetimes, colors };
  }, [position]);

  useFrame(({ clock }, delta) => {
    if (!pointsRef.current) return;
    const d = data;
    const t = clock.getElapsedTime();

    for (let i = 0; i < COUNT; i++) {
      d.lifetimes[i] -= delta;
      if (d.lifetimes[i] <= 0) {
        d.positions[i * 3]     = position[0] + (Math.random() - 0.5) * 0.02;
        d.positions[i * 3 + 1] = position[1];
        d.positions[i * 3 + 2] = position[2] + (Math.random() - 0.5) * 0.02;
        d.velocities[i * 3]     = (Math.random() - 0.5) * 0.08;
        d.velocities[i * 3 + 1] = 0.4 + Math.random() * 0.5;
        d.velocities[i * 3 + 2] = (Math.random() - 0.5) * 0.08;
        d.lifetimes[i] = 0.5 + Math.random() * 0.4;
      } else {
        d.positions[i * 3]     += d.velocities[i * 3] * delta;
        d.positions[i * 3 + 1] += d.velocities[i * 3 + 1] * delta;
        d.positions[i * 3 + 2] += d.velocities[i * 3 + 2] * delta;
      }
    }

    pointsRef.current.geometry.attributes.position.needsUpdate = true;

    if (lightRef.current) {
      lightRef.current.intensity = 0.6 + Math.sin(t * 8) * 0.15 + Math.sin(t * 13) * 0.1;
    }
  });

  return (
    <group>
      <points ref={pointsRef}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[data.positions, 3]} />
          <bufferAttribute attach="attributes-color" args={[data.colors, 3]} />
        </bufferGeometry>
        <pointsMaterial
          map={flameTex}
          size={0.06}
          transparent vertexColors sizeAttenuation
          depthWrite={false} opacity={0.9}
          blending={THREE.AdditiveBlending}
        />
      </points>
      <pointLight ref={lightRef} position={position} color="#ffaa44" intensity={0.6} distance={4} decay={2} />
    </group>
  );
}

interface HealParticlesProps {
  position: [number, number, number];
  active: boolean;
}

export function HealParticles({ position, active }: HealParticlesProps) {
  const COUNT = 25;
  const pointsRef = useRef<THREE.Points>(null);
  const timeRef = useRef(0);
  const healTex = useTexture('/textures/vfx/Soft_Circle_Pulse.png');

  const { positions, velocities, lifetimes, colors } = useMemo(() => {
    const positions = new Float32Array(COUNT * 3);
    const velocities = new Float32Array(COUNT * 3);
    const lifetimes = new Float32Array(COUNT);
    const colors = new Float32Array(COUNT * 3);
    const greenColor = new THREE.Color('#00ff66');
    const whiteColor = new THREE.Color('#ccffcc');

    for (let i = 0; i < COUNT; i++) {
      lifetimes[i] = -1;
      const c = Math.random() > 0.4 ? greenColor : whiteColor;
      colors[i * 3] = c.r;
      colors[i * 3 + 1] = c.g;
      colors[i * 3 + 2] = c.b;
    }
    return { positions, velocities, lifetimes, colors };
  }, []);

  useFrame((_, delta) => {
    if (!pointsRef.current) return;
    timeRef.current += delta;

    const mat = pointsRef.current.material as THREE.PointsMaterial;

    if (!active) {
      mat.opacity = 0;
      return;
    }

    mat.opacity = 0.9;

    for (let i = 0; i < COUNT; i++) {
      lifetimes[i] -= delta;
      if (lifetimes[i] <= 0) {
        const angle = Math.random() * Math.PI * 2;
        const radius = 0.2 + Math.random() * 0.4;
        positions[i * 3] = position[0] + Math.cos(angle) * radius;
        positions[i * 3 + 1] = position[1];
        positions[i * 3 + 2] = position[2] + Math.sin(angle) * radius;
        const spiralSpeed = 0.5;
        velocities[i * 3] = Math.cos(angle + timeRef.current) * spiralSpeed;
        velocities[i * 3 + 1] = 1.5 + Math.random() * 1.0;
        velocities[i * 3 + 2] = Math.sin(angle + timeRef.current) * spiralSpeed;
        lifetimes[i] = 0.8 + Math.random() * 0.7;
      } else {
        positions[i * 3] += velocities[i * 3] * delta;
        positions[i * 3 + 1] += velocities[i * 3 + 1] * delta;
        positions[i * 3 + 2] += velocities[i * 3 + 2] * delta;
      }
    }

    pointsRef.current.geometry.attributes.position.needsUpdate = true;
  });

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          args={[positions, 3]}
        />
        <bufferAttribute
          attach="attributes-color"
          args={[colors, 3]}
        />
      </bufferGeometry>
      <pointsMaterial
        map={healTex}
        size={0.18}
        transparent
        vertexColors
        sizeAttenuation
        depthWrite={false}
        opacity={0}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}

interface CeilingHoleBeamsProps {
  positions: Array<[number, number]>;
  color?: string;
  ceilingHeight?: number;
  motesPerHole?: number;
  intensity?: number;
  beamHalfWidth?: number;
}

export function CeilingHoleBeams({
  positions,
  color = '#a8c8ff',
  ceilingHeight = 4,
  motesPerHole = 6,
  intensity = 0.45,
  beamHalfWidth = 0.85,
}: CeilingHoleBeamsProps) {
  const N = positions.length;
  const beamRef = useRef<THREE.InstancedMesh>(null);
  const motesRef = useRef<THREE.Points>(null);
  const moteTex = useTexture('/textures/vfx/glow_ball2_grey.png');

  const beamGeom = useMemo(() => {
    const g = new THREE.BufferGeometry();
    const w = beamHalfWidth;
    const h = ceilingHeight;
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array([
      -w, 0, 0,   w, 0, 0,   w, h, 0,  -w, h, 0,
       0, 0,-w,   0, 0, w,   0, h, w,   0, h,-w,
    ]), 3));
    g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array([
      0,0, 1,0, 1,1, 0,1,
      0,0, 1,0, 1,1, 0,1,
    ]), 2));
    g.setIndex(new THREE.BufferAttribute(new Uint16Array([
      0,1,2, 0,2,3,
      4,5,6, 4,6,7,
    ]), 1));
    g.computeBoundingSphere();
    return g;
  }, [ceilingHeight, beamHalfWidth]);

  useEffect(() => () => beamGeom.dispose(), [beamGeom]);

  const beamMaterial = useMemo(() => {
    return new THREE.ShaderMaterial({
      uniforms: {
        uColor: { value: new THREE.Color(color) },
        uIntensity: { value: intensity },
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          // ShaderMaterial on InstancedMesh: three.js auto-injects
          // \`attribute mat4 instanceMatrix\` but we must apply it ourselves.
          vec4 mvPosition = modelViewMatrix * instanceMatrix * vec4(position, 1.0);
          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: `
        uniform vec3 uColor;
        uniform float uIntensity;
        varying vec2 vUv;
        void main() {
          float radial = 1.0 - 2.0 * abs(vUv.x - 0.5);
          radial = smoothstep(0.0, 1.0, radial);
          float vert = smoothstep(0.0, 0.5, vUv.y);
          float a = radial * vert * uIntensity;
          gl_FragColor = vec4(uColor, a);
        }
      `,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
    });
  }, [color, intensity]);

  useEffect(() => () => beamMaterial.dispose(), [beamMaterial]);

  useEffect(() => {
    const mesh = beamRef.current;
    if (!mesh || N === 0) return;
    const m = new THREE.Matrix4();
    const pos = new THREE.Vector3();
    const q = new THREE.Quaternion();
    const scl = new THREE.Vector3(1, 1, 1);
    for (let i = 0; i < N; i++) {
      pos.set(positions[i][0], 0, positions[i][1]);
      m.compose(pos, q, scl);
      mesh.setMatrixAt(i, m);
    }
    mesh.count = N;
    mesh.instanceMatrix.needsUpdate = true;
  }, [positions, N]);

  const totalMotes = N * motesPerHole;
  const motesData = useMemo(() => {
    const len = Math.max(1, totalMotes);
    const positionsArr = new Float32Array(len * 3);
    const speeds = new Float32Array(len);
    const radii = new Float32Array(len);
    const angles = new Float32Array(len);
    const phases = new Float32Array(len);
    for (let h = 0; h < N; h++) {
      for (let k = 0; k < motesPerHole; k++) {
        const i = h * motesPerHole + k;
        const r = Math.random() * 0.55;
        const a = Math.random() * Math.PI * 2;
        positionsArr[i * 3]     = positions[h][0] + Math.cos(a) * r;
        positionsArr[i * 3 + 1] = Math.random() * (ceilingHeight - 0.2) + 0.1;
        positionsArr[i * 3 + 2] = positions[h][1] + Math.sin(a) * r;
        speeds[i] = 0.18 + Math.random() * 0.22;
        radii[i] = r;
        angles[i] = a;
        phases[i] = Math.random() * Math.PI * 2;
      }
    }
    return { positions: positionsArr, speeds, radii, angles, phases };
  }, [positions, ceilingHeight, totalMotes, N, motesPerHole]);

  useFrame((state, delta) => {
    if (!motesRef.current || totalMotes === 0) return;
    const pos = motesRef.current.geometry.attributes.position.array as Float32Array;
    const t = state.clock.getElapsedTime();
    for (let h = 0; h < N; h++) {
      const baseX = positions[h][0];
      const baseZ = positions[h][1];
      for (let k = 0; k < motesPerHole; k++) {
        const i = h * motesPerHole + k;
        let y = pos[i * 3 + 1] - motesData.speeds[i] * delta;
        if (y < 0.1) {
          y = ceilingHeight - 0.05;
          motesData.radii[i] = Math.random() * 0.55;
          motesData.angles[i] = Math.random() * Math.PI * 2;
        }
        pos[i * 3 + 1] = y;
        const sway = Math.sin(t * 0.8 + motesData.phases[i]) * 0.04;
        const ang = motesData.angles[i] + sway * 0.2;
        const r = motesData.radii[i] + sway;
        pos[i * 3]     = baseX + Math.cos(ang) * r;
        pos[i * 3 + 2] = baseZ + Math.sin(ang) * r;
      }
    }
    motesRef.current.geometry.attributes.position.needsUpdate = true;
  });

  if (N === 0) return null;

  return (
    <group>
      <instancedMesh
        ref={beamRef}
        args={[beamGeom, beamMaterial, N]}
        frustumCulled={false}
      />
      {totalMotes > 0 && (
        <points ref={motesRef} frustumCulled={false}>
          <bufferGeometry>
            <bufferAttribute attach="attributes-position" args={[motesData.positions, 3]} />
          </bufferGeometry>
          <pointsMaterial
            map={moteTex}
            color={color}
            size={0.07}
            transparent
            sizeAttenuation
            depthWrite={false}
            opacity={0.85}
            blending={THREE.AdditiveBlending}
          />
        </points>
      )}
    </group>
  );
}
