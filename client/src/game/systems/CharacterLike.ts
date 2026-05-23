/**
 * CharacterLike — structural interface implemented by both ToonCharacter and
 * ModularCharacter so Player / Enemy are decoupled from the concrete type.
 */
import * as THREE from 'three';

export interface CharacterLike {
  /** The root Three.js group. Position / rotation applied here. */
  group: THREE.Group;

  /** Request an animation state via the FSM. */
  playAnimation(name: string, force?: boolean): void;

  /** Per-frame update (animation mixer, FSM, phase fx, etc.). */
  update(dt: number): void;

  /** Returns true when the named one-shot clip has passed the threshold. */
  isFinished(name: string): boolean;

  /** Current FSM state name. */
  readonly currentAnimation: string;

  /** False when running in procedural-fallback mode. */
  readonly hasRealModel: boolean;

  /** True when a single shared clip drives all states (eternal knight style). */
  readonly isSingleClipGltf: boolean;

  /** Switch between melee and ranged weapon visual modes. */
  setWeaponMode(mode: 'melee' | 'ranged'): void;

  /** Trigger the phase-blink dissolve-out visual. */
  startPhaseOut(): void;

  /** Trigger the phase-blink dissolve-in visual. */
  startPhaseIn(): void;
}
