/**
 * CharacterFSM — Sketchbook-inspired finite state machine for character animation.
 *
 * Reference: https://github.com/swift502/Sketchbook
 *
 * Architecture:
 *  - Each state class encapsulates the animation transitions for that state.
 *  - The FSM owns an AnimationSystem and transitions between states cleanly.
 *  - States call this.fsm.anim to trigger cross-fades.
 *  - External code calls fsm.setState('walk') etc.; the FSM handles
 *    exit/enter lifecycles.
 *
 * Difference from Sketchbook: we use a flat string-keyed map rather than
 * class instances per concrete state type, keeping it lightweight for this game.
 */
import { AnimationSystem, AnimName } from './AnimationSystem';

// ── State names ───────────────────────────────────────────────────────────────
export type FSMStateName =
  | 'idle'
  | 'walk'
  | 'run'
  | 'sprint'         // Pass 1: shift-hold sprint
  | 'attack'
  | 'attack_heavy'
  | 'shoot'
  | 'ranged_attack'
  | 'rifle_idle'
  | 'dodge'
  | 'dash'           // Pass 1: directional dash with iframes
  | 'block'          // Pass 1: hold-to-block (incoming dmg reduced)
  | 'stun'           // Pass 1: input-gated; set externally by hits/freezes
  | 'hit'
  | 'death'
  | 'phase_out'
  | 'phase_in'
  | 'jump'
  | 'fall';

// ── Abstract state ────────────────────────────────────────────────────────────
abstract class CharacterState {
  protected fsm: CharacterFSM;
  abstract readonly name: FSMStateName;

  constructor(fsm: CharacterFSM) { this.fsm = fsm; }

  abstract enter(prev: CharacterState | null): void;
  abstract exit(next: CharacterState): void;
  /** Called every frame while in this state. Return true to keep state. */
  update(_dt: number): boolean { return true; }
}

// ── Concrete states ────────────────────────────────────────────────────────────

class IdleState extends CharacterState {
  readonly name: FSMStateName = 'idle';

  enter(prev: CharacterState | null) {
    const anim = this.fsm.anim;
    const from = prev?.name ?? 'idle';
    if (from === 'walk' || from === 'run') {
      anim.crossFadeSync(from, 'idle', 0.25);
    } else if (from === 'attack' || from === 'attack_heavy' || from === 'hit' || from === 'dodge') {
      anim.crossFade(from, 'idle', 0.2);
    } else if (from === 'phase_in' || from === 'phase_out') {
      anim.crossFade(from, 'idle', 0.3);
    } else {
      anim.to('idle', 0.3);
    }
  }
  exit(_next: CharacterState) {}
}

class WalkState extends CharacterState {
  readonly name: FSMStateName = 'walk';

  enter(prev: CharacterState | null) {
    const from = prev?.name ?? 'idle';
    if (from === 'idle' || from === 'run') {
      this.fsm.anim.crossFadeSync(from, 'walk', 0.2);
    } else {
      this.fsm.anim.crossFade(from, 'walk', 0.2);
    }
  }
  exit(_next: CharacterState) {}
}

class RunState extends CharacterState {
  readonly name: FSMStateName = 'run';

  enter(prev: CharacterState | null) {
    const from = prev?.name ?? 'walk';
    // Run and walk have the same cycle; sync the phase
    this.fsm.anim.crossFadeSync(from, this.fsm.anim.has('run') ? 'run' : 'walk', 0.2);
  }
  exit(_next: CharacterState) {}
}

class RifleIdleState extends CharacterState {
  readonly name: FSMStateName = 'rifle_idle';

  enter(prev: CharacterState | null) {
    this.fsm.anim.crossFade(prev?.name ?? 'idle', 'rifle_idle', 0.25);
  }
  exit(_next: CharacterState) {}
}

class AttackState extends CharacterState {
  readonly name: FSMStateName = 'attack';

  enter(prev: CharacterState | null) {
    const from = prev?.name ?? 'idle';
    this.fsm.anim.crossFade(from, 'attack', 0.05, false);
  }
  exit(_next: CharacterState) {}
}

class AttackHeavyState extends CharacterState {
  readonly name: FSMStateName = 'attack_heavy';

  enter(prev: CharacterState | null) {
    const anim = this.fsm.anim;
    const clipName = anim.has('attack_heavy') ? 'attack_heavy' : 'attack';
    anim.crossFade(prev?.name ?? 'idle', clipName, 0.05);
  }
  exit(_next: CharacterState) {}
}

class ShootState extends CharacterState {
  readonly name: FSMStateName = 'shoot';

  enter(prev: CharacterState | null) {
    const anim = this.fsm.anim;
    const clip = anim.has('shoot') ? 'shoot' : anim.has('ranged_attack') ? 'ranged_attack' : 'attack';
    anim.crossFade(prev?.name ?? 'rifle_idle', clip, 0.06);
  }
  exit(_next: CharacterState) {}
}

class RangedAttackState extends CharacterState {
  readonly name: FSMStateName = 'ranged_attack';

  enter(prev: CharacterState | null) {
    const anim = this.fsm.anim;
    const clip = anim.has('ranged_attack') ? 'ranged_attack' : 'attack';
    anim.crossFade(prev?.name ?? 'idle', clip, 0.08);
  }
  exit(_next: CharacterState) {}
}

class DodgeState extends CharacterState {
  readonly name: FSMStateName = 'dodge';

  enter(prev: CharacterState | null) {
    this.fsm.anim.crossFade(prev?.name ?? 'idle', 'dodge', 0.05);
  }
  exit(_next: CharacterState) {}
}

class HitState extends CharacterState {
  readonly name: FSMStateName = 'hit';

  enter(prev: CharacterState | null) {
    this.fsm.anim.crossFade(prev?.name ?? 'idle', 'hit', 0.04, true);
  }
  exit(_next: CharacterState) {}
}

class DeathState extends CharacterState {
  readonly name: FSMStateName = 'death';

  enter(prev: CharacterState | null) {
    this.fsm.anim.crossFade(prev?.name ?? 'idle', 'death', 0.15);
  }
  exit(_next: CharacterState) {}
}

class PhaseOutState extends CharacterState {
  readonly name: FSMStateName = 'phase_out';

  enter(prev: CharacterState | null) {
    const anim = this.fsm.anim;
    const clip = anim.has('phase_out') ? 'phase_out' : 'dodge';
    anim.crossFade(prev?.name ?? 'idle', clip, 0.04);
  }
  exit(_next: CharacterState) {}
}

class PhaseInState extends CharacterState {
  readonly name: FSMStateName = 'phase_in';

  enter(prev: CharacterState | null) {
    const anim = this.fsm.anim;
    const clip = anim.has('phase_in') ? 'phase_in' : 'idle';
    anim.crossFade(prev?.name ?? 'phase_out', clip, 0.04);
  }
  exit(_next: CharacterState) {}
}

class JumpState extends CharacterState {
  readonly name: FSMStateName = 'jump';

  enter(prev: CharacterState | null) {
    const anim = this.fsm.anim;
    const clip = anim.has('jump') ? 'jump' : 'dodge';
    anim.crossFade(prev?.name ?? 'idle', clip, 0.05);
  }
  exit(_next: CharacterState) {}
}

class FallState extends CharacterState {
  readonly name: FSMStateName = 'fall';

  enter(prev: CharacterState | null) {
    const anim = this.fsm.anim;
    const clip = anim.has('fall') ? 'fall' : 'idle';
    anim.crossFade(prev?.name ?? 'jump', clip, 0.15);
  }
  exit(_next: CharacterState) {}
}

class SprintState extends CharacterState {
  readonly name: FSMStateName = 'sprint';

  enter(prev: CharacterState | null) {
    const anim = this.fsm.anim;
    const from = prev?.name ?? 'run';
    const clip = anim.has('sprint') ? 'sprint' : 'run';
    if (from === 'run' || from === 'walk' || from === 'idle') {
      anim.crossFadeSync(from, clip, 0.15);
    } else {
      anim.crossFade(from, clip, 0.2);
    }
  }
  exit(_next: CharacterState) {}
}

class DashState extends CharacterState {
  readonly name: FSMStateName = 'dash';

  enter(prev: CharacterState | null) {
    const anim = this.fsm.anim;
    const clip = anim.has('dash') ? 'dash' : anim.has('dodge') ? 'dodge' : 'run';
    anim.crossFade(prev?.name ?? 'idle', clip, 0.04);
  }
  exit(_next: CharacterState) {}
}

class BlockState extends CharacterState {
  readonly name: FSMStateName = 'block';

  enter(prev: CharacterState | null) {
    const anim = this.fsm.anim;
    const clip = anim.has('block') ? 'block' : 'idle';
    anim.crossFade(prev?.name ?? 'idle', clip, 0.12);
  }
  exit(_next: CharacterState) {}
}

class StunState extends CharacterState {
  readonly name: FSMStateName = 'stun';

  enter(prev: CharacterState | null) {
    const anim = this.fsm.anim;
    const clip = anim.has('stun') ? 'stun' : anim.has('hit') ? 'hit' : 'idle';
    anim.crossFade(prev?.name ?? 'idle', clip, 0.08, true);
  }
  exit(_next: CharacterState) {}
}

// ── Factory ────────────────────────────────────────────────────────────────────
function makeState(fsm: CharacterFSM, name: FSMStateName): CharacterState {
  switch (name) {
    case 'idle':          return new IdleState(fsm);
    case 'walk':          return new WalkState(fsm);
    case 'run':           return new RunState(fsm);
    case 'sprint':        return new SprintState(fsm);
    case 'rifle_idle':    return new RifleIdleState(fsm);
    case 'attack':        return new AttackState(fsm);
    case 'attack_heavy':  return new AttackHeavyState(fsm);
    case 'shoot':         return new ShootState(fsm);
    case 'ranged_attack': return new RangedAttackState(fsm);
    case 'dodge':         return new DodgeState(fsm);
    case 'dash':          return new DashState(fsm);
    case 'block':         return new BlockState(fsm);
    case 'stun':          return new StunState(fsm);
    case 'hit':           return new HitState(fsm);
    case 'death':         return new DeathState(fsm);
    case 'phase_out':     return new PhaseOutState(fsm);
    case 'phase_in':      return new PhaseInState(fsm);
    case 'jump':          return new JumpState(fsm);
    case 'fall':          return new FallState(fsm);
  }
}

// ── CharacterFSM ──────────────────────────────────────────────────────────────
export class CharacterFSM {
  readonly anim: AnimationSystem;
  private current: CharacterState | null = null;
  private stateCache = new Map<FSMStateName, CharacterState>();

  /** States that cannot be interrupted by regular transitions */
  private readonly noInterrupt: FSMStateName[] = ['death'];

  constructor(anim: AnimationSystem) {
    this.anim = anim;
    // Start idle
    const idle = this._getOrMake('idle');
    idle.enter(null);
    this.current = idle;
  }

  private _getOrMake(name: FSMStateName): CharacterState {
    if (!this.stateCache.has(name)) this.stateCache.set(name, makeState(this, name));
    return this.stateCache.get(name)!;
  }

  setState(name: FSMStateName) {
    if (!this.current) { this._enter(name); return; }
    if (this.current.name === name) return;
    // Don't interrupt death
    if (this.noInterrupt.includes(this.current.name)) return;
    this._enter(name);
  }

  /** Force-set state, bypassing no-interrupt rules (for death, respawn, etc.) */
  forceState(name: FSMStateName) {
    this._enter(name);
  }

  private _enter(name: FSMStateName) {
    const next = this._getOrMake(name);
    if (this.current) this.current.exit(next);
    const prev = this.current;
    this.current = next;
    next.enter(prev);
  }

  update(dt: number) {
    this.current?.update(dt);
  }

  get state(): FSMStateName { return this.current?.name ?? 'idle'; }

  isIn(...names: FSMStateName[]): boolean {
    return names.includes(this.current?.name ?? 'idle');
  }
}
