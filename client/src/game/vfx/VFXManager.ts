import * as THREE from "three";

/**
 * VFXManager — a single CPU-driven particle pool that renders every effect
 * (fire, blood, magic wisps, casting swirls, projectile trails, sparks,
 * bullet streaks) through one batched `THREE.Points` mesh.
 *
 * The architecture mirrors the *aesthetic* of the WebGPU TSL "linked
 * particles" example (https://threejs.org/examples/?q=particle#webgpu_tsl_vfx_linkedparticles)
 * even though we run on standard WebGL: a single mesh holds a pre-allocated
 * pool of slots, anyone can `emit` one particle per frame at a moving
 * source to form a *linked stream*, and per-particle lifetime drives a
 * color/size ramp that fades out cleanly with additive blending.
 *
 * Why one pool / one draw call:
 *  - Existing project effects each allocate their own buffer + shader and
 *    pay a draw call apiece. Adding many event-driven puffs (every hit,
 *    every projectile frame) used to mean N draw calls per frame.
 *  - With a shared pool the worst case stays at one draw call regardless
 *    of how many emissions happen — vital for the user's "seamless but
 *    not over-stating" requirement: we can emit liberally without paying
 *    for every emission.
 */

/** Per-emission spec describing a single particle. */
export interface ParticleSpec {
  /** World-space spawn position. */
  position: THREE.Vector3 | [number, number, number];
  /** Initial linear velocity (world units / second). */
  velocity?: THREE.Vector3 | [number, number, number];
  /** Color at birth. Multiplied by per-frame emissive intensity. */
  colorStart: THREE.Color | string | number;
  /** Color at death. Lerped over normalized lifetime. */
  colorEnd: THREE.Color | string | number;
  /** Render size at birth, in world units (sprite quad edge length). */
  sizeStart: number;
  /** Render size at death. */
  sizeEnd: number;
  /** Lifetime in seconds. */
  lifetime: number;
  /** Per-second downward acceleration. Defaults to 0 (magic floats). */
  gravity?: number;
  /** Linear damping (0 = no damping, 0.95 = strong drag per second). */
  damping?: number;
  /**
   * Curl-noise drift strength. Adds an organic per-frame tug to velocity
   * so trails don't look perfectly linear — what gives the linked-particle
   * demo its silky "ribbon caught in wind" quality.
   */
  drift?: number;
}

/** Burst emission spec — spawn many particles in one call. */
export interface BurstSpec extends Omit<ParticleSpec, "velocity"> {
  /** Number of particles to spawn. Clamped to pool capacity. */
  count: number;
  /** Mean speed of each particle's outward velocity. */
  speed: number;
  /** Random spread of speed (0 = exact, 0.5 = ±50%). */
  speedJitter?: number;
  /**
   * Cone direction. If omitted, particles fly omnidirectionally.
   * If provided, particles spread inside a half-angle `coneAngle` cone
   * around this axis.
   */
  direction?: THREE.Vector3 | [number, number, number];
  /** Half-angle in radians for the spawn cone. Ignored if `direction` omitted. */
  coneAngle?: number;
  /** Inherited base velocity (e.g. the source's own velocity). */
  baseVelocity?: THREE.Vector3 | [number, number, number];
}

const _tmpV = new THREE.Vector3();
const _tmpDir = new THREE.Vector3();
const _tmpAxis = new THREE.Vector3();
const _tmpQ = new THREE.Quaternion();

/**
 * Soft 3D-ish curl noise approximation. Cheap, stable, and good enough
 * to give particles an organic wobble without a real noise texture.
 * Returns a unit-magnitude(ish) drift vector for `(x, y, z, t)`.
 */
function curlSample(x: number, y: number, z: number, t: number, out: THREE.Vector3) {
  const sx = Math.sin(x * 1.3 + t * 0.7) + Math.cos(z * 0.9 - t * 0.5);
  const sy = Math.sin(y * 1.7 + t * 0.6) + Math.cos(x * 1.1 + t * 0.3);
  const sz = Math.sin(z * 1.5 - t * 0.4) + Math.cos(y * 1.2 + t * 0.8);
  out.set(sx, sy, sz).multiplyScalar(0.5);
}

export class VFXManager {
  /** Maximum live particles. Single batched draw, ~6k is comfortable. */
  readonly capacity: number;

  // Per-particle SoA arrays — kept on the manager so the React component
  // can hand them to BufferAttributes once and just flip needsUpdate.
  readonly positions: Float32Array;
  readonly velocities: Float32Array;
  readonly colors: Float32Array;          // current rgb (lerped each frame)
  readonly colorStarts: Float32Array;
  readonly colorEnds: Float32Array;
  readonly sizes: Float32Array;           // current size (lerped each frame)
  readonly sizeStarts: Float32Array;
  readonly sizeEnds: Float32Array;
  readonly ages: Float32Array;            // -1 means "slot free"
  readonly lifetimes: Float32Array;
  readonly gravities: Float32Array;
  readonly dampings: Float32Array;
  readonly drifts: Float32Array;

  /** Index of next slot to try when allocating. Wraps. */
  private cursor = 0;
  /** Live particle count — useful for debug HUDs. */
  aliveCount = 0;
  /** Wall-clock simulation time (seconds). */
  private time = 0;
  /**
   * The last `clock.elapsedTime` we stepped at. Multiple VFXSystem
   * components can be mounted simultaneously (e.g. two Physics roots in
   * the same scene), and each one calls `update()` from its own useFrame.
   * Without this guard the singleton would get integrated 2× per render
   * and particles would age at double speed. We skip any redundant call
   * that arrives with the same (or older) elapsed time.
   */
  private lastUpdateAt = -1;

  // Scratch color objects so we don't allocate per emission.
  private readonly _scratchColorA = new THREE.Color();
  private readonly _scratchColorB = new THREE.Color();

  constructor(capacity = 6000) {
    this.capacity = capacity;
    this.positions = new Float32Array(capacity * 3);
    this.velocities = new Float32Array(capacity * 3);
    this.colors = new Float32Array(capacity * 3);
    this.colorStarts = new Float32Array(capacity * 3);
    this.colorEnds = new Float32Array(capacity * 3);
    this.sizes = new Float32Array(capacity);
    this.sizeStarts = new Float32Array(capacity);
    this.sizeEnds = new Float32Array(capacity);
    this.ages = new Float32Array(capacity);
    this.lifetimes = new Float32Array(capacity);
    this.gravities = new Float32Array(capacity);
    this.dampings = new Float32Array(capacity);
    this.drifts = new Float32Array(capacity);
    // Mark every slot as free.
    for (let i = 0; i < capacity; i++) this.ages[i] = -1;
  }

  /**
   * Allocate the next free slot (linear scan from cursor). Returns -1 if
   * the pool is full — callers should silently drop the particle in that
   * case, since the pool size is sized for the worst case the gameplay
   * will throw at it.
   */
  private allocSlot(): number {
    for (let n = 0; n < this.capacity; n++) {
      const i = (this.cursor + n) % this.capacity;
      if (this.ages[i] < 0) {
        this.cursor = (i + 1) % this.capacity;
        return i;
      }
    }
    return -1;
  }

  private writeColor(target: Float32Array, slot: number, color: THREE.Color) {
    const o = slot * 3;
    target[o] = color.r;
    target[o + 1] = color.g;
    target[o + 2] = color.b;
  }

  /**
   * Spawn a single particle. Preferred over `burst` when emitting one
   * particle per frame to form a linked trail behind a moving source —
   * this is the core idiom borrowed from the linked-particles demo.
   */
  emit(spec: ParticleSpec): number {
    const slot = this.allocSlot();
    if (slot < 0) return -1;

    const o = slot * 3;
    if (Array.isArray(spec.position)) {
      this.positions[o] = spec.position[0];
      this.positions[o + 1] = spec.position[1];
      this.positions[o + 2] = spec.position[2];
    } else {
      this.positions[o] = spec.position.x;
      this.positions[o + 1] = spec.position.y;
      this.positions[o + 2] = spec.position.z;
    }

    if (spec.velocity) {
      if (Array.isArray(spec.velocity)) {
        this.velocities[o] = spec.velocity[0];
        this.velocities[o + 1] = spec.velocity[1];
        this.velocities[o + 2] = spec.velocity[2];
      } else {
        this.velocities[o] = spec.velocity.x;
        this.velocities[o + 1] = spec.velocity.y;
        this.velocities[o + 2] = spec.velocity.z;
      }
    } else {
      this.velocities[o] = 0;
      this.velocities[o + 1] = 0;
      this.velocities[o + 2] = 0;
    }

    this._scratchColorA.set(spec.colorStart as THREE.ColorRepresentation);
    this._scratchColorB.set(spec.colorEnd as THREE.ColorRepresentation);
    this.writeColor(this.colorStarts, slot, this._scratchColorA);
    this.writeColor(this.colorEnds, slot, this._scratchColorB);
    this.writeColor(this.colors, slot, this._scratchColorA);

    this.sizeStarts[slot] = spec.sizeStart;
    this.sizeEnds[slot] = spec.sizeEnd;
    this.sizes[slot] = spec.sizeStart;

    this.ages[slot] = 0;
    this.lifetimes[slot] = spec.lifetime;
    this.gravities[slot] = spec.gravity ?? 0;
    this.dampings[slot] = spec.damping ?? 0;
    this.drifts[slot] = spec.drift ?? 0;

    this.aliveCount++;
    return slot;
  }

  /**
   * Spawn many particles at once — for impact bursts (blood splatter, hit
   * sparks, fireball pop). Direction & cone control whether they fly
   * omnidirectionally or in a focused jet.
   */
  burst(spec: BurstSpec): void {
    const baseVx = spec.baseVelocity
      ? Array.isArray(spec.baseVelocity) ? spec.baseVelocity[0] : spec.baseVelocity.x
      : 0;
    const baseVy = spec.baseVelocity
      ? Array.isArray(spec.baseVelocity) ? spec.baseVelocity[1] : spec.baseVelocity.y
      : 0;
    const baseVz = spec.baseVelocity
      ? Array.isArray(spec.baseVelocity) ? spec.baseVelocity[2] : spec.baseVelocity.z
      : 0;

    const hasDir = !!spec.direction;
    if (hasDir) {
      if (Array.isArray(spec.direction!)) {
        _tmpDir.set(spec.direction![0], spec.direction![1], spec.direction![2]);
      } else {
        _tmpDir.copy(spec.direction!);
      }
      _tmpDir.normalize();
    }
    const cone = spec.coneAngle ?? Math.PI; // Math.PI = full sphere
    const sjitter = spec.speedJitter ?? 0.3;

    const count = Math.min(spec.count, this.capacity);
    for (let i = 0; i < count; i++) {
      let vx: number, vy: number, vz: number;
      if (hasDir) {
        // Random unit vector inside a cone around _tmpDir.
        const cosA = Math.cos(cone);
        const u = Math.random() * (1 - cosA) + cosA;
        const phi = Math.random() * Math.PI * 2;
        const sinT = Math.sqrt(1 - u * u);
        // Build a cone-local vector then rotate it onto _tmpDir.
        _tmpV.set(Math.cos(phi) * sinT, Math.sin(phi) * sinT, u);
        _tmpAxis.set(0, 0, 1);
        _tmpQ.setFromUnitVectors(_tmpAxis, _tmpDir);
        _tmpV.applyQuaternion(_tmpQ);
        vx = _tmpV.x; vy = _tmpV.y; vz = _tmpV.z;
      } else {
        // Uniform sphere.
        const u = Math.random() * 2 - 1;
        const phi = Math.random() * Math.PI * 2;
        const sinT = Math.sqrt(Math.max(0, 1 - u * u));
        vx = Math.cos(phi) * sinT;
        vy = Math.sin(phi) * sinT;
        vz = u;
      }
      const speed = spec.speed * (1 + (Math.random() * 2 - 1) * sjitter);
      this.emit({
        position: spec.position,
        velocity: [
          baseVx + vx * speed,
          baseVy + vy * speed,
          baseVz + vz * speed,
        ],
        colorStart: spec.colorStart,
        colorEnd: spec.colorEnd,
        sizeStart: spec.sizeStart,
        sizeEnd: spec.sizeEnd,
        lifetime: spec.lifetime,
        gravity: spec.gravity,
        damping: spec.damping,
        drift: spec.drift,
      });
    }
  }

  /**
   * Step the entire pool by `dt` seconds. Integrates velocity, gravity,
   * damping, curl drift, and lerps color + size along normalized lifetime.
   * Returns the alive count (so the React layer can set draw range).
   *
   * `nowTag` (optional) is a monotonic wall-clock value (e.g.
   * `state.clock.elapsedTime`) used to dedupe multiple update() calls
   * within the same render frame — see `lastUpdateAt`.
   */
  update(dt: number, nowTag?: number): number {
    if (nowTag !== undefined) {
      if (nowTag <= this.lastUpdateAt) return this.aliveCount;
      this.lastUpdateAt = nowTag;
    }
    if (dt <= 0) return this.aliveCount;
    // Clamp dt so a tab-swap or breakpoint doesn't fling everything.
    if (dt > 0.1) dt = 0.1;
    this.time += dt;
    let alive = 0;

    for (let i = 0; i < this.capacity; i++) {
      const age = this.ages[i];
      if (age < 0) continue;

      const newAge = age + dt;
      const life = this.lifetimes[i];
      if (newAge >= life) {
        this.ages[i] = -1;
        // Park the dead slot far below the world so its leftover render
        // (until the next position upload) is invisible.
        this.positions[i * 3 + 1] = -10000;
        continue;
      }
      this.ages[i] = newAge;
      alive++;

      const o = i * 3;
      // Drift via curl noise.
      const drift = this.drifts[i];
      if (drift > 0) {
        curlSample(this.positions[o], this.positions[o + 1], this.positions[o + 2], this.time, _tmpV);
        this.velocities[o] += _tmpV.x * drift * dt;
        this.velocities[o + 1] += _tmpV.y * drift * dt;
        this.velocities[o + 2] += _tmpV.z * drift * dt;
      }
      // Damping.
      const damp = this.dampings[i];
      if (damp > 0) {
        const k = Math.exp(-damp * dt);
        this.velocities[o] *= k;
        this.velocities[o + 1] *= k;
        this.velocities[o + 2] *= k;
      }
      // Gravity.
      this.velocities[o + 1] -= this.gravities[i] * dt;
      // Integrate.
      this.positions[o] += this.velocities[o] * dt;
      this.positions[o + 1] += this.velocities[o + 1] * dt;
      this.positions[o + 2] += this.velocities[o + 2] * dt;

      // Lifetime ramps.
      const t = newAge / life;
      this.sizes[i] = this.sizeStarts[i] * (1 - t) + this.sizeEnds[i] * t;
      const cs = i * 3;
      this.colors[cs]     = this.colorStarts[cs]     * (1 - t) + this.colorEnds[cs]     * t;
      this.colors[cs + 1] = this.colorStarts[cs + 1] * (1 - t) + this.colorEnds[cs + 1] * t;
      this.colors[cs + 2] = this.colorStarts[cs + 2] * (1 - t) + this.colorEnds[cs + 2] * t;
    }

    this.aliveCount = alive;
    return alive;
  }

  /** Convenience for debug HUDs / tests. */
  getTime(): number { return this.time; }

  /** Wipe the pool. Called on scene transitions. */
  clear(): void {
    for (let i = 0; i < this.capacity; i++) {
      this.ages[i] = -1;
      // Park each slot far below the world immediately. Without this,
      // the next render frame would upload the *previous* scene's last
      // positions to the GPU before update() got a chance to overwrite
      // them, producing a one-frame "ghost" of all leftover particles.
      this.positions[i * 3 + 1] = -10000;
    }
    this.aliveCount = 0;
    this.lastUpdateAt = -1;
  }
}
