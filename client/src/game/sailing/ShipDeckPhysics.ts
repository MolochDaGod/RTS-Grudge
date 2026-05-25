/**
 * shipDeckPhysics — keep characters glued to a moving/rocking ship deck.
 *
 * Why a custom system instead of Cannon constraints?
 *   - The ship's "physics" in this project is procedural (waves + scripted
 *     forward velocity), not driven by a rigidbody. There is no Cannon body
 *     to constrain to.
 *   - Riders need to *visually* lean and slip with the deck without ever
 *     leaving it (gameplay requirement: crew can't fall overboard from
 *     normal sailing motion).
 *
 * Design (inspired by BoatController.cs's `Slip.physicMaterial` + tilt
 * torques and Unity's `transform.parent`-style platform riding):
 *
 *   Each rider declares a *deck-local* foot anchor (relative to the ship
 *   root). Every frame we:
 *     1. Re-project the anchor into world space  →  target position.
 *     2. Inherit the deck's pitch/roll  →  target rotation (lerped via
 *        `tiltFollow`).
 *     3. Add a slip vector proportional to the deck's *world acceleration*,
 *        damped by the rider's `grip` (1 = glued, 0 = ice).
 *     4. Smooth-snap rider transform with critically-damped springs.
 *     5. Track a `balance` budget; sustained high angular velocity drains
 *        it. When it hits 0 a `stagger` event fires (host can play a
 *        stumble animation) and balance starts recovering.
 *
 * No external physics dependency — pure THREE math.
 */

import * as THREE from 'three';

export interface DeckRiderInit {
  /** Stable identifier for the rider (unit id, etc). */
  id: string;
  /** Object to drive — typically a unit's root Group. */
  rider: THREE.Object3D;
  /** Foot anchor in deck-local coordinates. */
  localAnchor: THREE.Vector3;
  /**
   * 0 = no friction (slides freely with deck acceleration),
   * 1 = perfectly glued. Default 0.85.
   */
  grip?: number;
  /**
   * 0 = ignore deck tilt, 1 = inherit deck tilt fully. Default 0.65 — feels
   * better than 1 because units stay more upright than the hull rolls.
   */
  tiltFollow?: number;
  /**
   * If `false`, position is parented (rider becomes a child of the deck).
   * If `true` (default), rider stays in world space — friendlier when other
   * systems read the rider's world transform directly.
   */
  worldSpace?: boolean;
}

interface RiderState {
  init:        DeckRiderInit;
  worldPos:    THREE.Vector3;
  worldVel:    THREE.Vector3;
  /** Smoothed roll (X) and pitch (Z) inherited from the deck. */
  appliedRoll:  number;
  appliedPitch: number;
  /** 0..1 stamina; 0 means staggered. */
  balance:     number;
  staggering:  boolean;
}

export interface DeckStaggerEvent {
  riderId: string;
  /** Magnitude of the angular shock that broke balance. */
  shock:   number;
}

export interface ShipDeckRigOpts {
  /** The ship root the riders are bolted to. */
  deck: THREE.Object3D;
  /**
   * If a rider's *world* slip exceeds this distance from its anchor, snap
   * back hard. Prevents drift accumulation. Default 0.6 m.
   */
  maxSlipDistance?: number;
  /** Angular velocity (rad/s) above which balance starts draining. */
  balanceShockThreshold?: number;
  /** How fast balance recovers per second. Default 0.4. */
  balanceRecoverPerSec?: number;
  /** Fired when a rider's balance hits 0. */
  onStagger?: (e: DeckStaggerEvent) => void;
}

export class ShipDeckRig {
  private opts: Required<Omit<ShipDeckRigOpts, 'onStagger'>> & Pick<ShipDeckRigOpts, 'onStagger'>;
  private riders = new Map<string, RiderState>();

  // Cached per-frame deck kinematics.
  private prevDeckPos     = new THREE.Vector3();
  private prevDeckVel     = new THREE.Vector3();
  private prevDeckQuat    = new THREE.Quaternion();
  private deckAccel       = new THREE.Vector3();
  private deckAngVel      = new THREE.Vector3();
  private initialised     = false;

  // Scratch.
  private _v0 = new THREE.Vector3();
  private _v1 = new THREE.Vector3();
  private _q0 = new THREE.Quaternion();
  private _e0 = new THREE.Euler();

  constructor(opts: ShipDeckRigOpts) {
    this.opts = {
      maxSlipDistance:       0.6,
      balanceShockThreshold: 1.4,
      balanceRecoverPerSec:  0.4,
      onStagger:             undefined,
      ...opts,
    };
  }

  addRider(init: DeckRiderInit): void {
    const r: RiderState = {
      init,
      worldPos:     new THREE.Vector3(),
      worldVel:     new THREE.Vector3(),
      appliedRoll:  0,
      appliedPitch: 0,
      balance:      1,
      staggering:   false,
    };
    // Seed at anchor in case host hasn't placed the rider yet.
    this.opts.deck.localToWorld(r.worldPos.copy(init.localAnchor));
    init.rider.position.copy(r.worldPos);
    this.riders.set(init.id, r);
  }

  removeRider(id: string): void {
    this.riders.delete(id);
  }

  setGrip(id: string, grip: number): void {
    const r = this.riders.get(id); if (!r) return;
    r.init.grip = grip;
  }

  /** Force-stagger a rider (e.g. a cannonball hits nearby). */
  shockRider(id: string, shock: number): void {
    const r = this.riders.get(id); if (!r) return;
    r.balance = Math.max(0, r.balance - shock);
    if (r.balance === 0 && !r.staggering) {
      r.staggering = true;
      this.opts.onStagger?.({ riderId: id, shock });
    }
  }

  isStaggering(id: string): boolean {
    return this.riders.get(id)?.staggering ?? false;
  }

  /** Drive every rider one step. Call after the ship has been moved. */
  update(delta: number): void {
    if (delta <= 0) return;
    const deck = this.opts.deck;
    deck.updateMatrixWorld(true);
    const deckPos = this._v0.setFromMatrixPosition(deck.matrixWorld);
    const deckQuat = this._q0.setFromRotationMatrix(deck.matrixWorld);

    if (!this.initialised) {
      this.prevDeckPos.copy(deckPos);
      this.prevDeckQuat.copy(deckQuat);
      this.initialised = true;
    }

    // Linear kinematics.
    const deckVel = this._v1.copy(deckPos).sub(this.prevDeckPos).divideScalar(delta);
    this.deckAccel.copy(deckVel).sub(this.prevDeckVel).divideScalar(delta);
    this.prevDeckVel.copy(deckVel);
    this.prevDeckPos.copy(deckPos);

    // Angular velocity (axis-angle of the delta quaternion).
    const dq = this.prevDeckQuat.invert().multiply(deckQuat); // mutates prevDeckQuat
    const angle = 2 * Math.acos(Math.min(1, Math.abs(dq.w)));
    const sinHalf = Math.sqrt(Math.max(0, 1 - dq.w * dq.w));
    if (sinHalf > 1e-4) {
      this.deckAngVel.set(dq.x, dq.y, dq.z).multiplyScalar(angle / sinHalf / delta);
    } else {
      this.deckAngVel.set(0, 0, 0);
    }
    this.prevDeckQuat.copy(deckQuat); // restore

    // Deck euler for tilt inheritance.
    this._e0.setFromQuaternion(deckQuat, 'YXZ');
    const deckRoll  = this._e0.x; // pitch around X (bow up/down)
    const deckPitch = this._e0.z; // roll around Z (port/starboard)

    const slipScratch = new THREE.Vector3();
    const targetScratch = new THREE.Vector3();
    const angShock = this.deckAngVel.length();

    for (const r of this.riders.values()) {
      const grip = r.init.grip ?? 0.85;
      const tiltFollow = r.init.tiltFollow ?? 0.65;

      // Target position from local anchor.
      targetScratch.copy(r.init.localAnchor);
      deck.localToWorld(targetScratch);

      // Slip: opposite to deck acceleration, scaled by (1 - grip) and delta.
      slipScratch.copy(this.deckAccel).multiplyScalar(-(1 - grip) * delta * delta);
      targetScratch.add(slipScratch);

      // Critically-damped position spring (omega tuned for "snappy but not jittery").
      const omega = 12;
      const k = 1 - Math.exp(-omega * delta);
      r.worldPos.lerp(targetScratch, k);

      // Clamp drift: if rider strays too far from raw anchor, snap.
      const anchorWorld = this._v1.copy(r.init.localAnchor);
      deck.localToWorld(anchorWorld);
      const drift = r.worldPos.distanceTo(anchorWorld);
      if (drift > this.opts.maxSlipDistance) {
        r.worldPos.copy(anchorWorld);
      }
      r.worldVel.copy(this.deckAccel); // approx; good enough for SFX gating

      // Tilt — lerp toward deck euler scaled by tiltFollow.
      const tk = 1 - Math.exp(-6 * delta);
      r.appliedRoll  += (deckRoll  * tiltFollow - r.appliedRoll)  * tk;
      r.appliedPitch += (deckPitch * tiltFollow - r.appliedPitch) * tk;

      // Apply transform.
      r.init.rider.position.copy(r.worldPos);
      r.init.rider.rotation.set(r.appliedRoll, r.init.rider.rotation.y, r.appliedPitch);

      // Balance budget.
      if (angShock > this.opts.balanceShockThreshold) {
        r.balance = Math.max(0, r.balance - (angShock - this.opts.balanceShockThreshold) * delta * 0.8);
        if (r.balance === 0 && !r.staggering) {
          r.staggering = true;
          this.opts.onStagger?.({ riderId: r.init.id, shock: angShock });
        }
      } else {
        r.balance = Math.min(1, r.balance + this.opts.balanceRecoverPerSec * delta);
        if (r.balance > 0.5 && r.staggering) r.staggering = false;
      }
    }
  }

  dispose(): void {
    this.riders.clear();
    this.initialised = false;
  }
}
