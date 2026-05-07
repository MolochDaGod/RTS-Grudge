import { useRef, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { useTexture } from '@react-three/drei';
import * as THREE from 'three';
import {
  tryReboundProjectile,
  tryReboundProjectileHit,
  type ProjectileTeam,
} from '../state/blockGuard';
import { vfx, VFXPresets } from '../vfx';
import { useGame } from '@/lib/stores/useGame';
import { useSurvival } from '@/lib/stores/useSurvival';
import { useCombatLog } from '@/lib/stores/useCombatLog';
import { useAudio } from '@/lib/stores/useAudio';

/**
 * Damage applied to an enemy when a successfully blocked Hadouken lands on
 * them after rebound. Mirrors the player's own skill1 damage with a small
 * parry bonus — see `client/src/game/machines/combatMachine.ts > DAMAGE_STATES`.
 */
const REBOUND_DAMAGE_HADOUKEN = 22;

export const VFX_TEXTURES = {
  flame: '/textures/vfx/FlameDecal04.png',
  fireball: '/textures/vfx/decal_fire10.png',
  glow: '/textures/vfx/Fx_Glow_004.png',
  radialGlow: '/textures/vfx/Radial_Glow.png',
  softCircle: '/textures/vfx/Soft_Circle_Pulse.png',
  spark: '/textures/vfx/Spark_Blur.png',
  sparkle: '/textures/vfx/Sparkle_Ink_001.png',
  hit: '/textures/vfx/hit_02.png',
  slash: '/textures/vfx/slash03_anim_1.png',
  ring: '/textures/vfx/Color_Ring_002.png',
  dust: '/textures/vfx/dust54.png',
  star: '/textures/vfx/star_06.png',
  lightning: '/textures/vfx/lightning01_02.png',
  trail: '/textures/vfx/trail_CPdr_Rm_01.png',
  beam: '/textures/vfx/Gradient_Beam_007.png',
  flow: '/textures/vfx/Flow_001.png',
  noise: '/textures/vfx/Noise_02.png',
  flare: '/textures/vfx/flare08.png',
  glowBall: '/textures/vfx/glow_ball2_grey.png',
  auraFlame: '/textures/vfx/Aura_Flame_000.png',
  particle: '/textures/vfx/Default-Particle.png',
  purpleSheet: '/textures/vfx/Sheet_purple_W01.png',
  smoke: '/textures/vfx/FX_smoke_02.png',
  portalRing: '/textures/vfx/DungeonRingGuid.png',
} as const;

interface SkillEffectProps {
  position: [number, number, number];
  direction?: [number, number, number];
  active: boolean;
  color?: string;
}

/**
 * Hadouken-class projectile props. The `team`, `rebounded`, and `onBlock`
 * fields wire this component into the rebound primitive in
 * `client/src/game/state/blockGuard.ts`. Defaults are backwards-compatible
 * with existing player casts (team="player", no rebound), so any future
 * enemy hadouken caster only needs to opt in by passing `team="enemy"`.
 */
interface HadoukenProjectileProps extends SkillEffectProps {
  team?: ProjectileTeam;
  rebounded?: boolean;
  onBlock?: (info: { position: [number, number, number] }) => void;
  /**
   * Fires the frame a rebounded Hadouken lands a hit on an enemy. Lets the
   * parent spawn an impact puff / play SFX. Pairs with the rebound primitive
   * (see `client/src/game/state/blockGuard.ts > tryReboundProjectileHit`).
   */
  onReboundHit?: (info: {
    position: [number, number, number];
    enemyId: string;
    damage: number;
    killed: boolean;
  }) => void;
  /**
   * When `team="enemy"` and `damage > 0`, the Hadouken applies this damage to
   * the player on impact and self-deactivates. Player casts leave this at 0.
   */
  damage?: number;
  /**
   * Optional id of the enemy that fired this Hadouken. Keeps a rebounded shot
   * from popping the caster the instant it flips sides — see
   * `tryReboundProjectileHit` in `blockGuard.ts`.
   */
  casterId?: string;
}

export function HadoukenProjectile({
  position,
  direction = [0, 0, -1],
  active,
  team = "player",
  rebounded = false,
  onBlock,
  onReboundHit,
  damage = 0,
  casterId,
}: HadoukenProjectileProps) {
  const groupRef = useRef<THREE.Group>(null);
  const timeRef = useRef(0);
  const activeRef = useRef(false);
  const startPos = useRef<[number, number, number]>([0, 0, 0]);
  const prevActive = useRef(false);
  // Mutable trajectory state for the rebound primitive — see blockGuard.ts.
  const dirRef = useRef<[number, number, number]>([direction[0], direction[1], direction[2]]);
  const teamRef = useRef<ProjectileTeam>(team);
  const reboundedRef = useRef<boolean>(rebounded);
  const glowTex = useTexture(VFX_TEXTURES.glowBall);
  const sparkTex = useTexture(VFX_TEXTURES.spark);

  const trailPositions = useMemo(() => new Float32Array(60 * 3), []);
  const trailColors = useMemo(() => new Float32Array(60 * 3), []);
  const trailLifetimes = useMemo(() => new Float32Array(60), []);

  useFrame((_, delta) => {
    if (!groupRef.current) return;

    if (active && !prevActive.current) {
      activeRef.current = true;
      timeRef.current = 0;
      startPos.current = [...position];
      // Re-arm the rebound primitive on every fresh activation.
      dirRef.current = [direction[0], direction[1], direction[2]];
      teamRef.current = team;
      reboundedRef.current = rebounded;
      for (let i = 0; i < 60; i++) trailLifetimes[i] = -1;
    }
    prevActive.current = active;

    if (!activeRef.current) {
      groupRef.current.visible = false;
      return;
    }

    groupRef.current.visible = true;
    timeRef.current += delta;

    const speed = 25;
    const t = timeRef.current;
    const dir = dirRef.current;
    const px = startPos.current[0] + dir[0] * speed * t;
    const py = startPos.current[1] + 1.0;
    const pz = startPos.current[2] + dir[2] * speed * t;

    // Linked-particle trail: drop one wisp every frame at the projectile
    // head. The accumulated stream forms the visual trail (this is the
    // core idiom of the WebGPU "linked particles" demo). Player and
    // rebounded shots use arcane (blue-white); enemy shots use shadow.
    // Skip while paused: the projectile freezes in place but useFrame
    // keeps ticking, and we don't want a growing pile of particles to
    // accumulate at one head position behind the menu.
    if (useGame.getState().phase === "playing") {
      const hue: "arcane" | "shadow" =
        teamRef.current === "enemy" ? "shadow" : "arcane";
      vfx.emit(VFXPresets.wispTrail([px, py, pz], hue));
    }

    if (
      tryReboundProjectile(
        { teamRef, reboundedRef, dirRef, startPosRef: startPos, timeRef },
        px,
        py,
        pz,
      )
    ) {
      onBlock?.({ position: [px, py, pz] });
    }

    // After a successful rebound the Hadouken is travelling back toward the
    // original caster's team — test for an enemy under it each frame so the
    // parry actually deals damage on the way through.
    const reboundHit = tryReboundProjectileHit(
      { teamRef, reboundedRef, dirRef, startPosRef: startPos, timeRef },
      px,
      py,
      pz,
      REBOUND_DAMAGE_HADOUKEN,
      1.4,
      casterId,
    );
    if (reboundHit) {
      onReboundHit?.(reboundHit);
      activeRef.current = false;
      groupRef.current.visible = false;
      return;
    }

    // Enemy-cast Hadouken damages the player on impact (player casts use
    // damage=0 and rely on a separate damage path).
    if (teamRef.current === "enemy" && damage > 0) {
      const playerPos = useGame.getState().playerPosition;
      if (playerPos) {
        const dx = px - playerPos.x;
        const dz = pz - playerPos.z;
        if (dx * dx + dz * dz < 1.1 * 1.1) {
          useSurvival.getState().takeDamage(damage, "blade");
          useCombatLog.getState().addEntry(
            `An energy wave strikes you for ${damage} damage!`,
            "#ff6b6b",
          );
          // Audible cue so the player feels the hit instead of only seeing
          // the combat-log line. Reuses the same playHit() ping that fires
          // when the player lands a melee hit / parries a projectile,
          // keeping impact SFX consistent across the game.
          try { useAudio.getState().playHit(); } catch {}
          // Visual cue (red vignette pulse) is now fired centrally from
          // `useSurvival.takeDamage`, so every damage source pulses the
          // HUD without each call site having to remember to do it.
          // See DamageFlashOverlay in HUD.tsx.
          activeRef.current = false;
          groupRef.current.visible = false;
          return;
        }
      }
    }

    groupRef.current.position.set(px, py, pz);

    const pulse = 1 + Math.sin(t * 20) * 0.3;
    groupRef.current.scale.setScalar(pulse);

    for (let i = 59; i > 0; i--) {
      trailPositions[i * 3] = trailPositions[(i - 1) * 3];
      trailPositions[i * 3 + 1] = trailPositions[(i - 1) * 3 + 1];
      trailPositions[i * 3 + 2] = trailPositions[(i - 1) * 3 + 2];
      trailLifetimes[i] = trailLifetimes[i - 1] - delta;
      const fade = Math.max(0, trailLifetimes[i] / 0.5);
      trailColors[i * 3] = 0.2 + fade * 0.8;
      trailColors[i * 3 + 1] = 0.4 * fade;
      trailColors[i * 3 + 2] = 1.0 * fade;
    }
    trailPositions[0] = px;
    trailPositions[1] = py;
    trailPositions[2] = pz;
    trailLifetimes[0] = 0.5;
    trailColors[0] = 1.0;
    trailColors[1] = 0.4;
    trailColors[2] = 1.0;

    if (t > 1.2) {
      activeRef.current = false;
    }
  });

  return (
    <group ref={groupRef} visible={false}>
      <mesh>
        <sphereGeometry args={[0.35, 16, 16]} />
        <meshStandardMaterial
          color="#4488ff"
          emissive="#2266ff"
          emissiveIntensity={3}
          transparent
          opacity={0.9}
          emissiveMap={glowTex}
        />
      </mesh>
      <mesh>
        <sphereGeometry args={[0.5, 12, 12]} />
        <meshStandardMaterial
          color="#88bbff"
          emissive="#4488ff"
          emissiveIntensity={1.5}
          transparent
          opacity={0.3}
          emissiveMap={glowTex}
        />
      </mesh>
      <sprite scale={[1.8, 1.8, 1]}>
        <spriteMaterial map={sparkTex} color="#4488ff" transparent opacity={0.4} blending={THREE.AdditiveBlending} depthWrite={false} />
      </sprite>
      <pointLight color="#4488ff" intensity={8} distance={6} />
    </group>
  );
}

export function ShoryukenFlame({ position, active }: SkillEffectProps) {
  const COUNT = 40;
  const pointsRef = useRef<THREE.Points>(null);
  const timeRef = useRef(0);
  const prevActive = useRef(false);
  const flameTex = useTexture(VFX_TEXTURES.flame);

  const { positions, velocities, lifetimes, colors, sizes } = useMemo(() => {
    const positions = new Float32Array(COUNT * 3);
    const velocities = new Float32Array(COUNT * 3);
    const lifetimes = new Float32Array(COUNT);
    const colors = new Float32Array(COUNT * 3);
    const sizes = new Float32Array(COUNT);
    for (let i = 0; i < COUNT; i++) lifetimes[i] = -1;
    return { positions, velocities, lifetimes, colors, sizes };
  }, []);

  useFrame((_, delta) => {
    if (!pointsRef.current) return;

    if (active && !prevActive.current) {
      timeRef.current = 0;
      for (let i = 0; i < COUNT; i++) {
        positions[i * 3] = position[0] + (Math.random() - 0.5) * 0.6;
        positions[i * 3 + 1] = position[1] + Math.random() * 0.5;
        positions[i * 3 + 2] = position[2] + (Math.random() - 0.5) * 0.6;
        velocities[i * 3] = (Math.random() - 0.5) * 2;
        velocities[i * 3 + 1] = 8 + Math.random() * 6;
        velocities[i * 3 + 2] = (Math.random() - 0.5) * 2;
        lifetimes[i] = 0.3 + Math.random() * 0.4;
        sizes[i] = 0.1 + Math.random() * 0.15;
        const t = Math.random();
        colors[i * 3] = 1.0;
        colors[i * 3 + 1] = 0.3 + t * 0.5;
        colors[i * 3 + 2] = t * 0.2;
      }
    }
    prevActive.current = active;

    timeRef.current += delta;

    let allDead = true;
    for (let i = 0; i < COUNT; i++) {
      if (lifetimes[i] <= 0) continue;
      allDead = false;
      lifetimes[i] -= delta;
      positions[i * 3] += velocities[i * 3] * delta;
      positions[i * 3 + 1] += velocities[i * 3 + 1] * delta;
      positions[i * 3 + 2] += velocities[i * 3] * delta;
      velocities[i * 3] *= 0.95;
      velocities[i * 3 + 2] *= 0.95;
    }

    const mat = pointsRef.current.material as THREE.PointsMaterial;
    mat.opacity = allDead ? 0 : 1;
    pointsRef.current.geometry.attributes.position.needsUpdate = true;
    pointsRef.current.geometry.attributes.color.needsUpdate = true;
  });

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        <bufferAttribute attach="attributes-color" args={[colors, 3]} />
      </bufferGeometry>
      <pointsMaterial
        map={flameTex}
        size={0.4}
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

export function EarthquakeShockwave({ position, active }: SkillEffectProps) {
  const ringRef = useRef<THREE.Mesh>(null);
  const timeRef = useRef(0);
  const prevActive = useRef(false);
  const isActive = useRef(false);
  const dustTex = useTexture(VFX_TEXTURES.dust);
  const ringTex = useTexture(VFX_TEXTURES.ring);

  const COUNT = 60;
  const debrisRef = useRef<THREE.Points>(null);
  const { positions: debrisPos, velocities: debrisVel, lifetimes: debrisLife, colors: debrisCol } = useMemo(() => {
    const positions = new Float32Array(COUNT * 3);
    const velocities = new Float32Array(COUNT * 3);
    const lifetimes = new Float32Array(COUNT);
    const colors = new Float32Array(COUNT * 3);
    for (let i = 0; i < COUNT; i++) lifetimes[i] = -1;
    return { positions, velocities, lifetimes, colors };
  }, []);

  useFrame((_, delta) => {
    if (active && !prevActive.current) {
      isActive.current = true;
      timeRef.current = 0;
      for (let i = 0; i < COUNT; i++) {
        const angle = Math.random() * Math.PI * 2;
        const r = Math.random() * 1.5;
        debrisPos[i * 3] = position[0] + Math.cos(angle) * r;
        debrisPos[i * 3 + 1] = position[1] + 0.1;
        debrisPos[i * 3 + 2] = position[2] + Math.sin(angle) * r;
        debrisVel[i * 3] = Math.cos(angle) * (3 + Math.random() * 4);
        debrisVel[i * 3 + 1] = 3 + Math.random() * 5;
        debrisVel[i * 3 + 2] = Math.sin(angle) * (3 + Math.random() * 4);
        debrisLife[i] = 0.5 + Math.random() * 0.5;
        const brown = 0.3 + Math.random() * 0.3;
        debrisCol[i * 3] = brown + 0.1;
        debrisCol[i * 3 + 1] = brown;
        debrisCol[i * 3 + 2] = brown * 0.5;
      }
    }
    prevActive.current = active;

    if (!isActive.current) {
      if (ringRef.current) ringRef.current.visible = false;
      return;
    }

    timeRef.current += delta;
    const t = timeRef.current;

    if (ringRef.current) {
      ringRef.current.visible = true;
      ringRef.current.position.set(position[0], position[1] + 0.05, position[2]);
      const radius = t * 12;
      ringRef.current.scale.set(radius, 1, radius);
      const mat = ringRef.current.material as THREE.MeshStandardMaterial;
      mat.opacity = Math.max(0, 1 - t * 1.5);
    }

    if (debrisRef.current) {
      for (let i = 0; i < COUNT; i++) {
        if (debrisLife[i] <= 0) continue;
        debrisLife[i] -= delta;
        debrisPos[i * 3] += debrisVel[i * 3] * delta;
        debrisPos[i * 3 + 1] += debrisVel[i * 3 + 1] * delta;
        debrisPos[i * 3 + 2] += debrisVel[i * 3 + 2] * delta;
        debrisVel[i * 3 + 1] -= 12 * delta;
      }
      debrisRef.current.geometry.attributes.position.needsUpdate = true;
    }

    if (t > 1.0) {
      isActive.current = false;
    }
  });

  return (
    <>
      <mesh ref={ringRef} rotation={[-Math.PI / 2, 0, 0]} visible={false}>
        <ringGeometry args={[0.8, 1.0, 32]} />
        <meshStandardMaterial
          color="#ffaa44"
          emissive="#ff6600"
          emissiveIntensity={2}
          map={ringTex}
          transparent
          opacity={1}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>
      <points ref={debrisRef}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[debrisPos, 3]} />
          <bufferAttribute attach="attributes-color" args={[debrisCol, 3]} />
        </bufferGeometry>
        <pointsMaterial
          map={dustTex}
          size={0.3}
          transparent
          vertexColors
          sizeAttenuation
          depthWrite={false}
          opacity={0.9}
        />
      </points>
    </>
  );
}

export function TatsumakiWind({ position, active }: SkillEffectProps) {
  const COUNT = 50;
  const pointsRef = useRef<THREE.Points>(null);
  const timeRef = useRef(0);
  const prevActive = useRef(false);
  const isActive = useRef(false);
  const flowTex = useTexture(VFX_TEXTURES.flow);

  const { positions, velocities, lifetimes, colors } = useMemo(() => {
    const positions = new Float32Array(COUNT * 3);
    const velocities = new Float32Array(COUNT * 3);
    const lifetimes = new Float32Array(COUNT);
    const colors = new Float32Array(COUNT * 3);
    for (let i = 0; i < COUNT; i++) lifetimes[i] = -1;
    return { positions, velocities, lifetimes, colors };
  }, []);

  useFrame((_, delta) => {
    if (!pointsRef.current) return;

    if (active && !prevActive.current) {
      isActive.current = true;
      timeRef.current = 0;
    }
    prevActive.current = active;

    if (!isActive.current) {
      (pointsRef.current.material as THREE.PointsMaterial).opacity = 0;
      return;
    }

    timeRef.current += delta;
    const t = timeRef.current;

    for (let i = 0; i < COUNT; i++) {
      lifetimes[i] -= delta;
      if (lifetimes[i] <= 0) {
        const angle = t * 8 + (i / COUNT) * Math.PI * 2;
        const radius = 0.8 + Math.random() * 1.5;
        const h = Math.random() * 2.5;
        positions[i * 3] = position[0] + Math.cos(angle) * radius;
        positions[i * 3 + 1] = position[1] + h;
        positions[i * 3 + 2] = position[2] + Math.sin(angle) * radius;
        velocities[i * 3] = -Math.sin(angle) * 4;
        velocities[i * 3 + 1] = 1 + Math.random() * 2;
        velocities[i * 3 + 2] = Math.cos(angle) * 4;
        lifetimes[i] = 0.3 + Math.random() * 0.3;
        colors[i * 3] = 0.6 + Math.random() * 0.3;
        colors[i * 3 + 1] = 0.8 + Math.random() * 0.2;
        colors[i * 3 + 2] = 1.0;
      } else {
        positions[i * 3] += velocities[i * 3] * delta;
        positions[i * 3 + 1] += velocities[i * 3 + 1] * delta;
        positions[i * 3 + 2] += velocities[i * 3 + 2] * delta;
      }
    }

    const mat = pointsRef.current.material as THREE.PointsMaterial;
    mat.opacity = t < 0.8 ? 0.8 : Math.max(0, 0.8 - (t - 0.8) * 2);
    pointsRef.current.geometry.attributes.position.needsUpdate = true;
    pointsRef.current.geometry.attributes.color.needsUpdate = true;

    if (t > 1.0) isActive.current = false;
  });

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        <bufferAttribute attach="attributes-color" args={[colors, 3]} />
      </bufferGeometry>
      <pointsMaterial
        map={flowTex}
        size={0.25}
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

export function SwordBlasterBeam({ position, direction = [0, 0, -1], active }: SkillEffectProps) {
  const groupRef = useRef<THREE.Group>(null);
  const timeRef = useRef(0);
  const prevActive = useRef(false);
  const isActive = useRef(false);
  const startPos = useRef<[number, number, number]>([0, 0, 0]);
  const beamTex = useTexture(VFX_TEXTURES.beam);
  const flareTex = useTexture(VFX_TEXTURES.flare);

  useFrame((_, delta) => {
    if (!groupRef.current) return;

    if (active && !prevActive.current) {
      isActive.current = true;
      timeRef.current = 0;
      startPos.current = [...position];
    }
    prevActive.current = active;

    if (!isActive.current) {
      groupRef.current.visible = false;
      return;
    }

    groupRef.current.visible = true;
    timeRef.current += delta;
    const t = timeRef.current;
    const speed = 30;

    groupRef.current.position.set(
      startPos.current[0] + direction[0] * speed * t,
      startPos.current[1] + 1.2,
      startPos.current[2] + direction[2] * speed * t
    );

    groupRef.current.rotation.y = Math.atan2(direction[0], direction[2]);
    const slashAngle = t * 15;
    groupRef.current.rotation.z = slashAngle;

    const fade = Math.max(0, 1 - t * 1.5);
    groupRef.current.scale.set(1 + t * 2, fade, 1);

    if (t > 0.8) isActive.current = false;
  });

  return (
    <group ref={groupRef} visible={false}>
      <mesh>
        <planeGeometry args={[3.0, 0.15]} />
        <meshStandardMaterial
          color="#ffdd44"
          emissive="#ffaa00"
          emissiveIntensity={4}
          map={beamTex}
          transparent
          opacity={0.9}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>
      <mesh>
        <planeGeometry args={[3.5, 0.4]} />
        <meshStandardMaterial
          color="#ffff88"
          emissive="#ffdd44"
          emissiveIntensity={2}
          transparent
          opacity={0.3}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>
      <sprite scale={[1.2, 1.2, 1]}>
        <spriteMaterial map={flareTex} color="#ffdd44" transparent opacity={0.6} blending={THREE.AdditiveBlending} depthWrite={false} />
      </sprite>
      <pointLight color="#ffaa00" intensity={6} distance={8} />
    </group>
  );
}

export function DashTrail({ position, active }: SkillEffectProps) {
  const COUNT = 20;
  const pointsRef = useRef<THREE.Points>(null);
  const prevActive = useRef(false);
  const isActive = useRef(false);
  const timeRef = useRef(0);
  const trailTex = useTexture(VFX_TEXTURES.softCircle);

  const { positions, lifetimes, colors } = useMemo(() => {
    const positions = new Float32Array(COUNT * 3);
    const lifetimes = new Float32Array(COUNT);
    const colors = new Float32Array(COUNT * 3);
    for (let i = 0; i < COUNT; i++) lifetimes[i] = -1;
    return { positions, lifetimes, colors };
  }, []);

  useFrame((_, delta) => {
    if (!pointsRef.current) return;

    if (active && !prevActive.current) {
      isActive.current = true;
      timeRef.current = 0;
    }
    prevActive.current = active;

    if (!isActive.current) {
      (pointsRef.current.material as THREE.PointsMaterial).opacity = 0;
      return;
    }

    timeRef.current += delta;

    for (let i = COUNT - 1; i > 0; i--) {
      positions[i * 3] = positions[(i - 1) * 3];
      positions[i * 3 + 1] = positions[(i - 1) * 3 + 1];
      positions[i * 3 + 2] = positions[(i - 1) * 3 + 2];
      lifetimes[i] = lifetimes[i - 1] - delta * 3;
    }
    positions[0] = position[0];
    positions[1] = position[1] + 0.9;
    positions[2] = position[2];
    lifetimes[0] = 1.0;

    for (let i = 0; i < COUNT; i++) {
      const fade = Math.max(0, lifetimes[i]);
      colors[i * 3] = 0.4 + fade * 0.4;
      colors[i * 3 + 1] = 0.7 * fade;
      colors[i * 3 + 2] = 1.0 * fade;
    }

    const mat = pointsRef.current.material as THREE.PointsMaterial;
    mat.opacity = active ? 0.8 : Math.max(0, 0.8 - timeRef.current * 4);
    pointsRef.current.geometry.attributes.position.needsUpdate = true;
    pointsRef.current.geometry.attributes.color.needsUpdate = true;

    if (!active && timeRef.current > 0.5) isActive.current = false;
  });

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        <bufferAttribute attach="attributes-color" args={[colors, 3]} />
      </bufferGeometry>
      <pointsMaterial
        map={trailTex}
        size={0.4}
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

export function SpinSlashRing({ position, active }: SkillEffectProps) {
  const ringRef = useRef<THREE.Mesh>(null);
  const timeRef = useRef(0);
  const prevActive = useRef(false);
  const isActive = useRef(false);
  const ringTex = useTexture(VFX_TEXTURES.ring);

  useFrame((_, delta) => {
    if (!ringRef.current) return;

    if (active && !prevActive.current) {
      isActive.current = true;
      timeRef.current = 0;
    }
    prevActive.current = active;

    if (!isActive.current) {
      ringRef.current.visible = false;
      return;
    }

    ringRef.current.visible = true;
    timeRef.current += delta;
    const t = timeRef.current;

    ringRef.current.position.set(position[0], position[1] + 1.0, position[2]);
    ringRef.current.rotation.x = -Math.PI / 2;
    ringRef.current.rotation.z = t * 15;

    const scale = 1 + t * 3;
    ringRef.current.scale.set(scale, scale, 1);

    const mat = ringRef.current.material as THREE.MeshStandardMaterial;
    mat.opacity = Math.max(0, 1 - t * 1.8);

    if (t > 0.7) isActive.current = false;
  });

  return (
    <mesh ref={ringRef} visible={false}>
      <ringGeometry args={[0.6, 0.8, 32]} />
      <meshStandardMaterial
        color="#66ddff"
        emissive="#4488ff"
        emissiveIntensity={3}
        map={ringTex}
        transparent
        opacity={1}
        side={THREE.DoubleSide}
        depthWrite={false}
      />
    </mesh>
  );
}

export function WhirlwindVortex({ position, active }: SkillEffectProps) {
  const COUNT = 40;
  const pointsRef = useRef<THREE.Points>(null);
  const flowTex = useTexture(VFX_TEXTURES.flow);

  const { positions, colors } = useMemo(() => {
    const positions = new Float32Array(COUNT * 3);
    const colors = new Float32Array(COUNT * 3);
    return { positions, colors };
  }, []);

  useFrame((state) => {
    if (!pointsRef.current) return;

    const mat = pointsRef.current.material as THREE.PointsMaterial;
    if (!active) {
      mat.opacity = Math.max(0, (mat.opacity || 0) - 0.1);
      return;
    }
    mat.opacity = 0.7;

    const t = state.clock.elapsedTime;
    for (let i = 0; i < COUNT; i++) {
      const angle = t * 6 + (i / COUNT) * Math.PI * 2;
      const h = (i / COUNT) * 3;
      const radius = 0.5 + h * 0.4;
      positions[i * 3] = position[0] + Math.cos(angle) * radius;
      positions[i * 3 + 1] = position[1] + h;
      positions[i * 3 + 2] = position[2] + Math.sin(angle) * radius;

      const fade = 1 - h / 3;
      colors[i * 3] = 0.5 + fade * 0.3;
      colors[i * 3 + 1] = 0.7 + fade * 0.3;
      colors[i * 3 + 2] = 0.9;
    }

    pointsRef.current.geometry.attributes.position.needsUpdate = true;
    pointsRef.current.geometry.attributes.color.needsUpdate = true;
  });

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        <bufferAttribute attach="attributes-color" args={[colors, 3]} />
      </bufferGeometry>
      <pointsMaterial
        map={flowTex}
        size={0.3}
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

export function CriticalHitFlash({ position, active }: SkillEffectProps) {
  const COUNT = 24;
  const groupRef = useRef<THREE.Group>(null);
  const pointsRef = useRef<THREE.Points>(null);
  const prevActive = useRef(false);
  const isActive = useRef(false);
  const timeRef = useRef(0);
  const sparkleTex = useTexture(VFX_TEXTURES.sparkle);

  const { positions, velocities, lifetimes, colors } = useMemo(() => {
    const positions = new Float32Array(COUNT * 3);
    const velocities = new Float32Array(COUNT * 3);
    const lifetimes = new Float32Array(COUNT);
    const colors = new Float32Array(COUNT * 3);
    for (let i = 0; i < COUNT; i++) lifetimes[i] = -1;
    return { positions, velocities, lifetimes, colors };
  }, []);

  useFrame((_, delta) => {
    if (!groupRef.current || !pointsRef.current) return;

    if (active && !prevActive.current) {
      isActive.current = true;
      timeRef.current = 0;
      for (let i = 0; i < COUNT; i++) {
        const angle = (i / COUNT) * Math.PI * 2;
        positions[i * 3] = position[0];
        positions[i * 3 + 1] = position[1] + 1.2;
        positions[i * 3 + 2] = position[2];
        const speed = 6 + Math.random() * 8;
        velocities[i * 3] = Math.cos(angle) * speed;
        velocities[i * 3 + 1] = (Math.random() - 0.3) * speed * 0.5;
        velocities[i * 3 + 2] = Math.sin(angle) * speed;
        lifetimes[i] = 0.25 + Math.random() * 0.2;
        colors[i * 3] = 1.0;
        colors[i * 3 + 1] = 0.85 + Math.random() * 0.15;
        colors[i * 3 + 2] = 0.1 + Math.random() * 0.3;
      }
    }
    prevActive.current = active;

    if (!isActive.current) {
      groupRef.current.visible = false;
      return;
    }

    groupRef.current.visible = true;
    timeRef.current += delta;

    let allDead = true;
    for (let i = 0; i < COUNT; i++) {
      if (lifetimes[i] <= 0) continue;
      allDead = false;
      lifetimes[i] -= delta;
      positions[i * 3] += velocities[i * 3] * delta;
      positions[i * 3 + 1] += velocities[i * 3 + 1] * delta;
      positions[i * 3 + 2] += velocities[i * 3 + 2] * delta;
      velocities[i * 3] *= 0.92;
      velocities[i * 3 + 1] *= 0.92;
      velocities[i * 3 + 2] *= 0.92;
    }

    const mat = pointsRef.current.material as THREE.PointsMaterial;
    mat.opacity = allDead ? 0 : 1;
    pointsRef.current.geometry.attributes.position.needsUpdate = true;

    if (allDead) isActive.current = false;
  });

  return (
    <group ref={groupRef} visible={false}>
      <points ref={pointsRef}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[positions, 3]} />
          <bufferAttribute attach="attributes-color" args={[colors, 3]} />
        </bufferGeometry>
        <pointsMaterial
          map={sparkleTex}
          size={0.35}
          transparent
          vertexColors
          sizeAttenuation
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          opacity={0}
        />
      </points>
      <pointLight ref={(light) => {
        if (light && groupRef.current) light.position.set(position[0], position[1] + 1.2, position[2]);
      }} color="#ffdd00" intensity={isActive.current ? 10 : 0} distance={8} />
    </group>
  );
}

export function LevelUpEffect({ position, active }: SkillEffectProps) {
  const COUNT = 50;
  const pointsRef = useRef<THREE.Points>(null);
  const prevActive = useRef(false);
  const isActive = useRef(false);
  const timeRef = useRef(0);
  const starTex = useTexture(VFX_TEXTURES.star);

  const { positions, velocities, lifetimes, colors } = useMemo(() => {
    const positions = new Float32Array(COUNT * 3);
    const velocities = new Float32Array(COUNT * 3);
    const lifetimes = new Float32Array(COUNT);
    const colors = new Float32Array(COUNT * 3);
    for (let i = 0; i < COUNT; i++) lifetimes[i] = -1;
    return { positions, velocities, lifetimes, colors };
  }, []);

  useFrame((_, delta) => {
    if (!pointsRef.current) return;

    if (active && !prevActive.current) {
      isActive.current = true;
      timeRef.current = 0;
      for (let i = 0; i < COUNT; i++) {
        const angle = (i / COUNT) * Math.PI * 2;
        const r = 0.3 + Math.random() * 0.5;
        positions[i * 3] = position[0] + Math.cos(angle) * r;
        positions[i * 3 + 1] = position[1];
        positions[i * 3 + 2] = position[2] + Math.sin(angle) * r;
        velocities[i * 3] = Math.cos(angle) * (1 + Math.random() * 2);
        velocities[i * 3 + 1] = 4 + Math.random() * 4;
        velocities[i * 3 + 2] = Math.sin(angle) * (1 + Math.random() * 2);
        lifetimes[i] = 0.8 + Math.random() * 0.6;
        const gold = Math.random();
        colors[i * 3] = 1.0;
        colors[i * 3 + 1] = 0.8 + gold * 0.2;
        colors[i * 3 + 2] = 0.2 * gold;
      }
    }
    prevActive.current = active;

    if (!isActive.current) {
      (pointsRef.current.material as THREE.PointsMaterial).opacity = 0;
      return;
    }

    timeRef.current += delta;
    let allDead = true;
    for (let i = 0; i < COUNT; i++) {
      if (lifetimes[i] <= 0) continue;
      allDead = false;
      lifetimes[i] -= delta;
      positions[i * 3] += velocities[i * 3] * delta;
      positions[i * 3 + 1] += velocities[i * 3 + 1] * delta;
      positions[i * 3 + 2] += velocities[i * 3 + 2] * delta;
      velocities[i * 3 + 1] -= 3 * delta;
    }

    const mat = pointsRef.current.material as THREE.PointsMaterial;
    mat.opacity = allDead ? 0 : 0.9;
    pointsRef.current.geometry.attributes.position.needsUpdate = true;

    if (allDead) isActive.current = false;
  });

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        <bufferAttribute attach="attributes-color" args={[colors, 3]} />
      </bufferGeometry>
      <pointsMaterial
        map={starTex}
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

export function MeleeSlashEffect({ position, direction = [0, 0, -1], active }: SkillEffectProps) {
  const ARC_POINTS = 24;
  const groupRef = useRef<THREE.Group>(null);
  const meshRef = useRef<THREE.Mesh>(null);
  const timeRef = useRef(0);
  const prevActive = useRef(false);
  const isActive = useRef(false);
  const startAngle = useRef(0);
  const slashTex = useTexture(VFX_TEXTURES.slash);

  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    const positions = new Float32Array(ARC_POINTS * 2 * 3);
    const uvs = new Float32Array(ARC_POINTS * 2 * 2);
    const indices: number[] = [];
    for (let i = 0; i < ARC_POINTS; i++) {
      const u = i / (ARC_POINTS - 1);
      uvs[i * 4] = u;
      uvs[i * 4 + 1] = 0;
      uvs[i * 4 + 2] = u;
      uvs[i * 4 + 3] = 1;
      if (i < ARC_POINTS - 1) {
        const a = i * 2;
        indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
      }
    }
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geo.setAttribute("uv", new THREE.BufferAttribute(uvs, 2));
    geo.setIndex(indices);
    return geo;
  }, []);

  useFrame((_, delta) => {
    if (!groupRef.current || !meshRef.current) return;

    if (active && !prevActive.current) {
      isActive.current = true;
      timeRef.current = 0;
      startAngle.current = Math.atan2(direction[0], direction[2]);
    }
    prevActive.current = active;

    if (!isActive.current) {
      groupRef.current.visible = false;
      return;
    }

    groupRef.current.visible = true;
    timeRef.current += delta;
    const t = timeRef.current;
    const duration = 0.35;
    const progress = Math.min(t / duration, 1);

    const sweepAngle = Math.PI * 0.8;
    const innerRadius = 0.4;
    const outerRadius = 1.8;
    const heightOffset = 1.0;

    const posAttr = geometry.getAttribute("position") as THREE.BufferAttribute;
    const arr = posAttr.array as Float32Array;

    for (let i = 0; i < ARC_POINTS; i++) {
      const frac = i / (ARC_POINTS - 1);
      const visibleFrac = Math.min(frac / Math.max(progress, 0.01), 1);
      if (visibleFrac > 1) {
        arr[i * 6] = 0; arr[i * 6 + 1] = 0; arr[i * 6 + 2] = 0;
        arr[i * 6 + 3] = 0; arr[i * 6 + 4] = 0; arr[i * 6 + 5] = 0;
        continue;
      }
      const angle = startAngle.current + (frac - 0.5) * sweepAngle;
      const cosA = Math.cos(angle);
      const sinA = Math.sin(angle);

      arr[i * 6] = position[0] + sinA * innerRadius;
      arr[i * 6 + 1] = position[1] + heightOffset;
      arr[i * 6 + 2] = position[2] + cosA * innerRadius;

      arr[i * 6 + 3] = position[0] + sinA * outerRadius;
      arr[i * 6 + 4] = position[1] + heightOffset + 0.3;
      arr[i * 6 + 5] = position[2] + cosA * outerRadius;
    }
    posAttr.needsUpdate = true;

    const mat = meshRef.current.material as THREE.MeshStandardMaterial;
    mat.opacity = Math.max(0, 1 - progress * progress) * 0.8;

    if (t > duration + 0.05) isActive.current = false;
  });

  return (
    <group ref={groupRef} visible={false}>
      <mesh ref={meshRef} geometry={geometry}>
        <meshStandardMaterial
          color="#aaddff"
          emissive="#66aaff"
          emissiveIntensity={3}
          map={slashTex}
          alphaMap={slashTex}
          transparent
          opacity={0.8}
          side={THREE.DoubleSide}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
    </group>
  );
}

/**
 * Sword charge tier-up flash. Port of the reference game's `SwordBlink.js`:
 * a brief additive cross + shard burst telegraphing that the held charge
 * has reached the next rung. Anchored to the right-hand bone via the
 * `anchor` ref so the flash follows the sword as it moves. `seq` is bumped
 * by the caller every time a tier-up fires so re-renders re-trigger the
 * burst even when `tier` matches the previous value.
 */
export function SwordBlinkFlash({
  anchor,
  tier,
  seq,
}: {
  anchor: React.RefObject<THREE.Object3D | null>;
  tier: 1 | 2;
  seq: number;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const timeRef = useRef(0);
  const isActive = useRef(false);
  const tierRef = useRef<1 | 2>(tier);
  // Initialize the seq mirror to the incoming seq so the very first
  // effect run is treated as the baseline (no auto-blink on mount).
  // Subsequent updates that bump seq fire the burst.
  const seqRef = useRef(seq);
  const sparkleTex = useTexture(VFX_TEXTURES.sparkle);
  const flareTex = useTexture(VFX_TEXTURES.flare);

  useEffect(() => {
    if (seq !== seqRef.current) {
      seqRef.current = seq;
      isActive.current = true;
      timeRef.current = 0;
      tierRef.current = tier;
    }
  }, [seq, tier]);

  useFrame((_, delta) => {
    const grp = groupRef.current;
    if (!grp) return;
    if (!isActive.current) {
      grp.visible = false;
      return;
    }
    if (anchor.current) {
      anchor.current.getWorldPosition(grp.position);
    }
    grp.visible = true;
    timeRef.current += delta;
    const t = timeRef.current;
    const dur = tierRef.current === 2 ? 0.35 : 0.25;
    const p = Math.min(t / dur, 1);
    const peak = tierRef.current === 2 ? 2.4 : 1.4;
    const scale = 0.3 + p * peak;
    grp.scale.setScalar(scale);
    const opacity = (1 - p) * 0.95;
    const lightIntensity = (1 - p) * (tierRef.current === 2 ? 6 : 3);
    grp.children.forEach((child) => {
      if (child instanceof THREE.Sprite) {
        const mat = child.material as THREE.SpriteMaterial;
        mat.opacity = opacity;
      } else if (child instanceof THREE.PointLight) {
        child.intensity = lightIntensity;
      }
    });
    grp.rotation.z += delta * 8;
    if (t > dur) isActive.current = false;
  });

  const color = tier === 2 ? '#ffcc44' : '#88ccff';
  const emissive = tier === 2 ? '#ffaa00' : '#4488ff';

  return (
    <group ref={groupRef} visible={false}>
      <sprite scale={[1.4, 0.18, 1]}>
        <spriteMaterial
          map={sparkleTex}
          color={color}
          transparent
          opacity={0.9}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </sprite>
      <sprite scale={[0.18, 1.4, 1]}>
        <spriteMaterial
          map={sparkleTex}
          color={color}
          transparent
          opacity={0.9}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </sprite>
      <sprite scale={[0.7, 0.7, 1]}>
        <spriteMaterial
          map={flareTex}
          color={emissive}
          transparent
          opacity={0.8}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </sprite>
      <pointLight color={emissive} intensity={tier === 2 ? 6 : 3} distance={3} />
    </group>
  );
}

/**
 * Brief radial shockwave burst spawned at the impact point of a charge
 * release (chargeStrike landing). Lighter and shorter than
 * `EarthquakeShockwave` — a single expanding ring + a quick dust kick to
 * sell the weight of the hit without stealing the screen for half a
 * second. `seq` should be bumped by the caller for every fresh impact so
 * the effect re-arms even when the position hasn't changed.
 */
interface ChargeImpactShockwaveProps {
  position: [number, number, number];
  seq: number;
}

export function ChargeImpactShockwave({
  position,
  seq,
}: ChargeImpactShockwaveProps) {
  const ringRef = useRef<THREE.Mesh>(null);
  const dustRef = useRef<THREE.Points>(null);
  const groupRef = useRef<THREE.Group>(null);
  const timeRef = useRef(0);
  const isActive = useRef(false);
  const seqRef = useRef(seq);
  const ringTex = useTexture(VFX_TEXTURES.ring);
  const dustTex = useTexture(VFX_TEXTURES.dust);

  const COUNT = 24;
  const { positions, velocities, lifetimes, colors } = useMemo(() => {
    const positions = new Float32Array(COUNT * 3);
    const velocities = new Float32Array(COUNT * 3);
    const lifetimes = new Float32Array(COUNT);
    const colors = new Float32Array(COUNT * 3);
    for (let i = 0; i < COUNT; i++) lifetimes[i] = -1;
    return { positions, velocities, lifetimes, colors };
  }, []);

  useEffect(() => {
    if (seq === seqRef.current) return;
    seqRef.current = seq;
    isActive.current = true;
    timeRef.current = 0;
    for (let i = 0; i < COUNT; i++) {
      const angle = (i / COUNT) * Math.PI * 2 + Math.random() * 0.2;
      const speed = 4 + Math.random() * 3;
      positions[i * 3] = position[0];
      positions[i * 3 + 1] = position[1] + 0.15;
      positions[i * 3 + 2] = position[2];
      velocities[i * 3] = Math.cos(angle) * speed;
      velocities[i * 3 + 1] = 1.5 + Math.random() * 1.5;
      velocities[i * 3 + 2] = Math.sin(angle) * speed;
      lifetimes[i] = 0.35 + Math.random() * 0.2;
      const grey = 0.55 + Math.random() * 0.25;
      colors[i * 3] = grey;
      colors[i * 3 + 1] = grey * 0.95;
      colors[i * 3 + 2] = grey * 0.85;
    }
    // Intentionally only key off `seq` — `position` is sampled from refs at
    // the moment the burst fires; including it would re-init every frame
    // when callers pass a fresh tuple.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seq]);

  useFrame((_, delta) => {
    if (!groupRef.current) return;
    if (!isActive.current) {
      groupRef.current.visible = false;
      return;
    }
    groupRef.current.visible = true;
    timeRef.current += delta;
    const t = timeRef.current;
    const DUR = 0.45;

    if (ringRef.current) {
      ringRef.current.position.set(position[0], position[1] + 0.05, position[2]);
      const radius = 0.4 + t * 7;
      ringRef.current.scale.set(radius, 1, radius);
      const mat = ringRef.current.material as THREE.MeshStandardMaterial;
      mat.opacity = Math.max(0, 1 - t / DUR);
    }

    if (dustRef.current) {
      for (let i = 0; i < COUNT; i++) {
        if (lifetimes[i] <= 0) continue;
        lifetimes[i] -= delta;
        positions[i * 3] += velocities[i * 3] * delta;
        positions[i * 3 + 1] += velocities[i * 3 + 1] * delta;
        positions[i * 3 + 2] += velocities[i * 3 + 2] * delta;
        velocities[i * 3] *= 0.9;
        velocities[i * 3 + 2] *= 0.9;
        velocities[i * 3 + 1] -= 6 * delta;
      }
      dustRef.current.geometry.attributes.position.needsUpdate = true;
      const dustMat = dustRef.current.material as THREE.PointsMaterial;
      dustMat.opacity = Math.max(0, 1 - t / DUR);
    }

    if (t > DUR) {
      isActive.current = false;
    }
  });

  return (
    <group ref={groupRef} visible={false}>
      <mesh ref={ringRef} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.85, 1.0, 32]} />
        <meshStandardMaterial
          color="#ffe2a8"
          emissive="#ffaa44"
          emissiveIntensity={2.2}
          map={ringTex}
          transparent
          opacity={1}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>
      <points ref={dustRef}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[positions, 3]} />
          <bufferAttribute attach="attributes-color" args={[colors, 3]} />
        </bufferGeometry>
        <pointsMaterial
          map={dustTex}
          size={0.45}
          transparent
          vertexColors
          sizeAttenuation
          depthWrite={false}
          opacity={1}
        />
      </points>
    </group>
  );
}
