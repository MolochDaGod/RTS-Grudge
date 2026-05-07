import { useRef, useMemo, useState, useEffect } from "react";
import { useFrame } from "@react-three/fiber";
import { useTexture } from "@react-three/drei";
import * as THREE from "three";
import { SPELL_MODELS, getArrowModel } from "../systems/ModelRegistry";
import { VFX_TEXTURES } from "./SkillEffects";
import { useAsset } from "../hooks/useAsset";
import { loadAsset } from "../systems/AssetLoader";
import {
  tryReboundProjectile,
  tryReboundProjectileHit,
  type ProjectileTeam,
} from "../state/blockGuard";
import { useGame } from "@/lib/stores/useGame";
import { useSurvival } from "@/lib/stores/useSurvival";
import { useEnemyManager } from "../systems/EnemyManager";
import { useCombatLog } from "@/lib/stores/useCombatLog";
import { useAudio } from "@/lib/stores/useAudio";

/**
 * Default damage applied to an enemy when a successfully blocked projectile
 * lands on them. Slightly tuned per projectile-class to roughly mirror their
 * source skill damage with a small parry bonus — see
 * `client/src/game/machines/combatMachine.ts > DAMAGE_STATES`.
 */
const REBOUND_DAMAGE_FIREBALL = 18;
const REBOUND_DAMAGE_BULLET = 14;
const REBOUND_DAMAGE_MAGIC_MISSILE = 14;

/**
 * `team` and `rebounded` are the rebound primitive (see
 * `client/src/game/state/blockGuard.ts`). Only "Hadouken-class" linear
 * projectiles below opt into the deflect-on-block loop — purely
 * gravity-driven shots (rocks, arrows in flight) stay one-way for now.
 *
 * `onBlock` fires on the single frame the rebound is triggered so callers can
 * spawn block VFX / SFX / award parry meter without having to re-poll the
 * projectile.
 */
interface ProjectileProps {
  position: [number, number, number];
  direction?: [number, number, number];
  active: boolean;
  color?: string;
  arrowModelId?: string | null;
  team?: ProjectileTeam;
  rebounded?: boolean;
  onBlock?: (info: { position: [number, number, number] }) => void;
  /**
   * Fires the frame a rebounded projectile lands a hit on an enemy. Lets the
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
   * When `team="enemy"` (or any non-player team) and `damage > 0`, the
   * projectile applies this damage to the player on impact and self-
   * deactivates. Player-side casts leave this at 0 because they damage enemies
   * via separate melee/spell systems, not the projectile component itself.
   */
  damage?: number;
  /**
   * Optional id of the enemy that fired this projectile. Used to keep a
   * rebounded shot from popping the caster the instant it flips sides — see
   * `tryReboundProjectileHit` in `blockGuard.ts`.
   */
  casterId?: string;
}

interface SpellProjectileProps {
  position: [number, number, number];
  direction?: [number, number, number];
  active: boolean;
  color?: string;
  team?: ProjectileTeam;
  rebounded?: boolean;
  onBlock?: (info: { position: [number, number, number] }) => void;
  onReboundHit?: (info: {
    position: [number, number, number];
    enemyId: string;
    damage: number;
    killed: boolean;
  }) => void;
  damage?: number;
  casterId?: string;
}

/**
 * Shared player-impact check for the four blockable projectile components
 * when used with `team="enemy"`. Returns true if the shot just hit the
 * player and the caller should deactivate the projectile.
 *
 * Kept in this file so the four projectile components stay self-contained,
 * and intentionally simple: 2D distance on the floor plane (matching how
 * `EnemyHadoukenProjectile` checks player hits) so projectile/player y
 * mismatches don't cause shots to phase through.
 */
function tryEnemyProjectileHitPlayer(
  teamRef: { current: ProjectileTeam },
  damage: number,
  px: number,
  pz: number,
  hitRadius: number = 1.0,
): boolean {
  if (teamRef.current !== "enemy" || damage <= 0) return false;
  const playerPos = useGame.getState().playerPosition;
  if (!playerPos) return false;
  const dx = px - playerPos.x;
  const dz = pz - playerPos.z;
  if (dx * dx + dz * dz > hitRadius * hitRadius) return false;
  useSurvival.getState().takeDamage(damage, "blade");
  useCombatLog.getState().addEntry(
    `An energy bolt strikes you for ${damage} damage!`,
    "#ff6b6b",
  );
  // Audible cue so the player feels the hit instead of only seeing the
  // combat-log line. Reuses the same playHit() ping that fires when the
  // player lands a melee hit / parries a projectile, keeping impact SFX
  // consistent across the game.
  try { useAudio.getState().playHit(); } catch {}
  // Visual cue (red vignette pulse) is now fired centrally from
  // `useSurvival.takeDamage`, so every damage source — projectile,
  // melee, trap, fall, status — pulses the HUD without each call site
  // having to remember to do it. See DamageFlashOverlay in HUD.tsx.
  return true;
}

function useSpellModel(spellId: string) {
  const entry = SPELL_MODELS.find((s) => s.id === spellId);
  const gltf = useAsset(entry?.path || SPELL_MODELS[0].path);
  return { scene: gltf.scene, entry };
}

export function FireballProjectile({
  position,
  direction = [0, 0, -1],
  active,
  team = "player",
  rebounded = false,
  onBlock,
  onReboundHit,
  damage = 0,
  casterId,
}: SpellProjectileProps) {
  const groupRef = useRef<THREE.Group>(null);
  const timeRef = useRef(0);
  const prevActive = useRef(false);
  const isActive = useRef(false);
  const startPos = useRef<[number, number, number]>([0, 0, 0]);
  // Mutable trajectory state for the rebound primitive — see blockGuard.ts.
  const dirRef = useRef<[number, number, number]>([direction[0], direction[1], direction[2]]);
  const teamRef = useRef<ProjectileTeam>(team);
  const reboundedRef = useRef<boolean>(rebounded);
  const { scene, entry } = useSpellModel("spell_fireball");
  const flameTex = useTexture(VFX_TEXTURES.flame);

  const clonedScene = useMemo(() => {
    const clone = scene.clone(true);
    clone.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        const mat = (mesh.material as THREE.MeshStandardMaterial).clone();
        mat.emissive = new THREE.Color("#ff4400");
        mat.emissiveIntensity = 2;
        mesh.material = mat;
      }
    });
    clone.scale.setScalar(entry?.defaultScale || 0.5);
    return clone;
  }, [scene, entry]);

  const trailData = useMemo(() => {
    const COUNT = 30;
    const positions = new Float32Array(COUNT * 3);
    const colors = new Float32Array(COUNT * 3);
    for (let i = 0; i < COUNT; i++) {
      positions[i * 3] = 0;
      positions[i * 3 + 1] = -999;
      positions[i * 3 + 2] = 0;
    }
    return { positions, colors, COUNT };
  }, []);

  useFrame((_, delta) => {
    if (!groupRef.current) return;

    if (active && !prevActive.current) {
      isActive.current = true;
      timeRef.current = 0;
      startPos.current = [...position];
      // Re-arm the rebound primitive on every fresh activation so a recycled
      // component doesn't carry over a "deflected" flag from the previous shot.
      dirRef.current = [direction[0], direction[1], direction[2]];
      teamRef.current = team;
      reboundedRef.current = rebounded;
    }
    prevActive.current = active;

    if (!isActive.current) {
      groupRef.current.visible = false;
      return;
    }

    groupRef.current.visible = true;
    timeRef.current += delta;
    const t = timeRef.current;
    const speed = 20;
    const dir = dirRef.current;
    const px = startPos.current[0] + dir[0] * speed * t;
    const py = startPos.current[1] + 1.2;
    const pz = startPos.current[2] + dir[2] * speed * t;

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

    // After a successful rebound the fireball is travelling back toward the
    // original caster's team — test for an enemy under it each frame so the
    // parry actually deals damage on the way through.
    const reboundHit = tryReboundProjectileHit(
      { teamRef, reboundedRef, dirRef, startPosRef: startPos, timeRef },
      px,
      py,
      pz,
      REBOUND_DAMAGE_FIREBALL,
      1.2,
      casterId,
    );
    if (reboundHit) {
      onReboundHit?.(reboundHit);
      isActive.current = false;
      groupRef.current.visible = false;
      return;
    }

    // Enemy-cast fireballs damage the player on impact (player casts use
    // damage=0 and rely on a separate damage path).
    if (tryEnemyProjectileHitPlayer(teamRef, damage, px, pz, 1.0)) {
      isActive.current = false;
      groupRef.current.visible = false;
      return;
    }

    groupRef.current.position.set(px, py, pz);
    groupRef.current.rotation.y =
      Math.atan2(dirRef.current[0], dirRef.current[2]) + t * 6;

    const pulse = 1 + Math.sin(t * 15) * 0.2;
    const scale = entry?.defaultScale || 0.5;
    clonedScene.scale.setScalar(scale * pulse);

    for (let i = trailData.COUNT - 1; i > 0; i--) {
      trailData.positions[i * 3] = trailData.positions[(i - 1) * 3];
      trailData.positions[i * 3 + 1] = trailData.positions[(i - 1) * 3 + 1];
      trailData.positions[i * 3 + 2] = trailData.positions[(i - 1) * 3 + 2];
      const fade = 1 - i / trailData.COUNT;
      trailData.colors[i * 3] = 1.0;
      trailData.colors[i * 3 + 1] = 0.3 * fade;
      trailData.colors[i * 3 + 2] = 0.0;
    }
    trailData.positions[0] = px;
    trailData.positions[1] = py;
    trailData.positions[2] = pz;
    trailData.colors[0] = 1.0;
    trailData.colors[1] = 0.6;
    trailData.colors[2] = 0.1;

    if (t > 1.5) isActive.current = false;
  });

  return (
    <group ref={groupRef} visible={false}>
      <primitive object={clonedScene} />
      <pointLight color="#ff4400" intensity={6} distance={8} />
      <points>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            args={[trailData.positions, 3]}
          />
          <bufferAttribute
            attach="attributes-color"
            args={[trailData.colors, 3]}
          />
        </bufferGeometry>
        <pointsMaterial
          map={flameTex}
          size={0.5}
          transparent
          vertexColors
          sizeAttenuation
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          opacity={0.8}
        />
      </points>
    </group>
  );
}

export function IceLanceProjectile({
  position,
  direction = [0, 0, -1],
  active,
}: SpellProjectileProps) {
  const groupRef = useRef<THREE.Group>(null);
  const timeRef = useRef(0);
  const prevActive = useRef(false);
  const isActive = useRef(false);
  const startPos = useRef<[number, number, number]>([0, 0, 0]);
  const { scene, entry } = useSpellModel("spell_ice_lance");
  const sparkTex = useTexture(VFX_TEXTURES.spark);

  const clonedScene = useMemo(() => {
    const clone = scene.clone(true);
    clone.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        const mat = (mesh.material as THREE.MeshStandardMaterial).clone();
        mat.color = new THREE.Color("#88ddff");
        mat.emissive = new THREE.Color("#4488ff");
        mat.emissiveIntensity = 1.5;
        mat.transparent = true;
        mat.opacity = 0.8;
        mesh.material = mat;
      }
    });
    clone.scale.setScalar(entry?.defaultScale || 0.5);
    return clone;
  }, [scene, entry]);

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
    const speed = 28;
    const px = startPos.current[0] + direction[0] * speed * t;
    const py = startPos.current[1] + 1.2;
    const pz = startPos.current[2] + direction[2] * speed * t;

    groupRef.current.position.set(px, py, pz);
    groupRef.current.rotation.y = Math.atan2(direction[0], direction[2]);
    groupRef.current.rotation.x = Math.PI * 0.1;

    if (t > 1.2) isActive.current = false;
  });

  return (
    <group ref={groupRef} visible={false}>
      <primitive object={clonedScene} />
      <pointLight color="#4488ff" intensity={5} distance={6} />
      <sprite scale={[1.2, 1.2, 1]}>
        <spriteMaterial
          map={sparkTex}
          color="#88ddff"
          transparent
          opacity={0.5}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </sprite>
    </group>
  );
}

export function RockProjectile({
  position,
  direction = [0, 0, -1],
  active,
}: SpellProjectileProps) {
  const groupRef = useRef<THREE.Group>(null);
  const timeRef = useRef(0);
  const prevActive = useRef(false);
  const isActive = useRef(false);
  const startPos = useRef<[number, number, number]>([0, 0, 0]);
  const { scene, entry } = useSpellModel("spell_rock");
  const dustTex = useTexture(VFX_TEXTURES.dust);

  const clonedScene = useMemo(() => {
    const clone = scene.clone(true);
    clone.scale.setScalar(entry?.defaultScale || 0.4);
    return clone;
  }, [scene, entry]);

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
    const speed = 18;
    const px = startPos.current[0] + direction[0] * speed * t;
    const py = startPos.current[1] + 1.5 + 2 * t - 5 * t * t;
    const pz = startPos.current[2] + direction[2] * speed * t;

    groupRef.current.position.set(px, Math.max(0.2, py), pz);
    groupRef.current.rotation.x += delta * 8;
    groupRef.current.rotation.z += delta * 5;

    if (t > 1.0 || py < 0) isActive.current = false;
  });

  return (
    <group ref={groupRef} visible={false}>
      <primitive object={clonedScene} />
      <sprite scale={[0.8, 0.8, 1]} position={[0, -0.2, 0]}>
        <spriteMaterial
          map={dustTex}
          color="#886644"
          transparent
          opacity={0.3}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </sprite>
    </group>
  );
}

export function RootAOE({
  position,
  active,
}: SpellProjectileProps) {
  const groupRef = useRef<THREE.Group>(null);
  const timeRef = useRef(0);
  const prevActive = useRef(false);
  const isActive = useRef(false);
  const { scene, entry } = useSpellModel("spell_root");

  const clonedScene = useMemo(() => {
    const clone = scene.clone(true);
    clone.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        const mat = (mesh.material as THREE.MeshStandardMaterial).clone();
        mat.emissive = new THREE.Color("#226622");
        mat.emissiveIntensity = 0.5;
        mesh.material = mat;
      }
    });
    clone.scale.setScalar(0);
    return clone;
  }, [scene, entry]);

  useFrame((_, delta) => {
    if (!groupRef.current) return;

    if (active && !prevActive.current) {
      isActive.current = true;
      timeRef.current = 0;
    }
    prevActive.current = active;

    if (!isActive.current) {
      groupRef.current.visible = false;
      return;
    }

    groupRef.current.visible = true;
    timeRef.current += delta;
    const t = timeRef.current;
    const duration = 2.0;

    groupRef.current.position.set(position[0], position[1], position[2]);

    const growT = Math.min(t / 0.5, 1);
    const targetScale = entry?.defaultScale || 0.6;
    clonedScene.scale.setScalar(targetScale * growT);

    if (t > duration) {
      const fadeT = (t - duration) / 0.5;
      clonedScene.scale.setScalar(targetScale * Math.max(0, 1 - fadeT));
      if (fadeT > 1) isActive.current = false;
    }
  });

  return (
    <group ref={groupRef} visible={false}>
      <primitive object={clonedScene} />
      <pointLight
        color="#44aa44"
        intensity={isActive.current ? 4 : 0}
        distance={6}
        position={[position[0], position[1] + 1, position[2]]}
      />
    </group>
  );
}

export function DistortionAOE({
  position,
  active,
}: SpellProjectileProps) {
  const groupRef = useRef<THREE.Group>(null);
  const timeRef = useRef(0);
  const prevActive = useRef(false);
  const isActive = useRef(false);
  const { scene, entry } = useSpellModel("spell_distortion");
  const noiseTex = useTexture(VFX_TEXTURES.noise);

  const clonedScene = useMemo(() => {
    const clone = scene.clone(true);
    clone.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        const mat = (mesh.material as THREE.MeshStandardMaterial).clone();
        mat.color = new THREE.Color("#9944cc");
        mat.emissive = new THREE.Color("#6622aa");
        mat.emissiveIntensity = 2;
        mat.transparent = true;
        mat.opacity = 0.6;
        mesh.material = mat;
      }
    });
    clone.scale.setScalar(0);
    return clone;
  }, [scene, entry]);

  useFrame((_, delta) => {
    if (!groupRef.current) return;

    if (active && !prevActive.current) {
      isActive.current = true;
      timeRef.current = 0;
    }
    prevActive.current = active;

    if (!isActive.current) {
      groupRef.current.visible = false;
      return;
    }

    groupRef.current.visible = true;
    timeRef.current += delta;
    const t = timeRef.current;

    groupRef.current.position.set(position[0], position[1] + 0.5, position[2]);
    groupRef.current.rotation.y += delta * 3;

    const scale = (entry?.defaultScale || 0.8) * Math.min(t * 3, 1);
    clonedScene.scale.setScalar(scale * (1 + Math.sin(t * 10) * 0.1));

    if (t > 1.5) isActive.current = false;
  });

  return (
    <group ref={groupRef} visible={false}>
      <primitive object={clonedScene} />
      <pointLight
        color="#9944cc"
        intensity={isActive.current ? 6 : 0}
        distance={8}
      />
      <sprite scale={[2, 2, 1]}>
        <spriteMaterial
          map={noiseTex}
          color="#6622aa"
          transparent
          opacity={0.2}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </sprite>
    </group>
  );
}


export function ArrowProjectile({
  position,
  direction = [0, 0, -1],
  active,
  arrowModelId,
}: ProjectileProps) {
  const groupRef = useRef<THREE.Group>(null);
  const timeRef = useRef(0);
  const prevActive = useRef(false);
  const isActive = useRef(false);
  const startPos = useRef<[number, number, number]>([0, 0, 0]);
  const trailTex = useTexture(VFX_TEXTURES.trail);

  // Procedural fallback arrow (used when no GLB is selected, or while the
  // selected GLB is still loading). Tip points toward -Z and the shaft spans
  // ~1.0m end-to-end; any GLB swap-in must match this orientation/length so
  // the per-frame yaw/pitch math below stays correct.
  const proceduralArrow = useMemo(() => {
    const grp = new THREE.Group();
    const shaftGeo = new THREE.CylinderGeometry(0.015, 0.015, 1.0, 6);
    const shaftMat = new THREE.MeshStandardMaterial({ color: "#8b6914", roughness: 0.7 });
    const shaft = new THREE.Mesh(shaftGeo, shaftMat);
    shaft.rotation.x = Math.PI / 2;
    grp.add(shaft);
    const headGeo = new THREE.ConeGeometry(0.04, 0.12, 4);
    const headMat = new THREE.MeshStandardMaterial({ color: "#aaa", metalness: 0.8, roughness: 0.2 });
    const head = new THREE.Mesh(headGeo, headMat);
    head.rotation.x = -Math.PI / 2;
    head.position.z = -0.56;
    grp.add(head);
    const fletchGeo = new THREE.PlaneGeometry(0.06, 0.15);
    const fletchMat = new THREE.MeshStandardMaterial({ color: "#cc4444", side: THREE.DoubleSide });
    for (let i = 0; i < 3; i++) {
      const fletch = new THREE.Mesh(fletchGeo, fletchMat);
      fletch.position.z = 0.42;
      fletch.rotation.z = (i / 3) * Math.PI;
      grp.add(fletch);
    }
    return grp;
  }, []);

  const [glbArrow, setGlbArrow] = useState<THREE.Group | null>(null);

  useEffect(() => {
    const entry = getArrowModel(arrowModelId);
    if (!entry) { setGlbArrow(null); return; }
    let cancelled = false;
    loadAsset(entry.path, "medium", "arrow_projectile").then((gltf) => {
      if (cancelled) return;
      // Wrap so we can normalise size + orientation without mutating the
      // shared GLB scene held by the loader cache.
      const wrapper = new THREE.Group();
      const cloned = gltf.scene.clone(true);
      // The medieval arrow GLB is exported with its long axis along +Y (see
      // `extract_medieval_pack.mjs > ROT_Z_TO_Y`). Map that to the projectile
      // convention (long axis on Z, tip toward -Z) by rotating +90deg around
      // X — this turns +Y into -Z, so whichever end of the source mesh was
      // "tip" ends up at -Z, matching the procedural arrow.
      if (entry.axis === "y") {
        cloned.rotation.x = Math.PI / 2;
      } else if (entry.axis === "x") {
        cloned.rotation.y = -Math.PI / 2;
      }
      // Normalise to the procedural shaft length (~1.0m) so wind-up animation
      // and trail spacing read correctly regardless of the source GLB scale.
      cloned.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromObject(cloned);
      const size = new THREE.Vector3();
      box.getSize(size);
      const longest = Math.max(size.x, size.y, size.z, 1e-4);
      const targetLength = 1.0;
      const s = targetLength / longest;
      cloned.scale.setScalar(s);
      wrapper.add(cloned);
      // Make sure shadows are enabled so the arrow reads against terrain.
      wrapper.traverse((c) => {
        if ((c as THREE.Mesh).isMesh) {
          (c as THREE.Mesh).castShadow = true;
        }
      });
      setGlbArrow(wrapper);
    }).catch(() => {
      if (!cancelled) setGlbArrow(null);
    });
    return () => { cancelled = true; };
  }, [arrowModelId]);

  const arrowMesh = glbArrow ?? proceduralArrow;

  const trailData = useMemo(() => {
    const COUNT = 20;
    const positions = new Float32Array(COUNT * 3);
    const sizes = new Float32Array(COUNT);
    for (let i = 0; i < COUNT; i++) {
      positions[i * 3 + 1] = -999;
      sizes[i] = Math.max(0.02, 0.12 * (1 - i / COUNT));
    }
    return { positions, sizes, COUNT };
  }, []);

  useFrame((_, delta) => {
    if (!groupRef.current) return;
    if (active && !prevActive.current) {
      isActive.current = true;
      timeRef.current = 0;
      startPos.current = [...position];
      for (let i = 0; i < trailData.COUNT; i++) trailData.positions[i * 3 + 1] = -999;
    }
    prevActive.current = active;
    if (!isActive.current) { groupRef.current.visible = false; return; }
    groupRef.current.visible = true;
    timeRef.current += delta;
    const t = timeRef.current;
    const speed = 45;
    const gravity = 2.5;
    const px = startPos.current[0] + direction[0] * speed * t;
    const py = startPos.current[1] + 1.4 - gravity * t * t;
    const pz = startPos.current[2] + direction[2] * speed * t;
    arrowMesh.position.set(px, py, pz);
    arrowMesh.rotation.y = Math.atan2(direction[0], direction[2]);
    arrowMesh.rotation.x = Math.atan2(2 * gravity * t, speed) * 0.5;
    for (let i = trailData.COUNT - 1; i > 0; i--) {
      trailData.positions[i * 3] = trailData.positions[(i - 1) * 3];
      trailData.positions[i * 3 + 1] = trailData.positions[(i - 1) * 3 + 1];
      trailData.positions[i * 3 + 2] = trailData.positions[(i - 1) * 3 + 2];
    }
    trailData.positions[0] = px;
    trailData.positions[1] = py;
    trailData.positions[2] = pz;
    const pts = groupRef.current.children.find(c => (c as THREE.Points).isPoints) as THREE.Points | undefined;
    if (pts?.geometry) pts.geometry.attributes.position.needsUpdate = true;
    if (t > 1.2 || py < 0) isActive.current = false;
  });

  return (
    <group ref={groupRef} visible={false}>
      <primitive object={arrowMesh} />
      <points>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[trailData.positions, 3]} />
        </bufferGeometry>
        <pointsMaterial map={trailTex} size={0.08} transparent color="#f0d68a"
          sizeAttenuation depthWrite={false} blending={THREE.AdditiveBlending} opacity={0.4} />
      </points>
    </group>
  );
}


export function CrossbowBoltProjectile({
  position,
  direction = [0, 0, -1],
  active,
}: ProjectileProps) {
  const groupRef = useRef<THREE.Group>(null);
  const timeRef = useRef(0);
  const prevActive = useRef(false);
  const isActive = useRef(false);
  const startPos = useRef<[number, number, number]>([0, 0, 0]);
  const sparkTex = useTexture(VFX_TEXTURES.spark);

  const boltMesh = useMemo(() => {
    const grp = new THREE.Group();
    const shaftGeo = new THREE.CylinderGeometry(0.02, 0.02, 0.6, 6);
    const shaftMat = new THREE.MeshStandardMaterial({ color: "#5a4020", roughness: 0.6 });
    const shaft = new THREE.Mesh(shaftGeo, shaftMat);
    shaft.rotation.x = Math.PI / 2;
    grp.add(shaft);
    const headGeo = new THREE.ConeGeometry(0.05, 0.15, 4);
    const headMat = new THREE.MeshStandardMaterial({ color: "#c0c0c0", metalness: 0.9, roughness: 0.15 });
    const head = new THREE.Mesh(headGeo, headMat);
    head.rotation.x = -Math.PI / 2;
    head.position.z = -0.37;
    grp.add(head);
    const fletchGeo = new THREE.PlaneGeometry(0.04, 0.08);
    const fletchMat = new THREE.MeshStandardMaterial({ color: "#2266aa", side: THREE.DoubleSide });
    for (let i = 0; i < 2; i++) {
      const fletch = new THREE.Mesh(fletchGeo, fletchMat);
      fletch.position.z = 0.27;
      fletch.rotation.z = (i / 2) * Math.PI;
      grp.add(fletch);
    }
    return grp;
  }, []);

  const trailData = useMemo(() => {
    const COUNT = 12;
    const positions = new Float32Array(COUNT * 3);
    for (let i = 0; i < COUNT; i++) positions[i * 3 + 1] = -999;
    return { positions, COUNT };
  }, []);

  useFrame((_, delta) => {
    if (!groupRef.current) return;
    if (active && !prevActive.current) {
      isActive.current = true;
      timeRef.current = 0;
      startPos.current = [...position];
      for (let i = 0; i < trailData.COUNT; i++) trailData.positions[i * 3 + 1] = -999;
    }
    prevActive.current = active;
    if (!isActive.current) { groupRef.current.visible = false; return; }
    groupRef.current.visible = true;
    timeRef.current += delta;
    const t = timeRef.current;
    const speed = 55;
    const px = startPos.current[0] + direction[0] * speed * t;
    const py = startPos.current[1] + 1.3;
    const pz = startPos.current[2] + direction[2] * speed * t;
    boltMesh.position.set(px, py, pz);
    boltMesh.rotation.y = Math.atan2(direction[0], direction[2]);
    for (let i = trailData.COUNT - 1; i > 0; i--) {
      trailData.positions[i * 3] = trailData.positions[(i - 1) * 3];
      trailData.positions[i * 3 + 1] = trailData.positions[(i - 1) * 3 + 1];
      trailData.positions[i * 3 + 2] = trailData.positions[(i - 1) * 3 + 2];
    }
    trailData.positions[0] = px;
    trailData.positions[1] = py;
    trailData.positions[2] = pz;
    const pts = groupRef.current.children.find(c => (c as THREE.Points).isPoints) as THREE.Points | undefined;
    if (pts?.geometry) pts.geometry.attributes.position.needsUpdate = true;
    if (t > 0.8) isActive.current = false;
  });

  return (
    <group ref={groupRef} visible={false}>
      <primitive object={boltMesh} />
      <points>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[trailData.positions, 3]} />
        </bufferGeometry>
        <pointsMaterial map={sparkTex} size={0.06} transparent color="#aaccff"
          sizeAttenuation depthWrite={false} blending={THREE.AdditiveBlending} opacity={0.35} />
      </points>
    </group>
  );
}


export function BulletProjectile({
  position,
  direction = [0, 0, -1],
  active,
  team = "player",
  rebounded = false,
  onBlock,
  onReboundHit,
  damage = 0,
  casterId,
}: ProjectileProps) {
  const groupRef = useRef<THREE.Group>(null);
  const timeRef = useRef(0);
  const prevActive = useRef(false);
  const isActive = useRef(false);
  const startPos = useRef<[number, number, number]>([0, 0, 0]);
  // Mutable trajectory state for the rebound primitive — see blockGuard.ts.
  const dirRef = useRef<[number, number, number]>([direction[0], direction[1], direction[2]]);
  const teamRef = useRef<ProjectileTeam>(team);
  const reboundedRef = useRef<boolean>(rebounded);
  const flareTex = useTexture(VFX_TEXTURES.flare);
  const sparkTex = useTexture(VFX_TEXTURES.spark);
  const muzzleRef = useRef<THREE.Sprite>(null);

  const trailData = useMemo(() => {
    const COUNT = 16;
    const positions = new Float32Array(COUNT * 3);
    const colors = new Float32Array(COUNT * 3);
    for (let i = 0; i < COUNT; i++) {
      positions[i * 3 + 1] = -999;
      const fade = 1 - i / COUNT;
      colors[i * 3] = 1.0;
      colors[i * 3 + 1] = 0.85 * fade;
      colors[i * 3 + 2] = 0.3 * fade;
    }
    return { positions, colors, COUNT };
  }, []);

  useFrame((_, delta) => {
    if (!groupRef.current) return;
    if (active && !prevActive.current) {
      isActive.current = true;
      timeRef.current = 0;
      startPos.current = [...position];
      // Re-arm the rebound primitive on every fresh activation.
      dirRef.current = [direction[0], direction[1], direction[2]];
      teamRef.current = team;
      reboundedRef.current = rebounded;
      for (let i = 0; i < trailData.COUNT; i++) trailData.positions[i * 3 + 1] = -999;
    }
    prevActive.current = active;
    if (!isActive.current) { groupRef.current.visible = false; return; }
    groupRef.current.visible = true;
    timeRef.current += delta;
    const t = timeRef.current;
    const speed = 80;
    const dir = dirRef.current;
    const px = startPos.current[0] + dir[0] * speed * t;
    const py = startPos.current[1] + 1.2;
    const pz = startPos.current[2] + dir[2] * speed * t;

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

    // After a successful rebound the bullet is travelling back at the
    // original shooter's team — test for an enemy under it each frame so
    // the parry actually deals damage on the way through.
    const reboundHit = tryReboundProjectileHit(
      { teamRef, reboundedRef, dirRef, startPosRef: startPos, timeRef },
      px,
      py,
      pz,
      REBOUND_DAMAGE_BULLET,
      0.9,
      casterId,
    );
    if (reboundHit) {
      onReboundHit?.(reboundHit);
      isActive.current = false;
      groupRef.current.visible = false;
      return;
    }

    // Enemy-cast bullets damage the player on impact.
    if (tryEnemyProjectileHitPlayer(teamRef, damage, px, pz, 0.9)) {
      isActive.current = false;
      groupRef.current.visible = false;
      return;
    }

    if (muzzleRef.current) {
      // Only show the muzzle flash on the original shot — a rebounded bullet
      // didn't come out of a barrel, so suppress it once deflected.
      const showFlash = !reboundedRef.current && t < 0.05;
      const flashScale = showFlash ? 1.5 : Math.max(0, 1.5 - t * 20);
      muzzleRef.current.scale.setScalar(reboundedRef.current ? 0 : flashScale);
      muzzleRef.current.position.set(
        startPos.current[0] + dir[0] * 0.8,
        startPos.current[1] + 1.2,
        startPos.current[2] + dir[2] * 0.8
      );
      muzzleRef.current.material.opacity = reboundedRef.current ? 0 : Math.max(0, 1 - t * 12);
    }
    for (let i = trailData.COUNT - 1; i > 0; i--) {
      trailData.positions[i * 3] = trailData.positions[(i - 1) * 3];
      trailData.positions[i * 3 + 1] = trailData.positions[(i - 1) * 3 + 1];
      trailData.positions[i * 3 + 2] = trailData.positions[(i - 1) * 3 + 2];
    }
    trailData.positions[0] = px;
    trailData.positions[1] = py;
    trailData.positions[2] = pz;
    const pts = groupRef.current.children.find(c => (c as THREE.Points).isPoints) as THREE.Points | undefined;
    if (pts?.geometry) pts.geometry.attributes.position.needsUpdate = true;
    if (t > 0.5) isActive.current = false;
  });

  return (
    <group ref={groupRef} visible={false}>
      <sprite ref={muzzleRef}>
        <spriteMaterial map={flareTex} color="#ffdd44" transparent
          blending={THREE.AdditiveBlending} depthWrite={false} />
      </sprite>
      <points>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[trailData.positions, 3]} />
          <bufferAttribute attach="attributes-color" args={[trailData.colors, 3]} />
        </bufferGeometry>
        <pointsMaterial map={sparkTex} size={0.15} transparent vertexColors
          sizeAttenuation depthWrite={false} blending={THREE.AdditiveBlending} opacity={0.7} />
      </points>
    </group>
  );
}


export function MagicMissileProjectile({
  position,
  direction = [0, 0, -1],
  active,
  color = "#9944ff",
  team = "player",
  rebounded = false,
  onBlock,
  onReboundHit,
  damage = 0,
  casterId,
}: ProjectileProps) {
  const groupRef = useRef<THREE.Group>(null);
  const timeRef = useRef(0);
  const prevActive = useRef(false);
  const isActive = useRef(false);
  const startPos = useRef<[number, number, number]>([0, 0, 0]);
  // Mutable trajectory state for the rebound primitive — see blockGuard.ts.
  const dirRef = useRef<[number, number, number]>([direction[0], direction[1], direction[2]]);
  const teamRef = useRef<ProjectileTeam>(team);
  const reboundedRef = useRef<boolean>(rebounded);
  const glowTex = useTexture(VFX_TEXTURES.glowBall);
  const trailData = useMemo(() => {
    const COUNT = 25;
    const positions = new Float32Array(COUNT * 3);
    for (let i = 0; i < COUNT; i++) positions[i * 3 + 1] = -999;
    return { positions, COUNT };
  }, []);

  useFrame((_, delta) => {
    if (!groupRef.current) return;
    if (active && !prevActive.current) {
      isActive.current = true;
      timeRef.current = 0;
      startPos.current = [...position];
      // Re-arm the rebound primitive on every fresh activation.
      dirRef.current = [direction[0], direction[1], direction[2]];
      teamRef.current = team;
      reboundedRef.current = rebounded;
      for (let i = 0; i < trailData.COUNT; i++) trailData.positions[i * 3 + 1] = -999;
    }
    prevActive.current = active;
    if (!isActive.current) { groupRef.current.visible = false; return; }
    groupRef.current.visible = true;
    timeRef.current += delta;
    const t = timeRef.current;
    const speed = 25;
    const wobble = Math.sin(t * 20) * 0.15;
    const dir = dirRef.current;
    const px = startPos.current[0] + dir[0] * speed * t + dir[2] * wobble;
    const py = startPos.current[1] + 1.5 + Math.sin(t * 12) * 0.1;
    const pz = startPos.current[2] + dir[2] * speed * t - dir[0] * wobble;

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

    // After a successful rebound the missile is travelling back toward the
    // original caster's team — test for an enemy under it each frame so the
    // parry actually deals damage on the way through.
    const reboundHit = tryReboundProjectileHit(
      { teamRef, reboundedRef, dirRef, startPosRef: startPos, timeRef },
      px,
      py,
      pz,
      REBOUND_DAMAGE_MAGIC_MISSILE,
      1.2,
      casterId,
    );
    if (reboundHit) {
      onReboundHit?.(reboundHit);
      isActive.current = false;
      groupRef.current.visible = false;
      return;
    }

    // Enemy-cast magic missiles damage the player on impact.
    if (tryEnemyProjectileHitPlayer(teamRef, damage, px, pz, 1.0)) {
      isActive.current = false;
      groupRef.current.visible = false;
      return;
    }

    const coreChild = groupRef.current.children[0] as THREE.Mesh;
    if (coreChild) coreChild.position.set(px, py, pz);
    const sprite = groupRef.current.children[1] as THREE.Sprite;
    if (sprite) sprite.position.set(px, py, pz);
    const light = groupRef.current.children[2] as THREE.PointLight;
    if (light) light.position.set(px, py, pz);

    for (let i = trailData.COUNT - 1; i > 0; i--) {
      trailData.positions[i * 3] = trailData.positions[(i - 1) * 3];
      trailData.positions[i * 3 + 1] = trailData.positions[(i - 1) * 3 + 1];
      trailData.positions[i * 3 + 2] = trailData.positions[(i - 1) * 3 + 2];
    }
    trailData.positions[0] = px;
    trailData.positions[1] = py;
    trailData.positions[2] = pz;
    const pts = groupRef.current.children.find(c => (c as THREE.Points).isPoints) as THREE.Points | undefined;
    if (pts?.geometry) pts.geometry.attributes.position.needsUpdate = true;
    if (t > 1.5) isActive.current = false;
  });

  return (
    <group ref={groupRef} visible={false}>
      <mesh>
        <sphereGeometry args={[0.12, 12, 12]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={3} transparent opacity={0.9} />
      </mesh>
      <sprite scale={[0.6, 0.6, 1]}>
        <spriteMaterial map={glowTex} color={color} transparent opacity={0.6}
          blending={THREE.AdditiveBlending} depthWrite={false} />
      </sprite>
      <pointLight color={color} intensity={5} distance={6} />
      <points>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[trailData.positions, 3]} />
        </bufferGeometry>
        <pointsMaterial map={glowTex} size={0.2} transparent color={color}
          sizeAttenuation depthWrite={false} blending={THREE.AdditiveBlending} opacity={0.5} />
      </points>
    </group>
  );
}


export function LightningBoltProjectile({
  position,
  direction = [0, 0, -1],
  active,
}: ProjectileProps) {
  const groupRef = useRef<THREE.Group>(null);
  const timeRef = useRef(0);
  const prevActive = useRef(false);
  const isActive = useRef(false);
  const startPos = useRef<[number, number, number]>([0, 0, 0]);

  const boltGeo = useMemo(() => {
    const segments = 12;
    const points: THREE.Vector3[] = [];
    for (let i = 0; i <= segments; i++) {
      const t = i / segments;
      const jX = i > 0 && i < segments ? (Math.random() - 0.5) * 0.4 : 0;
      const jY = i > 0 && i < segments ? (Math.random() - 0.5) * 0.3 : 0;
      points.push(new THREE.Vector3(jX, jY, -t * 8));
    }
    const curve = new THREE.CatmullRomCurve3(points);
    return new THREE.TubeGeometry(curve, 20, 0.04, 6, false);
  }, []);

  useFrame((_, delta) => {
    if (!groupRef.current) return;
    if (active && !prevActive.current) {
      isActive.current = true;
      timeRef.current = 0;
      startPos.current = [...position];
    }
    prevActive.current = active;
    if (!isActive.current) { groupRef.current.visible = false; return; }
    groupRef.current.visible = true;
    timeRef.current += delta;
    const t = timeRef.current;
    groupRef.current.position.set(startPos.current[0], startPos.current[1] + 1.3, startPos.current[2]);
    groupRef.current.rotation.y = Math.atan2(direction[0], direction[2]);
    const flash = t < 0.1 ? 1 : Math.max(0, 1 - (t - 0.1) * 4);
    groupRef.current.scale.setScalar(flash > 0 ? 1 : 0);
    if (t > 0.4) isActive.current = false;
  });

  return (
    <group ref={groupRef} visible={false}>
      <mesh geometry={boltGeo}>
        <meshStandardMaterial color="#88ccff" emissive="#4488ff" emissiveIntensity={5} transparent opacity={0.9} />
      </mesh>
      <mesh geometry={boltGeo} scale={[2, 2, 1]}>
        <meshStandardMaterial color="#aaddff" emissive="#6699ff" emissiveIntensity={2}
          transparent opacity={0.3} side={THREE.DoubleSide} />
      </mesh>
      <pointLight color="#88ccff" intensity={12} distance={10} />
    </group>
  );
}


/**
 * Enemy-cast Hadouken-class projectile. Mirrors the player's HadoukenProjectile
 * visually but is the first projectile in the codebase that actually closes the
 * loop with the rebound primitive in `blockGuard.ts`:
 *
 *   - Spawns with `team="enemy"` so blocking the shot flips it to `"player"`.
 *   - Each frame, the moving sphere checks its distance against either the
 *     player (when still flagged enemy) or every live enemy (after a rebound).
 *     Whoever it touches eats `damage`. This is the "block-and-reflect" payoff
 *     the audit calls for in §3.5 (Paladin/Robot AI).
 *
 * The component is fully self-contained: it reads the player position from the
 * useGame store and the enemy roster from useEnemyManager, so callers only need
 * to mount it with a fresh `key` whenever the caster wants to fire.
 */
interface EnemyHadoukenProjectileProps {
  position: [number, number, number];
  direction: [number, number, number];
  active: boolean;
  damage: number;
  /** Caster's enemy id. Excluded from rebound damage during the very first
   *  ~150 ms so the rebound visibly travels back across the field instead of
   *  the projectile insta-popping the caster from inside their own hitbox. */
  casterId?: string;
  onBlock?: (info: { position: [number, number, number] }) => void;
}

export function EnemyHadoukenProjectile({
  position,
  direction,
  active,
  damage,
  casterId,
  onBlock,
}: EnemyHadoukenProjectileProps) {
  const groupRef = useRef<THREE.Group>(null);
  const innerMatRef = useRef<THREE.MeshStandardMaterial>(null);
  const outerMatRef = useRef<THREE.MeshStandardMaterial>(null);
  const spriteMatRef = useRef<THREE.SpriteMaterial>(null);
  const lightRef = useRef<THREE.PointLight>(null);
  const timeRef = useRef(0);
  const isActive = useRef(false);
  const prevActive = useRef(false);
  const startPos = useRef<[number, number, number]>([0, 0, 0]);
  const dirRef = useRef<[number, number, number]>([direction[0], direction[1], direction[2]]);
  const teamRef = useRef<ProjectileTeam>("enemy");
  const reboundedRef = useRef<boolean>(false);
  const consumedRef = useRef(false);
  const glowTex = useTexture(VFX_TEXTURES.glowBall);
  const sparkTex = useTexture(VFX_TEXTURES.spark);
  // Cached colors so the per-frame "did we just rebound?" check doesn't
  // allocate a fresh THREE.Color every tick.
  const enemyColor = useMemo(() => new THREE.Color("#ff5577"), []);
  const playerColor = useMemo(() => new THREE.Color("#66ccff"), []);

  const trailPositions = useMemo(() => new Float32Array(40 * 3), []);
  const trailColors = useMemo(() => new Float32Array(40 * 3), []);

  useFrame((_, delta) => {
    if (!groupRef.current) return;

    if (active && !prevActive.current) {
      isActive.current = true;
      timeRef.current = 0;
      startPos.current = [position[0], position[1], position[2]];
      dirRef.current = [direction[0], direction[1], direction[2]];
      teamRef.current = "enemy";
      reboundedRef.current = false;
      consumedRef.current = false;
      for (let i = 0; i < 40; i++) {
        trailPositions[i * 3] = 0;
        trailPositions[i * 3 + 1] = -999;
        trailPositions[i * 3 + 2] = 0;
      }
    }
    prevActive.current = active;

    if (!isActive.current || consumedRef.current) {
      groupRef.current.visible = false;
      return;
    }

    groupRef.current.visible = true;
    timeRef.current += delta;
    const t = timeRef.current;
    const speed = 18;
    const dir = dirRef.current;
    const px = startPos.current[0] + dir[0] * speed * t;
    const py = startPos.current[1];
    const pz = startPos.current[2] + dir[2] * speed * t;

    if (
      tryReboundProjectile(
        { teamRef, reboundedRef, dirRef, startPosRef: startPos, timeRef },
        px,
        py,
        pz,
      )
    ) {
      onBlock?.({ position: [px, py, pz] });
      // Visual switch: pink (enemy) -> cyan (player) the moment the player
      // blocks. Doing this imperatively avoids a React re-render mid-flight.
      if (innerMatRef.current) {
        innerMatRef.current.color.copy(playerColor);
        innerMatRef.current.emissive.copy(playerColor);
      }
      if (outerMatRef.current) {
        outerMatRef.current.color.copy(playerColor);
        outerMatRef.current.emissive.copy(playerColor);
      }
      if (spriteMatRef.current) spriteMatRef.current.color.copy(playerColor);
      if (lightRef.current) lightRef.current.color.copy(playerColor);
    }

    groupRef.current.position.set(px, py, pz);
    const pulse = 1 + Math.sin(t * 18) * 0.25;
    groupRef.current.scale.setScalar(pulse);

    // --- damage application ---
    // Block-window note: tryReboundProjectile resets timeRef to 0 on a
    // successful block, so `t` here is the time since the LAST rebound (or
    // since the original launch, if no block has fired yet). That makes the
    // "small t" check below work for both phases.
    if (teamRef.current === "enemy") {
      const playerPos = useGame.getState().playerPosition;
      if (playerPos) {
        const dx = px - playerPos.x;
        const dy = py - (playerPos.y + 1.0);
        const dz = pz - playerPos.z;
        if (dx * dx + dy * dy + dz * dz < 1.0 * 1.0) {
          // Hit the player. The block primitive runs first, so if we reach
          // here, the shot was unblocked.
          useSurvival.getState().takeDamage(damage, "blade");
          useCombatLog.getState().addEntry(
            `An energy bolt strikes you for ${damage} damage!`,
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
          consumedRef.current = true;
        }
      }
    } else if (teamRef.current === "player") {
      // Rebounded — find whichever enemy the projectile is currently touching.
      // We skip the caster for the first ~150 ms so the rebound visibly flies
      // across the field instead of insta-popping the caster from inside.
      const enemies = useEnemyManager.getState().enemies;
      for (const e of enemies) {
        if (e.isDying) continue;
        if (e.id === casterId && t < 0.15) continue;
        const ex = e.position.x;
        const ez = e.position.z;
        const ddx = px - ex;
        const ddz = pz - ez;
        // 2D check on the floor plane keeps short/tall enemies all hittable
        // without having to know each model's torso height.
        if (ddx * ddx + ddz * ddz < 1.2 * 1.2) {
          useEnemyManager.getState().damageEnemy(e.id, damage);
          useCombatLog.getState().addEntry(
            `Reflected bolt hits ${e.type.replace(/_/g, " ")} for ${damage} damage!`,
            "#88ddff",
          );
          consumedRef.current = true;
          break;
        }
      }
    }

    // Trail (cheap pop-line; intentionally simpler than the player Hadouken
    // since enemy casts can fire several at once).
    for (let i = 39; i > 0; i--) {
      trailPositions[i * 3] = trailPositions[(i - 1) * 3];
      trailPositions[i * 3 + 1] = trailPositions[(i - 1) * 3 + 1];
      trailPositions[i * 3 + 2] = trailPositions[(i - 1) * 3 + 2];
      const fade = 1 - i / 40;
      // Color shifts on rebound so players get instant feedback that the shot
      // is now "theirs" and worth dodging into for damage.
      if (reboundedRef.current) {
        trailColors[i * 3] = 0.4 * fade;
        trailColors[i * 3 + 1] = 0.9 * fade;
        trailColors[i * 3 + 2] = 1.0 * fade;
      } else {
        trailColors[i * 3] = 1.0 * fade;
        trailColors[i * 3 + 1] = 0.3 * fade;
        trailColors[i * 3 + 2] = 0.5 * fade;
      }
    }
    trailPositions[0] = px;
    trailPositions[1] = py;
    trailPositions[2] = pz;
    trailColors[0] = reboundedRef.current ? 0.5 : 1.0;
    trailColors[1] = reboundedRef.current ? 1.0 : 0.4;
    trailColors[2] = 1.0;
    const pts = groupRef.current.children.find(
      (c) => (c as THREE.Points).isPoints,
    ) as THREE.Points | undefined;
    if (pts?.geometry) pts.geometry.attributes.position.needsUpdate = true;

    // Lifetime cap. The rebound primitive resets timeRef to 0 on block, so a
    // deflected shot also gets the full 1.6 s window to fly back.
    if (t > 1.6) {
      isActive.current = false;
    }
  });

  return (
    <group ref={groupRef} visible={false}>
      <mesh>
        <sphereGeometry args={[0.3, 14, 14]} />
        <meshStandardMaterial
          ref={innerMatRef}
          color={enemyColor}
          emissive={enemyColor}
          emissiveIntensity={3}
          transparent
          opacity={0.95}
          emissiveMap={glowTex}
        />
      </mesh>
      <mesh>
        <sphereGeometry args={[0.45, 12, 12]} />
        <meshStandardMaterial
          ref={outerMatRef}
          color={enemyColor}
          emissive={enemyColor}
          emissiveIntensity={1.5}
          transparent
          opacity={0.35}
          emissiveMap={glowTex}
        />
      </mesh>
      <sprite scale={[1.4, 1.4, 1]}>
        <spriteMaterial
          ref={spriteMatRef}
          map={sparkTex}
          color={enemyColor}
          transparent
          opacity={0.5}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </sprite>
      <pointLight ref={lightRef} color={enemyColor} intensity={5} distance={6} />
      <points>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[trailPositions, 3]} />
          <bufferAttribute attach="attributes-color" args={[trailColors, 3]} />
        </bufferGeometry>
        <pointsMaterial
          map={glowTex}
          size={0.25}
          transparent
          vertexColors
          sizeAttenuation
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          opacity={0.7}
        />
      </points>
    </group>
  );
}

