/**
 * MeshVFXProjectiles — GLB mesh-based VFX for abilities that need
 * real 3D geometry instead of just particles.
 *
 * Three VFX meshes:
 *   - Rasengan: spinning energy orb held in hand during charge,
 *               launched as a seeking projectile on release
 *   - Tornado (stylized): low-poly vortex for spin slash / whirlwind attacks
 *   - Tornado (realistic): full vortex for class ability wind storms
 *
 * Usage pattern:
 *   1. Preload at game start via `preloadMeshVFX()`
 *   2. Spawn via `spawnMeshVFX(type, scene, options)`
 *   3. Each spawned instance self-animates (rotation, scale, emission)
 *   4. Auto-despawns after duration or on manual `dispose()`
 *
 * These complement the particle system — particles provide trails and
 * impacts, mesh VFX provide the main visual body of the effect.
 */

import * as THREE from "three";
import { loadAsset } from "../systems/AssetLoader";
import { vfx, VFXPresets } from "../vfx";

// ---------------------------------------------------------------------------
// VFX model registry
// ---------------------------------------------------------------------------

export type MeshVFXType =
  | "rasengan" | "tornado_stylized" | "tornado" | "energy_orb"
  | "cast_circle" | "magic_orb"
  | "hex_shield" | "sparks_explosion" | "sphere_explosion" | "splash";

interface MeshVFXDef {
  path: string;
  defaultScale: number;
  rotationSpeed: [number, number, number]; // radians per second [x, y, z]
  emissiveColor: number;
  emissiveIntensity: number;
  particleHue: "arcane" | "holy" | "shadow" | "fire";
  particleRate: number; // particles per second
  defaultDuration: number; // seconds before auto-despawn
}

const VFX_DEFS: Record<MeshVFXType, MeshVFXDef> = {
  rasengan: {
    path: "/models/vfx_models/rasengan.glb",
    defaultScale: 0.3,
    rotationSpeed: [0, 15, 5],
    emissiveColor: 0x4488ff,
    emissiveIntensity: 2.0,
    particleHue: "arcane",
    particleRate: 30,
    defaultDuration: 3.0,
  },
  tornado_stylized: {
    path: "/models/vfx_models/tornado_stylized.glb",
    defaultScale: 0.5,
    rotationSpeed: [0, 8, 0],
    emissiveColor: 0x88ccff,
    emissiveIntensity: 0.8,
    particleHue: "holy",
    particleRate: 20,
    defaultDuration: 2.0,
  },
  tornado: {
    path: "/models/vfx_models/tornado.glb",
    defaultScale: 1.0,
    rotationSpeed: [0, 6, 0],
    emissiveColor: 0xaaddff,
    emissiveIntensity: 0.5,
    particleHue: "holy",
    particleRate: 15,
    defaultDuration: 4.0,
  },
  energy_orb: {
    // Reuses rasengan mesh with different color/scale
    path: "/models/vfx_models/rasengan.glb",
    defaultScale: 0.15,
    rotationSpeed: [3, 10, 3],
    emissiveColor: 0xff4444,
    emissiveIntensity: 1.5,
    particleHue: "fire",
    particleRate: 20,
    defaultDuration: 2.0,
  },
  cast_circle: {
    // Holy spell circle that appears under the caster's feet during cast time
    path: "/models/vfx_models/holy_cast_circle.glb",
    defaultScale: 1.2,
    rotationSpeed: [0, 2.5, 0], // slow majestic rotation on Y
    emissiveColor: 0xffeeaa,
    emissiveIntensity: 1.5,
    particleHue: "holy",
    particleRate: 10,
    defaultDuration: 3.0,
  },
  magic_orb: {
    // Colorable projectile orb — base for all magic projectile types.
    // Recolor via opts.color to match element: fire=0xff4400, ice=0x44aaff, etc.
    path: "/models/vfx_models/magic_orb.glb",
    defaultScale: 0.25,
    rotationSpeed: [2, 8, 2],
    emissiveColor: 0x88aaff,
    emissiveIntensity: 2.0,
    particleHue: "arcane",
    particleRate: 25,
    defaultDuration: 3.0,
  },
  hex_shield: {
    // Hexagonal force field — wraps around character for shield/counter/block.
    // Appears on perfect parry, shield buff activation, or protective magic.
    path: "/models/vfx_models/hex_shield/scene.gltf",
    defaultScale: 1.5,
    rotationSpeed: [0, 0.5, 0],
    emissiveColor: 0x44aaff,
    emissiveIntensity: 1.2,
    particleHue: "arcane",
    particleRate: 5,
    defaultDuration: 2.0,
  },
  sparks_explosion: {
    // Spark burst — plays on spell impact, explosive arrow hit, crit.
    path: "/models/vfx_models/sparks_explosion/scene.gltf",
    defaultScale: 0.8,
    rotationSpeed: [0, 0, 0],
    emissiveColor: 0xffaa44,
    emissiveIntensity: 2.5,
    particleHue: "fire",
    particleRate: 0, // the mesh IS the explosion
    defaultDuration: 0.6,
  },
  sphere_explosion: {
    // Expanding sphere explosion — AoE magic detonation.
    path: "/models/vfx_models/sphere_explosion/scene.gltf",
    defaultScale: 0.5,
    rotationSpeed: [0, 2, 0],
    emissiveColor: 0xff4400,
    emissiveIntensity: 2.0,
    particleHue: "fire",
    particleRate: 0,
    defaultDuration: 0.8,
  },
  splash: {
    // Splash ring — AoE impact ring. Retexturable: lava for fire spells,
    // water for ice/water spells, poison green for nature.
    path: "/models/vfx_models/splash.glb",
    defaultScale: 1.0,
    rotationSpeed: [0, 0, 0],
    emissiveColor: 0x4488ff,
    emissiveIntensity: 1.0,
    particleHue: "arcane",
    particleRate: 8,
    defaultDuration: 1.2,
  },
};

// ---------------------------------------------------------------------------
// Preloaded mesh cache
// ---------------------------------------------------------------------------

const meshCache = new Map<string, THREE.Group>();
let preloaded = false;

/**
 * Build a procedural VFX mesh when the GLB file is missing. Uses simple
 * Three.js geometry (sphere, cone, torus) with emissive materials so the
 * game's VFX system never shows a magenta cube for missing effects.
 */
function createProceduralVFX(type: MeshVFXType, def: MeshVFXDef): THREE.Group {
  const group = new THREE.Group();
  group.name = `procedural_vfx_${type}`;

  const mat = new THREE.MeshStandardMaterial({
    color: def.emissiveColor,
    emissive: new THREE.Color(def.emissiveColor),
    emissiveIntensity: def.emissiveIntensity,
    transparent: true,
    opacity: 0.85,
    depthWrite: false,
    side: THREE.DoubleSide,
    roughness: 0.3,
    metalness: 0.0,
  });

  let geo: THREE.BufferGeometry;

  switch (type) {
    case "rasengan":
    case "energy_orb":
    case "magic_orb":
    case "sphere_explosion":
      geo = new THREE.SphereGeometry(0.5, 16, 12);
      break;
    case "tornado_stylized":
    case "tornado":
      geo = new THREE.ConeGeometry(0.5, 1.5, 12, 1, true);
      break;
    case "cast_circle":
      geo = new THREE.TorusGeometry(0.6, 0.08, 8, 24);
      break;
    case "hex_shield":
      geo = new THREE.IcosahedronGeometry(0.6, 1);
      mat.wireframe = true;
      break;
    case "sparks_explosion":
      geo = new THREE.OctahedronGeometry(0.4, 0);
      break;
    case "splash":
      geo = new THREE.RingGeometry(0.3, 0.7, 16);
      break;
    default:
      geo = new THREE.SphereGeometry(0.4, 12, 8);
  }

  const mesh = new THREE.Mesh(geo, mat);
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  group.add(mesh);
  return group;
}

/**
 * Preload all VFX meshes. Call once at game start.
 * Falls back to procedural geometry when GLBs are missing.
 */
export async function preloadMeshVFX(): Promise<void> {
  if (preloaded) return;

  const uniquePaths = new Set(Object.values(VFX_DEFS).map(d => d.path));
  const promises = [...uniquePaths].map(async (path) => {
    try {
      const gltf = await loadAsset(path, "low", `vfx_mesh_${path}`);
      // Check if the AssetLoader returned a fallback cube (missing file)
      if (gltf.scene.userData?.isAssetFallback) {
        throw new Error(`fallback cube for ${path}`);
      }
      const group = new THREE.Group();
      group.add(gltf.scene.clone());
      meshCache.set(path, group);
    } catch (err) {
      console.warn(`[MeshVFX] GLB unavailable for ${path}, using procedural fallback`);
    }
  });

  await Promise.all(promises);

  // Generate procedural fallbacks for any VFX type whose GLB didn't load.
  for (const [type, def] of Object.entries(VFX_DEFS) as [MeshVFXType, MeshVFXDef][]) {
    if (!meshCache.has(def.path)) {
      meshCache.set(def.path, createProceduralVFX(type, def));
    }
  }

  preloaded = true;
}

// ---------------------------------------------------------------------------
// Active VFX instance
// ---------------------------------------------------------------------------

export interface MeshVFXInstance {
  id: string;
  type: MeshVFXType;
  group: THREE.Group;
  /** World position (updated per frame for attached effects) */
  position: THREE.Vector3;
  /** Velocity for projectile motion [x, y, z] m/s */
  velocity: THREE.Vector3;
  /** Remaining lifetime */
  remaining: number;
  /** Scale animation progress (0→1 grow-in, 1 = full size) */
  scaleProgress: number;
  /** Definition reference */
  def: MeshVFXDef;
  /** Parent scene reference for removal */
  scene: THREE.Scene | THREE.Group;
  /** Whether this VFX is attached to a bone (follows it) */
  attachedTo: THREE.Object3D | null;
  /** Callback on expire */
  onExpire?: (pos: THREE.Vector3) => void;
  /** Whether seeking a target */
  seekTarget: THREE.Vector3 | null;
  seekRate: number;
  /** Disposed flag */
  disposed: boolean;
}

const activeInstances: MeshVFXInstance[] = [];
let vfxIdCounter = 0;

// ---------------------------------------------------------------------------
// Spawn a mesh VFX
// ---------------------------------------------------------------------------

export interface SpawnMeshVFXOptions {
  position: [number, number, number];
  velocity?: [number, number, number];
  scale?: number;
  duration?: number;
  color?: number;
  attachTo?: THREE.Object3D;
  seekTarget?: [number, number, number];
  seekRate?: number;
  onExpire?: (pos: THREE.Vector3) => void;
}

/**
 * Spawn a mesh-based VFX effect in the scene.
 *
 * @param type    Which VFX model to use
 * @param scene   Three.js scene to add the mesh to
 * @param opts    Position, velocity, duration, color overrides
 * @returns Instance handle for manual control / early dispose
 */
export function spawnMeshVFX(
  type: MeshVFXType,
  scene: THREE.Scene | THREE.Group,
  opts: SpawnMeshVFXOptions,
): MeshVFXInstance | null {
  const def = VFX_DEFS[type];
  if (!def) return null;

  const cached = meshCache.get(def.path);
  if (!cached) {
    console.warn(`[MeshVFX] Mesh not preloaded: ${def.path}`);
    return null;
  }

  const group = cached.clone(true);
  group.name = `vfx_${type}_${vfxIdCounter}`;
  group.position.set(opts.position[0], opts.position[1], opts.position[2]);

  const finalScale = (opts.scale ?? 1) * def.defaultScale;
  group.scale.setScalar(0.01); // Start tiny, grow in

  // Apply emissive to all meshes
  const emissiveColor = opts.color ?? def.emissiveColor;
  group.traverse((child) => {
    if ((child as THREE.Mesh).isMesh) {
      const mesh = child as THREE.Mesh;
      const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      for (const mat of materials) {
        const stdMat = mat as THREE.MeshStandardMaterial;
        if (stdMat.isMeshStandardMaterial) {
          stdMat.emissive = new THREE.Color(emissiveColor);
          stdMat.emissiveIntensity = def.emissiveIntensity;
          stdMat.transparent = true;
          stdMat.opacity = 0.9;
          stdMat.depthWrite = false;
          stdMat.side = THREE.DoubleSide;
        }
      }
    }
  });

  scene.add(group);

  const instance: MeshVFXInstance = {
    id: `mvfx_${vfxIdCounter++}`,
    type,
    group,
    position: new THREE.Vector3(opts.position[0], opts.position[1], opts.position[2]),
    velocity: opts.velocity
      ? new THREE.Vector3(opts.velocity[0], opts.velocity[1], opts.velocity[2])
      : new THREE.Vector3(),
    remaining: opts.duration ?? def.defaultDuration,
    scaleProgress: 0,
    def,
    scene,
    attachedTo: opts.attachTo ?? null,
    onExpire: opts.onExpire,
    seekTarget: opts.seekTarget ? new THREE.Vector3(opts.seekTarget[0], opts.seekTarget[1], opts.seekTarget[2]) : null,
    seekRate: opts.seekRate ?? 3,
    disposed: false,
  };

  // Store final scale in userData for the grow-in animation
  group.userData._targetScale = finalScale;

  activeInstances.push(instance);
  return instance;
}

// ---------------------------------------------------------------------------
// Per-frame update — call from a useFrame hook
// ---------------------------------------------------------------------------

/**
 * Tick all active mesh VFX instances. Call once per frame.
 *
 * @param delta Frame delta in seconds
 */
export function tickMeshVFX(delta: number): void {
  const toRemove: number[] = [];

  for (let i = 0; i < activeInstances.length; i++) {
    const inst = activeInstances[i];
    if (inst.disposed) { toRemove.push(i); continue; }

    inst.remaining -= delta;
    if (inst.remaining <= 0) {
      inst.onExpire?.(inst.position);
      disposeMeshVFX(inst);
      toRemove.push(i);
      continue;
    }

    // Grow-in animation (first 0.2s)
    if (inst.scaleProgress < 1) {
      inst.scaleProgress = Math.min(1, inst.scaleProgress + delta * 5);
      const targetScale = inst.group.userData._targetScale ?? inst.def.defaultScale;
      const eased = 1 - Math.pow(1 - inst.scaleProgress, 3); // ease-out cubic
      inst.group.scale.setScalar(targetScale * eased);
    }

    // Fade out in last 0.3s
    if (inst.remaining < 0.3) {
      const fade = inst.remaining / 0.3;
      inst.group.traverse((child) => {
        if ((child as THREE.Mesh).isMesh) {
          const mat = (child as THREE.Mesh).material as THREE.MeshStandardMaterial;
          if (mat.isMeshStandardMaterial) mat.opacity = fade * 0.9;
        }
      });
    }

    // Rotation animation
    const [rx, ry, rz] = inst.def.rotationSpeed;
    inst.group.rotation.x += rx * delta;
    inst.group.rotation.y += ry * delta;
    inst.group.rotation.z += rz * delta;

    // Seeking behavior
    if (inst.seekTarget) {
      const toTarget = inst.seekTarget.clone().sub(inst.position).normalize();
      inst.velocity.lerp(toTarget.multiplyScalar(inst.velocity.length() || 15), inst.seekRate * delta);
    }

    // Move by velocity
    if (inst.velocity.lengthSq() > 0.01) {
      inst.position.addScaledVector(inst.velocity, delta);
    }

    // Follow attached bone
    if (inst.attachedTo) {
      inst.attachedTo.getWorldPosition(inst.position);
    }

    inst.group.position.copy(inst.position);

    // Emit trail particles
    if (Math.random() < inst.def.particleRate * delta) {
      const pos: [number, number, number] = [inst.position.x, inst.position.y, inst.position.z];
      vfx.emit(VFXPresets.wispTrail(pos, inst.def.particleHue));
    }
  }

  // Remove disposed (reverse order)
  for (let i = toRemove.length - 1; i >= 0; i--) {
    activeInstances.splice(toRemove[i], 1);
  }
}

/**
 * Dispose a mesh VFX instance — remove from scene and mark for cleanup.
 */
export function disposeMeshVFX(inst: MeshVFXInstance): void {
  if (inst.disposed) return;
  inst.disposed = true;
  inst.scene.remove(inst.group);
  // Dispose geometry/materials
  inst.group.traverse((child) => {
    if ((child as THREE.Mesh).isMesh) {
      const mesh = child as THREE.Mesh;
      mesh.geometry?.dispose();
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      mats.forEach(m => m.dispose());
    }
  });
}

// ---------------------------------------------------------------------------
// Combat ability shortcuts — spawn the right VFX for specific attacks
// ---------------------------------------------------------------------------

/**
 * Spawn a rasengan-style energy orb attached to the player's hand,
 * then launch it toward a target on release.
 */
export function spawnRasengan(
  scene: THREE.Scene | THREE.Group,
  handBone: THREE.Object3D,
  color?: number,
): MeshVFXInstance | null {
  return spawnMeshVFX("rasengan", scene, {
    position: [0, 0, 0],
    attachTo: handBone,
    duration: 5, // stays until manually launched or expires
    color,
  });
}

export function launchRasengan(
  inst: MeshVFXInstance,
  target: [number, number, number],
  speed: number = 20,
): void {
  // Detach from hand
  inst.attachedTo = null;
  const dir = new THREE.Vector3(
    target[0] - inst.position.x,
    target[1] - inst.position.y,
    target[2] - inst.position.z,
  ).normalize();
  inst.velocity.copy(dir.multiplyScalar(speed));
  inst.seekTarget = new THREE.Vector3(target[0], target[1], target[2]);
  inst.seekRate = 4;
  inst.remaining = 3; // 3s flight time max
  inst.onExpire = (pos) => {
    // Impact burst
    vfx.burst(VFXPresets.spellImpact([pos.x, pos.y, pos.z], "arcane"));
    vfx.burst(VFXPresets.lightningFlash([pos.x, pos.y, pos.z], 16));
  };
}

/**
 * Spawn a tornado vortex around the player for spin/whirlwind attacks.
 * Scales up quickly, rotates, emits wind particles, then fades.
 */
export function spawnTornadoSpin(
  scene: THREE.Scene | THREE.Group,
  position: [number, number, number],
  opts?: { scale?: number; duration?: number; stylized?: boolean },
): MeshVFXInstance | null {
  const type = opts?.stylized !== false ? "tornado_stylized" : "tornado";
  return spawnMeshVFX(type, scene, {
    position,
    scale: opts?.scale ?? 1,
    duration: opts?.duration ?? 1.5,
    onExpire: (pos) => {
      vfx.burst(VFXPresets.windGust([pos.x, pos.y, pos.z], [0, 1, 0], 16));
      vfx.burst(VFXPresets.dustPuff([pos.x, pos.y - 0.5, pos.z], 10));
    },
  });
}

/**
 * Spawn a holy cast circle under the caster's feet during spell charge.
 * Flat on the ground, slowly rotating, glowing gold/white.
 * Automatically despawns when the cast ends.
 */
export function spawnCastCircle(
  scene: THREE.Scene | THREE.Group,
  position: [number, number, number],
  opts?: { color?: number; scale?: number; duration?: number; element?: string },
): MeshVFXInstance | null {
  // Element-specific colors
  const elementColors: Record<string, number> = {
    fire: 0xff6600, ice: 0x44ccff, lightning: 0xeeeeff,
    shadow: 0x6622aa, arcane: 0x4488ff, nature: 0x44ff88,
    holy: 0xffeeaa,
  };
  const color = opts?.color ?? elementColors[opts?.element ?? "holy"] ?? 0xffeeaa;

  // Place flat on ground (Y = ground level)
  return spawnMeshVFX("cast_circle", scene, {
    position: [position[0], position[1] - 0.8, position[2]], // slightly below feet
    scale: opts?.scale ?? 1,
    duration: opts?.duration ?? 3,
    color,
    onExpire: (pos) => {
      // Gentle upward particle burst when cast completes
      vfx.burst(VFXPresets.healPulse([pos.x, pos.y + 0.5, pos.z], 8));
    },
  });
}

/**
 * Spawn a magic orb projectile — the universal spell projectile.
 * Color it per element. Moves toward target with wisp trail.
 */
export function spawnMagicOrb(
  scene: THREE.Scene | THREE.Group,
  position: [number, number, number],
  direction: [number, number, number],
  opts?: {
    color?: number;
    speed?: number;
    element?: string;
    seekTarget?: [number, number, number];
    scale?: number;
    duration?: number;
  },
): MeshVFXInstance | null {
  const elementColors: Record<string, number> = {
    fire: 0xff4400, ice: 0x44aaff, lightning: 0xeeeeff,
    shadow: 0x9944ff, arcane: 0x4488ff, nature: 0x44ff88,
  };
  const color = opts?.color ?? elementColors[opts?.element ?? "arcane"] ?? 0x4488ff;
  const speed = opts?.speed ?? 15;

  return spawnMeshVFX("magic_orb", scene, {
    position,
    velocity: [direction[0] * speed, direction[1] * speed, direction[2] * speed],
    color,
    scale: opts?.scale ?? 1,
    duration: opts?.duration ?? 3,
    seekTarget: opts?.seekTarget,
    seekRate: 3,
    onExpire: (pos) => {
      const element = opts?.element ?? "arcane";
      vfx.burst(VFXPresets.spellImpact([pos.x, pos.y, pos.z], element as any));
    },
  });
}

/**
 * Spawn a hex force field shield around a character.
 * Used for: perfect parry flash, shield buff, protective magic, counter.
 */
export function spawnHexShield(
  scene: THREE.Scene | THREE.Group,
  position: [number, number, number],
  opts?: { color?: number; scale?: number; duration?: number },
): MeshVFXInstance | null {
  return spawnMeshVFX("hex_shield", scene, {
    position,
    scale: opts?.scale ?? 1,
    duration: opts?.duration ?? 1.5,
    color: opts?.color ?? 0x44aaff,
    onExpire: (pos) => {
      vfx.burst(VFXPresets.perfectParry([pos.x, pos.y, pos.z]));
    },
  });
}

/**
 * Spawn a spark explosion at an impact point.
 * Used for: spell impact, explosive arrow, crit hit burst.
 */
export function spawnSparkExplosion(
  scene: THREE.Scene | THREE.Group,
  position: [number, number, number],
  opts?: { color?: number; scale?: number },
): MeshVFXInstance | null {
  return spawnMeshVFX("sparks_explosion", scene, {
    position,
    scale: opts?.scale ?? 1,
    color: opts?.color ?? 0xffaa44,
    duration: 0.6,
  });
}

/**
 * Spawn a sphere explosion for AoE magic detonation.
 * Used for: earthquake, charged spell release, classAbility AoE.
 */
export function spawnSphereExplosion(
  scene: THREE.Scene | THREE.Group,
  position: [number, number, number],
  opts?: { color?: number; scale?: number; element?: string },
): MeshVFXInstance | null {
  const elementColors: Record<string, number> = {
    fire: 0xff4400, ice: 0x44ccff, lightning: 0xeeeeff,
    shadow: 0x6622aa, arcane: 0x4488ff, nature: 0x44ff88,
  };
  return spawnMeshVFX("sphere_explosion", scene, {
    position,
    scale: opts?.scale ?? 1,
    color: opts?.color ?? elementColors[opts?.element ?? "fire"] ?? 0xff4400,
    duration: 0.8,
    onExpire: (pos) => {
      vfx.burst(VFXPresets.spellImpact([pos.x, pos.y, pos.z], (opts?.element ?? "fire") as any));
    },
  });
}

/**
 * Spawn a splash ring for AoE ground impacts.
 * Retexturable: lava (fire), water (ice), poison (nature).
 */
export function spawnSplash(
  scene: THREE.Scene | THREE.Group,
  position: [number, number, number],
  opts?: { color?: number; scale?: number; element?: string; duration?: number },
): MeshVFXInstance | null {
  const elementColors: Record<string, number> = {
    fire: 0xff4400, ice: 0x44aaff, lightning: 0xeeeeff,
    shadow: 0x6622aa, arcane: 0x4488ff, nature: 0x44ff88,
    water: 0x2266cc, lava: 0xff2200, poison: 0x33cc33,
  };
  return spawnMeshVFX("splash", scene, {
    position: [position[0], position[1] + 0.1, position[2]],
    scale: opts?.scale ?? 1,
    color: opts?.color ?? elementColors[opts?.element ?? "water"] ?? 0x4488ff,
    duration: opts?.duration ?? 1.2,
  });
}

/**
 * Spawn an energy orb projectile (fire variant of rasengan).
 * Moves in a straight line with fire trail.
 */
export function spawnFireOrb(
  scene: THREE.Scene | THREE.Group,
  position: [number, number, number],
  direction: [number, number, number],
  speed: number = 18,
): MeshVFXInstance | null {
  return spawnMeshVFX("energy_orb", scene, {
    position,
    velocity: [direction[0] * speed, direction[1] * speed, direction[2] * speed],
    color: 0xff4400,
    duration: 3,
    onExpire: (pos) => {
      vfx.burst(VFXPresets.fireBurst([pos.x, pos.y, pos.z], 24));
    },
  });
}
