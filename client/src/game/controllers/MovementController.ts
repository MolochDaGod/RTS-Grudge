import * as THREE from "three";

export interface MovementInput {
  forward: boolean;
  backward: boolean;
  left: boolean;
  right: boolean;
  sprint?: boolean;
}

export interface MovementResult {
  /** World-space normalized direction (XZ-plane) the character should move. */
  direction: THREE.Vector3;
  /** True when at least one direction key is held. */
  isMoving: boolean;
  /** Suggested locomotion bucket given a horizontal speed magnitude. */
  classify(speed: number, isGrounded: boolean): "idle" | "walk" | "run" | "sprint" | "jumping" | "falling";
}

/**
 * Pure-input → movement-intent translator. Decoupled from React so the same
 * code can drive Player.tsx (real keyboard) or NPCs (AI behavior). Holds
 * thresholds for walk/run/sprint that align with characterMachine guards.
 */
export class MovementController {
  static WALK_SPEED = 0.05;   // anything above this counts as walking
  static RUN_SPEED  = 1.6;    // anything above this counts as running
  static SPRINT_SPEED = 5.0;  // anything above this counts as sprinting

  private outDir = new THREE.Vector3();

  /**
   * Convert keyboard intent + camera yaw into a world-space movement vector.
   * Camera yaw rotates the local "forward" axis so pressing W moves into the
   * camera's forward direction regardless of player facing.
   */
  computeMoveDir(input: MovementInput, cameraYaw: number): MovementResult {
    const dir = this.outDir.set(0, 0, 0);
    if (input.forward)  dir.z -= 1;
    if (input.backward) dir.z += 1;
    if (input.left)     dir.x -= 1;
    if (input.right)    dir.x += 1;
    const isMoving = dir.lengthSq() > 0;

    if (isMoving) {
      const cy = Math.cos(cameraYaw);
      const sy = Math.sin(cameraYaw);
      const rx = dir.x * cy + dir.z * sy;
      const rz = -dir.x * sy + dir.z * cy;
      dir.set(rx, 0, rz).normalize();
    }

    const out: MovementResult = {
      direction: dir,
      isMoving,
      classify: (speed: number, isGrounded: boolean) => {
        if (!isGrounded) return speed > 0 ? "falling" : "jumping";
        if (speed > MovementController.SPRINT_SPEED) return "sprint";
        if (speed > MovementController.RUN_SPEED) return "run";
        if (speed > MovementController.WALK_SPEED) return "walk";
        return "idle";
      },
    };
    return out;
  }

  /** Convenience: build a face-towards-target heading angle (Y axis). */
  static facingFromDir(dir: THREE.Vector3): number {
    return Math.atan2(dir.x, dir.z);
  }
}
