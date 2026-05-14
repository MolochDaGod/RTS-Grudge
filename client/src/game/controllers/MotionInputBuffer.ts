/**
 * Fighting-game motion-input buffer (Annihilate / Street Fighter style).
 *
 * Lives next to MovementController.ts because conceptually it's another
 * pure-input → intent translator: WASD edge presses get fed in as direction
 * tokens and then a "punch"/"kick" follow-up press asks the buffer whether
 * the recent token sequence matches one of the canonical motions:
 *
 *   S → D      + J = Hadouken          (quarter-circle forward + punch)
 *   D → S → D  + J = Shoryuken         (DP / "Z" motion + punch)
 *   S → A      + K = Tatsumaki         (quarter-circle back + kick)
 *
 * Tokens decay after `DECAY_MS` of inactivity so half-finished motions don't
 * leak into the next attempt. The buffer itself does NOT know about the
 * combat state machine — the caller is expected to only feed it directions
 * (and only ask for `recognize()`) while the player is in the `blocking`
 * combat state, mirroring Annihilate's `RoleControls.js` block-gated parser.
 */

export type MotionDirection = "U" | "D" | "L" | "R";
export type MotionResult = "hadouken" | "shoryuken" | "tatsumaki";
export type MotionAction = "punch" | "kick";

interface Entry {
  dir: MotionDirection;
  /** `performance.now()` (ms) when this token was recorded. */
  t: number;
}

/**
 * Annihilate's RoleControls clears the seq buffer 150ms after the last
 * input. We mirror that gap rather than a fixed window so a player drumming
 * out the motion at speed always sees a clean slate going into the next
 * attempt, without forcing arcade-tight timings on individual transitions.
 */
const DEFAULT_DECAY_MS = 150;
const MAX_BUFFER = 8;

export class MotionInputBuffer {
  static DECAY_MS = DEFAULT_DECAY_MS;

  private entries: Entry[] = [];
  private readonly decayMs: number;

  constructor(decayMs: number = DEFAULT_DECAY_MS) {
    this.decayMs = decayMs;
  }

  /**
   * Record a directional edge press. Repeated identical directions just
   * refresh the timestamp on the trailing entry — repeatedly tapping `D`
   * shouldn't fill the buffer with `D, D, D, D`. Pruning runs on every
   * push so old tokens never linger.
   */
  pressDirection(dir: MotionDirection, now: number = performance.now()): void {
    this.prune(now);
    const last = this.entries[this.entries.length - 1];
    if (last && last.dir === dir) {
      last.t = now;
      return;
    }
    this.entries.push({ dir, t: now });
    if (this.entries.length > MAX_BUFFER) {
      this.entries.shift();
    }
  }

  /**
   * Ask whether the trailing tokens match a recognised motion for the given
   * action button. Returns the matched motion name (which the caller maps
   * to a combat-machine event) or null if no motion fits. Longer motions
   * are checked first so the more specific Shoryuken (D→S→D) wins over the
   * Hadouken (S→D) suffix it shares.
   */
  recognize(action: MotionAction, now: number = performance.now()): MotionResult | null {
    this.prune(now);
    // Direction tokens: U/D/L/R (up/down/left/right). The reference's WASD
    // letters (S/D/A) translate to D/R/L respectively. Hadouken's "S → D"
    // becomes "down → right", Shoryuken's "D → S → D" becomes
    // "right → down → right", Tatsumaki's "S → A" becomes "down → left".
    if (action === "punch") {
      if (this.endsWith(["R", "D", "R"])) return "shoryuken";
      if (this.endsWith(["D", "R"])) return "hadouken";
      return null;
    }
    // kick
    if (this.endsWith(["D", "L"])) return "tatsumaki";
    return null;
  }

  /** Drop everything. Called when the player exits the blocking state. */
  clear(): void {
    this.entries.length = 0;
  }

  /** Test/debug helper: peek at the current token sequence. */
  snapshot(now: number = performance.now()): MotionDirection[] {
    this.prune(now);
    return this.entries.map((e) => e.dir);
  }

  private prune(now: number): void {
    const cutoff = now - this.decayMs;
    while (this.entries.length > 0 && this.entries[0].t < cutoff) {
      this.entries.shift();
    }
  }

  private endsWith(pattern: MotionDirection[]): boolean {
    if (this.entries.length < pattern.length) return false;
    const offset = this.entries.length - pattern.length;
    for (let i = 0; i < pattern.length; i++) {
      if (this.entries[offset + i].dir !== pattern[i]) return false;
    }
    return true;
  }
}

/**
 * Map a `KeyboardEvent.code` to a motion direction token. Returns null for
 * any key the buffer doesn't care about. Centralised here so the wiring in
 * Player.tsx doesn't have to repeat the WASD ↔ U/D/L/R mapping.
 */
export function keyCodeToMotionDirection(code: string): MotionDirection | null {
  switch (code) {
    case "KeyW":
    case "ArrowUp":
      return "U";
    case "KeyS":
    case "ArrowDown":
      return "D";
    case "KeyA":
    case "ArrowLeft":
      return "L";
    case "KeyD":
    case "ArrowRight":
      return "R";
    default:
      return null;
  }
}

/** Resolve a `KeyboardEvent.code` to the punch/kick action, or null. */
export function keyCodeToMotionAction(code: string): MotionAction | null {
  if (code === "KeyJ") return "punch";
  if (code === "KeyK") return "kick";
  return null;
}

/** Map a recognised motion to the combat-machine event type it should fire. */
export function motionResultToCombatEvent(result: MotionResult): "KEY_1" | "KEY_2" | "KEY_3" {
  switch (result) {
    case "hadouken":
      return "KEY_1";
    case "shoryuken":
      return "KEY_2";
    case "tatsumaki":
      return "KEY_3";
  }
}
