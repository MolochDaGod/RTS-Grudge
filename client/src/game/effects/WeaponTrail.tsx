import { useMemo, useRef, useEffect, type RefObject } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { hasSwingArc, getSwingArcDef } from "../anim/SwingArcs";

/**
 * Ribbon trail that follows a weapon's blade tip during attack windows.
 *
 * Sampling: each frame while `active` is true we read the world position of
 * the blade tip — derived from the `weapon_*` group attached to the supplied
 * bone (or, if no weapon group exists yet, from the bone itself plus a
 * forward offset so unarmed/fists characters still get a flair). The last
 * `SEGMENTS` samples form a CatmullRom curve that we re-tessellate into a
 * triangle-strip ribbon (top + bottom vertex pair per segment, perpendicular
 * to the swing direction).
 *
 * Fade: every sample is timestamped at insertion time. Per-vertex alpha
 * decays from 1 → 0 over `FADE_MS` (~250ms) so the tail naturally trails
 * behind the blade and the ribbon disappears shortly after `active` drops.
 *
 * Charge tier:
 *   0 → white, narrow
 *   1 → cyan, slightly wider
 *   2 → orange, widest + brightest
 * The full charge palette/width table is in TIER_VISUALS below; the wired-up
 * charged attack states (chargeAttack / chargeAttackMax / chargeFist /
 * chargeStrike) are routed through the player's chargeTier mirror.
 *
 * For monster enemies (no rig hand bone) the caller can pass a `originRef`
 * (a Group ref); we'll sample its world position as the tip — the result is
 * a visual-only flourish near the chest, which still reads as "this attack
 * has weight" without faking a weapon they don't carry.
 */

const SEGMENTS = 24; // ribbon point count
const FADE_MS = 250; // age at which a sample alpha drops to 0 (tier-0 baseline)
const MIN_MOVE_SQ = 1e-6; // skip near-duplicate samples

export type ChargeTier = 0 | 1 | 2;

interface TierVisual {
  color: THREE.Color;
  widthMul: number;
  intensity: number;
}

// Cyan/orange palette mirrors SwordBlinkFlash / charge glow tinting in the
// player so the trail visually matches the charged-blade halo.
const TIER_VISUALS: Record<ChargeTier | "chargeStrike", TierVisual> = {
  0: { color: new THREE.Color("#ffffff"), widthMul: 1.0, intensity: 1.0 },
  1: { color: new THREE.Color("#7ad7ff"), widthMul: 1.25, intensity: 1.4 },
  2: { color: new THREE.Color("#ffaa44"), widthMul: 1.55, intensity: 1.8 },
  // Final perfect-charge release. Reuses tier-2 sizing but shifts to a
  // brighter near-white so the strike reads as the climax.
  chargeStrike: { color: new THREE.Color("#fff1c2"), widthMul: 1.7, intensity: 2.2 },
};

/**
 * Per-weapon-type ribbon profile. Lets each weapon read distinct without
 * touching the swing arc data:
 *   baseWidth — world units of the ribbon at tier 0 (before tier widthMul)
 *   tier0Color — base ribbon color at tier 0 (charge tiers still override)
 *   widthScale — extra multiplier stacked on top of baseWidth + tier mul
 *   lengthScale — multiplier on FADE_MS so e.g. greatsword ribbons linger
 *
 * Charged-tier palette/width still wins for tier ≥ 1 so the cyan/orange
 * charge ramp remains a consistent gameplay tell across weapons.
 */
interface WeaponTrailProfile {
  baseWidth: number;
  tier0Color: THREE.Color;
  widthScale?: number;
  lengthScale?: number;
}

const DEFAULT_PROFILE: WeaponTrailProfile = {
  baseWidth: 0.06,
  tier0Color: new THREE.Color("#ffffff"),
};

const WEAPON_TRAIL_PROFILES: Record<string, WeaponTrailProfile> = {
  // Standard sword — clean cool-white ribbon.
  sword:      { baseWidth: 0.07, tier0Color: new THREE.Color("#e6f5ff") },
  // Greatsword — much wider, lingers longer.
  greatsword: { baseWidth: 0.11, tier0Color: new THREE.Color("#cfe9ff"), widthScale: 1.1, lengthScale: 1.4 },
  // Dagger — short, narrow, warm flicker.
  dagger:     { baseWidth: 0.04, tier0Color: new THREE.Color("#fff7d4"), lengthScale: 0.7 },
  // Polearms — long, heavy.
  poleaxe:    { baseWidth: 0.10, tier0Color: new THREE.Color("#ffe8c2"), lengthScale: 1.3 },
  spear:      { baseWidth: 0.05, tier0Color: new THREE.Color("#dfe8ff"), lengthScale: 1.25 },
  // Axe / hammer — chunky warm streak.
  axe:        { baseWidth: 0.09, tier0Color: new THREE.Color("#ffd9b8"), lengthScale: 1.15 },
  hammer:     { baseWidth: 0.10, tier0Color: new THREE.Color("#fff0a8"), lengthScale: 1.2 },
  // Fists — narrow, short knuckle streak.
  fists:      { baseWidth: 0.045, tier0Color: new THREE.Color("#ffc99a"), lengthScale: 0.75 },
  // Caster sticks — faint violet wash.
  staff:      { baseWidth: 0.06, tier0Color: new THREE.Color("#c8b6ff"), lengthScale: 1.1 },
  wand:       { baseWidth: 0.04, tier0Color: new THREE.Color("#c8b6ff"), lengthScale: 0.8 },
};

function resolveWeaponProfile(weaponType?: string | null): WeaponTrailProfile {
  if (!weaponType) return DEFAULT_PROFILE;
  return WEAPON_TRAIL_PROFILES[weaponType] ?? DEFAULT_PROFILE;
}

export interface WeaponTrailProps {
  /** Source bone (right hand). The blade tip is derived from `weapon_*` children. */
  bone: RefObject<THREE.Object3D | null>;
  /** Fallback origin when there is no rigged hand bone (e.g. monster enemies). */
  originRef?: RefObject<THREE.Object3D | null>;
  /** Trail emits while this is true; otherwise it just decays + hides. */
  active: boolean;
  /** Charge tier from the player; ignored (stays 0) for non-player carriers. */
  chargeTier?: ChargeTier;
  /**
   * Live ref alternative to `chargeTier`. Read each frame so charge
   * transitions inside useFrame (which mutate refs without re-rendering)
   * are picked up without the parent having to mirror them into state.
   */
  chargeTierRef?: RefObject<number>;
  /** Set true on the chargeStrike release to flash the climax palette. */
  chargeStrikeFlash?: boolean;
  /** Live-ref variant of `chargeStrikeFlash`. */
  chargeStrikeFlashRef?: RefObject<boolean>;
  /**
   * Base ribbon width in world units before tier multiplier. When set,
   * overrides whatever the resolved `weaponType` profile would supply
   * (handy for monsters / bespoke effects).
   */
  baseWidth?: number;
  /**
   * Equipped weapon-type id (sword / greatsword / dagger / spear /
   * poleaxe / axe / hammer / fists / staff / wand …). Selects the
   * per-weapon-type ribbon profile (base width + tier-0 color + length).
   */
  weaponType?: string | null;
  /**
   * Live-ref to the current attack id (e.g. "attack1", "heavyAttack",
   * "spinSlash", "chargeStrike"). Read each frame so the per-attack
   * trail length / width scaling from `SwingArcs` follows whichever swing
   * is actually playing without React re-renders.
   */
  attackIdRef?: RefObject<string | null>;
}

/**
 * Resolve the blade-tip local position by reading the weapon group attached
 * to the bone. Cached on `weapon.userData.bladeTipLocal` after the first
 * lookup — `normalizeWeaponGroup` aligns the longest axis to +Y so the tip
 * sits at +Y of the world bbox. Returns null when no weapon is present
 * (caller falls back to the bone's own position).
 */
function getOrComputeTipLocal(weapon: THREE.Object3D): THREE.Vector3 {
  const cached = weapon.userData.bladeTipLocal as THREE.Vector3 | undefined;
  if (cached) return cached;
  weapon.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(weapon);
  if (!isFinite(box.min.x) || !isFinite(box.max.y)) {
    const fallback = new THREE.Vector3(0, 0.5, 0);
    weapon.userData.bladeTipLocal = fallback;
    return fallback;
  }
  // Find the world-space box corner farthest from the weapon's origin
  // (which is the grip anchor) — that's the visible blade tip regardless of
  // which axis the original GLB modeled the blade along.
  const origin = new THREE.Vector3();
  weapon.getWorldPosition(origin);
  const corners = [
    new THREE.Vector3(box.min.x, box.min.y, box.min.z),
    new THREE.Vector3(box.min.x, box.min.y, box.max.z),
    new THREE.Vector3(box.min.x, box.max.y, box.min.z),
    new THREE.Vector3(box.min.x, box.max.y, box.max.z),
    new THREE.Vector3(box.max.x, box.min.y, box.min.z),
    new THREE.Vector3(box.max.x, box.min.y, box.max.z),
    new THREE.Vector3(box.max.x, box.max.y, box.min.z),
    new THREE.Vector3(box.max.x, box.max.y, box.max.z),
  ];
  let bestWorld = corners[0];
  let bestDistSq = origin.distanceToSquared(bestWorld);
  for (let i = 1; i < corners.length; i++) {
    const d = origin.distanceToSquared(corners[i]);
    if (d > bestDistSq) { bestDistSq = d; bestWorld = corners[i]; }
  }
  // Convert world-space corner back into the weapon's local frame so we can
  // re-apply matrixWorld each frame without re-running the bbox sweep.
  const local = weapon.worldToLocal(bestWorld.clone());
  weapon.userData.bladeTipLocal = local;
  return local;
}

function findWeaponChild(bone: THREE.Object3D): THREE.Object3D | null {
  for (const c of bone.children) {
    if (c.name && c.name.startsWith("weapon_")) return c;
  }
  return null;
}

export function WeaponTrail({
  bone,
  originRef,
  active,
  chargeTier = 0,
  chargeTierRef,
  chargeStrikeFlash = false,
  chargeStrikeFlashRef,
  baseWidth,
  weaponType,
  attackIdRef,
}: WeaponTrailProps) {
  const profile = useMemo(() => resolveWeaponProfile(weaponType), [weaponType]);
  const resolvedBaseWidth = baseWidth ?? profile.baseWidth;
  const profileWidthScale = profile.widthScale ?? 1;
  const profileLengthScale = profile.lengthScale ?? 1;
  const meshRef = useRef<THREE.Mesh>(null);
  const matRef = useRef<THREE.MeshBasicMaterial>(null);

  // Ring buffer of sampled tip positions + insertion timestamps.
  const samples = useMemo(() => {
    const positions: THREE.Vector3[] = [];
    const times: number[] = [];
    for (let i = 0; i < SEGMENTS; i++) {
      positions.push(new THREE.Vector3());
      times.push(-Infinity);
    }
    return { positions, times, head: 0, lastTip: new THREE.Vector3(), valid: false };
  }, []);

  // BufferGeometry: 2 vertices per segment (top + bottom of ribbon) +
  // per-vertex color (RGB) and alpha (A) packed via vertex colors. We
  // rebuild positions/colors every frame.
  const { geometry, posAttr, colorAttr } = useMemo(() => {
    const g = new THREE.BufferGeometry();
    const verts = SEGMENTS * 2;
    const positions = new Float32Array(verts * 3);
    const colors = new Float32Array(verts * 4); // RGBA
    const indices: number[] = [];
    for (let i = 0; i < SEGMENTS - 1; i++) {
      const a = i * 2;
      const b = a + 1;
      const c = a + 2;
      const d = a + 3;
      indices.push(a, b, c);
      indices.push(b, d, c);
    }
    const posA = new THREE.BufferAttribute(positions, 3);
    const colA = new THREE.BufferAttribute(colors, 4);
    posA.setUsage(THREE.DynamicDrawUsage);
    colA.setUsage(THREE.DynamicDrawUsage);
    g.setAttribute("position", posA);
    g.setAttribute("color", colA);
    g.setIndex(indices);
    return { geometry: g, posAttr: posA, colorAttr: colA };
  }, []);

  useEffect(() => {
    return () => geometry.dispose();
  }, [geometry]);

  const tmpTip = useMemo(() => new THREE.Vector3(), []);
  const tmpDir = useMemo(() => new THREE.Vector3(), []);
  const tmpUp = useMemo(() => new THREE.Vector3(0, 1, 0), []);
  const tmpPerp = useMemo(() => new THREE.Vector3(), []);

  useFrame((_, delta) => {
    void delta;
    const mesh = meshRef.current;
    if (!mesh) return;

    const liveTier = chargeTierRef?.current ?? chargeTier;
    const liveStrike = chargeStrikeFlashRef?.current ?? chargeStrikeFlash;
    const tier = liveStrike ? "chargeStrike" : (Math.max(0, Math.min(2, liveTier ?? 0)) as ChargeTier);
    const visual = TIER_VISUALS[tier];
    // At tier 0 the weapon-type tint wins (so sword/axe/fists each look
    // distinct); charge tiers keep the cyan/orange ramp so the gameplay
    // tell stays consistent across weapons.
    const drawColor = tier === 0 ? profile.tier0Color : visual.color;
    // Per-attack ribbon scaling pulled from SwingArcs metadata. Heavy /
    // spin / charge attacks publish trailWidth + trailLength > 1, light
    // jabs default to 1.
    const liveAttackId = attackIdRef?.current ?? null;
    let attackWidthMul = 1;
    let attackLengthMul = 1;
    if (liveAttackId && hasSwingArc(liveAttackId)) {
      const def = getSwingArcDef(liveAttackId);
      if (def.trailWidth) attackWidthMul = def.trailWidth;
      if (def.trailLength) attackLengthMul = def.trailLength;
    }
    const fadeMs = FADE_MS * profileLengthScale * attackLengthMul;

    // --- Sample blade tip if active --------------------------------------
    const now = performance.now();
    let gotSample = false;
    if (active) {
      const b = bone.current;
      const o = originRef?.current;
      if (b) {
        const weapon = findWeaponChild(b);
        if (weapon) {
          weapon.updateMatrixWorld(true);
          const local = getOrComputeTipLocal(weapon);
          tmpTip.copy(local).applyMatrix4(weapon.matrixWorld);
          gotSample = true;
        } else {
          // Unarmed: sample the hand bone itself, slightly out from the palm
          // along world +Z so the trail isn't a single static dot.
          b.updateMatrixWorld(true);
          tmpTip.setFromMatrixPosition(b.matrixWorld);
          gotSample = true;
        }
      } else if (o) {
        o.updateMatrixWorld(true);
        tmpTip.setFromMatrixPosition(o.matrixWorld);
        // Lift the sample a bit so it reads as a chest-height swipe rather
        // than a footprint streak on the ground.
        tmpTip.y += 0.6;
        gotSample = true;
      }

      if (gotSample) {
        // Skip duplicate samples (frames with no movement) to avoid the
        // ribbon collapsing into degenerate triangles.
        if (!samples.valid || tmpTip.distanceToSquared(samples.lastTip) > MIN_MOVE_SQ) {
          samples.head = (samples.head - 1 + SEGMENTS) % SEGMENTS;
          samples.positions[samples.head].copy(tmpTip);
          samples.times[samples.head] = now;
          samples.lastTip.copy(tmpTip);
          samples.valid = true;
        }
      }
    }

    // --- Build ribbon vertices from the most recent samples --------------
    const positions = posAttr.array as Float32Array;
    const colors = colorAttr.array as Float32Array;
    const widthHalf = resolvedBaseWidth * visual.widthMul * profileWidthScale * attackWidthMul * 0.5;

    let anyVisible = false;
    for (let i = 0; i < SEGMENTS; i++) {
      const idx = (samples.head + i) % SEGMENTS;
      const p = samples.positions[idx];
      const t = samples.times[idx];
      const ageMs = now - t;
      const alpha = ageMs >= 0 && ageMs <= fadeMs ? 1 - ageMs / fadeMs : 0;
      if (alpha > 0) anyVisible = true;

      // Direction: previous → next sample so the ribbon's perpendicular
      // axis tracks the swing arc, not just world up.
      const prev = samples.positions[(samples.head + Math.max(0, i - 1)) % SEGMENTS];
      const next = samples.positions[(samples.head + Math.min(SEGMENTS - 1, i + 1)) % SEGMENTS];
      tmpDir.subVectors(next, prev);
      if (tmpDir.lengthSq() < 1e-8) tmpDir.set(0, 0, 1);
      tmpDir.normalize();
      tmpPerp.crossVectors(tmpDir, tmpUp);
      if (tmpPerp.lengthSq() < 1e-8) tmpPerp.set(1, 0, 0);
      tmpPerp.normalize().multiplyScalar(widthHalf);

      const a = i * 2;
      const b = a + 1;
      positions[a * 3 + 0] = p.x + tmpPerp.x;
      positions[a * 3 + 1] = p.y + tmpPerp.y;
      positions[a * 3 + 2] = p.z + tmpPerp.z;
      positions[b * 3 + 0] = p.x - tmpPerp.x;
      positions[b * 3 + 1] = p.y - tmpPerp.y;
      positions[b * 3 + 2] = p.z - tmpPerp.z;

      const r = drawColor.r * visual.intensity;
      const g = drawColor.g * visual.intensity;
      const bch = drawColor.b * visual.intensity;
      colors[a * 4 + 0] = r;
      colors[a * 4 + 1] = g;
      colors[a * 4 + 2] = bch;
      colors[a * 4 + 3] = alpha;
      colors[b * 4 + 0] = r;
      colors[b * 4 + 1] = g;
      colors[b * 4 + 2] = bch;
      colors[b * 4 + 3] = alpha;
    }
    posAttr.needsUpdate = true;
    colorAttr.needsUpdate = true;

    mesh.visible = anyVisible;
    if (matRef.current) matRef.current.opacity = anyVisible ? 1 : 0;
  });

  return (
    <mesh ref={meshRef} frustumCulled={false} renderOrder={5}>
      <primitive object={geometry} attach="geometry" />
      <meshBasicMaterial
        ref={matRef}
        vertexColors
        transparent
        depthWrite={false}
        side={THREE.DoubleSide}
        blending={THREE.AdditiveBlending}
        toneMapped={false}
      />
    </mesh>
  );
}
