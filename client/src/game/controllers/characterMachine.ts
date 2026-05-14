import { setup, assign, type ActorRefFrom, type SnapshotFrom, type StateValue } from "xstate";

/**
 * Top-level character state machine with four parallel regions:
 *   - locomotion: grounded.{idle, walk, run, sprint} | airborne.{jumping, falling, landing}
 *   - combat:     idle | attacking.{light1, light2, heavy, combo} | blocking | ability
 *   - posture:    standing | crouching | prone
 *   - overrides:  none | hit | death | pickup | victory
 *
 * Combat and locomotion run independently — that's why combat one-shots
 * (punch / uppercut / hit) layer on top of locomotion via bone masking.
 *
 * The machine is "layered" relative to the existing combatMachine.ts: this
 * file does NOT replace it. It runs alongside as the high-level animation
 * state-of-truth that the new CharacterAnimator listens to. Existing code
 * that still consumes combatMachine for combo / cooldown bookkeeping
 * continues to work; we just route animation choices through here.
 */
export interface CharacterContext {
  speed: number;
  isGrounded: boolean;
  wantsSprint: boolean;
  wantsCrouch: boolean;
  health: number;
  /**
   * Latched climb context. Populated on MOUNT_CLIMB so the climbing region
   * (and downstream consumers like useCharacterController) can pick the
   * right animation slot without re-querying the sensor singleton.
   */
  climbKind: "wall" | "ladder" | null;
  climbVertical: number;
  climbLateral: number;
  /**
   * Current fatigue level pushed from FatigueSystem. When "exhausted",
   * the sprint transition is blocked and heavy attacks are gated.
   */
  fatigueLevel: "rested" | "normal" | "tired" | "exhausted";
}

export type CharacterEvent =
  // Continuous parameters (sent every frame from the controller)
  | { type: "SET_SPEED"; value: number }
  | { type: "SET_GROUNDED"; value: boolean }
  | { type: "SET_WANTS_SPRINT"; value: boolean }
  | { type: "SET_FATIGUE"; value: "rested" | "normal" | "tired" | "exhausted" }
  // Discrete locomotion events
  | { type: "JUMP" }
  | { type: "FALL" }
  | { type: "LAND" }
  // Climbing locomotion (parallel sub-region within `locomotion`)
  // - MOUNT_CLIMB: enter the climbing region from grounded/airborne with
  //   the kind of surface we just snapped to (wall vs ladder).
  // - DISMOUNT_CLIMB: leave climbing back to airborne (drop off / jump
  //   off) — the controller's existing JUMP/FALL pipeline takes over.
  // - TOPOUT: pull-up over the top edge into grounded.
  // - CLIMB_VEL: continuous "are we currently moving" parameter so the
  //   climbing region can swap between climb_idle and climb / shimmy.
  | { type: "MOUNT_CLIMB"; kind: "wall" | "ladder" }
  | { type: "DISMOUNT_CLIMB" }
  | { type: "TOPOUT" }
  | { type: "CLIMB_VEL"; vertical: number; lateral: number }
  // Combat
  | { type: "ATTACK_LIGHT" }
  | { type: "ATTACK_HEAVY" }
  | { type: "ATTACK_COMBO_NEXT" }
  | { type: "ATTACK_DONE" }
  | { type: "BLOCK_START" }
  | { type: "BLOCK_END" }
  | { type: "ABILITY"; id: string }
  // Posture
  | { type: "CROUCH_START" }
  | { type: "CROUCH_END" }
  | { type: "PRONE_START" }
  | { type: "PRONE_END" }
  // Swimming
  | { type: "ENTER_WATER" }
  | { type: "EXIT_WATER" }
  | { type: "DIVE" }
  | { type: "SURFACE" }
  | { type: "DROWN" }
  | { type: "SWIM_MOVE"; speed: number }
  // Overrides
  | { type: "HIT" }
  | { type: "HIT_DONE" }
  | { type: "DEATH" }
  | { type: "REVIVE" }
  | { type: "PICKUP" }
  | { type: "VICTORY" }
  | { type: "OVERRIDE_DONE" };

// Speed thresholds shared with MovementController. Kept in sync there.
const WALK_THRESHOLD = 0.05;   // > this counts as walking
const RUN_THRESHOLD  = 1.6;    // > this counts as running
const SPRINT_THRESHOLD = 5.0;  // > this counts as sprinting

// Climbing motion thresholds. Below these magnitudes we treat the player
// as "holding still on the wall" → climb_idle. Vertical input dominates
// the choice between climb (up/down) and climb_shimmy (sideways).
const CLIMB_MOTION_EPS = 0.05;

export const characterMachine = setup({
  types: {
    context: {} as CharacterContext,
    events: {} as CharacterEvent,
  },
  guards: {
    // SET_SPEED guards must inspect the *incoming* event payload, not the
    // current context — XState evaluates guards before the assign() that
    // updates context, so reading context.speed here would always lag a
    // tick behind and produce missed transitions.
    //
    // Each substate wants different downgrade thresholds (e.g. `run` should
    // only fall back to `walk` when speed actually drops *below* the run
    // threshold), so we expose both "above-X" and "below-X" guards and let
    // each transition pick the right band.
    /** Sprint is blocked when fatigueLevel is "exhausted". */
    speedAboveSprint: ({ event, context }) =>
      event.type === "SET_SPEED" &&
      event.value > SPRINT_THRESHOLD &&
      context.fatigueLevel !== "exhausted",
    speedAboveRun: ({ event }) =>
      event.type === "SET_SPEED" && event.value > RUN_THRESHOLD,
    speedAboveWalk: ({ event }) =>
      event.type === "SET_SPEED" && event.value > WALK_THRESHOLD,
    speedAboveWalkBelowRun: ({ event }) =>
      event.type === "SET_SPEED" &&
      event.value > WALK_THRESHOLD && event.value <= RUN_THRESHOLD,
    speedAboveRunBelowSprint: ({ event }) =>
      event.type === "SET_SPEED" &&
      event.value > RUN_THRESHOLD && event.value <= SPRINT_THRESHOLD,
    speedIsStill: ({ event }) =>
      event.type === "SET_SPEED" && event.value <= WALK_THRESHOLD,
    // Climbing motion guards. CLIMB_VEL carries a vertical (up/down) and
    // a lateral (shimmy) component; we route to whichever has the larger
    // absolute value, falling through to climb_idle if both are tiny.
    climbVerticalDominant: ({ event }) =>
      event.type === "CLIMB_VEL" &&
      Math.abs(event.vertical) > CLIMB_MOTION_EPS &&
      Math.abs(event.vertical) >= Math.abs(event.lateral),
    climbLateralDominant: ({ event }) =>
      event.type === "CLIMB_VEL" &&
      Math.abs(event.lateral) > CLIMB_MOTION_EPS &&
      Math.abs(event.lateral) > Math.abs(event.vertical),
    climbStill: ({ event }) =>
      event.type === "CLIMB_VEL" &&
      Math.abs(event.vertical) <= CLIMB_MOTION_EPS &&
      Math.abs(event.lateral) <= CLIMB_MOTION_EPS,
    // Swimming guards
    swimMoving: ({ event }) =>
      event.type === "SWIM_MOVE" && event.speed > 0.3,
    swimStopped: ({ event }) =>
      event.type === "SWIM_MOVE" && event.speed <= 0.3,
  },
  actions: {
    storeSpeed: assign({
      speed: ({ event, context }) =>
        event.type === "SET_SPEED" ? event.value : context.speed,
    }),
    storeGrounded: assign({
      isGrounded: ({ event, context }) =>
        event.type === "SET_GROUNDED" ? event.value : context.isGrounded,
    }),
    storeWantsSprint: assign({
      wantsSprint: ({ event, context }) =>
        event.type === "SET_WANTS_SPRINT" ? event.value : context.wantsSprint,
    }),
    storeClimbKind: assign({
      climbKind: ({ event, context }) =>
        event.type === "MOUNT_CLIMB" ? event.kind : context.climbKind,
    }),
    clearClimbKind: assign({
      climbKind: null,
      climbVertical: 0,
      climbLateral: 0,
    }),
    storeClimbVel: assign({
      climbVertical: ({ event, context }) =>
        event.type === "CLIMB_VEL" ? event.vertical : context.climbVertical,
      climbLateral: ({ event, context }) =>
        event.type === "CLIMB_VEL" ? event.lateral : context.climbLateral,
    }),
    storeFatigue: assign({
      fatigueLevel: ({ event, context }) =>
        event.type === "SET_FATIGUE" ? event.value : context.fatigueLevel,
    }),
  },
}).createMachine({
  id: "character",
  type: "parallel",
  context: {
    speed: 0,
    isGrounded: true,
    wantsSprint: false,
    wantsCrouch: false,
    health: 100,
    climbKind: null,
    climbVertical: 0,
    climbLateral: 0,
    fatigueLevel: "normal" as const,
  },
  on: {
    SET_SPEED: { actions: "storeSpeed" },
    SET_GROUNDED: { actions: "storeGrounded" },
    SET_WANTS_SPRINT: { actions: "storeWantsSprint" },
    SET_FATIGUE: { actions: "storeFatigue" },
  },
  states: {
    locomotion: {
      initial: "grounded",
      states: {
        grounded: {
          initial: "idle",
          // JUMP/FALL are handled at the locomotion-parent level (below) so
          // they target sibling airborne.* states cleanly without each grounded
          // child having to re-declare the transition.
          states: {
            idle: {
              on: {
                SET_SPEED: [
                  { guard: "speedAboveSprint", target: "sprint", actions: "storeSpeed" },
                  { guard: "speedAboveRun", target: "run", actions: "storeSpeed" },
                  { guard: "speedAboveWalk", target: "walk", actions: "storeSpeed" },
                  { actions: "storeSpeed" },
                ],
              },
            },
            walk: {
              on: {
                SET_SPEED: [
                  { guard: "speedAboveSprint", target: "sprint", actions: "storeSpeed" },
                  { guard: "speedAboveRun", target: "run", actions: "storeSpeed" },
                  { guard: "speedIsStill", target: "idle", actions: "storeSpeed" },
                  { actions: "storeSpeed" },
                ],
              },
            },
            run: {
              on: {
                // Stay in run while RUN_THRESHOLD < speed <= SPRINT_THRESHOLD.
                // Order matters: sprint upgrade first, then explicit downgrades
                // (walk band, idle), then a fall-through that just stores the
                // value without changing state.
                SET_SPEED: [
                  { guard: "speedAboveSprint", target: "sprint", actions: "storeSpeed" },
                  { guard: "speedAboveWalkBelowRun", target: "walk", actions: "storeSpeed" },
                  { guard: "speedIsStill", target: "idle", actions: "storeSpeed" },
                  { actions: "storeSpeed" },
                ],
              },
            },
            sprint: {
              on: {
                // Stay in sprint while speed > SPRINT_THRESHOLD; downgrade only
                // when the value drops into a strictly lower band so sprint
                // doesn't immediately collapse to run on its own threshold.
                SET_SPEED: [
                  { guard: "speedAboveRunBelowSprint", target: "run", actions: "storeSpeed" },
                  { guard: "speedAboveWalkBelowRun", target: "walk", actions: "storeSpeed" },
                  { guard: "speedIsStill", target: "idle", actions: "storeSpeed" },
                  { actions: "storeSpeed" },
                ],
              },
            },
          },
        },
        airborne: {
          initial: "jumping",
          on: { LAND: "grounded.idle" },
          states: {
            jumping: {
              on: {
                FALL: "falling",
                LAND: "landing",
              },
            },
            falling: { on: { LAND: "landing" } },
            landing: {
              after: { 200: "#character.locomotion.grounded.idle" },
            },
          },
        },
        // The new climbing region. mounting → idle/vertical/shimmy on
        // CLIMB_VEL, topout → grounded.idle, dropoff → airborne.falling.
        // Sub-states map directly to the climb_* animation clips wired
        // up in useCharacterController.
        climbing: {
          initial: "mounting",
          on: {
            DISMOUNT_CLIMB: {
              target: "airborne.falling",
              actions: "clearClimbKind",
            },
            TOPOUT: {
              target: ".topout",
            },
          },
          exit: "clearClimbKind",
          states: {
            // Brief one-shot so the character grabs the wall before any
            // motion is applied. OVERRIDE_DONE on the climb_start clip
            // (emitted by useCharacterController) advances to climb_idle.
            mounting: {
              on: {
                OVERRIDE_DONE: "idle",
                CLIMB_VEL: [
                  { guard: "climbVerticalDominant", target: "vertical", actions: "storeClimbVel" },
                  { guard: "climbLateralDominant", target: "shimmy", actions: "storeClimbVel" },
                  { actions: "storeClimbVel" },
                ],
              },
            },
            idle: {
              on: {
                CLIMB_VEL: [
                  { guard: "climbVerticalDominant", target: "vertical", actions: "storeClimbVel" },
                  { guard: "climbLateralDominant", target: "shimmy", actions: "storeClimbVel" },
                  { actions: "storeClimbVel" },
                ],
              },
            },
            vertical: {
              on: {
                CLIMB_VEL: [
                  { guard: "climbStill", target: "idle", actions: "storeClimbVel" },
                  { guard: "climbLateralDominant", target: "shimmy", actions: "storeClimbVel" },
                  { actions: "storeClimbVel" },
                ],
              },
            },
            shimmy: {
              on: {
                CLIMB_VEL: [
                  { guard: "climbStill", target: "idle", actions: "storeClimbVel" },
                  { guard: "climbVerticalDominant", target: "vertical", actions: "storeClimbVel" },
                  { actions: "storeClimbVel" },
                ],
              },
            },
            topout: {
              // Climb_topout one-shot. When the override clip ends the
              // controller sends OVERRIDE_DONE → grounded.idle.
              on: {
                OVERRIDE_DONE: "#character.locomotion.grounded.idle",
              },
            },
            // Drop-off: a short release pose before falling resumes.
            dropoff: {
              after: { 150: "#character.locomotion.airborne.falling" },
            },
          },
        },
      },
      on: {
        JUMP: ".airborne.jumping",
        FALL: ".airborne.falling",
        // Climbing is a sibling of grounded/airborne. The MOUNT_CLIMB event
        // can fire from anywhere within locomotion (running off a ledge
        // into a wall, jumping into a ladder, etc.) so we host it at the
        // parent level and stash the surface kind on context.
        MOUNT_CLIMB: {
          target: ".climbing.mounting",
          actions: "storeClimbKind",
        },
      },
    },

    combat: {
      initial: "idle",
      states: {
        idle: {
          on: {
            ATTACK_LIGHT: "attacking.light1",
            ATTACK_HEAVY: "attacking.heavy",
            BLOCK_START: "blocking",
            ABILITY: "ability",
          },
        },
        attacking: {
          initial: "light1",
          on: { ATTACK_DONE: "idle" },
          states: {
            light1: {
              on: { ATTACK_COMBO_NEXT: "light2", ATTACK_HEAVY: "heavy" },
            },
            light2: {
              on: { ATTACK_COMBO_NEXT: "combo", ATTACK_HEAVY: "heavy" },
            },
            combo: { on: { ATTACK_HEAVY: "heavy" } },
            heavy: {},
          },
        },
        blocking: { on: { BLOCK_END: "idle", HIT: "idle" } },
        ability: { on: { ATTACK_DONE: "idle" } },
      },
    },

    posture: {
      initial: "standing",
      states: {
        standing: {
          on: {
            CROUCH_START: "crouching",
            PRONE_START: "prone",
          },
        },
        crouching: { on: { CROUCH_END: "standing", PRONE_START: "prone" } },
        prone: { on: { PRONE_END: "crouching", CROUCH_END: "standing" } },
      },
    },

    overrides: {
      initial: "none",
      states: {
        none: {
          on: {
            HIT: "hit",
            DEATH: "death",
            PICKUP: "pickup",
            VICTORY: "victory",
          },
        },
        hit: { on: { HIT_DONE: "none", OVERRIDE_DONE: "none", DEATH: "death" } },
        death: { on: { REVIVE: "none" } },
        pickup: { on: { OVERRIDE_DONE: "none", HIT: "hit" } },
        victory: { on: { OVERRIDE_DONE: "none" } },
      },
    },

    /**
     * Swimming — parallel region tracking water state independently of
     * locomotion. Locomotion continues to run (grounded/airborne) for the
     * blend tree; this region controls swim-specific animation overrides
     * and drowning logic.
     */
    swimming: {
      initial: "dry",
      states: {
        dry: {
          on: { ENTER_WATER: "surface_idle" },
        },
        surface_idle: {
          on: {
            EXIT_WATER: "dry",
            DIVE: "diving",
            DROWN: "drowning",
            SWIM_MOVE: [
              { guard: "swimMoving", target: "surface_swim" },
            ],
          },
        },
        surface_swim: {
          on: {
            EXIT_WATER: "dry",
            DIVE: "diving",
            DROWN: "drowning",
            SWIM_MOVE: [
              { guard: "swimStopped", target: "surface_idle" },
            ],
          },
        },
        diving: {
          on: {
            EXIT_WATER: "dry",
            SURFACE: "ascending",
            DROWN: "drowning",
          },
        },
        ascending: {
          on: {
            EXIT_WATER: "dry",
            DIVE: "diving",
            SWIM_MOVE: [
              { guard: "swimStopped", target: "surface_idle" },
              { target: "surface_swim" },
            ],
          },
        },
        treading: {
          on: {
            EXIT_WATER: "dry",
            DIVE: "diving",
            SURFACE: "ascending",
            DROWN: "drowning",
            SWIM_MOVE: [
              { guard: "swimMoving", target: "surface_swim" },
            ],
          },
        },
        drowning: {
          on: {
            EXIT_WATER: "dry",
            // Can be rescued if stamina recovers (e.g. potion)
            SURFACE: "ascending",
          },
        },
      },
    },
  },
});

export type CharacterActor = ActorRefFrom<typeof characterMachine>;
export type CharacterSnapshot = SnapshotFrom<typeof characterMachine>;

/** Locomotion sub-state extracted from the parallel snapshot. */
export type LocomotionState = "idle" | "walk" | "run" | "sprint" | "jumping" | "falling" | "landing";

/** Climbing sub-region leaf — null when not in the climbing region. */
export type ClimbingState =
  | "mounting"
  | "idle"
  | "vertical"
  | "shimmy"
  | "topout"
  | "dropoff"
  | null;

/**
 * Walk a (possibly nested) StateValue down to its left-most leaf string.
 * StateValue is `string | { [k: string]: StateValue }` (recursive), so the
 * loop terminates either at a string or at a node with no keys.
 */
function leafOf(value: StateValue): string | null {
  let current: StateValue = value;
  while (typeof current === "object") {
    const keys = Object.keys(current);
    if (keys.length === 0) return null;
    const next = current[keys[0]];
    if (next === undefined) return null;
    current = next;
  }
  return current;
}

export function getLocomotionState(value: StateValue): LocomotionState {
  if (typeof value !== "object") return "idle";
  const loco = value.locomotion;
  if (loco === undefined) return "idle";
  if (typeof loco === "string") return loco as LocomotionState;
  // Locomotion has nested grounded.{idle,...}, airborne.{jumping,...}, or
  // climbing.{mounting,idle,vertical,shimmy,topout,dropoff}.
  const grounded = loco.grounded;
  if (grounded !== undefined) {
    const leaf = leafOf(grounded);
    return (leaf as LocomotionState | null) ?? "idle";
  }
  const airborne = loco.airborne;
  if (airborne !== undefined) {
    const leaf = leafOf(airborne);
    return (leaf as LocomotionState | null) ?? "jumping";
  }
  // Climbing is reported as "idle" for the LocomotionState surface so
  // existing speed-driven blend trees don't try to play a walk loop while
  // we're on the wall. Use getClimbingState() for the true sub-leaf.
  if (loco.climbing !== undefined) return "idle";
  return "idle";
}

/**
 * Climbing-region leaf accessor. Returns null when the player is *not*
 * currently in the climbing region (i.e. the parallel locomotion region
 * resolved to grounded/airborne instead). Mirrors getLocomotionState.
 */
export function getClimbingState(value: StateValue): ClimbingState {
  if (typeof value !== "object") return null;
  const loco = value.locomotion;
  if (typeof loco !== "object") return null;
  const climbing = loco.climbing;
  if (climbing === undefined) return null;
  if (typeof climbing === "string") return climbing as ClimbingState;
  const leaf = leafOf(climbing);
  return (leaf as ClimbingState | null) ?? "mounting";
}

export type CombatState = "idle" | "light1" | "light2" | "combo" | "heavy" | "blocking" | "ability";
export function getCombatState(value: StateValue): CombatState {
  if (typeof value !== "object") return "idle";
  const c = value.combat;
  if (c === undefined) return "idle";
  if (typeof c === "string") return c as CombatState;
  const attacking = c.attacking;
  if (attacking !== undefined) {
    const leaf = leafOf(attacking);
    return (leaf as CombatState | null) ?? "light1";
  }
  const firstKey = Object.keys(c)[0];
  return (firstKey as CombatState | undefined) ?? "idle";
}

export type OverrideState = "none" | "hit" | "death" | "pickup" | "victory";
export function getOverrideState(value: StateValue): OverrideState {
  if (typeof value !== "object") return "none";
  const o = value.overrides;
  if (o === undefined) return "none";
  if (typeof o === "string") return o as OverrideState;
  const firstKey = Object.keys(o)[0];
  return (firstKey as OverrideState | undefined) ?? "none";
}

export type SwimmingState =
  | "dry"
  | "surface_idle"
  | "surface_swim"
  | "diving"
  | "ascending"
  | "treading"
  | "drowning";

export function getSwimmingState(value: StateValue): SwimmingState {
  if (typeof value !== "object") return "dry";
  const s = value.swimming;
  if (s === undefined) return "dry";
  if (typeof s === "string") return s as SwimmingState;
  const firstKey = Object.keys(s)[0];
  return (firstKey as SwimmingState | undefined) ?? "dry";
}
