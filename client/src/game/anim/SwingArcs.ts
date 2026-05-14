import * as THREE from "three";

/**
 * Per-attack swing-arc splines applied as ADDITIVE offsets on top of the
 * mixer-driven hand bone pose during layered combat states. Each arc is a
 * CatmullRom curve through a handful of local hand-space control points,
 * sampled by clip progress (0 → 1). The position offset is small (a few cm
 * in bone-local units) so it reads as flair on top of the source clip
 * without corrupting hit-window timing or combo windows.
 *
 * Tilt is a parallel small-angle Euler rotation that rolls the hand along
 * the swing direction. Both deltas blend in/out with smoothstep at the
 * clip boundaries so the additive layer never pops.
 *
 * `chargeAmpScale` is consumed by the player charge-tier wiring to widen
 * the arc on charged variants without authoring a separate spline.
 */
export type SwingArcId =
  | "attack1"
  | "attack2"
  | "attack3"
  // Aliases used by the actual layered AnimationState names emitted by the
  // controller (combatMachine COMBAT_STATE_ANIMS maps "attack1"→"attack",
  // "attack2"→"combo2", "attack3"→"combo3"). The animator's layerState is
  // the anim name, not the combat-state name, so we register both spellings
  // pointing at the same arc data via ALIAS below.
  | "attack"
  | "attack2"
  | "combo2"
  | "combo3"
  | "fastCombo"
  | "fastCombo2"
  | "uppercut"
  | "heavyAttack"
  | "spinSlash"
  | "risingSlash"
  | "counterStrike"
  | "dashAttack"
  | "chargeAttack"
  | "chargeAttackMax"
  | "chargeFist"
  | "chargeStrike"
  // Skill / class-ability anim names emitted by COMBAT_STATE_ANIMS. The
  // animator's layerState is the played anim name, so these are the
  // primary keys; the matching combat-state IDs (skill1..skill5,
  // classAbility[2|3]) are aliased below for callers that pass the
  // state name directly.
  | "hadouken"
  | "shoryuken"
  | "tatsumaki"
  | "whirlwind"
  | "swordBlaster"
  | "swordBlaster2"
  | "jumpBash"
  | "earthquake"
  | "skill1"
  | "skill2"
  | "skill3"
  | "skill4"
  | "skill5"
  | "classAbility"
  | "classAbility2"
  | "classAbility3";

export interface SwingArcDef {
  /** Position control points in local hand-bone space, sampled by progress. */
  points: THREE.Vector3[];
  /** Per-axis tilt range (radians). Tilt eases sin(πt) over the swing. */
  tilt: THREE.Euler;
  /** Multiplier applied to position+tilt amplitudes. 1 = author values. */
  amp: number;
  /** Width multiplier for the weapon trail ribbon (default 1). */
  trailWidth?: number;
  /**
   * Length multiplier for the weapon trail ribbon (default 1). Scales the
   * per-sample fade window so heavy/spin/charge attacks leave a longer
   * lingering ribbon than light jabs without changing sample count.
   */
  trailLength?: number;
}

const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

/**
 * Hand-bone local axes (mixamo / kaykit humanoids):
 *   +X ≈ along the forearm towards the fingers
 *   +Y ≈ thumb side up
 *   +Z ≈ palm-out
 *
 * We keep deltas under ~6cm so the arc reads as embellishment.
 */
const ARCS: Partial<Record<SwingArcId, SwingArcDef>> = {
  // Horizontal slash, right-to-left in front of the body.
  attack1: {
    points: [
      v( 0.04, -0.01, -0.02),
      v( 0.02,  0.01,  0.00),
      v( 0.00,  0.02,  0.03),
      v(-0.03,  0.01,  0.04),
      v(-0.04, -0.01,  0.02),
    ],
    tilt: new THREE.Euler(0, -0.18, 0.10),
    amp: 1.0,
  },
  // Reverse horizontal, left-to-right.
  attack2: {
    points: [
      v(-0.04, -0.01,  0.02),
      v(-0.02,  0.01,  0.04),
      v( 0.00,  0.02,  0.03),
      v( 0.03,  0.01,  0.00),
      v( 0.04, -0.01, -0.02),
    ],
    tilt: new THREE.Euler(0, 0.18, -0.10),
    amp: 1.0,
  },
  // Diagonal overhead chop, ending low.
  attack3: {
    points: [
      v( 0.01,  0.05, -0.03),
      v( 0.00,  0.04,  0.00),
      v(-0.01,  0.02,  0.03),
      v(-0.02, -0.01,  0.04),
      v(-0.02, -0.04,  0.02),
    ],
    tilt: new THREE.Euler(0.20, -0.10, 0.05),
    amp: 1.1,
    trailWidth: 1.1,
    trailLength: 1.15,
  },
  // Rising punch — straight up with slight outward push.
  uppercut: {
    points: [
      v( 0.00, -0.04,  0.00),
      v( 0.01, -0.01,  0.02),
      v( 0.01,  0.02,  0.04),
      v( 0.00,  0.05,  0.05),
      v(-0.01,  0.06,  0.04),
    ],
    tilt: new THREE.Euler(-0.25, 0.05, 0),
    amp: 1.0,
    trailWidth: 0.9,
  },
  // Big two-handed downward smash.
  heavyAttack: {
    points: [
      v( 0.02,  0.07, -0.04),
      v( 0.01,  0.05,  0.00),
      v( 0.00,  0.01,  0.04),
      v(-0.01, -0.04,  0.05),
      v(-0.02, -0.07,  0.02),
    ],
    tilt: new THREE.Euler(0.32, -0.08, 0.05),
    amp: 1.2,
    trailWidth: 1.4,
    trailLength: 1.4,
  },
  // 360 spin — circular arc around the body.
  spinSlash: {
    points: [
      v( 0.05,  0.00, -0.02),
      v( 0.00,  0.01,  0.05),
      v(-0.05,  0.00,  0.00),
      v( 0.00, -0.01, -0.05),
      v( 0.05,  0.00, -0.02),
    ],
    tilt: new THREE.Euler(0, 0.30, 0),
    amp: 1.15,
    trailWidth: 1.3,
    trailLength: 1.6,
  },
  // Sweep upward then forward.
  risingSlash: {
    points: [
      v( 0.00, -0.04,  0.00),
      v( 0.00, -0.01,  0.03),
      v( 0.00,  0.02,  0.05),
      v(-0.01,  0.05,  0.04),
      v(-0.02,  0.06,  0.01),
    ],
    tilt: new THREE.Euler(-0.22, 0, 0.05),
    amp: 1.0,
    trailWidth: 1.0,
  },
  counterStrike: {
    points: [
      v(-0.03,  0.00,  0.04),
      v(-0.01,  0.01,  0.05),
      v( 0.01,  0.01,  0.04),
      v( 0.03,  0.00,  0.02),
      v( 0.04, -0.01,  0.00),
    ],
    tilt: new THREE.Euler(0, 0.20, -0.08),
    amp: 1.0,
  },
  dashAttack: {
    points: [
      v( 0.00,  0.00, -0.04),
      v( 0.00,  0.00,  0.00),
      v( 0.00,  0.01,  0.04),
      v( 0.00,  0.01,  0.07),
      v( 0.00,  0.00,  0.08),
    ],
    tilt: new THREE.Euler(0, 0, 0),
    amp: 1.05,
    trailWidth: 1.1,
  },
  // Charge-released attacks — wider, longer arcs to read as more powerful.
  chargeAttack: {
    points: [
      v( 0.03,  0.05, -0.04),
      v( 0.02,  0.04,  0.00),
      v( 0.00,  0.01,  0.05),
      v(-0.02, -0.03,  0.06),
      v(-0.04, -0.06,  0.03),
    ],
    tilt: new THREE.Euler(0.28, -0.10, 0.06),
    amp: 1.3,
    trailWidth: 1.6,
    trailLength: 1.5,
  },
  chargeAttackMax: {
    points: [
      v( 0.06,  0.00, -0.03),
      v( 0.01,  0.02,  0.06),
      v(-0.06,  0.00,  0.01),
      v( 0.00, -0.02, -0.06),
      v( 0.06,  0.00, -0.03),
    ],
    tilt: new THREE.Euler(0, 0.40, 0),
    amp: 1.5,
    trailWidth: 2.0,
    trailLength: 1.9,
  },
  chargeFist: {
    points: [
      v( 0.00, -0.06,  0.00),
      v( 0.01, -0.02,  0.03),
      v( 0.01,  0.03,  0.06),
      v( 0.00,  0.07,  0.07),
      v(-0.02,  0.08,  0.05),
    ],
    tilt: new THREE.Euler(-0.32, 0.05, 0),
    amp: 1.3,
    trailWidth: 1.4,
    trailLength: 1.5,
  },
  chargeStrike: {
    points: [
      v( 0.07,  0.01, -0.04),
      v( 0.02,  0.03,  0.06),
      v(-0.07,  0.01,  0.02),
      v( 0.00, -0.02, -0.07),
      v( 0.07,  0.01, -0.04),
    ],
    tilt: new THREE.Euler(0, 0.45, 0),
    amp: 1.6,
    trailWidth: 2.2,
    trailLength: 2.0,
  },
  // ----- Skill / class-ability arcs -------------------------------------
  // hadouken (skill1): two-handed forward energy push. Hand drives from
  // chambered hip out along +Z (palm-out) with a slight downward sweep.
  hadouken: {
    points: [
      v(-0.04, -0.02, -0.05),
      v(-0.02, -0.01, -0.01),
      v( 0.00,  0.00,  0.04),
      v( 0.01,  0.01,  0.07),
      v( 0.02,  0.00,  0.08),
    ],
    tilt: new THREE.Euler(0.05, -0.10, 0),
    amp: 1.2,
    trailWidth: 1.4,
  },
  // shoryuken (skill2): rising-dragon uppercut. Tall vertical sweep with
  // outward roll — wider than the basic uppercut.
  shoryuken: {
    points: [
      v( 0.01, -0.06, -0.01),
      v( 0.02, -0.02,  0.02),
      v( 0.02,  0.03,  0.05),
      v( 0.00,  0.07,  0.06),
      v(-0.02,  0.09,  0.04),
    ],
    tilt: new THREE.Euler(-0.32, 0.08, 0.05),
    amp: 1.3,
    trailWidth: 1.5,
  },
  // tatsumaki (skill3): hurricane spin-kick — circular sweep around the
  // body, wider than spinSlash and more horizontal.
  tatsumaki: {
    points: [
      v( 0.06,  0.01, -0.03),
      v( 0.01,  0.02,  0.06),
      v(-0.06,  0.01,  0.01),
      v(-0.01,  0.00, -0.06),
      v( 0.06,  0.01, -0.03),
    ],
    tilt: new THREE.Euler(0, 0.35, 0.05),
    amp: 1.25,
    trailWidth: 1.6,
  },
  // whirlwind (skill4): tight repeating spin, smaller radius than tatsumaki
  // but pulled close to the body for a buzzsaw read.
  whirlwind: {
    points: [
      v( 0.04,  0.00, -0.02),
      v( 0.00,  0.01,  0.04),
      v(-0.04,  0.00,  0.00),
      v( 0.00, -0.01, -0.04),
      v( 0.04,  0.00, -0.02),
    ],
    tilt: new THREE.Euler(0, 0.40, 0),
    amp: 1.1,
    trailWidth: 1.3,
  },
  // swordBlaster (classAbility / classAbility3): lunging forward thrust
  // that opens into a rising flourish at the end.
  swordBlaster: {
    points: [
      v( 0.00, -0.02, -0.04),
      v( 0.00,  0.00,  0.02),
      v( 0.00,  0.01,  0.06),
      v(-0.01,  0.03,  0.07),
      v(-0.02,  0.05,  0.05),
    ],
    tilt: new THREE.Euler(-0.18, -0.05, 0.04),
    amp: 1.2,
    trailWidth: 1.5,
  },
  // swordBlaster2 (classAbility2): wider arcing slash — high-to-low
  // diagonal with extra reach over swordBlaster.
  swordBlaster2: {
    points: [
      v( 0.03,  0.06, -0.04),
      v( 0.01,  0.04,  0.01),
      v(-0.01,  0.01,  0.05),
      v(-0.03, -0.03,  0.06),
      v(-0.04, -0.06,  0.03),
    ],
    tilt: new THREE.Euler(0.30, -0.12, 0.06),
    amp: 1.3,
    trailWidth: 1.7,
  },
  // jumpBash: airborne downward smash. Hand chambers high then slams
  // straight down with a forward push.
  jumpBash: {
    points: [
      v( 0.00,  0.07, -0.02),
      v( 0.00,  0.04,  0.01),
      v( 0.00,  0.00,  0.04),
      v( 0.00, -0.05,  0.05),
      v( 0.00, -0.08,  0.03),
    ],
    tilt: new THREE.Euler(0.40, 0, 0),
    amp: 1.35,
    trailWidth: 1.6,
  },
  // earthquake: huge two-handed ground slam. Biggest amplitude in the
  // table — wide overhead chamber dropping into a hard low end.
  earthquake: {
    points: [
      v( 0.04,  0.09, -0.04),
      v( 0.02,  0.05,  0.00),
      v( 0.00,  0.00,  0.05),
      v(-0.02, -0.06,  0.06),
      v(-0.03, -0.10,  0.02),
    ],
    tilt: new THREE.Euler(0.45, -0.10, 0.08),
    amp: 1.5,
    trailWidth: 2.2,
  },
};

// Anim-name aliases. The animator's layered slot is keyed by AnimationState
// (combatMachine.COMBAT_STATE_ANIMS), not by the combat-state ID, so we
// also surface the same arc under the played anim name.
ARCS.attack     = ARCS.attack1;
ARCS.attack2    = ARCS.attack1; // legacy enemy attack name; reuse attack1 arc
ARCS.combo2     = ARCS.attack1;
ARCS.combo3     = ARCS.attack3;
ARCS.fastCombo  = ARCS.attack1;
ARCS.fastCombo2 = ARCS.attack3;
// Skill / class-ability aliases — point combat-state IDs at the same arcs
// authored under their played anim names so callers using either spelling
// resolve correctly.
ARCS.skill1         = ARCS.hadouken;
ARCS.skill2         = ARCS.shoryuken;
ARCS.skill3         = ARCS.tatsumaki;
ARCS.skill4         = ARCS.whirlwind;
ARCS.skill5         = ARCS.spinSlash;
ARCS.classAbility   = ARCS.swordBlaster;
ARCS.classAbility2  = ARCS.swordBlaster2;
ARCS.classAbility3  = ARCS.swordBlaster;

const CURVE_CACHE = new Map<SwingArcId, THREE.CatmullRomCurve3>();

function getCurve(id: SwingArcId): THREE.CatmullRomCurve3 {
  let c = CURVE_CACHE.get(id);
  if (!c) {
    const def = ARCS[id]!;
    c = new THREE.CatmullRomCurve3(def.points, false, "catmullrom", 0.5);
    CURVE_CACHE.set(id, c);
  }
  return c;
}

export function hasSwingArc(id: string): id is SwingArcId {
  return id in ARCS && ARCS[id as SwingArcId] !== undefined;
}

export function getSwingArcDef(id: SwingArcId): SwingArcDef {
  return ARCS[id]!;
}

/**
 * Smoothstep ease used to blend the additive layer in/out at clip boundaries
 * so the arc never pops on attach/detach.
 */
function easeInOut(t: number): number {
  if (t <= 0) return 0;
  if (t >= 1) return 1;
  return t * t * (3 - 2 * t);
}

/**
 * Envelope so the arc rises in over the first 15% of the clip, holds, then
 * rolls off over the last 20%. Multiplied into amplitude — at t=0 and t=1
 * the additive offset is zero so the bone is exactly the mixer pose.
 */
function envelope(t: number): number {
  const inEnd = 0.15;
  const outStart = 0.80;
  if (t < inEnd) return easeInOut(t / inEnd);
  if (t > outStart) return easeInOut((1 - t) / (1 - outStart));
  return 1;
}

const _tmp = new THREE.Vector3();

/**
 * Sample the swing arc into out-params:
 *   posOut: position offset in local hand-bone units (additive, ready to
 *           bone.position.add(...))
 *   eulerOut: tilt offset in radians (additive, ready to compose into
 *             bone.quaternion via quat.multiply(quatFromEuler))
 *
 * `t` is normalized clip progress (0..1, clamped). `ampMul` is an extra
 * multiplier the caller can pass (e.g. charge tier widens the arc).
 *
 * Returns the envelope value so the trail emitter can scale brightness/width
 * with the arc amplitude.
 */
export function sampleSwingArc(
  id: SwingArcId,
  t: number,
  posOut: THREE.Vector3,
  eulerOut: THREE.Euler,
  ampMul: number = 1,
): number {
  const def = ARCS[id];
  if (!def) {
    posOut.set(0, 0, 0);
    eulerOut.set(0, 0, 0);
    return 0;
  }
  const tt = Math.max(0, Math.min(1, t));
  const env = envelope(tt) * def.amp * ampMul;
  const curve = getCurve(id);
  curve.getPointAt(tt, _tmp);
  posOut.copy(_tmp).multiplyScalar(env);
  // Tilt envelope peaks at mid-swing.
  const tiltEnv = Math.sin(Math.PI * tt) * def.amp * ampMul;
  eulerOut.set(
    def.tilt.x * tiltEnv,
    def.tilt.y * tiltEnv,
    def.tilt.z * tiltEnv,
  );
  return env;
}
